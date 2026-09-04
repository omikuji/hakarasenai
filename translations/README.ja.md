# Hakarasenai

[English](../README.md) · [العربية](README.ar.md) · [Čeština](README.cs.md) · [Dansk](README.da.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Suomi](README.fi.md) · [Français](README.fr.md) · [עברית](README.he.md) · [हिन्दी](README.hi.md) · [Bahasa Indonesia](README.id.md) · [Italiano](README.it.md) · **日本語** · [한국어](README.ko.md) · [Norsk](README.nb.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Svenska](README.sv.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [Tiếng Việt](README.vi.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md)

Google Analytics に測らせないことだけをする Firefox 拡張。デスクトップと Android の両方。

*Hakarasenai*(測らせない)は「measure させない」という意味で、それが機能のすべて。

**できること:**

1. ページ内の Google Analytics に「この利用者はオプトアウト済み」と伝える
2. それでも出ていこうとする計測通信をブロックする
3. 都合が悪いサイトは、ツールバーのボタンからそのサイトだけ除外できる

設定画面なし、フィルタ購読なし、統計もカウンタもなし、Pro 版なし。

## なぜ作ったか

Google 公式の「Google Analytics オプトアウト アドオン」には Firefox 版もある。
問題は **やり方** で、ページに `<script>` 要素を挿し込む方式のため、
Firefox は Safari と同じく content script にもページ側の CSP を適用する。
CSP の厳しいサイトでは注入自体がブロックされ、オプトアウトは黙って何もしない。
失敗したことは何も教えてくれない — プライバシーツールとしては最悪の壊れ方をする。

この拡張は同じ公式フックを使いつつ、CSP の届かない場所にそれを置き、
その後ろに通信ブロックを二段目として重ねる。
一段目が何かの理由で効かなくても、データは出ていかない。

## インストール

### AMO から

[addons.mozilla.org](https://addons.mozilla.org/) で探す。
Android でも同じく AMO から入る。`gecko_android` を宣言してあるので、
Firefox for Android がインストール対象として扱う。

### ソースから一時的に読み込む

ビルド不要。`about:debugging#/runtime/this-firefox` を開き、
**一時的なアドオンを読み込む** から、このリポジトリの `manifest.json` を選ぶ。
Firefox を閉じるまで有効。

デスクトップ・Android とも Firefox 128 以上が必要。
`world: "MAIN"` の content script が 128 からのため。

AMO に上げる zip を作る場合:

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint` と `make run` は `web-ext` を使う(`npx` が初回に取ってくる)。
`make lint` は意図的に警告を 2 本出す。データ収集の申告
(`data_collection_permissions: none`)は Firefox 140 以降でしか読まれないキーで、
`strict_min_version` が 128 なので、リンタがその食い違いを指摘する。
128〜139 では単に無視されるだけなので、これを消すために対応範囲を狭める価値はない。

### Android 実機にソースから入れる

```bash
adb devices                      # デバイス ID を調べる
make run-android DEVICE=<id>
```

adb、端末側の USB デバッグ、Firefox 設定の *USB 経由のリモートデバッグ* が要る。

## 使い方

操作するものはツールバーのボタン 1 つだけ。
現在のサイトの状態を表示し、アクションを 1 つだけ提供する。

| 状態 | 意味 |
| --- | --- |
| **遮断中** | このサイトで両方の層が動いている。どこでもこれが既定 |
| **除外中** | このサイトでは両方の層が止まっている。アイコンに `OFF` バッジが付く |

**このサイトを除外する** を押すと、そのサイトが動的な `allow` ルールと
content script の `excludeMatches` の両方に入る。見かけだけでなく本当に止まる。
除外は **登録ドメイン単位でサブドメインも含む**。`example.com` を除外すると
`www.example.com` も `shop.example.com` も外れる。反映は次のページ読み込みから。

意図して測られたいとき — 自分のサイトの GA を検証するときなど — に使う。
`OFF` バッジは Android では描画されないが、ポップアップにはどちらの状態かが出る。

## 仕組み

### 一段目 — オプトアウトを伝える

`ga.js` / `analytics.js` / `gtag.js` はいずれも、送信前に
`window._gaUserPrefs.ioo()`(*ioo* = is opted out)を確認し、
true なら送信をやめる。Google 公式アドオンが立てるのと同じフラグで、
Google Analytics 自身が用意している抜け道。

`src/optout.js` を `world: "MAIN"` の content script として `document_start` に
登録するので、サイトのコードが動き出す前にフラグがページのグローバルに乗っている。
DOM には何も挿し込まないため、CSP に止められるものがない。
サイト側から上書きすることもできない。非書き込みプロパティではなく
setter を no-op にしてあるので、strict mode のページが代入しても
例外にはならず、黙って無視される。

### 二段目 — 計測通信をブロックする

declarativeNetRequest の静的ルール 5 本だけ(`rules/ga.json`):

| ドメイン | ブロックするもの |
| --- | --- |
| `*.google-analytics.com` | `/collect` を含む URL — `/collect`、`/j/collect`、`/g/collect`、`/r/collect`、`region1.` などの地域別ホストも |
| `*.google-analytics.com` | `/batch`(analytics.js のまとめ送信) |
| `*.analytics.google.com` | `/g/collect` と `/g/s/collect`(GA4 の地域別エンドポイント) |
| `stats.g.doubleclick.net` | `/collect`(Google シグナル有効時の送信先) |

**ブロックしないもの:** `googletagmanager.com`(`gtag.js` / `gtm.js`)と、
`google-analytics.com` が配るスクリプト本体。
読み込ませたうえで報告させないのがオプトアウトであって、
ローダーごと落とすとタグマネージャ経由の他機能まで巻き添えになる。
一段目があるので、読み込まれても GA は黙ったまま。

ページのリソース取得を一切止めないため、これが原因でサイトが壊れることはまずない。

## 効いているか確かめる

1. GA を使っているサイトを開く
2. `F12` → **ネットワーク** タブで `collect` で絞り込む
3. `www.google-analytics.com/g/collect` などが **ブロック**(`NS_ERROR_ABORTED`)
   になっていれば二段目が効いている
4. コンソールで `_gaUserPrefs.ioo()` が `true` を返せば一段目も効いている。
   `_gaUserPrefs is not defined` なら content script が登録できていない
   — トラブルシュートへ

## テスト

```bash
make setup-test   # 初回だけ: Firefox 本体・geckodriver・selenium 入り venv
make test
```

`setup-test` の入れ先は `~/opt/firefox`・`~/.local/bin`・`.test/`。
システムパッケージには触らず、root も要らない。

**`make unit`** は除外まわりのロジックを WebExtension API のスタブに対して回す。
node だけで動き、ブラウザは要らない。

**`make test-browser`** は実際の headless Firefox を 2 回起動し、
拡張を入れた状態と入れない状態を比べる。この対照実行が肝で、
これによって「そもそもネットワークが届いているか」と
「そのフラグは本当に拡張が置いたものか」が担保される。確認しているのは:

- オプトアウトのフラグが立つこと。**CSP の厳しいページでも立つこと**
  — Google 公式アドオンが黙って失敗するのがまさにこのケース
- サイトが `_gaUserPrefs` に代入してもオプトインに戻せないこと、
  かつその際に例外が飛ばないこと
- GA4・ユニバーサルアナリティクス・地域別の `/collect` がブロックされること。
  CSP 下でも同様であること
- `gtag.js` は読み込めること、同一オリジンの `/collect` は素通しであること
  — つまり過剰ブロックしていないこと

Android 版は実機で動かしていない。使っている API はすべて MDN の
browser-compat-data で確認し、デスクトップと同等であることが分かっているが、
これは机上の確認であってテストではない。

## 効かないケース

- **サーバーサイド GTM とファーストパーティ計測。**
  サイト自身のドメイン(たとえば `metrics.example.com`)で受けてから
  サーバー側で GA に転送する構成は、通信の見た目がそのサイトへの
  普通の通信と区別できないので、二段目では捕まえられない。
  送信しているのはページ上の gtag.js なので、一段目は効く。
- **GA 以外の解析ツール** は対象外。これは Google Analytics のオプトアウトだけをする。
- **純粋にサーバーサイドの Measurement Protocol** による送信はブラウザを通らないので、
  どんなブラウザ拡張にも止められない。

## プライバシー

この拡張は **何も収集せず、どこにも送信しない**。自分から外部通信もしない。
保存するのは、あなたが除外したサイトのホスト名の一覧(`storage.local`)だけで、
これも端末から出ない。マニフェストでも
`data_collection_permissions: { required: ["none"] }` と申告している。

## 言語

26 言語。ブラウザの言語設定から自動で選ばれるので、設定するものはない:

アラビア語、中国語(簡体字・繁体字)、チェコ語、デンマーク語、オランダ語、英語、
フィンランド語、フランス語、ドイツ語、ヘブライ語、ヒンディー語、インドネシア語、
イタリア語、日本語、韓国語、ノルウェー語、ポーランド語、ポルトガル語(ブラジル)、
ロシア語、スペイン語、スウェーデン語、タイ語、トルコ語、ウクライナ語、ベトナム語。

大半はネイティブスピーカーが書いたものではないので、修正はいちばん歓迎する
プルリクエスト。言語を追加するには `_locales/en/messages.json` を
`_locales/<コード>/messages.json` にコピーし、`message` の値だけを訳す
(キーと `description` は触らない)。文字列は 11 本。
訳が欠けている分は英語にフォールバックする。

この README も翻訳されている。他の言語は `translations/` にあり、
このファイルの先頭に一覧がある。英語版が正本で、
言語を追加したら `python3 Tools/sync-readme-nav.py` を実行してリンクを更新する。

## 公開のしかた(メンテナ向けメモ)

Firefox は署名なしの拡張を恒久的にインストールしないので、
配布はどちらにせよ Mozilla を通る:

- **リスト公開(listed)** — [AMO Developer Hub](https://addons.mozilla.org/developers/)
  に `dist/*.zip` をアップロードする。審査 → 署名 → addons.mozilla.org に掲載。
  この経路は自動化できない。`web-ext sign --channel=listed` も審査への提出まで。
- **非公開(unlisted)**、つまり自己配布 —
  [AMO の API キー](https://addons.mozilla.org/developers/addon/api/key/)
  を用意して `make sign`。署名済み `.xpi` が得られるので自分で配れる。
  ただし自己配布のアドオンは Firefox for Android にはインストールできない。

ソースコードの添付は不要。minify もバンドルもしていない。

## トラブルシュート

- **`_gaUserPrefs` が undefined** — サイトへのアクセス許可が外れている可能性が高い。
  `about:addons` でこの拡張の **許可** を開き、すべてのサイトへのアクセスを許可する。
  許可が戻れば自動で登録し直す
- **Firefox 127 以下で何も起きない** — `world: "MAIN"` の content script は
  Firefox 128 から。アップグレードする
- **除外が反映されない** — 除外はドメイン単位でサブドメインを含み、
  反映は次のページ読み込みから
- **サイトが壊れたが除外しても直らない** — それはこの拡張のせいではない。
  ブロックしているのは `/collect` への通信だけで、
  スクリプトやページのリソースは決して止めない

## サポート

Hakarasenai は無料で、これからもずっと無料。
もしこれが誰かのダッシュボードからあなたを外し続けているなら、
[GitHub Sponsors](https://github.com/sponsors/omikuji) での支援がありがたい。
このプロジェクトの資金源はそれだけ。

スポンサーが賄うのは維持費で、実際のコストはそこにある。
Google は収集エンドポイントを移したり増やしたりするので、
去年は網羅的だったルールがいつのまにかそうでなくなる。
現在は机上でしか確認できていない Android の実機も、支援があれば用意できる。

質問・不具合・アイデアはどれも歓迎:

- [X (@omikuji_man)](https://x.com/omikuji_man)
- [問い合わせフォーム](https://omikuji.dev/contact/)
- [GitHub で issue を立てる](https://github.com/omikuji/hakarasenai/issues)

## ライセンス

MIT License。
