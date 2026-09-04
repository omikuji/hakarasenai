# Hakarasenai

[English](../README.md) · [العربية](README.ar.md) · [Čeština](README.cs.md) · **Dansk** · [Deutsch](README.de.md) · [Español](README.es.md) · [Suomi](README.fi.md) · [Français](README.fr.md) · [עברית](README.he.md) · [हिन्दी](README.hi.md) · [Bahasa Indonesia](README.id.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Norsk](README.nb.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Svenska](README.sv.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [Tiếng Việt](README.vi.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md)

En Firefox-udvidelse, der udelukkende forhindrer Google Analytics i at måle dig.
Computer og Android.

*Hakarasenai* betyder "lader den ikke måle" — det er hele funktionslisten.

**Hvad den gør:**

1. Fortæller Google Analytics-koden på siden, at du har frameldt dig
2. Blokerer de måledata, der ellers ville blive sendt alligevel
3. Lader dig undtage et enkelt websted fra knappen i værktøjslinjen, hvis et
   driller

Ingen indstillingsside, ingen filterabonnementer, ingen tællere, ingen Pro-version.

## Hvorfor den findes

Google udgiver et officielt "Google Analytics Opt-out Add-on", og der findes en
Firefox-udgave. Problemet er **hvordan** den virker: den indsætter et
`<script>`-element i siden, og Firefox anvender — ligesom Safari — sidens egen
CSP på indholdsscripts. På ethvert websted med stram CSP bliver indsættelsen
blokeret, og frameldingen gør stiltiende ingenting. Intet fortæller dig, at det
mislykkedes, og det er den værst tænkelige måde for et privatlivsværktøj at gå i
stykker på.

Hakarasenai bruger den samme officielle krog, men placerer den, hvor ingen CSP
kan nå den, og sætter netværksblokering bagved som andet lag. Skulle første lag
en dag svigte, forlader data alligevel ikke maskinen.

## Installation

### Fra AMO

Søg efter den på [addons.mozilla.org](https://addons.mozilla.org/). På Android
installeres den på samme måde fra AMO — udvidelsen erklærer `gecko_android`, så
Firefox til Android tilbyder den.

### Indlæs den midlertidigt fra kildekoden

Ingen bygning nødvendig. Åbn `about:debugging#/runtime/this-firefox`, vælg
**Indlæs midlertidigt tilføjelsesprogram**, og peg på dette lagers
`manifest.json`. Den bliver, indtil du lukker Firefox.

Der kræves Firefox 128 eller nyere, både på computer og Android, fordi
indholdsscripts med `world: "MAIN"` først kom i 128.

Sådan laves zip-filen til AMO:

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint` og `make run` bruger `web-ext` (hentes af `npx` første gang).
`make lint` giver med vilje to advarsler: erklæringen om dataindsamling
(`data_collection_permissions: none`) læses først fra Firefox 140, mens
`strict_min_version` er 128, så linteren påpeger forskellen. På 128–139 ignoreres
nøglen bare, og det er ikke værd at indsnævre understøttelsen for at tie den.

### På Firefox til Android, fra kildekoden

```bash
adb devices                      # find enhedens id
make run-android DEVICE=<id>
```

Kræver adb, USB-fejlfinding på telefonen og *Fjernfejlfinding via USB* slået til
i Firefox' indstillinger.

## Brug

Der er én betjening: knappen i værktøjslinjen. Den viser det aktuelle websteds
tilstand og tilbyder en enkelt handling.

| Tilstand | Hvad det betyder |
| --- | --- |
| **Blokerer** | Begge lag er slået til på dette websted. Sådan er det som standard overalt |
| **Undtaget** | Begge lag er slået fra på dette websted, og ikonet får et `OFF`-mærke |

**Undtag dette websted** skriver webstedet både ind i en dynamisk `allow`-regel
*og* i indholdsscriptets `excludeMatches`, så undtagelsen er ægte og ikke bare
kosmetisk. Undtagelser gælder **pr. registrerbart domæne og dækker underdomæner**:
undtager du `example.com`, undtages også `www.example.com` og `shop.example.com`.
De gælder fra næste sideindlæsning.

Det er til, når du gerne vil måles med vilje — for eksempel når du efterprøver GA
på dit eget websted. `OFF`-mærket tegnes ikke på Android; pop op-vinduet siger
stadig, hvilken tilstand du er i.

## Sådan virker den

### Lag 1 — meddel frameldingen

`ga.js`, `analytics.js` og `gtag.js` tjekker alle
`window._gaUserPrefs.ioo()` (*ioo* = is opted out) før afsendelse og stopper,
hvis den returnerer true. Det er det samme flag, som Googles eget
tilføjelsesprogram sætter — en nødudgang, som Google Analytics selv stiller til
rådighed.

`src/optout.js` registreres som `world: "MAIN"`-indholdsscript på
`document_start`, så flaget ligger allerede på sidens globale objekt, før noget
som helst kode fra webstedet kører. Der indsættes intet i DOM'en, så der er
ingenting for en CSP at blokere. Webstedet kan heller ikke overskrive flaget:
setteren er en tom handling frem for en ikke-skrivbar egenskab, så sider i strict
mode, der tildeler til den, bliver ignoreret i stedet for at få en undtagelse.

### Lag 2 — blokér afsendelserne

Fem statiske declarativeNetRequest-regler i `rules/ga.json`:

| Domæne | Blokeret |
| --- | --- |
| `*.google-analytics.com` | enhver URL med `/collect` — `/collect`, `/j/collect`, `/g/collect`, `/r/collect` samt regionale værter som `region1.` |
| `*.google-analytics.com` | `/batch`, analytics.js' samlede transport |
| `*.analytics.google.com` | `/g/collect` og `/g/s/collect`, GA4's regionale endepunkter |
| `stats.g.doubleclick.net` | `/collect`, bruges når Google Signals er slået til |

**Ikke blokeret:** `googletagmanager.com` (`gtag.js`, `gtm.js`) og de scripts,
som `google-analytics.com` selv leverer. At framelde sig betyder at lade koden
indlæse og ikke lade den rapportere; at dræbe indlæseren ville også tage alt
andet, et websted styrer gennem Tag Manager. Lag 1 holder GA tavs, selv om den
blev indlæst.

Da ingen sideressource blokeres, ødelægger det stort set aldrig et websted.

## Tjek at det virker

1. Åbn et websted, der bruger GA
2. `F12` → **Netværk**, filtrér på `collect`
3. Forespørgsler til `www.google-analytics.com/g/collect` og lignende bør vises
   som blokeret (`NS_ERROR_ABORTED`) — det er lag 2
4. I konsollen bør `_gaUserPrefs.ioo()` give `true` — det er lag 1.
   `_gaUserPrefs is not defined` betyder, at indholdsscriptet ikke blev
   registreret; se Fejlfinding

## Test

```bash
make setup-test   # én gang: Firefox-arkiv, geckodriver og et venv med selenium
make test
```

`setup-test` installerer i `~/opt/firefox`, `~/.local/bin` og `.test/` — ingen
systempakker, intet kræver root.

**`make unit`** kører undtagelseslogikken mod en stub af WebExtension-API'erne.
Kun Node, ingen browser.

**`make test-browser`** styrer en rigtig headless Firefox to gange — én gang med
udvidelsen indlæst og én gang uden — og sammenligner. Kontrolkørslen er
pointen: den beviser, at netværket faktisk kan nås, og at frameldingsflaget
virkelig kommer fra udvidelsen. Den tjekker, at:

- frameldingsflaget bliver sat, **også på en side leveret med stram CSP** —
  præcis det tilfælde, hvor Googles eget tilføjelsesprogram svigter i stilhed
- et websted, der tildeler til `_gaUserPrefs`, ikke kan melde sig til igen og
  ikke kaster en undtagelse under forsøget
- `/collect`-afsendelser fra GA4, Universal Analytics og de regionale endepunkter
  bliver blokeret, også under stram CSP
- `gtag.js` stadig indlæses, og at et `/collect` fra samme ophav forbliver urørt
  — altså at reglerne ikke blokerer for bredt

Android-versionen er ikke afprøvet på fysisk hardware. Hver anvendt API er tjekket
mod MDN's browser-compat-data og svarer til understøttelsen på computer, men det
er en kontrol på papiret, ikke en test.

## Hvad den ikke kan

- **Serverside-GTM og first party-måling.** Indsamler et websted på sit eget
  domæne, f.eks. `metrics.example.com`, og videresender til GA fra sin server, kan
  trafikken ikke skelnes fra almindelig trafik til det websted, så lag 2 kan ikke
  fange den. Lag 1 gælder stadig, for afsenderen er gtag.js på siden.
- **Andre analyseprodukter end GA** er uden for rammerne. Denne udvidelse melder
  fra over for Google Analytics og intet andet.
- **Rene serverside-afsendelser via Measurement Protocol** rører aldrig browseren,
  så ingen browserudvidelse kan stoppe dem.

## Privatliv

Denne udvidelse **indsamler intet og sender intet nogen steder hen**. Den laver
ingen netværksforespørgsler af sig selv. Det eneste, der gemmes, er listen over de
værtsnavne, du har undtaget (`storage.local`), og den forlader aldrig enheden.
Manifestet erklærer det som
`data_collection_permissions: { required: ["none"] }`.

## Sprog

26 sprog, valgt automatisk ud fra browserens sprogindstillinger — der er ikke
noget at konfigurere:

arabisk, dansk, engelsk, finsk, fransk, hebraisk, hindi, indonesisk, italiensk,
japansk, kinesisk (forenklet og traditionelt), koreansk, nederlandsk, norsk,
polsk, portugisisk (Brasilien), russisk, spansk, svensk, thai, tjekkisk, tyrkisk,
tysk, ukrainsk, vietnamesisk.

De fleste er ikke skrevet af modersmålstalende, så rettelser er den mest
velkomne slags pull request. At tilføje et sprog vil sige at kopiere
`_locales/en/messages.json` til `_locales/<kode>/messages.json` og oversætte
`message`-værdierne uden at røre nøglerne og `description`-felterne. Der er elleve
tekster. Det, der mangler, falder tilbage til engelsk.

Denne README er også oversat — de øvrige sprog bor i `translations/` og er listet
øverst i denne fil. Engelsk er den kanoniske udgave; kør
`python3 Tools/sync-readme-nav.py` efter at have tilføjet et sprog for at friske
de links op.

## Udgivelse (noter til vedligeholdere)

Firefox installerer ikke en usigneret udvidelse permanent, så distributionen går
gennem Mozilla under alle omstændigheder:

- **Opført (listed)** — upload `dist/*.zip` på
  [AMO Developer Hub](https://addons.mozilla.org/developers/). Den bliver
  gennemgået, signeret og udgivet på addons.mozilla.org. Opførte indsendelser kan
  ikke automatiseres; `web-ext sign --channel=listed` uploader kun til gennemgang.
- **Ikke opført (unlisted)**, altså egen distribution — `make sign` med en
  [AMO API-nøgle](https://addons.mozilla.org/developers/addon/api/key/) giver en
  signeret `.xpi`, som du selv kan hoste. Bemærk, at et selvdistribueret
  tilføjelsesprogram ikke kan installeres på Firefox til Android.

Kildekode behøver ikke vedlægges: intet her er minificeret eller bundtet.

## Fejlfinding

- **`_gaUserPrefs` er undefined** — adgangen til websteder er sandsynligvis
  trukket tilbage. Åbn udvidelsens **Tilladelser** i `about:addons`, og tillad
  adgang til alle websteder. Den registrerer sig selv igen, så snart tilladelsen
  er tilbage
- **Intet sker på Firefox 127 eller ældre** — indholdsscripts med
  `world: "MAIN"` kræver Firefox 128. Opgradér
- **En undtagelse fik ingen virkning** — undtagelser gælder pr. domæne, omfatter
  underdomæner og virker fra næste sideindlæsning
- **Et websted gik i stykker, og undtagelsen løste intet** — så var det ikke denne
  udvidelse. Kun `/collect`-forespørgsler blokeres, aldrig et script eller en
  sideressource

## Støtte

Hakarasenai er gratis og bliver ved med at være det. Holder den dig ude af nogens
dashboard, er støtte via
[GitHub Sponsors](https://github.com/sponsors/omikuji) værdsat og er projektets
eneste finansiering.

Sponsorater betaler for vedligeholdelse, og det er dér, den egentlige omkostning
ligger: Google flytter og tilføjer indsamlingsendepunkter, og et regelsæt, der var
udtømmende sidste år, holder stille og roligt op med at være det. Det ville også
købe den Android-hardware, som udvidelsen indtil videre kun er tjekket mod på
papiret.

Spørgsmål, problemer og idéer er alle velkomne:

- [X (@omikuji_man)](https://x.com/omikuji_man)
- [Kontaktformular](https://omikuji.dev/contact/)
- [Rapportér et problem på GitHub](https://github.com/omikuji/hakarasenai/issues)

## Licens

MIT-licens.
