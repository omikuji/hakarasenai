# Hakarasenai

[English](../README.md) · [العربية](README.ar.md) · [Čeština](README.cs.md) · [Dansk](README.da.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Suomi](README.fi.md) · [Français](README.fr.md) · [עברית](README.he.md) · [हिन्दी](README.hi.md) · [Bahasa Indonesia](README.id.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Norsk](README.nb.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Svenska](README.sv.md) · [ไทย](README.th.md) · **Türkçe** · [Українська](README.uk.md) · [Tiếng Việt](README.vi.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md)

Yalnızca Google Analytics'in sizi ölçmesini engelleyen bir Firefox uzantısı.
Masaüstü ve Android.

*Hakarasenai* "ölçmesine izin vermemek" demek — özellik listesinin tamamı bu.

**Ne yapar:**

1. Sayfadaki Google Analytics koduna, izlemeyi reddettiğinizi bildirir
2. Yine de çıkacak olan ölçüm verilerini engeller
3. Bir site huysuzluk ederse, araç çubuğu düğmesinden yalnızca o siteyi hariç
   tutmanızı sağlar

Seçenekler sayfası yok, filtre aboneliği yok, sayaç yok, Pro sürüm yok.

## Neden var

Google resmî bir "Google Analytics Opt-out Add-on" yayımlıyor ve bunun Firefox
sürümü de var. Sorun **nasıl** çalıştığında: sayfaya bir `<script>` öğesi
enjekte ediyor ve Firefox — Safari gibi — sayfanın kendi CSP'sini içerik
betiklerine de uyguluyor. Katı CSP'li herhangi bir sitede enjeksiyon engelleniyor
ve reddetme sessizce hiçbir şey yapmıyor. Başarısız olduğunu size hiçbir şey
söylemiyor; bu da bir gizlilik aracının bozulabileceği en kötü biçim.

Hakarasenai aynı resmî kancayı kullanıyor, ama onu hiçbir CSP'nin
ulaşamayacağı yere koyuyor ve arkasına ikinci katman olarak ağ engellemesi
yerleştiriyor. Birinci katman bir gün başarısız olsa bile veri yine de çıkmıyor.

## Kurulum

### AMO'dan

