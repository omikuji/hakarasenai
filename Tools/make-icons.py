# -*- coding: utf-8 -*-
"""Rasterises icons/icon.svg to PNG for the AMO listing.

Firefox renders SVG icons fine, but AMO does not read them, so a listing that
only ships an SVG shows the default puzzle piece. This draws the same SVG onto
a canvas and pulls the PNG back out, so the raster icons cannot drift away from
the vector one.

    .test/venv/bin/python Tools/make-icons.py
"""
import base64
import json
import os

from selenium import webdriver
from selenium.webdriver.firefox.options import Options

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVG = os.path.join(ROOT, 'icons', 'icon.svg')
SIZES = (48, 96, 128)
FIREFOX = os.path.expanduser('~/opt/firefox/firefox')

PAGE = """<!DOCTYPE html><meta charset="utf-8"><body><script>
window.__render = (svg, size) => new Promise((done, fail) => {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    // Keep the alpha: the icon's rounded corners have to stay transparent.
    c.getContext('2d').drawImage(img, 0, 0, size, size);
    try { done(c.toDataURL('image/png')); } catch (e) { fail(String(e)); }
  };
  img.onerror = () => fail('the SVG did not load');
  img.src = 'data:image/svg+xml;base64,' + svg;
});
</script></body>"""


def main():
    svg64 = base64.b64encode(open(SVG, 'rb').read()).decode()

    opts = Options()
    opts.binary_location = FIREFOX
    opts.add_argument('-headless')
    opts.set_preference('security.sandbox.content.level', 0)
    driver = webdriver.Firefox(options=opts)
    try:
        driver.get('data:text/html;base64,' + base64.b64encode(PAGE.encode()).decode())
        for size in SIZES:
            url = driver.execute_async_script(
                'const done = arguments[arguments.length - 1];'
                'window.__render(arguments[0], arguments[1]).then(done, e => done("ERROR:" + e));',
                svg64, size)
            if url.startswith('ERROR:'):
                raise SystemExit(url)
            out = os.path.join(ROOT, 'icons', 'icon-%d.png' % size)
            open(out, 'wb').write(base64.b64decode(url.split(',', 1)[1]))
            print(out)
    finally:
        driver.quit()


if __name__ == '__main__':
    main()
