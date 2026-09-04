# Hakarasenai

[English](../README.md) · [العربية](README.ar.md) · [Čeština](README.cs.md) · [Dansk](README.da.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Suomi](README.fi.md) · [Français](README.fr.md) · [עברית](README.he.md) · [हिन्दी](README.hi.md) · [Bahasa Indonesia](README.id.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Norsk](README.nb.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Svenska](README.sv.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [Tiếng Việt](README.vi.md) · **简体中文** · [繁體中文](README.zh-Hant.md)

一个只做一件事的 Firefox 扩展:不让 Google Analytics 统计你。桌面版和 Android 版都可用。

*Hakarasenai* 的意思是「不让它测量」,这就是全部功能。

**它做什么:**

1. 告诉页面上的 Google Analytics 代码,你已经选择退出
2. 拦截那些仍然想发出去的统计数据
3. 如果某个网站因此出问题,可以从工具栏按钮把那个网站单独排除

没有选项页,没有过滤器订阅,没有计数器,没有 Pro 版。

## 为什么会有这个扩展

Google 提供官方的「Google Analytics 停用插件」,也有 Firefox 版本。
问题出在**实现方式**上:它往页面里注入一个 `<script>` 元素,
而 Firefox 和 Safari 一样,会把页面自己的 CSP 应用到内容脚本上。
在任何 CSP 严格的网站上,注入本身就被拦下,停用功能于是悄无声息地什么也没做。
没有任何东西告诉你它失败了 —— 对一个隐私工具来说,这是最糟糕的失效方式。

Hakarasenai 用的是同一个官方钩子,但把它放在 CSP 够不到的地方,
并在后面加上网络拦截作为第二层。即使第一层失效,数据依然出不去。

## 安装

### 从 AMO 安装

在 [addons.mozilla.org](https://addons.mozilla.org/) 搜索。
Android 上同样从 AMO 安装 —— 扩展声明了 `gecko_android`,
所以 Firefox for Android 会把它列为可安装项。

### 从源码临时加载

不需要构建。打开 `about:debugging#/runtime/this-firefox`,
选择**临时载入附加组件**,然后选中本仓库的 `manifest.json`。
它会一直有效,直到你关闭 Firefox。

桌面和 Android 都需要 Firefox 128 或更高版本,
因为 `world: "MAIN"` 内容脚本从 128 才开始支持。

要生成上传 AMO 的 zip:

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint` 和 `make run` 使用 `web-ext`(首次由 `npx` 下载)。
`make lint` 会故意报出两条警告:数据收集声明
(`data_collection_permissions: none`)只有 Firefox 140 及以上才会读取,
而 `strict_min_version` 是 128,所以检查器指出了这个落差。
在 128–139 上这个键会被直接忽略,不值得为了消除警告而收窄支持范围。

### 在 Firefox for Android 上从源码运行

```bash
adb devices                      # 查出设备 id
make run-android DEVICE=<id>
```

需要 adb、手机上的 USB 调试,以及在 Firefox 设置中打开*通过 USB 远程调试*。

## 使用

只有一个控件:工具栏按钮。它显示当前网站的状态,并只提供一个操作。

| 状态 | 含义 |
| --- | --- |
| **拦截中** | 两层在这个网站上都开着。这是所有网站的默认状态 |
| **已排除** | 两层在这个网站上都关着,工具栏图标会带上 `OFF` 标记 |

**排除此网站**会把该网站同时写入一条动态 `allow` 规则和
内容脚本的 `excludeMatches`,所以排除是真的生效,而不只是界面上的显示。
排除以**可注册域名为单位,并包含子域名**:排除 `example.com`
也会排除 `www.example.com` 和 `shop.example.com`。从下一次页面加载开始生效。

这是为了你想被统计的场合准备的 —— 比如验证自己网站上的 GA。
`OFF` 标记在 Android 上不会绘制,但弹出面板仍会显示你处于哪种状态。

## 工作原理

### 第一层 —— 声明已选择退出

`ga.js`、`analytics.js` 和 `gtag.js` 在发送前都会检查
`window._gaUserPrefs.ioo()`(*ioo* = is opted out),返回 true 就停止发送。
这和 Google 自家插件设置的是同一个标志,是 Google Analytics 自己留的出口。

`src/optout.js` 以 `world: "MAIN"` 内容脚本的形式注册在 `document_start`,
因此在网站代码运行之前,标志就已经在页面的全局对象上了。
不往 DOM 里插入任何东西,CSP 也就无从拦起。
网站也无法覆盖这个标志:这里用的是空操作的 setter 而不是不可写属性,
所以严格模式的页面即使赋值也不会抛错,只是被静默忽略。

### 第二层 —— 拦截统计数据

`rules/ga.json` 里只有五条 declarativeNetRequest 静态规则:

| 域名 | 拦截内容 |
| --- | --- |
| `*.google-analytics.com` | 任何含 `/collect` 的 URL —— `/collect`、`/j/collect`、`/g/collect`、`/r/collect`,以及 `region1.` 等区域主机 |
| `*.google-analytics.com` | `/batch`,analytics.js 的批量发送通道 |
| `*.analytics.google.com` | `/g/collect` 和 `/g/s/collect`,GA4 的区域端点 |
| `stats.g.doubleclick.net` | `/collect`,启用 Google 信号时使用 |

**不拦截的:** `googletagmanager.com`(`gtag.js`、`gtm.js`)
以及 `google-analytics.com` 提供的脚本本身。
选择退出的含义是让代码加载但不让它上报;
把加载器一并干掉,会连带打断网站通过代码管理器驱动的其他功能。
有了第一层,即使加载了,GA 也保持沉默。

因为没有任何页面资源被拦截,基本不会因此弄坏网站。

## 确认它在起作用

1. 打开一个使用 GA 的网站
2. `F12` → **网络**,用 `collect` 过滤
3. 指向 `www.google-analytics.com/g/collect` 之类的请求应显示为被拦截
   (`NS_ERROR_ABORTED`)—— 这是第二层
4. 在控制台里,`_gaUserPrefs.ioo()` 应返回 `true` —— 这是第一层。
   如果提示 `_gaUserPrefs is not defined`,说明内容脚本没有注册成功,见「疑难排解」

## 测试

```bash
make setup-test   # 只需一次:Firefox 压缩包、geckodriver,以及装了 selenium 的 venv
make test
```

`setup-test` 安装到 `~/opt/firefox`、`~/.local/bin` 和 `.test/` —— 不碰系统软件包,不需要 root。

**`make unit`** 针对 WebExtension API 的桩运行排除逻辑。只用 node,不需要浏览器。

**`make test-browser`** 会启动两次真实的 headless Firefox —— 一次装扩展,一次不装 ——
然后比较两者。对照运行才是关键:它证明网络确实可达,
并且那个标志确实来自扩展。它检查:

- 停用标志被设置,**包括在带严格 CSP 的页面上** ——
  正是 Google 自家插件悄悄失效的那种情形
- 给 `_gaUserPrefs` 赋值的网站无法把自己改回加入统计,而且赋值时不会抛错
- GA4、Universal Analytics 和区域 `/collect` 请求被拦截,在严格 CSP 下同样如此
- `gtag.js` 仍然能加载,同源的 `/collect` 不受影响 —— 也就是说规则没有过度拦截

Android 版本没有在真机上跑过。它用到的每个 API 都对照 MDN 的
browser-compat-data 查过,支持情况与桌面一致,但那是纸面核对,不是测试。

## 它做不到的事

- **服务端 GTM 和第一方统计。** 如果网站用自己的域名(比如 `metrics.example.com`)
  接收,再从服务器转发给 GA,这些流量和发往该网站的普通流量无法区分,
  第二层抓不到。第一层仍然有效,因为发送方是页面上的 gtag.js。
- **GA 以外的分析产品**不在范围内。这个扩展只针对 Google Analytics 做停用。
- **纯服务端 Measurement Protocol** 的请求根本不经过浏览器,
  任何浏览器扩展都拦不住。

## 隐私

这个扩展**不收集任何数据,也不向任何地方发送数据**。它自己不发起网络请求。
唯一保存的是你排除的主机名列表(`storage.local`),而且它从不离开本机。
清单文件中也以 `data_collection_permissions: { required: ["none"] }` 作了声明。

## 语言

26 种语言,根据浏览器的语言设置自动选择,没有需要配置的地方:

阿拉伯语、简体中文、繁体中文、捷克语、丹麦语、荷兰语、英语、芬兰语、法语、
德语、希伯来语、印地语、印尼语、意大利语、日语、韩语、挪威语、波兰语、
葡萄牙语(巴西)、俄语、西班牙语、瑞典语、泰语、土耳其语、乌克兰语、越南语。

其中大多数并非母语者所写,所以订正是最受欢迎的一类 pull request。
添加语言的做法是把 `_locales/en/messages.json` 复制为
`_locales/<代码>/messages.json`,只翻译 `message` 的值,
保留键名和 `description` 不动。一共十一条字符串。缺失的部分会回退到英语。

这份 README 也有翻译 —— 其他语言在 `translations/` 目录里,
本文件顶部有列表。英语版是正本;添加语言后运行
`python3 Tools/sync-readme-nav.py` 来刷新这些链接。

## 发布(维护者备忘)

Firefox 不会永久安装未签名的扩展,所以无论哪种方式,分发都要经过 Mozilla:

- **上架(listed)** —— 在 [AMO Developer Hub](https://addons.mozilla.org/developers/)
  上传 `dist/*.zip`。经过审核、签名,然后发布到 addons.mozilla.org。
  上架提交无法自动化;`web-ext sign --channel=listed` 也只是提交审核。
- **不上架(unlisted)**,即自行分发 —— 准备
  [AMO API 密钥](https://addons.mozilla.org/developers/addon/api/key/)后执行
  `make sign`,会得到一个签名过的 `.xpi`,可以自己托管。
  注意自行分发的扩展无法安装到 Firefox for Android 上。

不需要附带源码:这里没有压缩或打包过的东西。

## 疑难排解

- **`_gaUserPrefs` 是 undefined** —— 多半是网站访问权限被撤销了。
  在 `about:addons` 打开这个扩展的**权限**,允许访问所有网站。
  权限一恢复,它会自动重新注册
- **在 Firefox 127 或更早版本上毫无反应** —— `world: "MAIN"` 内容脚本
  需要 Firefox 128。请升级
- **排除没有生效** —— 排除以域名为单位、包含子域名,并从下一次页面加载开始生效
- **网站坏了,但排除之后也没修好** —— 那就不是这个扩展造成的。
  被拦截的只有 `/collect` 请求,脚本和页面资源从不拦截

## 支持

Hakarasenai 是免费的,并且会一直免费。
如果它一直把你挡在别人的仪表盘之外,
通过 [GitHub Sponsors](https://github.com/sponsors/omikuji) 赞助这项工作会很感谢,
这也是本项目唯一的资金来源。

赞助支付的是维护成本,真正的开销就在那里:
Google 会迁移和新增收集端点,去年还算周全的规则集,不知不觉就不再周全。
赞助也能买下目前只在纸面上核对过的 Android 真机。

问题、故障和想法都欢迎:

- [X (@omikuji_man)](https://x.com/omikuji_man)
- [联系表单](https://omikuji.dev/contact/)
- [在 GitHub 上提 issue](https://github.com/omikuji/hakarasenai/issues)

## 许可证

MIT License。
