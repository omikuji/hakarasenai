# Hakarasenai

**English** · [العربية](translations/README.ar.md) · [Čeština](translations/README.cs.md) · [Dansk](translations/README.da.md) · [Deutsch](translations/README.de.md) · [Español](translations/README.es.md) · [Suomi](translations/README.fi.md) · [Français](translations/README.fr.md) · [עברית](translations/README.he.md) · [हिन्दी](translations/README.hi.md) · [Bahasa Indonesia](translations/README.id.md) · [Italiano](translations/README.it.md) · [日本語](translations/README.ja.md) · [한국어](translations/README.ko.md) · [Norsk](translations/README.nb.md) · [Nederlands](translations/README.nl.md) · [Polski](translations/README.pl.md) · [Português](translations/README.pt-BR.md) · [Русский](translations/README.ru.md) · [Svenska](translations/README.sv.md) · [ไทย](translations/README.th.md) · [Türkçe](translations/README.tr.md) · [Українська](translations/README.uk.md) · [Tiếng Việt](translations/README.vi.md) · [简体中文](translations/README.zh-Hans.md) · [繁體中文](translations/README.zh-Hant.md)

A Firefox extension that only stops Google Analytics from measuring you.
Desktop and Android.

*Hakarasenai* means "won't let it measure" — that is the whole feature list.

**What it does:**

1. Tells the Google Analytics code on the page that you have opted out
2. Blocks the measurement hits that would go out anyway
3. Lets you exclude a single site from the toolbar button, if one misbehaves

No options page, no filter subscriptions, no counters, no Pro version.

## Why this exists

Google ships an official "Google Analytics Opt-out Add-on", and there is a
Firefox build of it. The trouble is **how** it works: it injects a `<script>`
element into the page, and Firefox — like Safari — applies the page's own CSP to
content scripts. On any site with a strict CSP the injection is blocked and the
opt-out quietly does nothing. Nothing tells you it failed, which is the worst
possible failure mode for a privacy tool.

Hakarasenai uses the same official opt-out hook, but puts it where no CSP can
reach it, and puts network blocking behind it as a second layer. If the first
layer ever fails, the data still does not leave.

## Install

### From AMO

