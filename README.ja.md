# Hakarasenai(測らせない)

Google Analytics に測らせないだけの Firefox 拡張。デスクトップと Android の両方。

**できること(これがすべて):**

1. ページ内の Google Analytics に「この利用者はオプトアウト済み」と伝える
2. それでも出ていこうとする計測通信をブロックする
3. 都合が悪いサイトは、ツールバーのボタンから **そのサイトだけ除外** できる

設定画面なし、フィルタ購読なし、統計もカウンタもなし、Pro 版なし。

[English README](README.md)

## なぜ作ったか

Google 公式の「Google Analytics オプトアウト アドオン」は Firefox 版もある。
問題は **やり方** で、ページに `<script>` を挿し込む方式のため、
CSP の厳しいサイトでは注入自体がブロックされてオプトアウトが黙って無効になる
(Firefox は Safari と同じく content script にもページの CSP を適用する)。
効いていないことが外から分からない — プライバシーツールとしては最悪の壊れ方をする。

この拡張は同じ公式フックを使いつつ、CSP の届かない場所(`world: "MAIN"`)に置き、
その後ろに通信ブロックを二段目として重ねる。一段目が何かの理由で効かなくても、データは出ていかない。

## インストール

### AMO から(公開後)

[addons.mozilla.org](https://addons.mozilla.org/) で探す。
Android でも同じく AMO から入る(`gecko_android` を宣言してあるため、
Firefox for Android がインストール対象として扱う)。

### ソースから一時的に読み込む

ビルド不要。`about:debugging#/runtime/this-firefox` を開き、
**「一時的なアドオンを読み込む」** → このリポジトリの `manifest.json` を選ぶ。
Firefox を閉じるまで有効。

デスクトップ・Android とも **Firefox 128 以上** が必要
(`world: "MAIN"` の content script が 128 からのため)。

AMO に上げる zip が要る場合:

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint` / `make run` は `web-ext` を使う(`npx` が初回にダウンロードする)。
`make lint` は警告を 2 本出すが、これは想定どおり。
データ収集の申告(`data_collection_permissions: none`)は Firefox 140 以降でしか読まれないキーで、
`strict_min_version` が 128 なので「古い版では未対応」と指摘されるだけ。
128〜139 では単に無視されるので、対応範囲を狭めてまで消す必要はないと判断した。

### Android 実機にソースから入れる

```bash
adb devices                      # デバイス ID を調べる
make run-android DEVICE=<id>
```

adb、端末側の USB デバッグ、Firefox 設定の **USB 経由のリモートデバッグ** が要る。

## 仕組み

### 一段目 — オプトアウトを伝える

`ga.js` / `analytics.js` / `gtag.js` はいずれも、送信前に
`window._gaUserPrefs.ioo()`(ioo = is opted out)を見て、true なら送信をやめる。
Google 公式アドオンと同じフラグで、GA 自身が用意している正規の抜け道。

`src/optout.js` を `world: "MAIN"` の content script として `document_start` に走らせるので、
サイトのコードが動き出す前にフラグがページのグローバルに乗っている。
DOM に何も挿さないため CSP に止められるものがない。
サイト側からの上書きも封じてあるが、非書き込みプロパティにすると strict mode のページが
TypeError で落ちるので、setter を no-op にして黙って無視する形にしてある。

### 二段目 — 計測通信をブロックする

declarativeNetRequest の静的ルール 5 本だけ(`rules/ga.json`)。

| 対象 | ブロックするもの |
|---|---|
| `*.google-analytics.com` | `/collect` を含む URL(`/collect`, `/j/collect`, `/g/collect`, `/r/collect`、`region1.` などの地域別ホストも含む) |
| `*.google-analytics.com` | `/batch`(analytics.js のまとめ送信) |
| `*.analytics.google.com` | `/g/collect`, `/g/s/collect`(GA4 の地域別エンドポイント) |
| `stats.g.doubleclick.net` | `/collect`(Google シグナル有効時の送信先) |

**ブロックしないもの:** `googletagmanager.com`(`gtag.js` / `gtm.js`)と、
`google-analytics.com` が配るスクリプト本体。
読み込ませたうえで報告させないのがオプトアウトであって、
ローダーごと落とすとタグマネージャ経由の他機能まで巻き添えになる。
一段目があるので、読み込まれても GA は黙ったまま。

ページのリソース取得を一切止めないので、これが原因でサイトが壊れることはまずない。

## サイトごとの除外

ツールバーのアイコンを押すと、そのサイトの状態が出る。
**「このサイトを除外する」** で一段目・二段目の両方が止まる
(動的な `allow` ルールと content script の `excludeMatches` の両方に入る)。
除外中のタブには `OFF` バッジが出る(デスクトップのみ。Android は拡張のバッジを描画しない)。

除外は **登録ドメイン単位でサブドメインも含む**。
`example.com` を除外すると `www.example.com` も `shop.example.com` も外れる。

自分のサイトの GA を検証したいときなど、意図して測られたいときに使う。

## 効いているか確かめる

1. GA を使っているサイトを開く
2. `F12` → **ネットワーク** タブで `collect` で絞り込む
3. `www.google-analytics.com/g/collect` などが **ブロック**(`NS_ERROR_ABORTED`)になっていれば二段目が効いている
4. コンソールで `_gaUserPrefs.ioo()` が `true` を返せば一段目も効いている。
   `_gaUserPrefs is not defined` なら content script が登録できていない → トラブルシュートへ

## テスト

```bash
make setup-test   # 初回だけ: Firefox 本体・geckodriver・selenium 入り venv
make test
```

`setup-test` の入れ先は `~/opt/firefox`・`~/.local/bin`・`.test/`。
システムパッケージには触らないので root は要らない。

**`make unit`** は除外まわりのロジックを WebExtension API のスタブに対して回す。node だけで動く。

**`make test-browser`** は実際の headless Firefox を 2 回起動し、
**拡張を入れた状態と入れない状態を比べる**。この対照実行が肝で、
これによって「そもそもネットワークが届いているか」と
「そのフラグは本当に拡張が置いたものか」が担保される。見ているのは:

- オプトアウトのフラグが立つこと。**CSP の厳しいページでも立つこと**
  — Google 公式アドオンが黙って失敗するのがまさにこのケース
- サイトが `_gaUserPrefs` に代入してもオプトインに戻せないこと、かつそれで例外が飛ばないこと
- GA4・ユニバーサルアナリティクス・地域別の `/collect` がブロックされること(CSP 下でも)
- `gtag.js` は読み込めること、同一オリジンの `/collect` は素通しであること
  — つまり過剰ブロックしていないこと

Android 版は実機で動かしていない。使っている API は MDN の browser-compat-data で
すべてデスクトップと同等(mirror)であることを確認したが、これは机上の確認であってテストではない。

## 効かないケース(正直なところ)

- **サーバーサイド GTM / ファーストパーティ計測**
  サイト自身のドメイン(例: `metrics.example.com`)で受けてからサーバー側で GA に転送する構成は、
  通信の見た目がサイト自身への通信と区別できないので二段目では止められない。
  ただし送信しているのはページ上の gtag.js なので、**一段目のフラグは効く**。
- **GA 以外の解析ツール** は対象外。これは Google Analytics のオプトアウトだけをする拡張。
- **Measurement Protocol による純サーバーサイド送信** はブラウザを通らないので、
  ブラウザ拡張の原理として止められない。

## プライバシー

この拡張は**何も収集せず、どこにも送信しない**。自分から外部通信もしない。
保存するのは、あなたが除外したサイトのホスト名の一覧(`storage.local`)だけで、これも端末から出ない。
マニフェストでも `data_collection_permissions: { required: ["none"] }` と申告している。

## 翻訳

UI は [`_locales/`](_locales/) に 15 言語入っている:
英語・日本語・ドイツ語・スペイン語・フランス語・イタリア語・韓国語・オランダ語・
ポーランド語・ポルトガル語(ブラジル)・ロシア語・トルコ語・ウクライナ語・簡体字中国語・繁体字中国語。

追加するときは `_locales/en/messages.json` を `_locales/<コード>/messages.json` にコピーし、
`message` の値だけを訳して(キーと `description` は触らない)プルリクエストを送ってほしい。文字列は 11 本。

## 公開のしかた(メンテナ向けメモ)

Firefox は署名なしの拡張を恒久的にインストールしないので、配布はどちらにせよ Mozilla を通る:

- **リスト公開(listed)** — [AMO Developer Hub](https://addons.mozilla.org/developers/) に
  `dist/*.zip` をアップロード。審査 → 署名 → addons.mozilla.org に掲載。
  この経路は自動化できない(`web-ext sign --channel=listed` も審査への提出まで)。
- **非公開(unlisted・自己配布)** — [AMO の API キー](https://addons.mozilla.org/developers/addon/api/key/)
  を用意して `make sign`。署名済み `.xpi` が落ちてくるので自分で配れる。

ソースコードの添付は不要(minify もバンドルもしていないため)。

## トラブルシュート

- **`_gaUserPrefs` が undefined** → サイトへのアクセス許可が外れている可能性。
  `about:addons` → この拡張 → **許可** で「すべてのサイト」を ON にする。
  許可が戻れば自動で登録し直す
- **Firefox 127 以下で何も起きない** → `world: "MAIN"` の content script が Firefox 128 からのため。128 以上に上げる
- **除外したのに反映されない** → 除外はドメイン単位でサブドメインも含む。反映は次のページ読み込みから

## ライセンス

MIT License。
