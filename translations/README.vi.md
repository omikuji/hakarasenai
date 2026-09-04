# Hakarasenai

[English](../README.md) · [العربية](README.ar.md) · [Čeština](README.cs.md) · [Dansk](README.da.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Suomi](README.fi.md) · [Français](README.fr.md) · [עברית](README.he.md) · [हिन्दी](README.hi.md) · [Bahasa Indonesia](README.id.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Norsk](README.nb.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Svenska](README.sv.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · **Tiếng Việt** · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md)

Một tiện ích Firefox chỉ làm đúng một việc: không để Google Analytics đo lường
bạn. Trên máy tính và trên Android.

*Hakarasenai* nghĩa là "không cho nó đo" — và đó là toàn bộ danh sách tính năng.

**Nó làm gì:**

1. Báo cho mã Google Analytics trên trang biết rằng bạn đã từ chối theo dõi
2. Chặn dữ liệu đo lường vốn vẫn sẽ được gửi đi
3. Cho phép bạn loại trừ riêng một trang web từ nút trên thanh công cụ, nếu có
   trang nào giở chứng

Không trang tùy chọn, không đăng ký danh sách lọc, không bộ đếm, không bản Pro.

## Vì sao có tiện ích này

Google phát hành "Google Analytics Opt-out Add-on" chính thức, và có cả bản dựng
cho Firefox. Vấn đề nằm ở **cách** nó hoạt động: nó chèn một phần tử `<script>`
vào trang, mà Firefox — giống Safari — lại áp CSP của chính trang đó lên cả
content script. Trên bất kỳ trang nào có CSP nghiêm ngặt, việc chèn bị chặn và
tùy chọn từ chối lặng lẽ chẳng làm gì cả. Không có gì báo cho bạn biết nó đã thất
bại, và đó là kiểu hỏng tệ nhất mà một công cụ riêng tư có thể mắc phải.

Hakarasenai dùng đúng cái móc chính thức đó, nhưng đặt nó ở nơi không CSP nào với
tới, rồi dựng thêm lớp chặn mạng phía sau làm lớp thứ hai. Nếu lớp thứ nhất có
lúc nào đó hỏng, dữ liệu vẫn không đi ra ngoài.

## Cài đặt

### Từ AMO

