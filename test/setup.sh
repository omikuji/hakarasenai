#!/usr/bin/env bash
# Sets up what test/run.py needs, without touching system packages:
#   ~/opt/firefox        official Firefox tarball
#   ~/.local/bin/geckodriver
#   .test/venv           python venv with selenium
# Safe to re-run; anything already present is left alone.
set -euo pipefail

cd "$(dirname "$0")/.."

FIREFOX="${FIREFOX_DIR:-$HOME/opt/firefox}"
BIN="${BIN_DIR:-$HOME/.local/bin}"

if [ ! -x "$FIREFOX/firefox" ]; then
  echo "==> Firefox -> $FIREFOX"
  mkdir -p "$(dirname "$FIREFOX")"
  tmp="$(mktemp -d)"
  curl -sSL -o "$tmp/firefox.tar.xz" \
    "https://download.mozilla.org/?product=firefox-latest-ssl&os=linux64&lang=en-US"
  tar -xf "$tmp/firefox.tar.xz" -C "$(dirname "$FIREFOX")"
  rm -rf "$tmp"
fi
"$FIREFOX/firefox" --version

if [ ! -x "$BIN/geckodriver" ]; then
  echo "==> geckodriver -> $BIN"
  mkdir -p "$BIN"
  url="$(curl -sSL https://api.github.com/repos/mozilla/geckodriver/releases/latest \
    | grep -o 'https://[^"]*linux64\.tar\.gz' | head -1)"
  curl -sSL "$url" | tar -xz -C "$BIN" geckodriver
fi
"$BIN/geckodriver" --version | head -1

if [ ! -x .test/venv/bin/python ]; then
  echo "==> venv -> .test/venv"
  python3 -m venv .test/venv
fi
.test/venv/bin/pip -q install --upgrade pip
.test/venv/bin/pip -q install selenium
.test/venv/bin/python -c "import selenium; print('selenium', selenium.__version__)"

echo "==> ready. run: make test"
