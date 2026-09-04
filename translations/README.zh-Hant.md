# Hakarasenai

[English](../README.md) · [العربية](README.ar.md) · [Čeština](README.cs.md) · [Dansk](README.da.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Suomi](README.fi.md) · [Français](README.fr.md) · [עברית](README.he.md) · [हिन्दी](README.hi.md) · [Bahasa Indonesia](README.id.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Norsk](README.nb.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Svenska](README.sv.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [Tiếng Việt](README.vi.md) · [简体中文](README.zh-Hans.md) · **繁體中文**

一個只做一件事的 Firefox 擴充套件:不讓 Google Analytics 統計你。桌面版與 Android 版都能用。

*Hakarasenai* 的意思是「不讓它測量」,這就是全部的功能。

**它做什麼:**

1. 告訴頁面上的 Google Analytics 程式碼,你已經選擇退出
2. 攔截那些仍想送出去的統計資料
3. 如果某個網站因此出問題,可以從工具列按鈕把那個網站單獨排除

沒有選項頁,沒有過濾器訂閱,沒有計數器,沒有 Pro 版。

## 為什麼會有這個擴充套件

Google 提供官方的「Google Analytics 停用外掛程式」,也有 Firefox 版本。
問題出在**實作方式**:它往頁面裡注入一個 `<script>` 元素,
而 Firefox 和 Safari 一樣,會把頁面本身的 CSP 套用到內容腳本上。
在任何 CSP 嚴格的網站上,注入本身就被擋下,停用功能於是悄無聲息地什麼也沒做。
沒有任何東西告訴你它失敗了 —— 對一個隱私工具而言,這是最糟糕的失效方式。

Hakarasenai 用的是同一個官方掛鉤,但把它放在 CSP 構不到的地方,
並在後面加上網路攔截作為第二層。就算第一層失效,資料依然出不去。

## 安裝

### 從 AMO 安裝

在 [addons.mozilla.org](https://addons.mozilla.org/) 搜尋。
Android 上同樣從 AMO 安裝 —— 這個擴充套件宣告了 `gecko_android`,
所以 Firefox for Android 會把它列為可安裝項目。

### 從原始碼暫時載入

不需要建置。開啟 `about:debugging#/runtime/this-firefox`,
選擇**載入暫時附加元件**,然後選取本儲存庫的 `manifest.json`。
它會一直有效,直到你關閉 Firefox。

桌面與 Android 都需要 Firefox 128 或更新版本,
因為 `world: "MAIN"` 內容腳本從 128 才開始支援。

要產生上傳 AMO 的 zip:

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint` 與 `make run` 使用 `web-ext`(首次由 `npx` 下載)。
`make lint` 會刻意報出兩則警告:資料蒐集宣告
(`data_collection_permissions: none`)只有 Firefox 140 以上才會讀取,
而 `strict_min_version` 是 128,所以檢查工具指出了這個落差。
在 128–139 上這個鍵會直接被忽略,不值得為了消除警告而縮小支援範圍。

### 在 Firefox for Android 上從原始碼執行

```bash
adb devices                      # 查出裝置 id
make run-android DEVICE=<id>
```

需要 adb、手機上的 USB 偵錯,以及在 Firefox 設定中開啟*透過 USB 遠端偵錯*。

## 使用

只有一個控制項:工具列按鈕。它顯示目前網站的狀態,並只提供一個動作。

| 狀態 | 意義 |
| --- | --- |
| **攔截中** | 兩層在這個網站上都開著。這是所有網站的預設狀態 |
| **已排除** | 兩層在這個網站上都關著,工具列圖示會帶上 `OFF` 標記 |

**排除此網站**會把該網站同時寫入一條動態 `allow` 規則與
內容腳本的 `excludeMatches`,所以排除是真的生效,而不只是介面上的顯示。
排除以**可註冊網域為單位,並包含子網域**:排除 `example.com`
也會排除 `www.example.com` 與 `shop.example.com`。從下一次頁面載入開始生效。

這是為了你想被統計的場合準備的 —— 例如驗證自己網站上的 GA。
`OFF` 標記在 Android 上不會繪製,但彈出面板仍會顯示你處於哪種狀態。

## 運作方式

### 第一層 —— 宣告已選擇退出

`ga.js`、`analytics.js` 與 `gtag.js` 在送出前都會檢查
`window._gaUserPrefs.ioo()`(*ioo* = is opted out),回傳 true 就停止傳送。
這和 Google 自家外掛程式設定的是同一個旗標,是 Google Analytics 自己留的出口。

`src/optout.js` 以 `world: "MAIN"` 內容腳本的形式註冊在 `document_start`,
因此在網站程式碼執行之前,旗標就已經在頁面的全域物件上了。
不往 DOM 裡插入任何東西,CSP 也就無從攔起。
網站也無法覆寫這個旗標:這裡用的是空操作的 setter 而非唯讀屬性,
所以嚴格模式的頁面即使賦值也不會拋出例外,只是被靜默忽略。

### 第二層 —— 攔截統計資料

`rules/ga.json` 裡只有五條 declarativeNetRequest 靜態規則:

| 網域 | 攔截內容 |
| --- | --- |
| `*.google-analytics.com` | 任何含 `/collect` 的 URL —— `/collect`、`/j/collect`、`/g/collect`、`/r/collect`,以及 `region1.` 等區域主機 |
| `*.google-analytics.com` | `/batch`,analytics.js 的批次傳送通道 |
| `*.analytics.google.com` | `/g/collect` 與 `/g/s/collect`,GA4 的區域端點 |
| `stats.g.doubleclick.net` | `/collect`,啟用 Google 信號時使用 |

**不攔截的:** `googletagmanager.com`(`gtag.js`、`gtm.js`)
以及 `google-analytics.com` 提供的腳本本身。
選擇退出的意思是讓程式碼載入但不讓它回報;
把載入器一併殺掉,會連帶打斷網站透過代碼管理工具驅動的其他功能。
有了第一層,即使載入了,GA 也保持沉默。

因為沒有任何頁面資源被攔截,基本不會因此弄壞網站。

## 確認它有在運作

1. 開啟一個使用 GA 的網站
2. `F12` → **網路**,用 `collect` 過濾
3. 指向 `www.google-analytics.com/g/collect` 之類的請求應顯示為被攔截
   (`NS_ERROR_ABORTED`)—— 這是第二層
4. 在主控台裡,`_gaUserPrefs.ioo()` 應回傳 `true` —— 這是第一層。
   若顯示 `_gaUserPrefs is not defined`,表示內容腳本沒有註冊成功,見「疑難排解」

## 測試

```bash
make setup-test   # 只需一次:Firefox 壓縮檔、geckodriver,以及裝了 selenium 的 venv
make test
```

`setup-test` 安裝到 `~/opt/firefox`、`~/.local/bin` 與 `.test/` —— 不碰系統套件,不需要 root。

**`make unit`** 針對 WebExtension API 的樁執行排除邏輯。只用 node,不需要瀏覽器。

**`make test-browser`** 會啟動兩次真實的 headless Firefox —— 一次裝擴充套件,一次不裝 ——
然後比較兩者。對照執行才是關鍵:它證明網路確實可達,
而且那個旗標確實來自擴充套件。它檢查:

- 停用旗標有被設定,**包括在帶嚴格 CSP 的頁面上** ——
  正是 Google 自家外掛程式悄悄失效的那種情形
- 對 `_gaUserPrefs` 賦值的網站無法把自己改回加入統計,而且賦值時不會拋出例外
- GA4、Universal Analytics 與區域 `/collect` 請求被攔截,在嚴格 CSP 下同樣如此
- `gtag.js` 仍然能載入,同源的 `/collect` 不受影響 —— 也就是說規則沒有過度攔截

Android 版本沒有在實機上跑過。它用到的每個 API 都對照 MDN 的
browser-compat-data 查過,支援情況與桌面一致,但那是紙面核對,不是測試。

## 它做不到的事

- **伺服器端 GTM 與第一方統計。** 如果網站用自己的網域(例如 `metrics.example.com`)
  接收,再從伺服器轉送給 GA,這些流量和送往該網站的一般流量無法區分,
  第二層抓不到。第一層仍然有效,因為送出的是頁面上的 gtag.js。
- **GA 以外的分析產品**不在範圍內。這個擴充套件只針對 Google Analytics 做停用。
- **純伺服器端 Measurement Protocol** 的請求根本不經過瀏覽器,
  任何瀏覽器擴充套件都攔不住。

## 隱私

這個擴充套件**不蒐集任何資料,也不向任何地方傳送資料**。它自己不發起網路請求。
唯一儲存的是你排除的主機名稱清單(`storage.local`),而且它從不離開本機。
資訊清單中也以 `data_collection_permissions: { required: ["none"] }` 作了宣告。

## 語言

26 種語言,依瀏覽器的語言設定自動選擇,沒有需要設定的地方:

阿拉伯文、簡體中文、繁體中文、捷克文、丹麥文、荷蘭文、英文、芬蘭文、法文、
德文、希伯來文、印地文、印尼文、義大利文、日文、韓文、挪威文、波蘭文、
葡萄牙文(巴西)、俄文、西班牙文、瑞典文、泰文、土耳其文、烏克蘭文、越南文。

其中大多數並非母語者所寫,所以訂正是最受歡迎的一類 pull request。
新增語言的做法是把 `_locales/en/messages.json` 複製為
`_locales/<代碼>/messages.json`,只翻譯 `message` 的值,
保留鍵名與 `description` 不動。一共十一條字串。缺少的部分會回退到英文。

這份 README 也有翻譯 —— 其他語言在 `translations/` 目錄裡,
本檔案頂端有清單。英文版是正本;新增語言後執行
`python3 Tools/sync-readme-nav.py` 來更新這些連結。

## 發布(維護者備忘)

Firefox 不會永久安裝未簽章的擴充套件,所以無論哪種方式,散布都要經過 Mozilla:

- **上架(listed)** —— 在 [AMO Developer Hub](https://addons.mozilla.org/developers/)
  上傳 `dist/*.zip`。經過審查、簽章,然後發布到 addons.mozilla.org。
  上架提交無法自動化;`web-ext sign --channel=listed` 也只是送審。
- **不上架(unlisted)**,也就是自行散布 —— 準備
  [AMO API 金鑰](https://addons.mozilla.org/developers/addon/api/key/)後執行
  `make sign`,會得到一個已簽章的 `.xpi`,可以自己託管。
  注意自行散布的擴充套件無法安裝到 Firefox for Android 上。

不需要附上原始碼:這裡沒有壓縮或打包過的東西。

## 疑難排解

- **`_gaUserPrefs` 是 undefined** —— 多半是網站存取權限被撤銷了。
  在 `about:addons` 開啟這個擴充套件的**權限**,允許存取所有網站。
  權限一恢復,它會自動重新註冊
- **在 Firefox 127 或更舊版本上毫無反應** —— `world: "MAIN"` 內容腳本
  需要 Firefox 128。請升級
- **排除沒有生效** —— 排除以網域為單位、包含子網域,並從下一次頁面載入開始生效
- **網站壞了,但排除之後也沒修好** —— 那就不是這個擴充套件造成的。
  被攔截的只有 `/collect` 請求,腳本與頁面資源從不攔截

## 支持

Hakarasenai 是免費的,而且會一直免費。
如果它一直把你擋在別人的儀表板之外,
透過 [GitHub Sponsors](https://github.com/sponsors/omikuji) 贊助這項工作會很感謝,
這也是本專案唯一的資金來源。

贊助支付的是維護成本,真正的開銷就在那裡:
Google 會遷移與新增收集端點,去年還算周全的規則集,不知不覺就不再周全。
贊助也能買下目前只在紙面上核對過的 Android 實機。

問題、故障與想法都歡迎:

- [X (@omikuji_man)](https://x.com/omikuji_man)
- [聯絡表單](https://omikuji.dev/contact/)
- [在 GitHub 上開 issue](https://github.com/omikuji/hakarasenai/issues)

## 授權

MIT License。
