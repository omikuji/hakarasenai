# -*- coding: utf-8 -*-
"""Renders the AMO listing screenshots from the real popup.

The popup markup and popup.css are the ones the extension ships; only the
strings are filled in from _locales/en and the surrounding stage is drawn
here. That way the screenshots cannot drift away from the actual UI.

    .test/venv/bin/python Tools/make-screenshots.py

Writes 1280x800 PNGs (AMO's display size) into docs/screenshots/.
"""
import json
import os
import subprocess
import sys
import tempfile

from selenium import webdriver
from selenium.webdriver.firefox.options import Options

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'screenshots')
FIREFOX = os.path.expanduser('~/opt/firefox/firefox')
W, H = 1280, 800

MESSAGES = json.load(open(os.path.join(ROOT, '_locales/en/messages.json'), encoding='utf-8'))
POPUP_CSS = open(os.path.join(ROOT, 'src/popup.css'), encoding='utf-8').read()
ICON = open(os.path.join(ROOT, 'icons/icon.svg'), encoding='utf-8').read()


def t(key):
    return MESSAGES[key]['message']


STAGE = """<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><style>
%(popup_css)s

html, body.stage { width: %(w)dpx; height: %(h)dpx; }
body.stage {
  margin: 0; padding: 0; max-width: none; min-width: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 44px;
  background: %(bg)s;
  font: 13px/1.6 system-ui, sans-serif; color: var(--fg);
}
.caption { margin: 0; text-align: center; max-width: 720px; }
.caption b { display: block; font-size: 30px; font-weight: 650; letter-spacing: -0.01em; }
.caption span { display: block; margin-top: 10px; font-size: 16px; color: var(--dim); }
.frame {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 18px; border-radius: 16px;
  background: var(--bg); border: 1px solid var(--line);
  box-shadow: 0 24px 60px -20px rgba(0,0,0,.45);
  zoom: 1.5;
}
.frame .mark { position: relative; width: 34px; height: 34px; flex: none; }
.frame .mark svg { width: 34px; height: 34px; border-radius: 8px; }
.frame .mark .badge {
  position: absolute; right: -3px; bottom: -3px;
  padding: 1px 4px; border-radius: 4px;
  background: #8a8f98; color: #fff;
  font: 600 9px/1.2 system-ui, sans-serif;
}
.panel { width: 260px; }
.panel .host { margin: 0; font-weight: 600; word-break: break-all; }
</style></head>
<body class="stage">
  <p class="caption"><b>%(title)s</b><span>%(subtitle)s</span></p>
  <div class="frame">
    <div class="mark">%(icon)s%(badge)s</div>
    <div class="panel">
      <p class="host">%(host)s</p>
      <p class="state %(state_class)s">%(state)s</p>
      <button type="button">%(button)s</button>
      <p class="note">%(note)s</p>
    </div>
  </div>
</body></html>
"""

SHOTS = [
    dict(
        name='01-blocking',
        dark=False,
        bg='#eef1f5',
        title='Google Analytics gets nothing',
        subtitle='The opt-out flag is set before the page runs, and the hits are '
                 'blocked on the way out. Two layers, no configuration.',
        host='example.com',
        state=t('stateBlocking'), state_class='on',
        button=t('buttonExclude'), badge='',
    ),
    dict(
        name='02-excluded',
        dark=False,
        bg='#eef1f5',
        title='One site at a time, when you want to be measured',
        subtitle='Excluding a site turns off both layers there, subdomains '
                 'included. For checking Analytics on your own site.',
        host='example.com',
        state=t('stateExcluded'), state_class='off',
        button=t('buttonInclude'), badge='<span class="badge">OFF</span>',
    ),
    dict(
        name='03-dark',
        dark=True,
        bg='#17191d',
        title='Follows your theme, in 26 languages',
        subtitle='One button, two states, nothing to set up. Light and dark, '
                 'and whichever language your browser is already in.',
        host='news.example.org',
        state=t('stateBlocking'), state_class='on',
        button=t('buttonExclude'), badge='',
    ),
]


def build(shot, path):
    html = STAGE % dict(
        shot, popup_css=POPUP_CSS, icon=ICON, note=t('popupNote'), w=W, h=H)
    open(path, 'w', encoding='utf-8').write(html)


def start(dark):
    opts = Options()
    opts.binary_location = FIREFOX
    opts.add_argument('-headless')
    opts.set_preference('security.sandbox.content.level', 0)
    # popup.css follows prefers-color-scheme, and this pref is the only way to
    # steer it: 0 forces dark, 1 forces light.
    opts.set_preference('layout.css.prefers-color-scheme.content-override', 0 if dark else 1)
    driver = webdriver.Firefox(options=opts)

    # The window size is the outer frame; grow it until the viewport is exactly
    # W x H, otherwise the shots come out short.
    driver.set_window_size(W, H)
    driver.get('about:blank')
    vw, vh = driver.execute_script('return [innerWidth, innerHeight]')
    driver.set_window_size(W + (W - vw), H + (H - vh))
    return driver


def main():
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for dark in (False, True):
            shots = [s for s in SHOTS if s['dark'] is dark]
            if not shots:
                continue
            driver = start(dark)
            try:
                for shot in shots:
                    page = os.path.join(tmp, shot['name'] + '.html')
                    build(shot, page)
                    driver.get('file://' + page)
                    out = os.path.join(OUT, shot['name'] + '.png')
                    driver.get_screenshot_as_file(out)
                    print(out)
            finally:
                driver.quit()


if __name__ == '__main__':
    main()
