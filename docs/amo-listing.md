# AMO listing copy

Everything the addons.mozilla.org submission form asks for, ready to paste.
Update this file rather than retyping into the form, so the next release starts
from what was actually published last time.

The **name** is not typed here: AMO reads it from the manifest, which uses
`__MSG_extensionName__`, so all 26 locales are picked up automatically.

- **Add-on URL (slug)**: `hakarasenai`
- **Categories**: Firefox → *Privacy & Security*; Firefox for Android → *Privacy & Security*
- **License**: MIT License
- **Support email**: via https://omikuji.dev/contact/
- **Support site**: https://github.com/omikuji/hakarasenai/issues
- **Homepage**: https://github.com/omikuji/hakarasenai
- **Contains minified or obfuscated code**: No (so no source package is needed)
- **Privacy policy**: not required, since nothing leaves the device. The text
  below is provided anyway because reviewers read it.

## Summary (English, 250 characters max)

Keeps Google Analytics from measuring you. It tells the GA code on the page that
you have opted out, and blocks the measurement hits that would go out anyway.
Nothing to configure, and any site can be excluded from the toolbar button.

## Summary (日本語)

Google Analytics に測らせません。ページ内の GA に「オプトアウト済み」と伝えたうえで、
それでも出ていく計測通信をブロックします。設定は不要で、サイトごとの除外は
ツールバーのボタンからできます。

## Description (English)

Google publishes an official Google Analytics opt-out add-on, and there is a
Firefox build of it. The trouble is how it works: it injects a script element
into the page, and Firefox applies the page's own Content Security Policy to
content scripts. On any site with a strict CSP the injection is blocked and the
opt-out quietly does nothing — and nothing tells you it failed.

Hakarasenai uses the same official opt-out hook, but puts it where no CSP can
reach it, and adds network blocking behind it as a second layer.

WHAT IT DOES

1. Tells the Google Analytics code on the page that you have opted out. The flag
   is the one Google Analytics reads itself (window._gaUserPrefs.ioo), set from a
   content script running in the page's own world at document start, so there is
   nothing in the DOM for a CSP to block.

2. Blocks the measurement hits. Five static declarativeNetRequest rules cover the
   /collect and /batch endpoints on google-analytics.com and analytics.google.com,
   including the regional hosts, plus stats.g.doubleclick.net.

3. Lets you exclude one site at a time from the toolbar button, if you actually
   want to be measured — verifying Analytics on your own site, for instance.
   Exclusions cover subdomains and turn off both layers.

WHAT IT DOES NOT BLOCK

The Tag Manager loader (gtag.js, gtm.js) and the scripts served by
google-analytics.com are left alone. Opting out means letting the code load and
not letting it report; taking out the loader would break whatever else a site
drives through Tag Manager. No page resource is blocked, so this practically
never breaks a site.

WHAT IT CANNOT DO

Server-side tagging that collects on a site's own domain cannot be told apart
from ordinary traffic to that site, so the blocking layer cannot catch it — the
opt-out flag still applies there. Analytics products other than Google Analytics
are out of scope.

PRIVACY

It collects nothing, sends nothing anywhere, and makes no network requests of its
own. The only stored value is the list of hostnames you excluded, and it never
leaves the device.

No options page, no filter subscriptions, no counters, no Pro version. MIT
licensed, source at https://github.com/omikuji/hakarasenai

## Description (日本語)

Google 公式の Google Analytics オプトアウト アドオンには Firefox 版もあります。
問題はその作りで、ページに script 要素を挿し込む方式のため、Firefox が
ページ側の Content Security Policy を content script にも適用する結果、
CSP の厳しいサイトでは注入そのものがブロックされ、オプトアウトは黙って
何もしません。しかも失敗したことは何も知らせてくれません。

Hakarasenai は同じ公式フックを使いますが、CSP の届かない場所にそれを置き、
その後ろに通信ブロックを二段目として重ねます。

できること

1. ページ内の Google Analytics に「オプトアウト済み」と伝えます。使うのは
   Google Analytics 自身が見るフラグ (window._gaUserPrefs.ioo) で、ページと
   同じ world で document_start に走る content script から設定するため、
   CSP がブロックすべき DOM 要素が存在しません。

