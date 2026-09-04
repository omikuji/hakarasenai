// Exercises background.js against a stub of the WebExtension APIs, so the
// exclusion logic can be checked without a browser.
//
//   node --test test/unit.mjs

import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

// Values built inside the vm context carry that context's prototypes, so
// deepEqual would reject them on identity alone. Normalise before comparing.
const plain = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const deep = (actual, expected) => assert.deepEqual(plain(actual), expected);

function load() {
  const state = { storage: {}, rules: [], script: null, badges: {} };

  const browser = {
    storage: {
      local: {
        get: async (k) => (k in state.storage ? { [k]: state.storage[k] } : {}),
        set: async (o) => void Object.assign(state.storage, o),
      },
    },
    declarativeNetRequest: {
      updateDynamicRules: async (o) => void (state.rules = o.addRules ?? []),
    },
    scripting: {
      unregisterContentScripts: async () => {},
      registerContentScripts: async ([s]) => void (state.script = s),
    },
    action: {
      setBadgeText: async ({ tabId, text }) => void (state.badges[tabId] = text),
      setBadgeBackgroundColor: async () => {},
      setBadgeTextColor: async () => {},
    },
    tabs: {
      query: async () => [],
      get: async () => ({}),
      onUpdated: { addListener() {} },
      onActivated: { addListener() {} },
    },
    runtime: {
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} },
      onMessage: { addListener: (f) => void (state.send = f) },
    },
    permissions: { onAdded: { addListener() {} } },
  };

  vm.runInContext(
    readFileSync(new URL("../src/background.js", import.meta.url), "utf8"),
    vm.createContext({ browser, console, URL })
  );
  return state;
}

test("http(s) pages are in scope, anything else is not", async () => {
  const s = load();
  assert.equal((await s.send({ cmd: "get", url: "https://example.com/a" })).host, "example.com");
  assert.equal((await s.send({ cmd: "get", url: "http://example.com/a" })).host, "example.com");
  assert.equal((await s.send({ cmd: "get", url: "about:config" })).host, null);
  assert.equal((await s.send({ cmd: "get", url: "file:///tmp/x.html" })).host, null);
  assert.equal((await s.send({ cmd: "get", url: undefined })).host, null);
});

test("a leading www. is dropped so one entry covers the site", async () => {
  const s = load();
  assert.equal((await s.send({ cmd: "get", url: "https://www.Example.com/" })).host, "example.com");
});

test("nothing is excluded until you ask", async () => {
  const s = load();
  assert.equal((await s.send({ cmd: "get", url: "https://example.com/" })).excluded, false);
  deep(s.rules, []);
  assert.equal(s.script, null);
});

test("excluding a site writes both the allow rule and excludeMatches", async () => {
  const s = load();
  const r = await s.send({ cmd: "toggle", url: "https://example.com/page" });

  assert.equal(r.excluded, true);
  deep(s.storage.excluded, ["example.com"]);

  assert.equal(s.rules.length, 1);
  assert.equal(s.rules[0].action.type, "allow");
  deep(s.rules[0].condition.initiatorDomains, ["example.com"]);
  assert.ok(s.rules[0].priority > 1, "must outrank the static block rules");

  deep(s.script.excludeMatches, ["*://*.example.com/*"]);
});

test("an exclusion covers subdomains", async () => {
  const s = load();
  await s.send({ cmd: "toggle", url: "https://example.com/" });
  assert.equal((await s.send({ cmd: "get", url: "https://shop.example.com/" })).excluded, true);
  assert.equal((await s.send({ cmd: "get", url: "https://notexample.com/" })).excluded, false);
});

test("toggling back clears the rule and the exclusion", async () => {
  const s = load();
  await s.send({ cmd: "toggle", url: "https://example.com/" });
  const r = await s.send({ cmd: "toggle", url: "https://example.com/" });

  assert.equal(r.excluded, false);
  deep(s.storage.excluded, []);
  deep(s.rules, []);
  assert.equal(s.script.excludeMatches, undefined);
});

test("re-enabling from a subdomain lifts the whole exclusion", async () => {
  const s = load();
  await s.send({ cmd: "toggle", url: "https://example.com/" });
  await s.send({ cmd: "toggle", url: "https://shop.example.com/" });
  deep(s.storage.excluded, []);
});

test("optout.js is registered where and how it needs to be", async () => {
  const s = load();
  await s.send({ cmd: "toggle", url: "https://example.com/" });

  deep(s.script.js, ["src/optout.js"]);
  deep(s.script.matches, ["<all_urls>"]);
  assert.equal(s.script.world, "MAIN", "CSP-proof injection depends on this");
  assert.equal(s.script.runAt, "document_start", "must beat the site's own scripts");
  assert.equal(s.script.allFrames, true);
  assert.equal(s.script.persistAcrossSessions, true);
});
