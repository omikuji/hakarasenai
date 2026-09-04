# Hakarasenai

[English](../README.md) · [العربية](README.ar.md) · [Čeština](README.cs.md) · [Dansk](README.da.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Suomi](README.fi.md) · [Français](README.fr.md) · [עברית](README.he.md) · [हिन्दी](README.hi.md) · **Bahasa Indonesia** · [Italiano](README.it.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Norsk](README.nb.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Svenska](README.sv.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [Tiếng Việt](README.vi.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md)

Ekstensi Firefox yang hanya mencegah Google Analytics mengukur Anda.
Desktop dan Android.

*Hakarasenai* berarti "tidak membiarkannya mengukur" — itulah seluruh daftar
fiturnya.

**Apa yang dilakukannya:**

1. Memberi tahu kode Google Analytics di halaman bahwa Anda telah menolak pelacakan
2. Memblokir data pengukuran yang tetap akan keluar
3. Memungkinkan Anda mengecualikan satu situs lewat tombol bilah alat, kalau ada
   yang berulah

Tanpa halaman opsi, tanpa langganan filter, tanpa penghitung, tanpa versi Pro.

## Mengapa ini ada

Google merilis "Google Analytics Opt-out Add-on" resmi, dan ada versi Firefox-nya.
Masalahnya ada pada **caranya**: ia menyuntikkan elemen `<script>` ke dalam
halaman, sementara Firefox — seperti Safari — menerapkan CSP halaman itu juga
pada skrip konten. Di situs mana pun dengan CSP ketat, penyuntikan itu diblokir
dan penolakan diam-diam tidak melakukan apa-apa. Tidak ada yang memberi tahu Anda
bahwa ia gagal, dan itu cara terburuk sebuah alat privasi bisa rusak.

Hakarasenai memakai kait resmi yang sama, tetapi menaruhnya di tempat yang tidak
terjangkau CSP mana pun, lalu memasang pemblokiran jaringan di belakangnya
sebagai lapisan kedua. Kalau lapisan pertama sampai gagal, datanya tetap tidak
keluar.

## Pemasangan

### Dari AMO

Cari di [addons.mozilla.org](https://addons.mozilla.org/). Di Android
pemasangannya sama, lewat AMO — ekstensi ini mendeklarasikan `gecko_android`,
jadi Firefox untuk Android menawarkannya.

### Memuat sementara dari kode sumber

Tidak perlu proses build. Buka `about:debugging#/runtime/this-firefox`, pilih
**Muat Pengaya Sementara**, lalu tunjuk `manifest.json` di repositori ini. Ia
bertahan sampai Anda menutup Firefox.

Dibutuhkan Firefox 128 atau lebih baru, baik di desktop maupun Android, karena
skrip konten `world: "MAIN"` baru hadir di versi 128.

Untuk membuat zip bagi AMO:

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint` dan `make run` memakai `web-ext` (diunduh `npx` saat pertama kali).
`make lint` sengaja memunculkan dua peringatan: deklarasi pengumpulan data
(`data_collection_permissions: none`) baru dibaca mulai Firefox 140, sedangkan
`strict_min_version` bernilai 128, jadi linter menunjuk selisih itu. Di 128–139
kunci tersebut hanya diabaikan, dan tidak sepadan mempersempit dukungan hanya
demi mendiamkannya.

### Di Firefox untuk Android, dari kode sumber

```bash
adb devices                      # cari id perangkat
make run-android DEVICE=<id>
```

Butuh adb, USB debugging di ponsel, dan *Remote debugging via USB* aktif di
pengaturan Firefox.

## Cara pakai

Hanya ada satu kendali: tombol di bilah alat. Ia menunjukkan status situs saat ini
dan menawarkan satu tindakan saja.

| Status | Artinya |
| --- | --- |
| **Memblokir** | Kedua lapisan aktif di situs ini. Ini bawaannya di mana saja |
| **Dikecualikan** | Kedua lapisan mati di situs ini, dan ikonnya membawa lencana `OFF` |

**Kecualikan situs ini** memasukkan situs tersebut ke aturan `allow` dinamis
*sekaligus* ke `excludeMatches` pada skrip konten, jadi pengecualiannya nyata,
bukan sekadar tampilan. Pengecualian berlaku **per domain terdaftar dan mencakup
subdomain**: mengecualikan `example.com` juga mengecualikan `www.example.com` dan
`shop.example.com`. Berlaku sejak pemuatan halaman berikutnya.

Ini untuk saat Anda memang ingin diukur — misalnya ketika memverifikasi GA di
situs Anda sendiri. Lencana `OFF` tidak digambar di Android; jendela sembulnya
tetap memberi tahu Anda sedang dalam status apa.

## Cara kerjanya

### Lapisan 1 — mengumumkan penolakan

`ga.js`, `analytics.js`, dan `gtag.js` semuanya memeriksa
`window._gaUserPrefs.ioo()` (*ioo* = is opted out) sebelum mengirim, dan berhenti
kalau nilainya true. Ini bendera yang sama dengan yang dipasang pengaya Google
sendiri — pintu darurat yang disediakan Google Analytics sendiri.

`src/optout.js` didaftarkan sebagai skrip konten `world: "MAIN"` pada
`document_start`, sehingga bendera itu sudah ada di objek global halaman sebelum
kode situs mana pun berjalan. Tidak ada yang disisipkan ke DOM, jadi tidak ada
yang bisa diblokir CSP. Situs juga tidak bisa menimpa bendera itu: setter-nya
berupa operasi kosong, bukan properti yang tidak bisa ditulis, sehingga halaman
dalam strict mode yang menugaskan nilai padanya diabaikan alih-alih dilempari
pengecualian.

### Lapisan 2 — memblokir kiriman

Lima aturan statis declarativeNetRequest, di `rules/ga.json`:

| Domain | Yang diblokir |
| --- | --- |
| `*.google-analytics.com` | URL apa pun yang memuat `/collect` — `/collect`, `/j/collect`, `/g/collect`, `/r/collect`, serta host regional seperti `region1.` |
| `*.google-analytics.com` | `/batch`, jalur kiriman berkelompok analytics.js |
| `*.analytics.google.com` | `/g/collect` dan `/g/s/collect`, endpoint regional GA4 |
| `stats.g.doubleclick.net` | `/collect`, dipakai saat Google Signals aktif |

**Yang tidak diblokir:** `googletagmanager.com` (`gtag.js`, `gtm.js`) dan
skrip-skrip yang disajikan `google-analytics.com` sendiri. Menolak pelacakan
berarti membiarkan kodenya dimuat tetapi tidak membiarkannya melapor; mematikan
loader-nya akan ikut menjatuhkan semua hal lain yang dijalankan situs lewat Tag
Manager. Berkat lapisan 1, GA tetap bungkam meski sudah dimuat.

Karena tidak ada sumber daya halaman yang diblokir, praktis ini hampir tidak
pernah merusak situs.

## Memastikan ia bekerja

1. Buka situs yang memakai GA
2. `F12` → **Jaringan**, saring dengan `collect`
3. Permintaan ke `www.google-analytics.com/g/collect` dan kerabatnya harusnya
   tampil sebagai diblokir (`NS_ERROR_ABORTED`) — itu lapisan 2
4. Di konsol, `_gaUserPrefs.ioo()` harusnya mengembalikan `true` — itu lapisan 1.
   `_gaUserPrefs is not defined` berarti skrip kontennya tidak terdaftar; lihat
   Pemecahan masalah

## Pengujian

```bash
make setup-test   # sekali saja: arsip Firefox, geckodriver, dan venv berisi selenium
make test
```

`setup-test` memasang ke `~/opt/firefox`, `~/.local/bin`, dan `.test/` — tanpa
paket sistem, tidak ada yang butuh root.

**`make unit`** menjalankan logika pengecualian terhadap tiruan API WebExtension.
Hanya Node, tanpa peramban.

**`make test-browser`** mengemudikan Firefox headless sungguhan dua kali — sekali
dengan ekstensi terpasang, sekali tanpa — lalu membandingkannya. Justru
pembandingnya yang penting: itulah yang membuktikan jaringan benar-benar
terjangkau dan bendera penolakan memang datang dari ekstensi. Yang diperiksa:

- bendera penolakan terpasang, **termasuk di halaman yang disajikan dengan CSP
  ketat** — persis kasus ketika pengaya Google sendiri gagal diam-diam
- situs yang menugaskan nilai ke `_gaUserPrefs` tidak bisa mendaftarkan dirinya
  kembali, dan tidak melempar pengecualian saat mencoba
- kiriman `/collect` dari GA4, Universal Analytics, dan endpoint regional
  diblokir, juga di bawah CSP ketat
- `gtag.js` tetap dimuat, dan `/collect` sesama asal dibiarkan utuh — artinya
  aturannya tidak memblokir berlebihan

Build Android belum dicoba di perangkat fisik. Setiap API yang dipakai sudah
dicocokkan dengan browser-compat-data MDN dan setara dengan dukungan desktop,
tetapi itu pemeriksaan di atas kertas, bukan pengujian.

## Yang tidak bisa dilakukannya

- **GTM sisi server dan pengukuran first-party.** Kalau sebuah situs mengumpulkan
  di domainnya sendiri, misalnya `metrics.example.com`, lalu meneruskan ke GA dari
  servernya, lalu lintas itu tidak bisa dibedakan dari lalu lintas biasa ke situs
  tersebut, jadi lapisan 2 tidak bisa menangkapnya. Lapisan 1 tetap berlaku,
  karena yang mengirim adalah gtag.js di halaman.
- **Produk analitik selain GA** di luar cakupan. Ekstensi ini menolak Google
  Analytics, tidak lebih.
- **Kiriman murni sisi server lewat Measurement Protocol** sama sekali tidak
  melewati peramban, jadi tidak ada ekstensi peramban yang bisa menghentikannya.

## Privasi

Ekstensi ini **tidak mengumpulkan apa pun dan tidak mengirim apa pun ke mana
pun**. Ia tidak membuat permintaan jaringan sendiri. Satu-satunya yang disimpan
adalah daftar nama host yang Anda kecualikan (`storage.local`), dan itu tidak
pernah meninggalkan perangkat. Manifesnya menyatakan hal itu sebagai
`data_collection_permissions: { required: ["none"] }`.

## Bahasa

26 bahasa, dipilih otomatis dari pengaturan bahasa peramban Anda — tidak ada yang
perlu dikonfigurasi:

Arab, Belanda, Ceko, Denmark, Finlandia, Ibrani, Hindi, Indonesia, Inggris,
Italia, Jepang, Jerman, Korea, Mandarin (Sederhana dan Tradisional), Norwegia,
Polandia, Portugis (Brasil), Prancis, Rusia, Spanyol, Swedia, Thai, Turki,
Ukraina, Vietnam.

Sebagian besar tidak ditulis penutur asli, jadi koreksi adalah jenis pull request
yang paling disambut. Menambah bahasa berarti menyalin
`_locales/en/messages.json` ke `_locales/<kode>/messages.json` lalu
menerjemahkan nilai `message`, dengan membiarkan kunci dan bidang `description`
apa adanya. Ada sebelas teks. Yang tidak ada akan jatuh kembali ke bahasa Inggris.

README ini juga diterjemahkan — bahasa lain ada di `translations/`, tercantum di
bagian atas berkas ini. Bahasa Inggris adalah versi kanonik; jalankan
`python3 Tools/sync-readme-nav.py` setelah menambahkan satu bahasa untuk
menyegarkan tautan itu.

## Penerbitan (catatan bagi pengelola)

Firefox tidak memasang ekstensi tak bertanda tangan secara permanen, jadi
distribusi tetap lewat Mozilla:

- **Terdaftar (listed)** — unggah `dist/*.zip` di
  [AMO Developer Hub](https://addons.mozilla.org/developers/). Ia ditinjau,
  ditandatangani, lalu diterbitkan di addons.mozilla.org. Pengiriman terdaftar
  tidak bisa diotomatiskan; `web-ext sign --channel=listed` hanya mengunggah untuk
  ditinjau.
- **Tak terdaftar (unlisted)**, alias distribusi sendiri — `make sign` dengan
  [kunci API AMO](https://addons.mozilla.org/developers/addon/api/key/)
  mengembalikan `.xpi` bertanda tangan yang bisa Anda hos sendiri. Perlu dicatat,
  pengaya yang didistribusikan sendiri tidak bisa dipasang di Firefox untuk Android.

Kode sumber tidak perlu dilampirkan: di sini tidak ada yang diminifikasi atau
dibundel.

## Pemecahan masalah

- **`_gaUserPrefs` bernilai undefined** — kemungkinan besar akses situsnya
  dicabut. Di `about:addons`, buka **Izin** ekstensi ini dan izinkan akses ke
  semua situs. Ia mendaftarkan diri lagi begitu izinnya kembali
- **Tidak terjadi apa-apa di Firefox 127 atau lebih lama** — skrip konten
  `world: "MAIN"` butuh Firefox 128. Perbarui
- **Pengecualian tidak berlaku** — pengecualian bersifat per domain, mencakup
  subdomain, dan berlaku sejak pemuatan halaman berikutnya
- **Situs rusak dan mengecualikannya tidak memperbaiki apa pun** — berarti
  penyebabnya bukan ekstensi ini. Hanya permintaan `/collect` yang diblokir,
  tidak pernah skrip atau sumber daya halaman

## Dukungan

Hakarasenai gratis dan akan selalu begitu. Kalau ia menjaga Anda tetap di luar
dasbor seseorang, mendukung pekerjaan ini lewat
[GitHub Sponsors](https://github.com/sponsors/omikuji) sangat dihargai dan
merupakan satu-satunya sumber dana proyek ini.

Sponsor membiayai perawatan, dan di situlah biaya sebenarnya: Google memindahkan
dan menambah endpoint pengumpulan, sehingga kumpulan aturan yang tahun lalu
lengkap diam-diam berhenti lengkap. Sponsor juga akan membeli perangkat keras
Android yang sejauh ini hanya diperiksa di atas kertas.

Pertanyaan, masalah, dan ide semuanya disambut:

- [X (@omikuji_man)](https://x.com/omikuji_man)
- [Formulir kontak](https://omikuji.dev/contact/)
- [Laporkan masalah di GitHub](https://github.com/omikuji/hakarasenai/issues)

## Lisensi

Lisensi MIT.
