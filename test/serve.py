#!/usr/bin/env python3
"""Tiny static server for the browser test.

Serves test/pages on 127.0.0.1. /csp.html is sent with a strict CSP that
forbids injected scripts but still allows XHR to the Google Analytics hosts,
so the two layers of the extension can be told apart:

  - a blocked _gaUserPrefs means layer 1 lost to the CSP
  - a blocked /collect means layer 2 did its job (and not the CSP)
"""

import http.server
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pages")

CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "connect-src 'self' https://www.google-analytics.com "
    "https://analytics.google.com https://www.googletagmanager.com"
)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        if self.path.startswith("/csp.html"):
            self.send_header("Content-Security-Policy", CSP)
        super().end_headers()

    def do_GET(self):
        # A same-origin /collect, to prove the block rules are scoped to the
        # Google hosts and are not just matching the word "collect".
        if self.path.startswith("/collect"):
            self.send_response(204)
            self.end_headers()
            return
        super().do_GET()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
    http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
