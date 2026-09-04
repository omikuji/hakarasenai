# Hakarasenai(測らせない)

Google Analytics に測らせないだけの Firefox 拡張。

**できること(これがすべて):**

1. ページ内の Google Analytics に「この利用者はオプトアウト済み」と伝える
2. それでも出ていこうとする GA への計測通信をブロックする
3. 都合が悪いサイトは、ツールバーのボタンから **そのサイトだけ除外** できる

設定画面なし、フィルタ購読なし、統計もカウンタもなし、Pro 版なし。

## なぜ作ったか

Google 公式の「Google Analytics オプトアウト アドオン」は Firefox 版もあるが、
**ページに `<script>` を挿し込む方式なので、CSP の厳しいサイトでは注入自体がブロックされて効かない**
(Firefox と Safari は content script にもページの CSP を適用するため)。
効いていないことがユーザーからは分からない、というのがいちばん困る。

この拡張は同じ仕組みを CSP の影響を受けない形(`world: "MAIN"`)で実装し、
さらに**通信ブロックを二段目に置く**ので、一段目が何かの理由で効かなくても計測データは出ていかない。

## インストール

### AMO から(公開後)

addons.mozilla.org から入れる。

### 自分でビルドして一時的に入れる

zip は作らなくてよい。Firefox で `about:debugging#/runtime/this-firefox` を開き、
**「一時的なアドオンを読み込む」** → このリポジトリの `manifest.json` を選ぶ。
Firefox を閉じるまで有効。

AMO に上げる zip が要る場合:

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint` / `make run` は `web-ext` を使う(`npx` が初回にダウンロードする)。

Firefox 128 以上が必要(`world: "MAIN"` の content script を使うため)。

`make lint` は警告を 2 本出すが、これは想定どおり。
データ収集の申告(`data_collection_permissions: none`)は Firefox 140 以降でしか読まれないキーで、
`strict_min_version` を 128 にしているぶん「古い版では未対応」と言われるだけ。
128〜139 では単に無視されるので、対応範囲を狭めてまで消す必要はないと判断した。

## 仕組み

### 一段目 — オプトアウトを伝える

`ga.js` / `analytics.js` / `gtag.js` はいずれも、送信前に
`window._gaUserPrefs.ioo()`(ioo = is opted out)を見て、true なら送信をやめる分岐を持っている。
Google 公式アドオンと同じフラグで、GA 自身が用意している正規の抜け道。

`src/optout.js` を `world: "MAIN"` の content script として `document_start` に走らせ、
このフラグをページのグローバルに置く。`<script>` を DOM に挿さないので CSP に止められない。
サイト側から代入で上書きされないよう、setter は握りつぶす
(非書き込みプロパティにすると strict mode のサイトが TypeError で落ちるため、
黙って無視する形にしてある)。

### 二段目 — 計測通信をブロックする

declarativeNetRequest の静的ルール 5 本だけ(`rules/ga.json`)。

| 対象 | ブロックするもの |
|---|---|
| `*.google-analytics.com` | `/collect` を含む URL(`/collect`, `/j/collect`, `/g/collect`, `/r/collect`, `region1.` などの地域別も含む) |
| `*.google-analytics.com` | `/batch`(analytics.js のまとめ送信) |
| `*.analytics.google.com` | `/g/collect`, `/g/s/collect`(GA4 の地域別エンドポイント) |
| `stats.g.doubleclick.net` | `/collect`(Google シグナル有効時の送信先) |

**ブロックしないもの:** `googletagmanager.com` の `gtag.js` / `gtm.js` 本体、
`google-analytics.com` が配る `analytics.js` などのスクリプト。
読み込ませたうえで「送らせない」のがオプトアウトであって、
ローダーごと落とすとタグマネージャ経由の他機能まで壊れるため。
一段目のフラグがあるので、読み込まれても GA は送信しない。

主要リソースの取得は止めないので、これが原因でサイトが壊れることはまずない。

## サイトごとの除外

ツールバーのアイコンを押すと、そのサイトの状態が出る。
「このサイトを除外する」を押すと、そのサイトでは一段目・二段目の両方を止める
(動的な allow ルールと `excludeMatches` の両方に入る)。除外中はアイコンに `OFF` バッジが出る。

除外は **登録ドメイン単位** で、サブドメインも一緒に外れる
(`example.com` を除外すると `www.example.com` も `shop.example.com` も外れる)。

自分のサイトの GA を検証したいときなど、一時的に測られたいときに使う。

## 効かないケース(正直なところ)

- **サーバーサイド GTM / ファーストパーティ計測**
  サイト自身のドメイン(例: `metrics.example.com`)で受けてからサーバー側で GA に転送する構成は、
  通信の見た目がサイト自身への通信と区別できないので二段目では止められない。
  ただしこの場合も **一段目のフラグは効く**(送信するのはページ上の gtag.js なので)。
- **GA 以外の解析ツール** は対象外。これは GA のオプトアウトだけをする拡張。
- **Measurement Protocol による純サーバーサイド送信**(ブラウザを一切通らないもの)は、
  ブラウザ拡張の原理的に止められない。

## 効いているか確かめる

1. GA を使っているサイトを開く
2. `F12` → **ネットワーク** タブで `collect` で絞り込む
3. `www.google-analytics.com/g/collect` などが **NS_ERROR_ABORTED / ブロック** になっていればニ段目が効いている
4. コンソールで `_gaUserPrefs.ioo()` と打って `true` が返れば一段目も効いている
   (`_gaUserPrefs is not defined` なら content script が登録できていない → 下記)

## トラブルシュート

- **`_gaUserPrefs` が undefined** → サイトへのアクセス許可が外れている可能性。
  `about:addons` → この拡張 → 「許可」で「すべてのサイトのデータへのアクセス」を ON にする。
  許可を戻せば自動で再登録される
- **Firefox 127 以下で動かない** → `world: "MAIN"` の content script が Firefox 128 からのため。
  128 以上に上げる
- **除外したのに止まらない/止まる** → 除外はドメイン単位。
  サブドメインごと外れる点と、除外の反映はページ再読み込み後である点に注意

## プライバシー

この拡張は**何も収集せず、どこにも送信しない**
(マニフェストの `data_collection_permissions` も `none` で申告している)。
外部との通信もしない。ブラウザに保存するのは、あなたが除外したサイトのホスト名の一覧
(`storage.local`)だけで、これも端末内から出ない。

## ライセンス

MIT License。
