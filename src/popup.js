const $ = (id) => document.getElementById(id);
const t = (key) => browser.i18n.getMessage(key);

function show(title, detail, cls) {
  $("host").textContent = title;
  $("state").textContent = detail;
  $("state").className = "state" + (cls ? " " + cls : "");
  $("toggle").hidden = true;
}

function render(state) {
  if (!state || !state.host) {
    show(t("pageUnsupported"), t("pageUnsupportedDetail"));
    return;
  }

  $("host").textContent = state.host;
  $("state").textContent = state.excluded
    ? t("stateExcluded")
    : t("stateBlocking");
  $("state").className = "state " + (state.excluded ? "off" : "on");

  const button = $("toggle");
  button.textContent = state.excluded ? t("buttonInclude") : t("buttonExclude");
  button.hidden = false;
}

(async () => {
  document.documentElement.lang = browser.i18n.getUILanguage();
  document.dir = browser.i18n.getMessage("@@bidi_dir");
  $("note").textContent = t("popupNote");

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url;

  // tab.url is unreadable once host permissions are revoked. Say so plainly,
  // otherwise it is indistinguishable from "page out of scope".
  if (!url) {
    show(t("noAccess"), t("noAccessDetail"), "off");
    return;
  }

  render(await browser.runtime.sendMessage({ cmd: "get", url }));

  $("toggle").addEventListener("click", async () => {
    render(await browser.runtime.sendMessage({ cmd: "toggle", url }));
  });
})();
