# Hakarasenai (測らせない)

A Firefox extension that just keeps Google Analytics from measuring you.
Desktop and Android.

**What it does (this is all of it):**

1. Tells the Google Analytics code on the page that you have opted out
2. Blocks the measurement hits that would go out anyway
3. Lets you **exclude a single site** from the toolbar button, if one misbehaves

No options page, no filter subscriptions, no counters, no Pro version.

[日本語の README](README.ja.md)

## Why this exists

Google ships an official "Google Analytics Opt-out Add-on", and there is a
Firefox build of it. The trouble is **how** it works: it injects a `<script>`
element into the page, and Firefox (like Safari) applies the page's CSP to
content scripts. On any site with a strict CSP the injection is blocked and the
opt-out quietly does nothing. You cannot tell from the outside that it failed,
which is the worst possible failure mode for a privacy tool.

Hakarasenai uses the same official opt-out hook, but places it where no CSP can
reach it (`world: "MAIN"`), and puts network blocking behind it as a second
layer. If the first layer ever fails, the data still does not leave.

## Install

### From AMO (once published)

Search for it on [addons.mozilla.org](https://addons.mozilla.org/).
On Android, install from AMO the same way — the add-on declares
`gecko_android`, so Firefox for Android will offer it.

### Load it temporarily from source

No build step needed. Open `about:debugging#/runtime/this-firefox`, choose
**Load Temporary Add-on**, and pick this repository's `manifest.json`.
It stays until you close Firefox.

Firefox 128 or newer is required, on desktop and on Android, because
`world: "MAIN"` content scripts landed in 128.

To produce the zip for AMO:

```bash
make build   # -> dist/hakarasenai-<version>.zip
```

`make lint` and `make run` use `web-ext` (fetched by `npx` on first use).
`make lint` reports two warnings on purpose: the data-collection declaration
(`data_collection_permissions: none`) is only read by Firefox 140+, and
`strict_min_version` is 128, so the linter points out the gap. On 128–139 the
key is simply ignored, which is not worth narrowing support to silence.

### On Firefox for Android, from source

```bash
adb devices                      # find your device id
make run-android DEVICE=<id>
```

Needs adb, USB debugging on the phone, and *Remote debugging via USB* turned on
in Firefox's settings.

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
|---|---|
| `*.google-analytics.com` | any URL containing `/collect` (`/collect`, `/j/collect`, `/g/collect`, `/r/collect`, and regional hosts like `region1.`) |
| `*.google-analytics.com` | `/batch` (the batched analytics.js transport) |
| `*.analytics.google.com` | `/g/collect` and `/g/s/collect` (GA4 regional endpoints) |
| `stats.g.doubleclick.net` | `/collect` (used when Google Signals is on) |

**Not blocked:** `googletagmanager.com` (`gtag.js`, `gtm.js`) and the scripts
served from `google-analytics.com` itself. Opting out means letting the code
load and not letting it report; killing the loader would also take out whatever
else a site drives through Tag Manager. Layer 1 means GA stays silent even
though it loaded.

Because no page resource is blocked, this practically never breaks a site.

## Excluding a single site

Click the toolbar icon to see the state for the current site. **Exclude this
site** turns off both layers there — the site goes into a dynamic `allow` rule
*and* into the content script's `excludeMatches`. Excluded tabs show an `OFF`
badge (desktop; Android does not draw extension badges).

Exclusions are **per registrable domain and cover subdomains**: excluding
`example.com` also excludes `www.example.com` and `shop.example.com`.

Useful when you want to be measured on purpose — verifying GA on your own site,
for instance.

## Checking that it works

1. Open a site that uses GA
2. `F12` → **Network**, filter on `collect`
3. Requests to `www.google-analytics.com/g/collect` and friends should show as
   blocked (`NS_ERROR_ABORTED`) — that is layer 2
4. In the console, `_gaUserPrefs.ioo()` should return `true` — that is layer 1.
   `_gaUserPrefs is not defined` means the content script did not register; see
   Troubleshooting

## What it cannot do

- **Server-side GTM / first-party measurement.** If a site collects on its own
  domain (say `metrics.example.com`) and forwards to GA from its server, the
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

## Translations

The UI ships in 15 languages under [`_locales/`](_locales/): English, Japanese,
German, Spanish, French, Italian, Korean, Dutch, Polish, Portuguese (Brazil),
Russian, Turkish, Ukrainian, Simplified and Traditional Chinese.

To add one, copy `_locales/en/messages.json` to `_locales/<code>/messages.json`,
translate the `message` values (leave the keys and `description` fields alone),
and open a pull request. There are eleven strings.

## Publishing (notes for maintainers)

Firefox will not permanently install an unsigned extension, so distribution goes
through Mozilla either way:

- **Listed** — upload `dist/*.zip` at the
  [AMO Developer Hub](https://addons.mozilla.org/developers/). It gets reviewed,
  signed, and published on addons.mozilla.org. Listed submissions cannot be
  automated; `web-ext sign --channel=listed` only uploads for review.
- **Unlisted** (self-distribution) — `make sign` with an
  [AMO API key](https://addons.mozilla.org/developers/addon/api/key/) returns a
  signed `.xpi` you can host yourself.

Sources do not need to be attached: nothing here is minified or bundled.

## Troubleshooting

- **`_gaUserPrefs` is undefined** → site access was probably revoked. In
  `about:addons`, open this extension's **Permissions** and allow access to all
  sites. It re-registers itself as soon as the permission comes back.
- **Nothing happens on Firefox 127 or older** → `world: "MAIN"` content scripts
  need Firefox 128. Upgrade.
- **An exclusion did not take effect** → exclusions are per domain and include
  subdomains, and they apply from the next page load.

## License

MIT.