Search for it on [addons.mozilla.org](https://addons.mozilla.org/). On Android,
install from AMO the same way — the add-on declares `gecko_android`, so Firefox
for Android offers it.

### Load it temporarily from source

No build step needed. Open `about:debugging#/runtime/this-firefox`, choose
**Load Temporary Add-on**, and pick this repository's `manifest.json`. It stays
until you close Firefox.

Firefox 128 or newer is required, on desktop and on Android, because `world:
"MAIN"` content scripts landed in 128.

To produce the zip for AMO:

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint` and `make run` use `web-ext` (fetched by `npx` on first use).
`make lint` reports two warnings on purpose: the data-collection declaration
(`data_collection_permissions: none`) is only read by Firefox 140 and later,
and `strict_min_version` is 128, so the linter points out the gap. On 128–139
the key is simply ignored, which is not worth narrowing support to silence.

### On Firefox for Android, from source

```bash
adb devices                      # find your device id
make run-android DEVICE=<id>
```

Needs adb, USB debugging on the phone, and *Remote debugging via USB* turned on
in Firefox's settings.

## Using it

There is one control: the toolbar button. It shows the current site's state and
offers a single action.

| State | What it means |
| --- | --- |
| **Blocking** | Both layers are on for this site. This is the default everywhere |
| **Excluded** | Both layers are off for this site, and the toolbar icon carries an `OFF` badge |

**Exclude this site** puts the site into a dynamic `allow` rule *and* into the
content script's `excludeMatches`, so the exclusion is real rather than
cosmetic. Exclusions are **per registrable domain and cover subdomains**:
excluding `example.com` also excludes `www.example.com` and `shop.example.com`.
They apply from the next page load.

This is for when you want to be measured on purpose — verifying GA on your own
site, for instance. The `OFF` badge is not drawn on Android; the popup still
says which state you are in.

## How it works

### Layer 1 — announce the opt-out

`ga.js`, `analytics.js` and `gtag.js` all check `window._gaUserPrefs.ioo()`
(*ioo* = is opted out) before sending, and stop if it returns true. It is the
same flag Google's own add-on sets — an escape hatch Google Analytics provides
itself.

`src/optout.js` is registered as a `world: "MAIN"` content script at
`document_start`, so the flag is already on the page's global object before any
site code runs. Nothing is inserted into the DOM, so there is nothing for a CSP
to block. A site cannot overwrite the flag either: the setter is a no-op rather
than a non-writable property, so strict-mode pages that assign to it are
ignored instead of thrown at.

### Layer 2 — block the hits

Five static declarativeNetRequest rules, in `rules/ga.json`:

| Domain | Blocked |
| --- | --- |
| `*.google-analytics.com` | any URL containing `/collect` — `/collect`, `/j/collect`, `/g/collect`, `/r/collect`, and regional hosts such as `region1.` |
| `*.google-analytics.com` | `/batch`, the batched analytics.js transport |
| `*.analytics.google.com` | `/g/collect` and `/g/s/collect`, the GA4 regional endpoints |
| `stats.g.doubleclick.net` | `/collect`, used when Google Signals is on |

**Not blocked:** `googletagmanager.com` (`gtag.js`, `gtm.js`) and the scripts
served from `google-analytics.com` itself. Opting out means letting the code
load and not letting it report; killing the loader would also take out whatever
else a site drives through Tag Manager. Layer 1 keeps GA silent even though it
loaded.

Because no page resource is blocked, this practically never breaks a site.

## Checking that it works

1. Open a site that uses GA
2. `F12` → **Network**, filter on `collect`
3. Requests to `www.google-analytics.com/g/collect` and friends should show as
   blocked (`NS_ERROR_ABORTED`) — that is layer 2
4. In the console, `_gaUserPrefs.ioo()` should return `true` — that is layer 1.
   `_gaUserPrefs is not defined` means the content script did not register; see
   Troubleshooting

## Testing

```bash
make setup-test   # once: Firefox tarball, geckodriver, and a venv with selenium
make test
```

`setup-test` installs into `~/opt/firefox`, `~/.local/bin` and `.test/` — no
system packages, nothing needs root.

**`make unit`** runs the exclusion logic against a stub of the WebExtension
APIs. Node only, no browser.

**`make test-browser`** drives a real headless Firefox twice — once with the
extension loaded, once without — and compares the two. The control run is the
point: it proves the network is actually reachable and that the opt-out flag is
genuinely coming from the extension. It checks that

- the opt-out flag is set, **including on a page served with a strict CSP** —
  the exact case where Google's own add-on silently fails
- a site that assigns to `_gaUserPrefs` cannot opt itself back in, and does not
  throw while trying
- GA4, Universal Analytics and regional `/collect` hits are blocked, under a
  strict CSP as well
- `gtag.js` still loads, and a same-origin `/collect` is left alone — that is,
  the rules are not over-blocking

The Android build has not been exercised on a physical device. Every API it uses
was checked against MDN's browser-compat-data and mirrors desktop support, but
that is a paper check, not a test.

## What it cannot do

- **Server-side GTM and first-party measurement.** If a site collects on its own
  domain, say `metrics.example.com`, and forwards to GA from its server, the
  traffic is indistinguishable from ordinary traffic to that site, so layer 2
  cannot catch it. Layer 1 still applies, because the sender is gtag.js on the
  page.
- **Analytics products other than GA** are out of scope. This extension opts out
  of Google Analytics, nothing else.
- **Pure server-side Measurement Protocol** hits never touch the browser, so no
  browser extension can stop them.

## Privacy

This extension **collects nothing and sends nothing anywhere**. It makes no
network requests of its own. The only thing stored is the list of hostnames you
excluded (`storage.local`), and that never leaves the device. The manifest
declares this as `data_collection_permissions: { required: ["none"] }`.

## Languages

26 languages, picked automatically from your browser's language settings —
there is nothing to configure:

Arabic, Chinese (Simplified and Traditional), Czech, Danish, Dutch, English,
Finnish, French, German, Hebrew, Hindi, Indonesian, Italian, Japanese, Korean,
Norwegian, Polish, Portuguese (Brazil), Russian, Spanish, Swedish, Thai,
Turkish, Ukrainian, Vietnamese.

Most of these were not written by native speakers, so corrections are the most
welcome kind of pull request. Adding a language means copying
`_locales/en/messages.json` to `_locales/<code>/messages.json` and translating
the `message` values, leaving the keys and `description` fields alone. There are
eleven strings. Anything missing falls back to English.

This README is translated too — the other languages live in `translations/`,
listed at the top of this file. English is the canonical version; run
`python3 Tools/sync-readme-nav.py` after adding one to refresh those links.

## Publishing (notes for maintainers)

Firefox will not permanently install an unsigned extension, so distribution goes
through Mozilla either way:

- **Listed** — upload `dist/*.zip` at the
  [AMO Developer Hub](https://addons.mozilla.org/developers/). It gets reviewed,
  signed, and published on addons.mozilla.org. Listed submissions cannot be
  automated; `web-ext sign --channel=listed` only uploads for review.
- **Unlisted**, meaning self-distribution — `make sign` with an
  [AMO API key](https://addons.mozilla.org/developers/addon/api/key/) returns a
  signed `.xpi` you can host yourself. Note that a self-distributed add-on
  cannot be installed on Firefox for Android.

Sources do not need to be attached: nothing here is minified or bundled.

The listing copy — summary, description, categories, privacy policy and
reviewer notes, in English and Japanese — lives in
[`docs/amo-listing.md`](docs/amo-listing.md), and the store screenshots are
generated from the real popup by `Tools/make-screenshots.py`.

## Troubleshooting

- **`_gaUserPrefs` is undefined** — site access was probably revoked. In
  `about:addons`, open this extension's **Permissions** and allow access to all
  sites. It re-registers itself as soon as the permission comes back
- **Nothing happens on Firefox 127 or older** — `world: "MAIN"` content scripts
  need Firefox 128. Upgrade
- **An exclusion did not take effect** — exclusions are per domain, include
  subdomains, and apply from the next page load
- **A site broke and excluding it fixed nothing** — then it was not this
  extension. Only `/collect` requests are blocked, never a script or a page
  resource

## Support

Hakarasenai is free and always will be. If it keeps you out of somebody's
dashboard, sponsoring the work through
[GitHub Sponsors](https://github.com/sponsors/omikuji) is appreciated and is the
only way the project is funded.

Sponsorship pays for upkeep, which is the real cost here: Google moves and adds
collection endpoints, and a rule set that was exhaustive last year quietly stops
being so. It would also buy the Android hardware the add-on is currently only
checked against on paper.

Questions, problems and ideas are all welcome:

- [X (@omikuji_man)](https://x.com/omikuji_man)
- [Contact form](https://omikuji.dev/contact/)
- [Report an issue on GitHub](https://github.com/omikuji/hakarasenai/issues)

## License

MIT License.
