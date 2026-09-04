// Runs in the page (MAIN world) at document_start.
//
// Google's measurement scripts (ga.js / analytics.js / gtag.js) all check
// window._gaUserPrefs.ioo() before sending, and give up if it returns true.
// That is the same hook Google's own opt-out add-on uses -- an official escape
// hatch built into Google Analytics itself.
//
// The official add-on injects a <script> element into the page, so on sites
// with a strict CSP the injection is blocked and the opt-out silently does
// nothing. Using world: "MAIN" puts the flag straight on the page's global
// object instead, which no CSP can stop.
(() => {
  const prefs = { ioo: () => true };

  try {
    Object.defineProperty(window, "_gaUserPrefs", {
      // Swallow assignments so a site cannot overwrite the flag.
      // A non-writable data property would make strict-mode pages throw a
      // TypeError on assignment, so use a no-op setter and ignore it quietly.
      get: () => prefs,
      set: () => {},
      configurable: false,
      enumerable: false,
    });
  } catch (_) {
    // Already defined and not redefinable -- just try a plain assignment.
    try {
      window._gaUserPrefs = prefs;
    } catch (__) {
      // Give up; the network blocking layer still stands.
    }
  }
})();
