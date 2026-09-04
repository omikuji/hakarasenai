# Hakarasenai

[English](../README.md) · [العربية](README.ar.md) · [Čeština](README.cs.md) · [Dansk](README.da.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Suomi](README.fi.md) · [Français](README.fr.md) · [עברית](README.he.md) · [हिन्दी](README.hi.md) · [Bahasa Indonesia](README.id.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Norsk](README.nb.md) · **Nederlands** · [Polski](README.pl.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Svenska](README.sv.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [Tiếng Việt](README.vi.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md)

Een Firefox-extensie die alleen voorkomt dat Google Analytics je meet.
Desktop en Android.

*Hakarasenai* betekent "laat het niet meten" — dat is de hele functielijst.

**Wat het doet:**

1. Het vertelt de Google Analytics-code op de pagina dat je je hebt afgemeld
2. Het blokkeert de meetgegevens die anders toch zouden vertrekken
3. Je kunt één site uitsluiten via de knop in de werkbalk, als er eentje dwarsligt

Geen instellingenpagina, geen filterabonnementen, geen tellers, geen Pro-versie.

## Waarom dit bestaat

Google levert een officiële "Google Analytics Opt-out Add-on", en er is een
Firefox-versie van. Het probleem is **hoe** hij werkt: hij injecteert een
`<script>`-element in de pagina, en Firefox past — net als Safari — de CSP van de
pagina ook toe op content scripts. Op elke site met een strikte CSP wordt de
injectie geblokkeerd en doet de afmelding stilletjes niets. Niets vertelt je dat
het mislukt is, en dat is de slechtst denkbare manier waarop een privacytool kan
falen.

Hakarasenai gebruikt dezelfde officiële haak, maar zet die op een plek waar geen
CSP bij kan, en plaatst er netwerkblokkering achter als tweede laag. Mocht de
eerste laag ooit falen, dan vertrekken de gegevens alsnog niet.

## Installatie

### Vanaf AMO

Zoek ernaar op [addons.mozilla.org](https://addons.mozilla.org/). Op Android
installeer je hem net zo vanaf AMO — de add-on declareert `gecko_android`, dus
Firefox voor Android biedt hem aan.

### Tijdelijk laden vanuit de broncode

Bouwen is niet nodig. Open `about:debugging#/runtime/this-firefox`, kies
**Tijdelijke add-on laden** en selecteer de `manifest.json` van deze repository.
Hij blijft tot je Firefox afsluit.

Firefox 128 of nieuwer is vereist, op desktop én op Android, omdat content
scripts met `world: "MAIN"` pas in 128 zijn geland.

Om de zip voor AMO te maken:

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint` en `make run` gebruiken `web-ext` (de eerste keer opgehaald door
`npx`). `make lint` geeft met opzet twee waarschuwingen: de
gegevensverzamelingsverklaring (`data_collection_permissions: none`) wordt pas
vanaf Firefox 140 gelezen, en `strict_min_version` staat op 128, dus de linter
wijst op dat gat. Op 128–139 wordt de sleutel simpelweg genegeerd, en daarvoor de
ondersteuning versmallen is het niet waard.

### Op Firefox voor Android, vanuit de broncode

```bash
adb devices                      # zoek het apparaat-id
make run-android DEVICE=<id>
```

Vereist adb, USB-foutopsporing op de telefoon en *Externe foutopsporing via USB*
aan in de instellingen van Firefox.

## Gebruik

Er is één bedieningselement: de knop in de werkbalk. Die toont de status van de
huidige site en biedt precies één actie.

| Status | Wat het betekent |
| --- | --- |
| **Blokkeert** | Beide lagen staan aan op deze site. Dit is overal de standaard |
| **Uitgesloten** | Beide lagen staan uit op deze site, en het pictogram krijgt een `OFF`-badge |

**Deze site uitsluiten** zet de site zowel in een dynamische `allow`-regel *als*
in de `excludeMatches` van het content script, dus de uitsluiting is echt en niet
alleen cosmetisch. Uitsluitingen gelden **per registreerbaar domein en dekken
subdomeinen**: `example.com` uitsluiten sluit ook `www.example.com` en
`shop.example.com` uit. Ze gelden vanaf de volgende paginalading.

Dit is bedoeld voor wanneer je expres gemeten wilt worden — bij het controleren
van GA op je eigen site bijvoorbeeld. De `OFF`-badge wordt op Android niet
getekend; het pop-upvenster vertelt nog steeds in welke status je zit.

## Hoe het werkt

### Laag 1 — de afmelding kenbaar maken

`ga.js`, `analytics.js` en `gtag.js` controleren alle drie
`window._gaUserPrefs.ioo()` (*ioo* = is opted out) vóór het verzenden, en stoppen
als die true teruggeeft. Het is dezelfde vlag die Googles eigen add-on zet — een
nooduitgang die Google Analytics zelf aanbiedt.

`src/optout.js` wordt geregistreerd als `world: "MAIN"` content script op
`document_start`, dus de vlag staat al op het globale object van de pagina
voordat er ook maar één regel sitecode draait. Er wordt niets in de DOM gezet,
dus er is niets voor een CSP om te blokkeren. Een site kan de vlag ook niet
overschrijven: de setter is een lege bewerking in plaats van een
niet-schrijfbare eigenschap, zodat pagina's in strict mode die eraan toewijzen
genegeerd worden in plaats van een uitzondering te krijgen.

### Laag 2 — de hits blokkeren

Vijf statische declarativeNetRequest-regels, in `rules/ga.json`:

| Domein | Geblokkeerd |
| --- | --- |
| `*.google-analytics.com` | elke URL met `/collect` — `/collect`, `/j/collect`, `/g/collect`, `/r/collect`, en regionale hosts zoals `region1.` |
| `*.google-analytics.com` | `/batch`, het gebundelde transport van analytics.js |
| `*.analytics.google.com` | `/g/collect` en `/g/s/collect`, de regionale GA4-eindpunten |
| `stats.g.doubleclick.net` | `/collect`, gebruikt wanneer Google Signals aanstaat |

**Niet geblokkeerd:** `googletagmanager.com` (`gtag.js`, `gtm.js`) en de scripts
die `google-analytics.com` zelf serveert. Afmelden betekent de code laten laden
en hem niet laten rapporteren; de loader neerhalen zou ook alles meenemen wat een
site verder via Tag Manager aanstuurt. Laag 1 houdt GA stil, ook al is het geladen.

Omdat er geen enkele paginabron wordt geblokkeerd, gaat er hierdoor vrijwel nooit
een site stuk.

## Controleren of het werkt

1. Open een site die GA gebruikt
2. `F12` → **Netwerk**, filter op `collect`
3. Verzoeken naar `www.google-analytics.com/g/collect` en verwanten horen als
   geblokkeerd (`NS_ERROR_ABORTED`) te verschijnen — dat is laag 2
4. In de console hoort `_gaUserPrefs.ioo()` `true` te geven — dat is laag 1.
   `_gaUserPrefs is not defined` betekent dat het content script niet
   geregistreerd is; zie Problemen oplossen

## Testen

```bash
make setup-test   # eenmalig: Firefox-tarball, geckodriver en een venv met selenium
make test
```

`setup-test` installeert in `~/opt/firefox`, `~/.local/bin` en `.test/` — geen
systeempakketten, niets vereist root.

**`make unit`** draait de uitsluitingslogica tegen een stub van de
WebExtension-API's. Alleen Node, geen browser.

**`make test-browser`** stuurt twee keer een echte headless Firefox aan — één keer
met de extensie geladen en één keer zonder — en vergelijkt beide. De controlerun
is de kern: die bewijst dat het netwerk echt bereikbaar is en dat de
afmeldingsvlag werkelijk van de extensie komt. Er wordt gecontroleerd dat:

- de afmeldingsvlag wordt gezet, **ook op een pagina met een strikte CSP** —
  precies het geval waarin Googles eigen add-on stilletjes faalt
- een site die aan `_gaUserPrefs` toewijst zichzelf niet weer kan aanmelden, en
  daarbij geen uitzondering veroorzaakt
- `/collect`-hits van GA4, Universal Analytics en de regionale eindpunten worden
  geblokkeerd, ook onder een strikte CSP
- `gtag.js` nog steeds laadt en een `/collect` van dezelfde oorsprong onaangeroerd
  blijft — de regels blokkeren dus niet te breed

De Android-build is niet op echte hardware beproefd. Elke gebruikte API is
nagetrokken in de browser-compat-data van MDN en spiegelt de desktopondersteuning,
maar dat is een controle op papier, geen test.

## Wat het niet kan

- **Server-side GTM en first-party meting.** Verzamelt een site op het eigen
  domein, zeg `metrics.example.com`, en stuurt hij het vanaf de server door naar
  GA, dan is dat verkeer niet te onderscheiden van gewoon verkeer naar die site,
  dus laag 2 krijgt het niet te pakken. Laag 1 geldt nog wel, want de afzender is
  gtag.js op de pagina.
- **Andere analyseproducten dan GA** vallen buiten het bestek. Deze extensie meldt
  je af bij Google Analytics, verder niets.
- **Puur server-side hits via het Measurement Protocol** raken de browser nooit,
  dus geen enkele browserextensie kan ze tegenhouden.

## Privacy

Deze extensie **verzamelt niets en stuurt niets ergens heen**. Ze doet geen eigen
netwerkverzoeken. Het enige wat wordt opgeslagen is de lijst met hostnamen die je
hebt uitgesloten (`storage.local`), en die verlaat het apparaat nooit. Het
manifest verklaart dit als
`data_collection_permissions: { required: ["none"] }`.

## Talen

26 talen, automatisch gekozen op basis van de taalinstellingen van je browser —
er valt niets in te stellen:

Arabisch, Chinees (vereenvoudigd en traditioneel), Deens, Duits, Engels, Fins,
Frans, Hebreeuws, Hindi, Indonesisch, Italiaans, Japans, Koreaans, Nederlands,
Noors, Oekraïens, Pools, Portugees (Brazilië), Russisch, Spaans, Thai, Tsjechisch,
Turks, Vietnamees, Zweeds.

De meeste zijn niet door moedertaalsprekers geschreven, dus correcties zijn de
meest welkome soort pull request. Een taal toevoegen betekent
`_locales/en/messages.json` kopiëren naar `_locales/<code>/messages.json` en de
`message`-waarden vertalen, met de sleutels en de `description`-velden ongemoeid.
Het zijn elf teksten. Wat ontbreekt valt terug op het Engels.

Deze README is ook vertaald — de andere talen staan in `translations/`, opgesomd
bovenaan dit bestand. Engels is de canonieke versie; draai
`python3 Tools/sync-readme-nav.py` na het toevoegen van een taal om die links bij
te werken.

## Publiceren (aantekeningen voor beheerders)

Firefox installeert geen niet-ondertekende extensie permanent, dus distributie
loopt hoe dan ook via Mozilla:

- **Vermeld (listed)** — upload `dist/*.zip` op de
  [AMO Developer Hub](https://addons.mozilla.org/developers/). Hij wordt
  beoordeeld, ondertekend en gepubliceerd op addons.mozilla.org. Vermelde
  inzendingen zijn niet te automatiseren; `web-ext sign --channel=listed` uploadt
  alleen ter beoordeling.
- **Niet vermeld (unlisted)**, dus zelf distribueren — `make sign` met een
  [AMO-API-sleutel](https://addons.mozilla.org/developers/addon/api/key/) levert
  een ondertekende `.xpi` op die je zelf kunt hosten. Let op: een zelf
  gedistribueerde add-on kan niet op Firefox voor Android worden geïnstalleerd.

Broncode hoeft niet te worden meegestuurd: hier is niets geminificeerd of gebundeld.

## Problemen oplossen

- **`_gaUserPrefs` is undefined** — waarschijnlijk is de sitetoegang ingetrokken.
  Open in `about:addons` de **Machtigingen** van deze extensie en sta toegang tot
  alle sites toe. Zodra de machtiging terug is, registreert hij zichzelf opnieuw
- **Op Firefox 127 of ouder gebeurt er niets** — content scripts met
  `world: "MAIN"` vereisen Firefox 128. Werk bij
- **Een uitsluiting had geen effect** — uitsluitingen gelden per domein, omvatten
  subdomeinen en werken vanaf de volgende paginalading
- **Een site ging stuk en uitsluiten hielp niet** — dan was het deze extensie
  niet. Alleen `/collect`-verzoeken worden geblokkeerd, nooit een script of een
  paginabron

## Steun

Hakarasenai is gratis en blijft dat. Als het je buiten iemands dashboard houdt,
is steun via [GitHub Sponsors](https://github.com/sponsors/omikuji) welkom en is
het de enige financiering van het project.

Sponsoring betaalt het onderhoud, en daar zit de echte kostenpost: Google
verplaatst en voegt verzamelpunten toe, en een regelset die vorig jaar volledig
was, houdt stilletjes op dat te zijn. Het zou ook de Android-hardware kopen
waartegen de add-on nu alleen op papier is nagetrokken.

Vragen, problemen en ideeën zijn allemaal welkom:

- [X (@omikuji_man)](https://x.com/omikuji_man)
- [Contactformulier](https://omikuji.dev/contact/)
- [Een probleem melden op GitHub](https://github.com/omikuji/hakarasenai/issues)

## Licentie

MIT-licentie.