Tìm nó trên [addons.mozilla.org](https://addons.mozilla.org/). Trên Android cũng
cài từ AMO theo cách tương tự — tiện ích khai báo `gecko_android`, nên Firefox
cho Android sẽ đề xuất nó.

### Nạp tạm thời từ mã nguồn

Không cần biên dịch. Mở `about:debugging#/runtime/this-firefox`, chọn
**Load Temporary Add-on**, rồi trỏ tới `manifest.json` của kho này. Nó tồn tại
cho tới khi bạn đóng Firefox.

Cần Firefox 128 trở lên, cả trên máy tính lẫn Android, vì content script với
`world: "MAIN"` chỉ có từ bản 128.

Để tạo tệp zip nộp lên AMO:

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint` và `make run` dùng `web-ext` (lần đầu `npx` sẽ tải về). `make lint`
cố ý báo hai cảnh báo: khai báo thu thập dữ liệu
(`data_collection_permissions: none`) chỉ được đọc từ Firefox 140 trở đi, trong
khi `strict_min_version` là 128, nên trình kiểm tra chỉ ra khoảng chênh đó. Trên
128–139 khóa này đơn giản bị bỏ qua, và không đáng thu hẹp phạm vi hỗ trợ chỉ để
làm im cảnh báo.

### Trên Firefox cho Android, từ mã nguồn

```bash
adb devices                      # tìm id thiết bị
make run-android DEVICE=<id>
```

Cần adb, bật gỡ lỗi USB trên điện thoại, và bật *Remote debugging via USB* trong
cài đặt Firefox.

## Cách dùng

Chỉ có một thứ để bấm: nút trên thanh công cụ. Nó hiển thị trạng thái của trang
hiện tại và cung cấp đúng một hành động.

| Trạng thái | Nghĩa là gì |
| --- | --- |
| **Đang chặn** | Cả hai lớp đang bật trên trang này. Đây là mặc định ở mọi nơi |
| **Đã loại trừ** | Cả hai lớp đang tắt trên trang này, và biểu tượng mang huy hiệu `OFF` |

**Loại trừ trang này** đưa trang đó vào một quy tắc `allow` động *và* vào
`excludeMatches` của content script, nên việc loại trừ là thật chứ không phải chỉ
hình thức. Loại trừ áp dụng **theo tên miền đăng ký được và bao gồm cả tên miền
phụ**: loại trừ `example.com` cũng loại trừ `www.example.com` và
`shop.example.com`. Chúng có hiệu lực từ lần tải trang kế tiếp.

Tính năng này dành cho khi bạn cố ý muốn được đo — chẳng hạn khi kiểm tra GA trên
trang của chính mình. Huy hiệu `OFF` không được vẽ trên Android; cửa sổ bật lên
vẫn cho biết bạn đang ở trạng thái nào.

## Nó hoạt động thế nào

### Lớp 1 — thông báo việc từ chối

`ga.js`, `analytics.js` và `gtag.js` đều kiểm tra
`window._gaUserPrefs.ioo()` (*ioo* = is opted out) trước khi gửi, và dừng lại nếu
hàm này trả về true. Đó chính là cờ mà tiện ích của Google đặt — một lối thoát mà
Google Analytics tự cung cấp.

`src/optout.js` được đăng ký làm content script `world: "MAIN"` tại
`document_start`, nên cờ đã nằm sẵn trên đối tượng toàn cục của trang trước khi
bất kỳ mã nào của trang chạy. Không có gì được chèn vào DOM, nên CSP chẳng có gì
để chặn. Trang web cũng không ghi đè được cờ: setter là một thao tác rỗng thay vì
một thuộc tính không ghi được, nhờ vậy những trang ở strict mode có gán giá trị
cho nó sẽ bị bỏ qua thay vì nhận ngoại lệ.

### Lớp 2 — chặn các lượt gửi

Năm quy tắc declarativeNetRequest tĩnh, trong `rules/ga.json`:

| Tên miền | Bị chặn |
| --- | --- |
| `*.google-analytics.com` | mọi URL chứa `/collect` — `/collect`, `/j/collect`, `/g/collect`, `/r/collect`, và các máy chủ theo vùng như `region1.` |
| `*.google-analytics.com` | `/batch`, kênh gửi theo lô của analytics.js |
| `*.analytics.google.com` | `/g/collect` và `/g/s/collect`, các điểm cuối theo vùng của GA4 |
| `stats.g.doubleclick.net` | `/collect`, dùng khi Google Signals được bật |

**Không bị chặn:** `googletagmanager.com` (`gtag.js`, `gtm.js`) và các script do
chính `google-analytics.com` phục vụ. Từ chối nghĩa là để mã tải về nhưng không
để nó báo cáo; giết luôn trình tải sẽ kéo theo mọi thứ khác mà trang điều khiển
qua Tag Manager. Nhờ lớp 1, GA vẫn im lặng dù đã được tải.

Vì không tài nguyên nào của trang bị chặn, chuyện này gần như không bao giờ làm
hỏng một trang web.

## Kiểm tra xem nó có chạy không

1. Mở một trang có dùng GA
2. `F12` → **Network**, lọc theo `collect`
3. Các yêu cầu tới `www.google-analytics.com/g/collect` và tương tự phải hiện là
   bị chặn (`NS_ERROR_ABORTED`) — đó là lớp 2
4. Trong console, `_gaUserPrefs.ioo()` phải trả về `true` — đó là lớp 1. Nếu thấy
   `_gaUserPrefs is not defined` nghĩa là content script chưa được đăng ký; xem
   phần Khắc phục sự cố

## Kiểm thử

```bash
make setup-test   # một lần: gói Firefox, geckodriver, và một venv có selenium
make test
```

`setup-test` cài vào `~/opt/firefox`, `~/.local/bin` và `.test/` — không đụng gói
hệ thống, không có gì cần quyền root.

**`make unit`** chạy phần logic loại trừ trên một bản giả lập của các API
WebExtension. Chỉ cần Node, không cần trình duyệt.

**`make test-browser`** điều khiển một Firefox headless thật hai lần — một lần có
nạp tiện ích, một lần không — rồi so sánh. Lần chạy đối chứng mới là điểm mấu
chốt: nó chứng minh mạng thực sự thông và cờ từ chối thực sự đến từ tiện ích.
Những điều được kiểm tra:

- cờ từ chối được đặt, **kể cả trên trang phục vụ kèm CSP nghiêm ngặt** — đúng
  trường hợp mà tiện ích của chính Google thất bại trong im lặng
- một trang gán giá trị cho `_gaUserPrefs` không thể tự đưa mình trở lại diện
  theo dõi, và cũng không ném ngoại lệ khi thử
- các lượt gửi `/collect` của GA4, Universal Analytics và các điểm cuối theo vùng
  đều bị chặn, kể cả dưới CSP nghiêm ngặt
- `gtag.js` vẫn tải được, và một `/collect` cùng nguồn gốc vẫn nguyên vẹn — nghĩa
  là các quy tắc không chặn quá tay

Bản dựng Android chưa được thử trên thiết bị thật. Mọi API được dùng đều đã đối
chiếu với browser-compat-data của MDN và trùng với mức hỗ trợ trên máy tính,
nhưng đó là kiểm tra trên giấy, không phải kiểm thử.

## Những gì nó không làm được

- **GTM phía máy chủ và đo lường first-party.** Nếu một trang thu thập trên chính
  tên miền của họ, ví dụ `metrics.example.com`, rồi chuyển tiếp tới GA từ máy chủ
  của họ, lưu lượng đó không phân biệt được với lưu lượng thông thường tới trang
  ấy, nên lớp 2 không bắt được. Lớp 1 vẫn có tác dụng, vì bên gửi là gtag.js trên
  trang.
- **Các sản phẩm phân tích khác ngoài GA** nằm ngoài phạm vi. Tiện ích này chỉ từ
  chối Google Analytics, không gì khác.
- **Các lượt gửi thuần phía máy chủ qua Measurement Protocol** không hề đi qua
  trình duyệt, nên không tiện ích trình duyệt nào chặn được.

## Quyền riêng tư

Tiện ích này **không thu thập gì và không gửi gì đi đâu cả**. Nó không tự thực
hiện yêu cầu mạng nào. Thứ duy nhất được lưu là danh sách tên máy chủ bạn đã loại
trừ (`storage.local`), và nó không bao giờ rời khỏi thiết bị. Tệp manifest khai
báo điều đó là `data_collection_permissions: { required: ["none"] }`.

## Ngôn ngữ

26 ngôn ngữ, được chọn tự động theo thiết lập ngôn ngữ của trình duyệt — không có
gì phải cấu hình:

Ả Rập, Anh, Ba Lan, Bồ Đào Nha (Brazil), Đan Mạch, Đức, Hà Lan, Hàn, Hebrew,
Hindi, Indonesia, Na Uy, Nga, Nhật, Pháp, Phần Lan, Séc, Tây Ban Nha, Thái, Thổ
Nhĩ Kỳ, Thụy Điển, Trung (giản thể và phồn thể), Ukraina, Việt, Ý.

Phần lớn không do người bản ngữ viết, nên chỉnh sửa là loại pull request được
hoan nghênh nhất. Thêm một ngôn ngữ nghĩa là sao chép
`_locales/en/messages.json` thành `_locales/<mã>/messages.json` rồi dịch các giá
trị `message`, giữ nguyên các khóa và trường `description`. Có mười một chuỗi.
Phần nào thiếu sẽ lùi về tiếng Anh.

README này cũng được dịch — các ngôn ngữ khác nằm trong `translations/` và được
liệt kê ở đầu tệp này. Tiếng Anh là bản chuẩn; sau khi thêm một ngôn ngữ, hãy
chạy `python3 Tools/sync-readme-nav.py` để làm mới các liên kết đó.

## Phát hành (ghi chú cho người bảo trì)

Firefox không cài vĩnh viễn một tiện ích chưa ký, nên việc phân phối đằng nào
cũng đi qua Mozilla:

- **Có niêm yết (listed)** — tải `dist/*.zip` lên
  [AMO Developer Hub](https://addons.mozilla.org/developers/). Nó được duyệt, ký,
  rồi xuất bản trên addons.mozilla.org. Việc nộp bản niêm yết không thể tự động
  hóa; `web-ext sign --channel=listed` cũng chỉ tải lên để chờ duyệt.
- **Không niêm yết (unlisted)**, tức tự phân phối — `make sign` cùng một
  [khóa API AMO](https://addons.mozilla.org/developers/addon/api/key/) trả về tệp
  `.xpi` đã ký để bạn tự lưu trữ. Lưu ý rằng tiện ích tự phân phối không thể cài
  trên Firefox cho Android.

Không cần đính kèm mã nguồn: ở đây không có gì bị minify hay đóng gói.

## Khắc phục sự cố

- **`_gaUserPrefs` là undefined** — nhiều khả năng quyền truy cập trang đã bị thu
  hồi. Trong `about:addons`, mở phần **Quyền** của tiện ích này và cho phép truy
  cập mọi trang. Nó tự đăng ký lại ngay khi quyền quay về
- **Không có gì xảy ra trên Firefox 127 trở về trước** — content script
  `world: "MAIN"` cần Firefox 128. Hãy nâng cấp
- **Loại trừ không có tác dụng** — loại trừ áp dụng theo tên miền, bao gồm tên
  miền phụ, và có hiệu lực từ lần tải trang kế tiếp
- **Một trang bị hỏng và loại trừ nó cũng không sửa được** — vậy thì không phải do
  tiện ích này. Chỉ các yêu cầu `/collect` bị chặn, không bao giờ chặn một script
  hay tài nguyên của trang

## Ủng hộ

Hakarasenai miễn phí và sẽ luôn như vậy. Nếu nó giữ bạn nằm ngoài bảng điều khiển
của ai đó, việc ủng hộ qua
[GitHub Sponsors](https://github.com/sponsors/omikuji) rất được trân trọng và là
nguồn tài trợ duy nhất của dự án.

Tiền ủng hộ trả cho công bảo trì, và đó mới là chi phí thật ở đây: Google dời và
thêm các điểm cuối thu thập, khiến một bộ quy tắc từng đầy đủ hồi năm ngoái lặng
lẽ không còn đầy đủ nữa. Nó cũng sẽ mua được thiết bị Android mà đến giờ tiện ích
mới chỉ được đối chiếu trên giấy.

Câu hỏi, sự cố và ý tưởng đều được hoan nghênh:

- [X (@omikuji_man)](https://x.com/omikuji_man)
- [Biểu mẫu liên hệ](https://omikuji.dev/contact/)
- [Báo lỗi trên GitHub](https://github.com/omikuji/hakarasenai/issues)

## Giấy phép

Giấy phép MIT.
