// Keeps two things in sync with the list of excluded sites:
//   1) a dynamic declarativeNetRequest rule that lets those sites through
//   2) the registration of optout.js, with those sites in excludeMatches
// That is all this script does.

const STORAGE_KEY = "excluded";
const ALLOW_RULE_ID = 1000; // one dynamic rule, always this id
const SCRIPT_ID = "hakarasenai-optout";

// ---- the exclusion list ----------------------------------------------

async function getExcluded() {
  const got = await browser.storage.local.get(STORAGE_KEY);
  return Array.isArray(got[STORAGE_KEY]) ? got[STORAGE_KEY] : [];
}

// Excluding example.com also excludes www.example.com and friends. Dropping a
// leading "www." keeps that one rule easy to explain.
function normalize(hostname) {
  return hostname.replace(/^www\./, "").toLowerCase();
}

// Anything that is not an http(s) page (about:, moz-extension:, file: ...)
// is out of scope.
function hostOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return normalize(u.hostname);
  } catch (_) {
    return null;
  }
}

function isExcluded(host, list) {
  return list.some((h) => host === h || host.endsWith("." + h));
}

// ---- applying the list ------------------------------------------------

async function syncRules(list) {
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [ALLOW_RULE_ID],
    addRules: list.length
      ? [
          {
            id: ALLOW_RULE_ID,
            priority: 2, // beats the static block rules, which are priority 1
            action: { type: "allow" },
            condition: { initiatorDomains: list },
          },
        ]
      : [],
  });
}

async function syncScript(list) {
  const script = {
    id: SCRIPT_ID,
    js: ["src/optout.js"],
    matches: ["<all_urls>"],
    runAt: "document_start",
    allFrames: true,
    world: "MAIN",
    persistAcrossSessions: true,
  };
  if (list.length) script.excludeMatches = list.map((h) => `*://*.${h}/*`);

  try {
    await browser.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  } catch (_) {
    // Fails when nothing was registered yet. Fine.
  }
  try {
    await browser.scripting.registerContentScripts([script]);
  } catch (e) {
    // Happens when host permissions have been revoked. The static blocking
    // rules keep working either way, and permissions.onAdded retries below.
    console.warn("Hakarasenai: could not register optout.js", e);
  }
}

async function sync() {
  const list = await getExcluded();
  await syncRules(list);
  await syncScript(list);
  return list;
}

// ---- toolbar badge ----------------------------------------------------

async function updateBadge(tabId, url, list) {
  const host = hostOf(url);
  const off = host !== null && isExcluded(host, list ?? (await getExcluded()));
  try {
    await browser.action.setBadgeText({ tabId, text: off ? "OFF" : "" });
    if (off) {
      await browser.action.setBadgeBackgroundColor({ tabId, color: "#8a8f98" });
      await browser.action.setBadgeTextColor({ tabId, color: "#ffffff" });
    }
  } catch (_) {
    // The badge is cosmetic and is not drawn on every platform (Android).
    // Never let it break the toggle.
  }
}

async function updateAllBadges() {
  const list = await getExcluded();
  const tabs = await browser.tabs.query({});
  await Promise.all(tabs.map((t) => updateBadge(t.id, t.url, list)));
}

// ---- wiring -----------------------------------------------------------

browser.runtime.onInstalled.addListener(() => sync().then(updateAllBadges));
browser.runtime.onStartup.addListener(() => sync().then(updateAllBadges));
// Re-register once the user grants site access after the fact.
browser.permissions.onAdded.addListener(() => sync());

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    updateBadge(tabId, tab.url);
  }
});
browser.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await browser.tabs.get(tabId);
  updateBadge(tabId, tab.url);
});

browser.runtime.onMessage.addListener(async (msg) => {
  const host = hostOf(msg?.url);
  if (host === null) return { host: null };

  let list = await getExcluded();

  if (msg.cmd === "toggle") {
    list = isExcluded(host, list)
      ? list.filter((h) => host !== h && !host.endsWith("." + h))
      : list.concat(host);
    await browser.storage.local.set({ [STORAGE_KEY]: list });
    await sync();
    await updateAllBadges();
  }

  return { host, excluded: isExcluded(host, list) };
});
