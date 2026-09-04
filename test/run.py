#!/usr/bin/env python3
"""Drives Firefox twice -- once with the extension, once without -- and
compares. The control run is what makes the result meaningful: it proves the
network is reachable and that the flag is genuinely ours.

  python3 test/run.py [--firefox PATH] [--visible]

Needs selenium and geckodriver on PATH.
"""

import argparse
import os
import subprocess
import sys
import time

from selenium import webdriver
from selenium.webdriver.firefox.options import Options

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8787
BASE = f"http://127.0.0.1:{PORT}"


def start_server():
    p = subprocess.Popen(
        [sys.executable, os.path.join(ROOT, "test", "serve.py"), str(PORT)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(50):
        try:
            import urllib.request

            urllib.request.urlopen(f"{BASE}/plain.html", timeout=1).read()
            return p
        except Exception:
            time.sleep(0.1)
    p.kill()
    raise RuntimeError("test server did not come up")


def probe(driver, page):
    driver.get(f"{BASE}/{page}")
    return driver.execute_async_script(
        """
        const done = arguments[0];
        const t0 = Date.now();
        (function poll() {
          if (window.__probe) return done(window.__probe);
          if (Date.now() - t0 > 20000) return done(null);
          setTimeout(poll, 50);
        })();
        """
    )


def run(firefox, with_extension, visible):
    opts = Options()
    opts.binary_location = firefox
    if not visible:
        opts.add_argument("-headless")
    # Content sandbox can't start in some containers; irrelevant to what we test.
    opts.set_preference("security.sandbox.content.level", 0)
    driver = webdriver.Firefox(options=opts)
    try:
        if with_extension:
            driver.install_addon(ROOT, temporary=True)
            time.sleep(2)  # let the background script register optout.js
        return {p: probe(driver, p) for p in ("plain.html", "csp.html")}
    finally:
        driver.quit()


CHECKS = [
    # (label, page, getter, expected with extension, expected without)
    ("layer 1: opt-out flag set", "plain.html", lambda r: r["flag"], True, False),
    ("layer 1: survives a strict CSP", "csp.html", lambda r: r["flag"], True, False),
    ("layer 1: site cannot opt back in", "plain.html", lambda r: r["overwriteHeld"], True, False),
    ("layer 1: assignment does not throw", "plain.html", lambda r: r["assignThrew"], False, False),
    ("layer 2: GA4 /g/collect", "plain.html", lambda r: r["fetches"]["ga4"], "blocked", "sent"),
    ("layer 2: UA /collect", "plain.html", lambda r: r["fetches"]["ua"], "blocked", "sent"),
    ("layer 2: analytics.google.com /g/collect", "plain.html", lambda r: r["fetches"]["region"], "blocked", "sent"),
    ("layer 2: blocks under a strict CSP too", "csp.html", lambda r: r["fetches"]["ga4"], "blocked", "sent"),
    ("scope: gtag.js loader still loads", "plain.html", lambda r: r["fetches"]["loader"], "sent", "sent"),
    ("scope: same-origin /collect untouched", "plain.html", lambda r: r["fetches"]["sameOrigin"], "sent", "sent"),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--firefox", default=os.path.expanduser("~/opt/firefox/firefox"))
    ap.add_argument("--visible", action="store_true")
    args = ap.parse_args()

    server = start_server()
    try:
        print("run 1/2: with the extension")
        on = run(args.firefox, True, args.visible)
        print("run 2/2: control, without the extension")
        off = run(args.firefox, False, args.visible)
    finally:
        server.kill()

    for page in on:
        if on[page] is None or off[page] is None:
            print(f"FAIL: probe never finished on {page}")
            return 1

    width = max(len(c[0]) for c in CHECKS)
    failed = 0
    for label, page, get, want_on, want_off in CHECKS:
        got_on, got_off = get(on[page]), get(off[page])
        ok = got_on == want_on and got_off == want_off
        failed += not ok
        mark = "PASS" if ok else "FAIL"
        print(f"{mark}  {label:<{width}}  with={got_on!r:<10} without={got_off!r}")

    print()
    print(f"{len(CHECKS) - failed}/{len(CHECKS)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
