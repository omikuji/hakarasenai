# Hakarasenai

[English](../README.md) · [العربية](README.ar.md) · [Čeština](README.cs.md) · [Dansk](README.da.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Suomi](README.fi.md) · [Français](README.fr.md) · [עברית](README.he.md) · [हिन्दी](README.hi.md) · [Bahasa Indonesia](README.id.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · **Norsk** · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Svenska](README.sv.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [Tiếng Việt](README.vi.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md)

En Firefox-utvidelse som bare hindrer Google Analytics i å måle deg.
Skrivebord og Android.

*Hakarasenai* betyr "lar den ikke måle" — det er hele funksjonslisten.

**Hva den gjør:**

1. Forteller Google Analytics-koden på siden at du har reservert deg
2. Blokkerer måledataene som ellers ville gått ut likevel
3. Lar deg unnta ett enkelt nettsted fra knappen på verktøylinjen, om noe skulle
   krangle

Ingen innstillingsside, ingen filterabonnementer, ingen tellere, ingen Pro-versjon.

## Hvorfor den finnes

Google gir ut et offisielt «Google Analytics Opt-out Add-on», og det finnes en
Firefox-utgave. Problemet er **hvordan** den virker: den setter inn et
`<script>`-element i siden, og Firefox bruker — som Safari — sidens egen CSP også
på innholdsskript. På ethvert nettsted med streng CSP blir innsettingen blokkert,
og reservasjonen gjør stille ingenting. Ingenting forteller deg at den mislyktes,
og det er den verst tenkelige måten et personvernverktøy kan svikte på.

Hakarasenai bruker den samme offisielle kroken, men legger den der ingen CSP
rekker, og setter nettverksblokkering bak som andre lag. Skulle første lag noen
gang svikte, forlater dataene likevel ikke maskinen.

## Installasjon

### Fra AMO

Søk etter den på [addons.mozilla.org](https://addons.mozilla.org/). På Android
installeres den på samme måte fra AMO — utvidelsen erklærer `gecko_android`, så
Firefox for Android tilbyr den.

### Laste den midlertidig fra kildekoden

Ingen bygging nødvendig. Åpne `about:debugging#/runtime/this-firefox`, velg
**Last midlertidig utvidelse**, og pek på `manifest.json` i dette depotet. Den
blir værende til du lukker Firefox.

Firefox 128 eller nyere kreves, både på skrivebord og Android, fordi
innholdsskript med `world: "MAIN"` først kom i 128.

Slik lages zip-filen til AMO:

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint` og `make run` bruker `web-ext` (hentes av `npx` første gang).
`make lint` gir med vilje to advarsler: erklæringen om datainnsamling
(`data_collection_permissions: none`) leses først fra Firefox 140, mens
`strict_min_version` er 128, så linteren peker på avviket. På 128–139 blir nøkkelen
bare ignorert, og det er ikke verdt å snevre inn støtten for å tie den.

### På Firefox for Android, fra kildekoden

```bash
adb devices                      # finn enhetens id
make run-android DEVICE=<id>
```

Krever adb, USB-feilsøking på telefonen og *Ekstern feilsøking via USB* slått på i
Firefox-innstillingene.

## Bruk

Det finnes én betjening: knappen på verktøylinjen. Den viser tilstanden for det
gjeldende nettstedet og tilbyr én eneste handling.

| Tilstand | Hva det betyr |
| --- | --- |
| **Blokkerer** | Begge lag er på for dette nettstedet. Slik er det som standard overalt |
| **Unntatt** | Begge lag er av for dette nettstedet, og ikonet får et `OFF`-merke |

**Unnta dette nettstedet** skriver nettstedet både inn i en dynamisk `allow`-regel
*og* i innholdsskriptets `excludeMatches`, så unntaket er ekte og ikke bare
kosmetisk. Unntak gjelder **per registrerbart domene og dekker underdomener**:
unntar du `example.com`, unntas også `www.example.com` og `shop.example.com`. De
gjelder fra neste sideinnlasting.

Det er til de gangene du vil måles med vilje — for eksempel når du kontrollerer GA
på ditt eget nettsted. `OFF`-merket tegnes ikke på Android; sprettoppvinduet sier
likevel hvilken tilstand du er i.

## Slik virker den

### Lag 1 — kunngjøre reservasjonen

`ga.js`, `analytics.js` og `gtag.js` sjekker alle
`window._gaUserPrefs.ioo()` (*ioo* = is opted out) før sending, og stopper hvis
den gir true. Det er det samme flagget som Googles egen utvidelse setter — en
nødutgang Google Analytics tilbyr selv.

`src/optout.js` registreres som `world: "MAIN"`-innholdsskript på
`document_start`, så flagget ligger allerede på sidens globale objekt før noe
kode fra nettstedet kjører. Ingenting settes inn i DOM-en, så det finnes ikke noe
for en CSP å blokkere. Nettstedet kan heller ikke overskrive flagget: setteren er
en tom operasjon i stedet for en ikke-skrivbar egenskap, slik at sider i strict
mode som tilordner til den blir ignorert i stedet for å få et unntak.

### Lag 2 — blokkere sendingene

Fem statiske declarativeNetRequest-regler i `rules/ga.json`:

| Domene | Blokkert |
| --- | --- |
| `*.google-analytics.com` | enhver URL som inneholder `/collect` — `/collect`, `/j/collect`, `/g/collect`, `/r/collect` og regionale verter som `region1.` |
| `*.google-analytics.com` | `/batch`, den samlede transporten til analytics.js |
| `*.analytics.google.com` | `/g/collect` og `/g/s/collect`, GA4s regionale endepunkter |
| `stats.g.doubleclick.net` | `/collect`, brukes når Google Signals er på |

**Ikke blokkert:** `googletagmanager.com` (`gtag.js`, `gtm.js`) og skriptene som
`google-analytics.com` selv leverer. Å reservere seg betyr å la koden lastes og
ikke la den rapportere; å drepe lasteren ville også ta med seg alt annet et
nettsted styrer gjennom Tag Manager. Lag 1 holder GA taus selv om den ble lastet.

Siden ingen sideressurs blokkeres, ødelegger dette praktisk talt aldri et nettsted.

## Sjekke at det virker

1. Åpne et nettsted som bruker GA
2. `F12` → **Nettverk**, filtrer på `collect`
3. Forespørsler til `www.google-analytics.com/g/collect` og lignende bør vises som
   blokkert (`NS_ERROR_ABORTED`) — det er lag 2
4. I konsollen bør `_gaUserPrefs.ioo()` gi `true` — det er lag 1.
   `_gaUserPrefs is not defined` betyr at innholdsskriptet ikke ble registrert; se
   Feilsøking

## Testing

```bash
make setup-test   # én gang: Firefox-arkiv, geckodriver og et venv med selenium
make test
```

`setup-test` installerer i `~/opt/firefox`, `~/.local/bin` og `.test/` — ingen
systempakker, ingenting krever root.

**`make unit`** kjører unntakslogikken mot en stubb av WebExtension-API-ene. Bare
Node, ingen nettleser.

**`make test-browser`** styrer en ekte headless Firefox to ganger — én gang med
utvidelsen lastet og én gang uten — og sammenligner. Kontrollkjøringen er poenget:
den beviser at nettverket faktisk er tilgjengelig, og at reservasjonsflagget
virkelig kommer fra utvidelsen. Den sjekker at:

- reservasjonsflagget blir satt, **også på en side levert med streng CSP** —
  nøyaktig det tilfellet der Googles egen utvidelse svikter i stillhet
- et nettsted som tilordner til `_gaUserPrefs` ikke kan melde seg på igjen, og
  ikke kaster et unntak under forsøket
- `/collect`-sendinger fra GA4, Universal Analytics og de regionale endepunktene
  blir blokkert, også under streng CSP
- `gtag.js` fortsatt lastes, og at et `/collect` fra samme opphav forblir urørt —
  altså at reglene ikke blokkerer for bredt

Android-versjonen er ikke prøvd på fysisk maskinvare. Hvert API som brukes er
sjekket mot MDNs browser-compat-data og speiler støtten på skrivebordet, men det er
en kontroll på papiret, ikke en test.

## Hva den ikke kan

- **Tjenersidig GTM og førsteparts måling.** Samler et nettsted inn på sitt eget
  domene, si `metrics.example.com`, og videresender til GA fra tjeneren sin, kan
  trafikken ikke skilles fra vanlig trafikk til det nettstedet, så lag 2 får ikke
  tak i den. Lag 1 gjelder fortsatt, for avsenderen er gtag.js på siden.
- **Andre analyseprodukter enn GA** er utenfor rammen. Denne utvidelsen reserverer
  deg mot Google Analytics og ingenting annet.
- **Rene tjenersidige sendinger via Measurement Protocol** rører aldri nettleseren,
  så ingen nettleserutvidelse kan stoppe dem.

## Personvern

Denne utvidelsen **samler ingenting og sender ingenting noe sted**. Den gjør ingen
nettverksforespørsler på egen hånd. Det eneste som lagres, er listen over
vertsnavn du har unntatt (`storage.local`), og den forlater aldri enheten.
Manifestet erklærer dette som
`data_collection_permissions: { required: ["none"] }`.

## Språk

26 språk, valgt automatisk ut fra nettleserens språkinnstillinger — det er
ingenting å konfigurere:

arabisk, dansk, engelsk, finsk, fransk, hebraisk, hindi, indonesisk, italiensk,
japansk, kinesisk (forenklet og tradisjonell), koreansk, nederlandsk, norsk,
polsk, portugisisk (Brasil), russisk, spansk, svensk, thai, tsjekkisk, tyrkisk,
tysk, ukrainsk, vietnamesisk.

De fleste er ikke skrevet av morsmålsbrukere, så rettelser er den mest velkomne
typen pull request. Å legge til et språk betyr å kopiere
`_locales/en/messages.json` til `_locales/<kode>/messages.json` og oversette
`message`-verdiene, uten å røre nøklene og `description`-feltene. Det er elleve
tekster. Det som mangler, faller tilbake til engelsk.

Denne README-en er også oversatt — de andre språkene bor i `translations/` og er
listet øverst i denne filen. Engelsk er den kanoniske utgaven; kjør
`python3 Tools/sync-readme-nav.py` etter å ha lagt til et språk for å friske opp
lenkene.

## Publisering (notater til vedlikeholdere)

Firefox installerer ikke en usignert utvidelse permanent, så distribusjonen går
gjennom Mozilla uansett:

- **Oppført (listed)** — last opp `dist/*.zip` på
  [AMO Developer Hub](https://addons.mozilla.org/developers/). Den blir gjennomgått,
  signert og publisert på addons.mozilla.org. Oppførte innsendinger kan ikke
  automatiseres; `web-ext sign --channel=listed` laster bare opp til gjennomgang.
- **Ikke oppført (unlisted)**, altså egen distribusjon — `make sign` med en
  [AMO API-nøkkel](https://addons.mozilla.org/developers/addon/api/key/) gir en
  signert `.xpi` du kan legge ut selv. Merk at en selvdistribuert utvidelse ikke kan
  installeres på Firefox for Android.

Kildekode trenger ikke legges ved: ingenting her er minifisert eller bundlet.

## Feilsøking

- **`_gaUserPrefs` er undefined** — tilgangen til nettsteder er sannsynligvis
  trukket tilbake. Åpne **Tillatelser** for denne utvidelsen i `about:addons`, og
  tillat tilgang til alle nettsteder. Den registrerer seg selv på nytt så snart
  tillatelsen er tilbake
- **Ingenting skjer på Firefox 127 eller eldre** — innholdsskript med
  `world: "MAIN"` krever Firefox 128. Oppgrader
- **Et unntak fikk ingen virkning** — unntak gjelder per domene, omfatter
  underdomener og virker fra neste sideinnlasting
- **Et nettsted gikk i stykker, og unntaket løste ingenting** — da var det ikke
  denne utvidelsen. Bare `/collect`-forespørsler blokkeres, aldri et skript eller
  en sideressurs

## Støtte

Hakarasenai er gratis og forblir det. Holder den deg utenfor noens dashbord, er
støtte via [GitHub Sponsors](https://github.com/sponsors/omikuji) satt pris på og
er prosjektets eneste finansiering.

Sponsing betaler for vedlikehold, og det er der den virkelige kostnaden ligger:
Google flytter og legger til innsamlingsendepunkter, og et regelsett som var
uttømmende i fjor slutter stille å være det. Den ville også kjøpe
Android-maskinvaren utvidelsen så langt bare er kontrollert mot på papiret.

Spørsmål, problemer og idéer er alle velkomne:

- [X (@omikuji_man)](https://x.com/omikuji_man)
- [Kontaktskjema](https://omikuji.dev/contact/)
- [Meld et problem på GitHub](https://github.com/omikuji/hakarasenai/issues)

## Lisens

MIT-lisens.