2. 計測通信をブロックします。declarativeNetRequest の静的ルール 5 本で、
   google-analytics.com と analytics.google.com の /collect・/batch(地域別
   ホストを含む)、および stats.g.doubleclick.net をカバーします。

3. 意図して測られたいときは、ツールバーのボタンからそのサイトだけ除外できます。
   自分のサイトの Analytics を検証するときなどに使います。除外はサブドメインを
   含み、両方の層を止めます。

ブロックしないもの

タグマネージャのローダー (gtag.js, gtm.js) と google-analytics.com が配る
スクリプト本体には触れません。読み込ませたうえで報告させないのがオプトアウトで
あって、ローダーごと落とすとタグマネージャ経由の他機能まで壊れるためです。
ページのリソースを一切ブロックしないので、これが原因でサイトが壊れることは
まずありません。

できないこと

サイト自身のドメインで受けるサーバーサイド計測は、そのサイトへの通常の通信と
区別できないため、ブロック層では捕まえられません(その場合もオプトアウトの
フラグは効きます)。Google Analytics 以外の解析ツールは対象外です。

プライバシー

何も収集せず、どこにも送信せず、自分から外部通信もしません。保存するのは
あなたが除外したサイトのホスト名だけで、端末から出ることはありません。

設定画面なし、フィルタ購読なし、カウンタなし、Pro 版なし。MIT ライセンス、
ソースは https://github.com/omikuji/hakarasenai

## Privacy policy (optional, English)

This extension collects no data. It makes no network requests of its own and
sends nothing to the developer or to any third party.

The only value it stores is the list of hostnames you have chosen to exclude,
kept in the browser's local extension storage on your own device. It is never
transmitted anywhere and is removed when you uninstall the extension.

The manifest declares this as `data_collection_permissions: { required: ["none"] }`.

## Version notes (v1.2.0, first release)

### English

First public release.

- Sets the opt-out flag Google Analytics reads itself, from a content script in
  the page's own world, so a strict Content Security Policy cannot block it the
  way it blocks the official add-on's injected script tag.
- Blocks the Google Analytics collection endpoints as a second layer, so nothing
  is sent even if the flag is ever defeated.
- Any site can be excluded from the toolbar button, subdomains included.
- Interface in 26 languages, chosen automatically from the browser.
- Firefox 128 or newer, on desktop and on Android.

### 日本語

初回リリースです。

- Google Analytics 自身が参照するオプトアウトのフラグを、ページと同じ world で
  動く content script から設定します。公式アドオンのように script 要素を
  挿し込まないため、厳しい Content Security Policy にブロックされません。
- 二段目として Google Analytics の計測エンドポイントをブロックします。
  万一フラグが無効化されても、データは送信されません。
- ツールバーのボタンから、サイトごとに除外できます(サブドメインを含む)。
- UI は 26 言語。ブラウザーの設定から自動で選ばれます。
- デスクトップ・Android とも Firefox 128 以上。

## Notes for reviewers

- Nothing is minified, bundled or obfuscated. What is in the ZIP is the source,
  and it matches https://github.com/omikuji/hakarasenai at the same tag.
- The extension is two layers. `src/optout.js` is registered from
  `src/background.js` as a `world: "MAIN"` content script so that it can set
  `window._gaUserPrefs`, the flag Google's own opt-out add-on sets. It is
  registered dynamically rather than declared in the manifest so that per-site
  exclusions can be applied through `excludeMatches`.
- `<all_urls>` is requested because that registration, and the opt-out flag it
  places, has to apply on every site. The extension reads no page content and
  sends nothing anywhere.
- `rules/ga.json` blocks only Google Analytics collection endpoints. Tag loaders
  and page resources are deliberately left alone.
- The repository carries the test suite that backs the description: a headless
  Firefox is run with and without the extension and the two are compared,
  including on a page served with a strict CSP.

## Screenshots

`docs/screenshots/*.png`, 1280x800, regenerate with

```bash
.test/venv/bin/python Tools/make-screenshots.py
```

Upload in this order: 01-blocking, 02-excluded, 03-dark.