[addons.mozilla.org](https://addons.mozilla.org/) üzerinde arayın. Android'de de
aynı şekilde AMO'dan kurulur — uzantı `gecko_android` bildiriyor, dolayısıyla
Android için Firefox onu sunuyor.

### Kaynaktan geçici olarak yükleme

Derlemeye gerek yok. `about:debugging#/runtime/this-firefox` adresini açın,
**Geçici Eklenti Yükle** seçeneğini seçin ve bu deponun `manifest.json`
dosyasını gösterin. Firefox'u kapatana kadar kalır.

Masaüstünde de Android'de de Firefox 128 veya üzeri gerekir, çünkü
`world: "MAIN"` içerik betikleri 128 ile geldi.

AMO için zip üretmek üzere:

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint` ve `make run`, `web-ext` kullanır (ilk seferde `npx` indirir).
`make lint` bilerek iki uyarı verir: veri toplama bildirimi
(`data_collection_permissions: none`) yalnızca Firefox 140 ve sonrasında okunur,
`strict_min_version` ise 128 — linter bu boşluğa işaret eder. 128–139'da anahtar
zaten yok sayılır; susturmak için destek aralığını daraltmaya değmez.

### Android için Firefox'ta, kaynaktan

```bash
adb devices                      # cihaz kimliğini bulun
make run-android DEVICE=<id>
```

adb, telefonda USB hata ayıklama ve Firefox ayarlarında açık *USB üzerinden uzak
hata ayıklama* gerekir.

## Kullanım

Tek bir denetim var: araç çubuğundaki düğme. Geçerli sitenin durumunu gösterir ve
tek bir eylem sunar.

| Durum | Anlamı |
| --- | --- |
| **Engelleniyor** | Bu sitede iki katman da açık. Her yerde varsayılan budur |
| **Hariç tutuldu** | Bu sitede iki katman da kapalı ve simge `OFF` rozeti taşır |

**Bu siteyi hariç tut**, siteyi hem dinamik bir `allow` kuralına *hem de* içerik
betiğinin `excludeMatches` listesine yazar; yani hariç tutma göstermelik değil,
gerçektir. Hariç tutmalar **kayıt edilebilir alan adı düzeyindedir ve alt alan
adlarını kapsar**: `example.com` hariç tutulduğunda `www.example.com` ve
`shop.example.com` da hariç tutulur. Bir sonraki sayfa yüklemesinden itibaren
geçerlidir.

Bu, bilerek ölçülmek istediğiniz durumlar içindir — örneğin kendi sitenizde GA'yı
doğrularken. `OFF` rozeti Android'de çizilmez; açılır pencere yine de hangi
durumda olduğunuzu söyler.

## Nasıl çalışır

### Katman 1 — reddi duyurmak

`ga.js`, `analytics.js` ve `gtag.js`, göndermeden önce
`window._gaUserPrefs.ioo()` (*ioo* = is opted out) değerini kontrol eder ve true
dönerse dururlar. Bu, Google'ın kendi eklentisinin koyduğu bayrağın aynısıdır —
Google Analytics'in kendi sunduğu bir acil çıkış.

`src/optout.js`, `document_start` anında `world: "MAIN"` içerik betiği olarak
kaydedilir; böylece bayrak, sitenin herhangi bir kodu çalışmadan önce sayfanın
global nesnesinde hazırdır. DOM'a hiçbir şey eklenmediği için CSP'nin
engelleyeceği bir şey yoktur. Site bayrağın üzerine de yazamaz: yazılamaz bir
özellik yerine boş bir setter kullanıldığından, katı moddaki sayfaların atamaları
bir istisna almak yerine sessizce yok sayılır.

### Katman 2 — istekleri engellemek

`rules/ga.json` içinde beş adet statik declarativeNetRequest kuralı:

| Alan adı | Engellenen |
| --- | --- |
| `*.google-analytics.com` | `/collect` içeren her URL — `/collect`, `/j/collect`, `/g/collect`, `/r/collect` ve `region1.` gibi bölgesel ana makineler |
| `*.google-analytics.com` | `/batch`, analytics.js'in toplu gönderim kanalı |
| `*.analytics.google.com` | `/g/collect` ve `/g/s/collect`, GA4'ün bölgesel uç noktaları |
| `stats.g.doubleclick.net` | `/collect`, Google Sinyalleri açıkken kullanılır |

**Engellenmeyenler:** `googletagmanager.com` (`gtag.js`, `gtm.js`) ve doğrudan
`google-analytics.com` tarafından sunulan betikler. Reddetmek, kodun yüklenmesine
izin verip rapor vermesine izin vermemek demektir; yükleyiciyi öldürmek, sitenin
Etiket Yöneticisi üzerinden çalıştırdığı her şeyi de beraberinde götürürdü.
Katman 1 sayesinde GA yüklense bile susar.

Hiçbir sayfa kaynağı engellenmediği için bu, pratikte neredeyse hiçbir siteyi
bozmaz.

## Çalıştığını doğrulamak

1. GA kullanan bir siteyi açın
2. `F12` → **Ağ**, `collect` ile filtreleyin
3. `www.google-analytics.com/g/collect` ve benzerlerine giden istekler engellendi
   (`NS_ERROR_ABORTED`) olarak görünmeli — bu katman 2'dir
4. Konsolda `_gaUserPrefs.ioo()` `true` döndürmeli — bu katman 1'dir.
   `_gaUserPrefs is not defined` görüyorsanız içerik betiği kaydolmamıştır;
   Sorun giderme bölümüne bakın

## Testler

```bash
make setup-test   # bir kez: Firefox arşivi, geckodriver ve selenium içeren bir venv
make test
```

`setup-test`, `~/opt/firefox`, `~/.local/bin` ve `.test/` içine kurar — sistem
paketi yok, hiçbir şey root gerektirmez.

**`make unit`**, hariç tutma mantığını WebExtension API'lerinin bir taklidine
karşı çalıştırır. Yalnızca Node, tarayıcı yok.

**`make test-browser`**, gerçek bir headless Firefox'u iki kez sürer — bir kez
uzantı yüklüyken, bir kez yüklü değilken — ve ikisini karşılaştırır. Asıl mesele
kontrol koşusudur: ağın gerçekten erişilebilir olduğunu ve reddetme bayrağının
gerçekten uzantıdan geldiğini kanıtlar. Denetlediği şeyler:

- reddetme bayrağının kurulduğu, **katı CSP ile sunulan bir sayfada bile** —
  Google'ın kendi eklentisinin sessizce başarısız olduğu tam da bu durum
- `_gaUserPrefs`'e atama yapan bir sitenin kendini yeniden izlemeye alamadığı ve
  bunu denerken bir istisna fırlatmadığı
- GA4, Universal Analytics ve bölgesel `/collect` isteklerinin engellendiği, katı
  CSP altında da
- `gtag.js`'in hâlâ yüklendiği ve aynı kaynaktan gelen bir `/collect` isteğinin
  dokunulmadan kaldığı — yani kuralların fazladan engelleme yapmadığı

Android derlemesi fiziksel bir cihazda denenmedi. Kullanılan her API, MDN'in
browser-compat-data kaynağına karşı denetlendi ve masaüstü desteğini yansıtıyor;
ama bu kâğıt üzerinde bir denetim, test değil.

## Yapamadıkları

- **Sunucu tarafı GTM ve first-party ölçüm.** Bir site kendi alan adında, diyelim
  `metrics.example.com`, toplayıp sunucusundan GA'ya iletiyorsa, bu trafik o
  siteye giden sıradan trafikten ayırt edilemez; katman 2 onu yakalayamaz.
  Katman 1 yine geçerlidir, çünkü gönderen sayfadaki gtag.js'tir.
- **GA dışındaki analiz ürünleri** kapsam dışıdır. Bu uzantı Google Analytics'i
  reddeder, başka hiçbir şeyi değil.
- **Tamamen sunucu tarafı Measurement Protocol** istekleri tarayıcıya hiç
  uğramaz, dolayısıyla hiçbir tarayıcı uzantısı onları durduramaz.

## Gizlilik

Bu uzantı **hiçbir şey toplamaz ve hiçbir yere hiçbir şey göndermez**. Kendi
başına ağ isteği yapmaz. Saklanan tek şey, hariç tuttuğunuz ana makine adlarının
listesidir (`storage.local`) ve o da cihazdan asla çıkmaz. Manifest bunu
`data_collection_permissions: { required: ["none"] }` olarak bildirir.

## Diller

26 dil, tarayıcınızın dil ayarlarına göre otomatik seçilir — yapılandırılacak bir
şey yok:

Almanca, Arapça, Çekçe, Çince (Basitleştirilmiş ve Geleneksel), Danca, Endonezce,
Felemenkçe, Fince, Fransızca, Hintçe, İbranice, İngilizce, İspanyolca, İsveççe,
İtalyanca, Japonca, Korece, Lehçe, Norveççe, Portekizce (Brezilya), Rusça,
Tayca, Türkçe, Ukraynaca, Vietnamca.

Çoğu ana dili konuşanlar tarafından yazılmadı, bu yüzden düzeltmeler en hoş
karşılanan pull request türüdür. Bir dil eklemek,
`_locales/en/messages.json` dosyasını `_locales/<kod>/messages.json` olarak
kopyalayıp `message` değerlerini çevirmek demektir; anahtarlara ve `description`
alanlarına dokunulmaz. On bir dizge var. Eksik kalanlar İngilizceye düşer.

Bu README de çevrilmiştir — diğer diller `translations/` içinde yaşar ve bu
dosyanın başında listelenir. İngilizce, kanonik sürümdür; bir dil ekledikten
sonra bağlantıları tazelemek için `python3 Tools/sync-readme-nav.py` çalıştırın.

## Yayımlama (bakımcılar için notlar)

Firefox imzasız bir uzantıyı kalıcı olarak kurmaz, dolayısıyla dağıtım her hâlde
Mozilla'dan geçer:

- **Listelenmiş** — `dist/*.zip` dosyasını
  [AMO Developer Hub](https://addons.mozilla.org/developers/) üzerinden yükleyin.
  İncelenir, imzalanır ve addons.mozilla.org'da yayımlanır. Listelenmiş gönderiler
  otomatikleştirilemez; `web-ext sign --channel=listed` yalnızca incelemeye yükler.
- **Listelenmemiş**, yani kendi dağıtımınız — bir
  [AMO API anahtarı](https://addons.mozilla.org/developers/addon/api/key/) ile
  `make sign` size kendiniz barındırabileceğiniz imzalı bir `.xpi` verir. Şunu
  unutmayın: kendi dağıttığınız bir eklenti Android için Firefox'a kurulamaz.

Kaynakların eklenmesi gerekmez: burada hiçbir şey küçültülmüş ya da paketlenmiş
değil.

## Sorun giderme

- **`_gaUserPrefs` undefined** — büyük olasılıkla site erişimi geri alınmıştır.
  `about:addons` içinde bu uzantının **İzinler** bölümünü açın ve tüm sitelere
  erişime izin verin. İzin geri geldiğinde uzantı kendini yeniden kaydeder
- **Firefox 127 veya öncesinde hiçbir şey olmuyor** — `world: "MAIN"` içerik
  betikleri Firefox 128 ister. Yükseltin
- **Hariç tutma işe yaramadı** — hariç tutmalar alan adı düzeyindedir, alt alan
  adlarını kapsar ve bir sonraki sayfa yüklemesinden itibaren geçerlidir
- **Bir site bozuldu ve hariç tutmak düzeltmedi** — o zaman sorun bu uzantı
  değildi. Yalnızca `/collect` istekleri engellenir; asla bir betik ya da sayfa
  kaynağı değil

## Destek

Hakarasenai ücretsizdir ve öyle kalacak. Sizi birilerinin panosunun dışında
tutuyorsa, [GitHub Sponsors](https://github.com/sponsors/omikuji) üzerinden
desteklemek makbule geçer ve projenin tek finansman kaynağıdır.

Sponsorluk bakımı finanse eder; buradaki asıl maliyet de odur: Google toplama uç
noktalarını taşır ve yenilerini ekler, geçen yıl eksiksiz olan bir kural kümesi
sessizce eksiksiz olmaktan çıkar. Ayrıca uzantının şimdilik yalnızca kâğıt
üzerinde denetlendiği Android donanımını da satın alırdı.

Sorular, sorunlar ve fikirler; hepsi hoş karşılanır:

- [X (@omikuji_man)](https://x.com/omikuji_man)
- [İletişim formu](https://omikuji.dev/contact/)
- [GitHub'da sorun bildirin](https://github.com/omikuji/hakarasenai/issues)

## Lisans

MIT Lisansı.
