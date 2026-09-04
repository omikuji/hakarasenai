# Hakarasenai

[English](../README.md) · [العربية](README.ar.md) · [Čeština](README.cs.md) · [Dansk](README.da.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Suomi](README.fi.md) · [Français](README.fr.md) · [עברית](README.he.md) · [हिन्दी](README.hi.md) · [Bahasa Indonesia](README.id.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Norsk](README.nb.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · **Svenska** · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [Tiếng Việt](README.vi.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md)

Ett Firefox-tillägg som bara hindrar Google Analytics från att mäta dig.
Dator och Android.

*Hakarasenai* betyder "låter den inte mäta" — det är hela funktionslistan.

**Vad det gör:**

1. Talar om för Google Analytics-koden på sidan att du har valt bort spårning
2. Blockerar de mätdata som annars skulle skickas ändå
3. Låter dig undanta en enskild webbplats från knappen i verktygsfältet, om någon
   krånglar

Ingen inställningssida, inga filterprenumerationer, inga räknare, ingen Pro-version.

## Varför det finns

Google ger ut ett officiellt "Google Analytics Opt-out Add-on", och det finns en
Firefox-version. Problemet är **hur** det fungerar: det injicerar ett
`<script>`-element i sidan, och Firefox tillämpar — precis som Safari — sidans
egen CSP även på innehållsskript. På varje webbplats med strikt CSP blockeras
injiceringen och bortvalet gör tyst ingenting. Ingenting talar om för dig att det
misslyckades, vilket är det sämsta tänkbara sättet för ett integritetsverktyg att
gå sönder på.

Hakarasenai använder samma officiella krok, men lägger den där ingen CSP når, och
sätter nätverksblockering bakom som andra lager. Skulle första lagret någon gång
fallera lämnar data ändå inte datorn.

## Installation

### Från AMO

Sök efter det på [addons.mozilla.org](https://addons.mozilla.org/). På Android
installeras det på samma sätt från AMO — tillägget deklarerar `gecko_android`, så
Firefox för Android erbjuder det.

### Läsa in det tillfälligt från källkoden

Ingen byggning behövs. Öppna `about:debugging#/runtime/this-firefox`, välj
**Läs in temporärt tillägg** och peka ut `manifest.json` i det här förrådet. Det
ligger kvar tills du stänger Firefox.

Firefox 128 eller senare krävs, både på dator och Android, eftersom
innehållsskript med `world: "MAIN"` kom först i 128.

Så byggs zip-filen för AMO:

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint` och `make run` använder `web-ext` (hämtas av `npx` första gången).
`make lint` ger med flit två varningar: deklarationen om datainsamling
(`data_collection_permissions: none`) läses först från Firefox 140, medan
`strict_min_version` är 128, så lintern påpekar glappet. På 128–139 ignoreras
nyckeln helt enkelt, och det är inte värt att smalna av stödet för att tysta den.

### På Firefox för Android, från källkoden

```bash
adb devices                      # ta reda på enhetens id
make run-android DEVICE=<id>
```

Kräver adb, USB-felsökning på telefonen och *Fjärrfelsökning via USB* påslaget i
Firefox inställningar.

## Användning

Det finns en enda kontroll: knappen i verktygsfältet. Den visar den aktuella
webbplatsens tillstånd och erbjuder en enda åtgärd.

| Tillstånd | Vad det betyder |
| --- | --- |
| **Blockerar** | Båda lagren är på för den här webbplatsen. Så är det som standard överallt |
| **Undantagen** | Båda lagren är av för den här webbplatsen, och ikonen bär en `OFF`-bricka |

**Undanta den här webbplatsen** skriver in webbplatsen både i en dynamisk
`allow`-regel *och* i innehållsskriptets `excludeMatches`, så undantaget är på
riktigt och inte bara kosmetiskt. Undantag gäller **per registrerbar domän och
täcker underdomäner**: undantar du `example.com` undantas även `www.example.com`
och `shop.example.com`. De gäller från nästa sidladdning.

Det är till för när du vill bli mätt med flit — till exempel när du kontrollerar
GA på din egen webbplats. `OFF`-brickan ritas inte på Android; popupen säger ändå
vilket tillstånd du är i.

## Så fungerar det

### Lager 1 — meddela bortvalet

`ga.js`, `analytics.js` och `gtag.js` kontrollerar alla
`window._gaUserPrefs.ioo()` (*ioo* = is opted out) före sändning och slutar om
den ger true. Det är samma flagga som Googles eget tillägg sätter — en nödutgång
som Google Analytics tillhandahåller själv.

`src/optout.js` registreras som `world: "MAIN"`-innehållsskript vid
`document_start`, så flaggan ligger redan på sidans globala objekt innan någon
kod från webbplatsen körs. Ingenting sätts in i DOM:en, så det finns ingenting
för en CSP att blockera. Webbplatsen kan inte heller skriva över flaggan:
settern är en tom operation i stället för en icke skrivbar egenskap, så sidor i
strict mode som tilldelar till den ignoreras i stället för att få ett undantag.

### Lager 2 — blockera sändningarna

Fem statiska declarativeNetRequest-regler i `rules/ga.json`:

| Domän | Blockerat |
| --- | --- |
| `*.google-analytics.com` | varje URL som innehåller `/collect` — `/collect`, `/j/collect`, `/g/collect`, `/r/collect` samt regionala värdar som `region1.` |
| `*.google-analytics.com` | `/batch`, den buntade transporten i analytics.js |
| `*.analytics.google.com` | `/g/collect` och `/g/s/collect`, GA4:s regionala ändpunkter |
| `stats.g.doubleclick.net` | `/collect`, används när Google Signals är på |

**Blockeras inte:** `googletagmanager.com` (`gtag.js`, `gtm.js`) och de skript som
`google-analytics.com` själv levererar. Att välja bort betyder att låta koden
laddas och inte låta den rapportera; att döda laddaren skulle även ta med allt
annat en webbplats styr genom Tagghanteraren. Lager 1 håller GA tyst trots att det
laddades.

Eftersom ingen sidresurs blockeras går det praktiskt taget aldrig sönder någon
webbplats av det här.

## Kontrollera att det fungerar

1. Öppna en webbplats som använder GA
2. `F12` → **Nätverk**, filtrera på `collect`
3. Förfrågningar till `www.google-analytics.com/g/collect` och liknande bör visas
   som blockerade (`NS_ERROR_ABORTED`) — det är lager 2
4. I konsolen bör `_gaUserPrefs.ioo()` ge `true` — det är lager 1.
   `_gaUserPrefs is not defined` betyder att innehållsskriptet inte registrerades;
   se Felsökning

## Tester

```bash
make setup-test   # en gång: Firefox-arkiv, geckodriver och ett venv med selenium
make test
```

`setup-test` installerar i `~/opt/firefox`, `~/.local/bin` och `.test/` — inga
systempaket, ingenting kräver root.

**`make unit`** kör undantagslogiken mot en stubbe av WebExtension-API:erna. Bara
Node, ingen webbläsare.

**`make test-browser`** styr en riktig headless Firefox två gånger — en gång med
tillägget inläst och en gång utan — och jämför de två. Kontrollkörningen är
själva poängen: den bevisar att nätverket verkligen går att nå och att
bortvalsflaggan verkligen kommer från tillägget. Den kontrollerar att:

- bortvalsflaggan sätts, **även på en sida som levereras med strikt CSP** —
  precis det fall där Googles eget tillägg fallerar i tysthet
- en webbplats som tilldelar till `_gaUserPrefs` inte kan välja in sig igen, och
  inte kastar något undantag när den försöker
- `/collect`-sändningar från GA4, Universal Analytics och de regionala ändpunkterna
  blockeras, även under strikt CSP
- `gtag.js` fortfarande laddas och att ett `/collect` från samma ursprung lämnas i
  fred — alltså att reglerna inte blockerar för brett

Android-bygget har inte prövats på fysisk hårdvara. Varje API som används har
stämts av mot MDN:s browser-compat-data och speglar stödet på skrivbordet, men det
är en kontroll på papperet, inte ett test.

## Vad det inte kan

- **Serversidig GTM och förstapartsmätning.** Om en webbplats samlar in på sin
  egen domän, säg `metrics.example.com`, och vidarebefordrar till GA från sin
  server går trafiken inte att skilja från vanlig trafik till den webbplatsen, så
  lager 2 kan inte fånga den. Lager 1 gäller fortfarande, eftersom avsändaren är
  gtag.js på sidan.
- **Andra analysprodukter än GA** ligger utanför omfånget. Det här tillägget
  väljer bort Google Analytics och ingenting annat.
- **Rent serversidiga sändningar via Measurement Protocol** rör aldrig
  webbläsaren, så inget webbläsartillägg kan stoppa dem.

## Integritet

Det här tillägget **samlar inte in något och skickar inte något någonstans**. Det
gör inga egna nätverksanrop. Det enda som lagras är listan över de värdnamn du
undantagit (`storage.local`), och den lämnar aldrig enheten. Manifestet deklarerar
detta som `data_collection_permissions: { required: ["none"] }`.

## Språk

26 språk, valda automatiskt utifrån webbläsarens språkinställningar — det finns
ingenting att konfigurera:

arabiska, danska, engelska, finska, franska, hebreiska, hindi, indonesiska,
italienska, japanska, kinesiska (förenklad och traditionell), koreanska,
nederländska, norska, polska, portugisiska (Brasilien), ryska, spanska, svenska,
thailändska, tjeckiska, turkiska, tyska, ukrainska, vietnamesiska.

De flesta är inte skrivna av modersmålstalare, så rättelser är den mest välkomna
sortens pull request. Att lägga till ett språk innebär att kopiera
`_locales/en/messages.json` till `_locales/<kod>/messages.json` och översätta
`message`-värdena, utan att röra nycklarna och `description`-fälten. Det är elva
texter. Det som saknas faller tillbaka på engelska.

Den här README-filen är också översatt — de andra språken bor i `translations/`
och listas överst i den här filen. Engelska är den kanoniska versionen; kör
`python3 Tools/sync-readme-nav.py` efter att ha lagt till ett språk för att
uppdatera länkarna.

## Publicering (anteckningar för underhållare)

Firefox installerar inte ett osignerat tillägg permanent, så distributionen går
via Mozilla i vilket fall:

- **Listat** — ladda upp `dist/*.zip` på
  [AMO Developer Hub](https://addons.mozilla.org/developers/). Det granskas,
  signeras och publiceras på addons.mozilla.org. Listade inskickningar går inte att
  automatisera; `web-ext sign --channel=listed` laddar bara upp för granskning.
- **Olistat**, det vill säga egen distribution — `make sign` med en
  [AMO API-nyckel](https://addons.mozilla.org/developers/addon/api/key/) ger en
  signerad `.xpi` som du kan hosta själv. Observera att ett egendistribuerat
  tillägg inte går att installera på Firefox för Android.

Källkod behöver inte bifogas: ingenting här är minifierat eller buntat.

## Felsökning

- **`_gaUserPrefs` är undefined** — åtkomsten till webbplatser har troligen
  återkallats. Öppna tilläggets **Behörigheter** i `about:addons` och tillåt
  åtkomst till alla webbplatser. Det registrerar sig självt igen så snart
  behörigheten är tillbaka
- **Ingenting händer på Firefox 127 eller äldre** — innehållsskript med
  `world: "MAIN"` kräver Firefox 128. Uppgradera
- **Ett undantag fick ingen effekt** — undantag gäller per domän, omfattar
  underdomäner och gäller från nästa sidladdning
- **En webbplats gick sönder och undantaget löste ingenting** — då var det inte
  det här tillägget. Bara `/collect`-förfrågningar blockeras, aldrig ett skript
  eller en sidresurs

## Stöd

Hakarasenai är gratis och kommer att förbli det. Om det håller dig utanför någons
instrumentpanel är stöd via
[GitHub Sponsors](https://github.com/sponsors/omikuji) uppskattat och är projektets
enda finansiering.

Sponsring betalar underhållet, och det är där den verkliga kostnaden ligger:
Google flyttar och lägger till insamlingsändpunkter, och en regeluppsättning som
var uttömmande i fjol slutar tyst att vara det. Det skulle också köpa den
Android-hårdvara som tillägget hittills bara kontrollerats mot på papperet.

Frågor, problem och idéer är alla välkomna:

- [X (@omikuji_man)](https://x.com/omikuji_man)
- [Kontaktformulär](https://omikuji.dev/contact/)
- [Rapportera ett problem på GitHub](https://github.com/omikuji/hakarasenai/issues)

## Licens

MIT-licens.
