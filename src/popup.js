const $ = (id) => document.getElementById(id);

function show(title, detail, cls) {
  $("host").textContent = title;
  $("state").textContent = detail;
  $("state").className = "state" + (cls ? " " + cls : "");
  $("toggle").hidden = true;
}

function render(state) {
  if (!state || !state.host) {
    show("このページでは動作しません", "http / https のページでのみ働きます");
    return;
  }

  $("host").textContent = state.host;
  $("state").textContent = state.excluded
    ? "除外中 — このサイトでは何もしません"
    : "遮断中 — GA には送っていません";
  $("state").className = "state " + (state.excluded ? "off" : "on");

  const button = $("toggle");
  button.textContent = state.excluded
    ? "このサイトで有効にする"
    : "このサイトを除外する";
  button.hidden = false;
}

(async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url;

  // サイトへのアクセス許可を外されると tab.url が読めなくなる。
  // 「対象外のページ」と区別が付かないと原因不明になるので、分けて出す
  if (!url) {
    show(
      "サイトへのアクセスが許可されていません",
      "about:addons のこの拡張の設定で「すべてのサイト」を許可してください",
      "off"
    );
    return;
  }

  render(await browser.runtime.sendMessage({ cmd: "get", url }));

  $("toggle").addEventListener("click", async () => {
    render(await browser.runtime.sendMessage({ cmd: "toggle", url }));
  });
})();
