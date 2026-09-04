# Hakarasenai

[English](../README.md) · [العربية](README.ar.md) · [Čeština](README.cs.md) · [Dansk](README.da.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Suomi](README.fi.md) · [Français](README.fr.md) · [עברית](README.he.md) · [हिन्दी](README.hi.md) · [Bahasa Indonesia](README.id.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Norsk](README.nb.md) · [Nederlands](README.nl.md) · **Polski** · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Svenska](README.sv.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [Tiếng Việt](README.vi.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md)

Rozszerzenie Firefoksa, które robi tylko jedno: nie pozwala Google Analytics Cię
mierzyć. Na komputerze i na Androidzie.

*Hakarasenai* znaczy „nie pozwolić zmierzyć" — i to cała lista funkcji.

**Co robi:**

1. Mówi kodowi Google Analytics na stronie, że zrezygnowałeś ze śledzenia
2. Blokuje dane pomiarowe, które i tak by wyszły
3. Pozwala wykluczyć pojedynczą witrynę przyciskiem na pasku narzędzi, jeśli
   któraś sprawia kłopoty

Bez strony ustawień, bez subskrypcji filtrów, bez liczników, bez wersji Pro.

## Dlaczego to powstało

Google wydaje oficjalny „Google Analytics Opt-out Add-on" i istnieje jego wersja
dla Firefoksa. Problemem jest **sposób** działania: wstrzykuje on element
`<script>` do strony, a Firefox — tak jak Safari — stosuje CSP strony również do
skryptów treści. Na każdej witrynie z surową CSP wstrzyknięcie zostaje
zablokowane, a rezygnacja po cichu nic nie robi. Nic nie informuje, że się nie
udało, a to najgorszy możliwy sposób, w jaki narzędzie prywatności może zawieść.

Hakarasenai korzysta z tego samego oficjalnego zaczepu, ale umieszcza go tam,
gdzie żadna CSP nie sięga, a za nim stawia blokowanie sieciowe jako drugą
warstwę. Gdyby pierwsza warstwa kiedykolwiek zawiodła, dane i tak nie wyjdą.

## Instalacja

### Z AMO

Poszukaj go na [addons.mozilla.org](https://addons.mozilla.org/). Na Androidzie
instaluje się tak samo z AMO — dodatek deklaruje `gecko_android`, więc Firefox
dla Androida go proponuje.

### Tymczasowe wczytanie ze źródeł

Nie trzeba niczego budować. Otwórz `about:debugging#/runtime/this-firefox`,
wybierz **Wczytaj tymczasowy dodatek** i wskaż `manifest.json` z tego
repozytorium. Zostaje do zamknięcia Firefoksa.

Wymagany jest Firefox 128 lub nowszy, na komputerze i na Androidzie, bo skrypty
treści z `world: "MAIN"` pojawiły się dopiero w 128.

Aby zbudować archiwum zip dla AMO:

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint` i `make run` korzystają z `web-ext` (za pierwszym razem pobiera go
`npx`). `make lint` celowo zgłasza dwa ostrzeżenia: deklaracja zbierania danych
(`data_collection_permissions: none`) jest odczytywana dopiero od Firefoksa 140,
a `strict_min_version` wynosi 128, więc linter wytyka tę różnicę. Na 128–139
klucz jest po prostu ignorowany i nie warto zawężać wsparcia, żeby go uciszyć.

### Na Firefoksie dla Androida, ze źródeł

```bash
adb devices                      # ustal identyfikator urządzenia
make run-android DEVICE=<id>
```

Potrzebne są adb, debugowanie USB na telefonie oraz włączone *Zdalne debugowanie
przez USB* w ustawieniach Firefoksa.

## Obsługa

Jest tylko jeden element sterujący: przycisk na pasku narzędzi. Pokazuje stan
bieżącej witryny i oferuje jedną akcję.

| Stan | Co oznacza |
| --- | --- |
| **Blokowanie** | Obie warstwy działają na tej witrynie. Wszędzie tak jest domyślnie |
| **Wykluczona** | Obie warstwy są wyłączone na tej witrynie, a ikona ma plakietkę `OFF` |

**Wyklucz tę witrynę** wpisuje ją zarówno do dynamicznej reguły `allow`, jak i do
`excludeMatches` skryptu treści, więc wykluczenie jest realne, a nie pozorne.
Wykluczenia działają **na poziomie domeny rejestrowalnej i obejmują subdomeny**:
wykluczenie `example.com` wyklucza też `www.example.com` i `shop.example.com`.
Obowiązują od następnego wczytania strony.

Przydaje się, gdy chcesz być mierzony celowo — na przykład przy sprawdzaniu GA na
własnej witrynie. Plakietka `OFF` nie jest rysowana na Androidzie; okienko i tak
mówi, w jakim jesteś stanie.

## Jak to działa

### Warstwa 1 — ogłoszenie rezygnacji

`ga.js`, `analytics.js` i `gtag.js` sprawdzają przed wysłaniem
`window._gaUserPrefs.ioo()` (*ioo* = is opted out) i przerywają, jeśli zwróci
true. To ta sama flaga, którą ustawia dodatek samego Google — wyjście awaryjne,
które Google Analytics udostępnia samo z siebie.

`src/optout.js` jest rejestrowany jako skrypt treści `world: "MAIN"` w
`document_start`, więc flaga jest już na obiekcie globalnym strony, zanim
uruchomi się jakikolwiek kod witryny. Nic nie jest wstawiane do DOM, więc CSP nie
ma czego zablokować. Witryna też nie nadpisze flagi: setter jest pustą operacją,
a nie właściwością tylko do odczytu, dzięki czemu strony w trybie ścisłym, które
przypisują do niej wartość, są ignorowane, a nie karane wyjątkiem.

### Warstwa 2 — blokowanie wysyłek

Pięć statycznych reguł declarativeNetRequest w `rules/ga.json`:

| Domena | Blokowane |
| --- | --- |
| `*.google-analytics.com` | każdy adres zawierający `/collect` — `/collect`, `/j/collect`, `/g/collect`, `/r/collect` oraz hosty regionalne w rodzaju `region1.` |
| `*.google-analytics.com` | `/batch`, zbiorczy transport analytics.js |
| `*.analytics.google.com` | `/g/collect` i `/g/s/collect`, regionalne punkty końcowe GA4 |
| `stats.g.doubleclick.net` | `/collect`, używane przy włączonych sygnałach Google |

**Nie są blokowane:** `googletagmanager.com` (`gtag.js`, `gtm.js`) ani skrypty
serwowane przez samo `google-analytics.com`. Rezygnacja polega na tym, by kod się
wczytał, ale nie raportował; zabicie loadera zabrałoby też wszystko inne, czym
witryna steruje przez Menedżera tagów. Dzięki warstwie 1 GA milczy, choć się
wczytało.

Ponieważ nie jest blokowany żaden zasób strony, praktycznie nigdy niczego to nie
psuje.

## Sprawdzenie, czy działa

1. Otwórz witrynę korzystającą z GA
2. `F12` → **Sieć**, filtruj po `collect`
3. Żądania do `www.google-analytics.com/g/collect` i pokrewnych powinny być
   pokazane jako zablokowane (`NS_ERROR_ABORTED`) — to warstwa 2
4. W konsoli `_gaUserPrefs.ioo()` powinno zwrócić `true` — to warstwa 1.
   `_gaUserPrefs is not defined` oznacza, że skrypt treści się nie zarejestrował;
   zobacz Rozwiązywanie problemów

## Testy

```bash
make setup-test   # raz: archiwum Firefoksa, geckodriver i venv z selenium
make test
```

`setup-test` instaluje w `~/opt/firefox`, `~/.local/bin` i `.test/` — żadnych
pakietów systemowych, nic nie wymaga roota.

**`make unit`** uruchamia logikę wykluczeń na atrapie API WebExtension. Sam Node,
bez przeglądarki.

**`make test-browser`** dwukrotnie steruje prawdziwym Firefoksem bez interfejsu —
raz z wczytanym rozszerzeniem, raz bez — i porównuje wyniki. Przebieg kontrolny
jest tu sednem: dowodzi, że sieć jest naprawdę osiągalna i że flaga rezygnacji
faktycznie pochodzi od rozszerzenia. Sprawdzane jest, że:

- flaga rezygnacji zostaje ustawiona, **także na stronie z surową CSP** — czyli
  dokładnie tam, gdzie dodatek Google po cichu zawodzi
- witryna przypisująca do `_gaUserPrefs` nie może sama wrócić do śledzenia i nie
  wywołuje przy tym wyjątku
- wysyłki `/collect` z GA4, Universal Analytics i punktów regionalnych są
  blokowane, również pod surową CSP
- `gtag.js` nadal się wczytuje, a `/collect` z tego samego źródła pozostaje
  nietknięte — reguły nie blokują więc zbyt szeroko

Wersja na Androida nie była uruchamiana na fizycznym urządzeniu. Każde użyte API
sprawdzono w browser-compat-data MDN i odpowiada wsparciu desktopowemu, ale to
weryfikacja na papierze, nie test.

## Czego nie potrafi

- **GTM po stronie serwera i pomiar first-party.** Jeśli witryna zbiera dane na
  własnej domenie, np. `metrics.example.com`, a potem przekazuje je do GA ze
  swojego serwera, ruch jest nie do odróżnienia od zwykłego ruchu do tej witryny,
  więc warstwa 2 go nie złapie. Warstwa 1 nadal obowiązuje, bo nadawcą jest
  gtag.js na stronie.
- **Narzędzia analityczne inne niż GA** są poza zakresem. To rozszerzenie
  rezygnuje z Google Analytics i z niczego więcej.
- **Czysto serwerowe wysyłki przez Measurement Protocol** w ogóle nie dotykają
  przeglądarki, więc żadne rozszerzenie ich nie zatrzyma.

## Prywatność

To rozszerzenie **niczego nie zbiera i niczego nigdzie nie wysyła**. Samo nie
wykonuje żadnych żądań sieciowych. Jedyne, co przechowuje, to lista nazw hostów,
które wykluczyłeś (`storage.local`), i ona nigdy nie opuszcza urządzenia. W
manifeście zadeklarowano to jako
`data_collection_permissions: { required: ["none"] }`.

## Języki

26 języków, wybierane automatycznie na podstawie ustawień językowych
przeglądarki — nie ma czego konfigurować:

angielski, arabski, chiński (uproszczony i tradycyjny), czeski, duński, fiński,
francuski, hebrajski, hindi, hiszpański, indonezyjski, japoński, koreański,
niderlandzki, niemiecki, norweski, polski, portugalski (Brazylia), rosyjski,
szwedzki, tajski, turecki, ukraiński, wietnamski, włoski.

Większość nie została napisana przez native speakerów, więc poprawki to
najbardziej mile widziany rodzaj pull requesta. Dodanie języka polega na
skopiowaniu `_locales/en/messages.json` do `_locales/<kod>/messages.json` i
przetłumaczeniu wartości `message`, bez ruszania kluczy i pól `description`. Jest
jedenaście ciągów. Czego zabraknie, wróci do angielskiego.

Ten README też jest tłumaczony — pozostałe języki leżą w `translations/` i są
wypisane na górze tego pliku. Angielski jest wersją źródłową; po dodaniu języka
uruchom `python3 Tools/sync-readme-nav.py`, aby odświeżyć te odnośniki.

## Publikowanie (notatki dla opiekunów)

Firefox nie zainstaluje na stałe niepodpisanego rozszerzenia, więc dystrybucja i
tak przechodzi przez Mozillę:

- **Na liście (listed)** — wyślij `dist/*.zip` w
  [AMO Developer Hub](https://addons.mozilla.org/developers/). Zostanie
  sprawdzone, podpisane i opublikowane na addons.mozilla.org. Zgłoszeń listowych
  nie da się zautomatyzować; `web-ext sign --channel=listed` tylko wysyła do
  przeglądu.
- **Poza listą (unlisted)**, czyli dystrybucja własna — `make sign` z
  [kluczem API AMO](https://addons.mozilla.org/developers/addon/api/key/) zwraca
  podpisany plik `.xpi`, który możesz hostować sam. Uwaga: dodatku
  rozprowadzanego własnymi kanałami nie da się zainstalować w Firefoksie dla
  Androida.

Nie trzeba dołączać źródeł: nic tu nie jest zminifikowane ani zbundlowane.

## Rozwiązywanie problemów

- **`_gaUserPrefs` jest undefined** — najpewniej cofnięto dostęp do witryn. W
  `about:addons` otwórz **Uprawnienia** tego rozszerzenia i zezwól na dostęp do
  wszystkich witryn. Gdy uprawnienie wróci, rozszerzenie zarejestruje się samo
- **Na Firefoksie 127 lub starszym nic się nie dzieje** — skrypty treści
  `world: "MAIN"` wymagają Firefoksa 128. Zaktualizuj
- **Wykluczenie nie zadziałało** — wykluczenia dotyczą domeny, obejmują subdomeny
  i obowiązują od następnego wczytania strony
- **Witryna się zepsuła, a wykluczenie nic nie dało** — to nie było to
  rozszerzenie. Blokowane są wyłącznie żądania `/collect`, nigdy skrypt ani zasób
  strony

## Wsparcie

Hakarasenai jest darmowe i takie pozostanie. Jeśli trzyma Cię z dala od czyjegoś
panelu, wsparcie przez
[GitHub Sponsors](https://github.com/sponsors/omikuji) jest mile widziane i
stanowi jedyne finansowanie projektu.

Sponsoring pokrywa utrzymanie, a to tutaj prawdziwy koszt: Google przenosi i
dodaje punkty zbierania danych, a zestaw reguł, który rok temu był wyczerpujący,
po cichu przestaje taki być. Kupiłby też sprzęt z Androidem, na którym dodatek
jest na razie sprawdzony wyłącznie na papierze.

Pytania, problemy i pomysły — wszystko mile widziane:

- [X (@omikuji_man)](https://x.com/omikuji_man)
- [Formularz kontaktowy](https://omikuji.dev/contact/)
- [Zgłoś problem na GitHubie](https://github.com/omikuji/hakarasenai/issues)

## Licencja

Licencja MIT.
