// Loaded as an external same-origin script so it survives a strict CSP.
// Everything it learns goes on window.__probe for the driver to read.
(async () => {
  const out = { flag: null, overwriteHeld: null, assignThrew: null, fetches: {} };

  out.flag =
    typeof window._gaUserPrefs === "object" &&
    typeof window._gaUserPrefs.ioo === "function" &&
    window._gaUserPrefs.ioo() === true;

  // A site trying to opt itself back in must not succeed, and must not blow up.
  // The assignment has to happen in a genuinely strict function: a non-writable
  // data property would throw here, which is exactly what we avoid.
  const optBackIn = () => {
    "use strict";
    window._gaUserPrefs = { ioo: () => false };
  };
  try {
    optBackIn();
    out.assignThrew = false;
  } catch (e) {
    out.assignThrew = true;
  }
  out.overwriteHeld =
    typeof window._gaUserPrefs === "object" &&
    typeof window._gaUserPrefs.ioo === "function" &&
    window._gaUserPrefs.ioo() === true;

  const probe = async (name, url) => {
    try {
      await fetch(url, { mode: "no-cors", cache: "no-store" });
      out.fetches[name] = "sent";
    } catch (e) {
      out.fetches[name] = "blocked";
    }
  };

  await probe("ga4", "https://www.google-analytics.com/g/collect?v=2&tid=G-0000000000&cid=1");
  await probe("ua", "https://www.google-analytics.com/collect?v=1&tid=UA-000000-1&cid=1");
  await probe("region", "https://analytics.google.com/g/collect?v=2&tid=G-0000000000&cid=1");
  await probe("loader", "https://www.googletagmanager.com/gtag/js?id=G-0000000000");
  await probe("sameOrigin", "/collect?should=notBeBlocked");

  window.__probe = out;
})();
