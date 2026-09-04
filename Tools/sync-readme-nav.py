# -*- coding: utf-8 -*-
"""Writes the same language navigation line into every README.

English lives at the repository root because GitHub only ever renders
README.md; the translations sit in translations/ so the root stays readable.
Adding a language means adding one entry to NAMES and running this.
"""
import io
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOLDER = 'translations'

NAMES = [
    ('en', 'English'), ('ar', 'العربية'), ('cs', 'Čeština'), ('da', 'Dansk'),
    ('de', 'Deutsch'), ('es', 'Español'), ('fi', 'Suomi'), ('fr', 'Français'),
    ('he', 'עברית'), ('hi', 'हिन्दी'), ('id', 'Bahasa Indonesia'), ('it', 'Italiano'),
    ('ja', '日本語'), ('ko', '한국어'), ('nb', 'Norsk'), ('nl', 'Nederlands'),
    ('pl', 'Polski'), ('pt-BR', 'Português'), ('ru', 'Русский'), ('sv', 'Svenska'),
    ('th', 'ไทย'), ('tr', 'Türkçe'), ('uk', 'Українська'), ('vi', 'Tiếng Việt'),
    ('zh-Hans', '简体中文'), ('zh-Hant', '繁體中文'),
]


def path_of(code):
    return 'README.md' if code == 'en' else os.path.join(FOLDER, 'README.%s.md' % code)


def link_from(current, target):
    """Where `current` should point to reach `target`."""
    if target == 'en':
        return 'README.md' if current == 'en' else '../README.md'
    name = 'README.%s.md' % target
    return name if current != 'en' else '%s/%s' % (FOLDER, name)


def navigation(current):
    parts = []
    for code, name in NAMES:
        parts.append('**%s**' % name if code == current
                     else '[%s](%s)' % (name, link_from(current, code)))
    return ' · '.join(parts)


def apply():
    for code, _ in NAMES:
        path = os.path.join(ROOT, path_of(code))
        if not os.path.exists(path):
            print('missing:', path_of(code))
            continue
        lines = io.open(path, encoding='utf-8').read().split('\n')
        rest = lines[1:]
        # drop the previous navigation line and the blank lines around it
        while rest and (rest[0].strip() == '' or ' · ' in rest[0]):
            rest.pop(0)
        body = [lines[0], '', navigation(code), ''] + rest
        io.open(path, 'w', encoding='utf-8').write('\n'.join(body))
    print('navigation written for %d files' % len(NAMES))


if __name__ == '__main__':
    apply()
