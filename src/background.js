// 除外サイト(ホスト名の配列)の管理と、それに応じた
//   1) 動的 DNR ルール(そのサイト発の通信をブロック対象から外す)
//   2) optout.js の登録内容(そのサイトを excludeMatches に入れる)
// の同期だけを行う。

const STORAGE_KEY = "excluded";
const ALLOW_RULE_ID = 1000; // 動的ルールは常にこの 1 本だけ使う
const SCRIPT_ID = "hakarasenai-optout";

// ---- 除外リスト -------------------------------------------------------

async function getExcluded() {
  const got = await browser.storage.local.get(STORAGE_KEY);
  return Array.isArray(got[STORAGE_KEY]) ? got[STORAGE_KEY] : [];
}

// example.com を除外すると www.example.com などのサブドメインもまとめて外れる。
// 迷いどころを増やしたくないので www. だけ落として正規化する。
function normalize(hostname) {
  return hostname.replace(/^www\./, "").toLowerCase();
}

// http/https のページ以外(about:, moz-extension:, file: など)では何もしない
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

// ---- 除外の反映 -------------------------------------------------------

async function syncRules(list) {
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [ALLOW_RULE_ID],
    addRules: list.length
      ? [
          {
            id: ALLOW_RULE_ID,
            priority: 2, // 静的な block ルール(priority 1)より強い
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
    // 未登録なら失敗する。無視してよい
  }
  try {
    await browser.scripting.registerContentScripts([script]);
  } catch (e) {
    // サイトへのアクセス許可が外されているとここで失敗する。
    // その場合でも通信ブロック(静的 DNR ルール)は生きている。
    console.warn("Hakarasenai: optout.js の登録に失敗しました", e);
  }
}

async function sync() {
  const list = await getExcluded();
  await syncRules(list);
  await syncScript(list);
  return list;
}

// ---- バッジ -----------------------------------------------------------

async function updateBadge(tabId, url, list) {
  const host = hostOf(url);
  const off = host !== null && isExcluded(host, list ?? (await getExcluded()));
  await browser.action.setBadgeText({ tabId, text: off ? "OFF" : "" });
  if (off) {
    await browser.action.setBadgeBackgroundColor({ tabId, color: "#8a8f98" });
    await browser.action.setBadgeTextColor({ tabId, color: "#ffffff" });
  }
}

async function updateAllBadges() {
  const list = await getExcluded();
  const tabs = await browser.tabs.query({});
  await Promise.all(tabs.map((t) => updateBadge(t.id, t.url, list)));
}

// ---- 配線 -------------------------------------------------------------

browser.runtime.onInstalled.addListener(() => sync().then(updateAllBadges));
browser.runtime.onStartup.addListener(() => sync().then(updateAllBadges));
// あとからサイトへのアクセスを許可された場合に登録し直す
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
