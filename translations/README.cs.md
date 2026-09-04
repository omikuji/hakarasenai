# Hakarasenai

[English](../README.md) · [العربية](README.ar.md) · **Čeština** · [Dansk](README.da.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Suomi](README.fi.md) · [Français](README.fr.md) · [עברית](README.he.md) · [हिन्दी](README.hi.md) · [Bahasa Indonesia](README.id.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Norsk](README.nb.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Svenska](README.sv.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [Tiếng Việt](README.vi.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md)

Rozšíření Firefoxu, které dělá jedinou věc: nenechá Google Analytics, aby vás
měřil. Na počítači i na Androidu.

*Hakarasenai* znamená „nenechat změřit" — a to je celý seznam funkcí.

**Co dělá:**

1. Řekne kódu Google Analytics na stránce, že jste se odhlásili z měření
2. Zablokuje měřicí data, která by odešla i tak
3. Umožní tlačítkem na liště vyloučit jeden konkrétní web, když nějaký zlobí

Žádná stránka nastavení, žádné odběry filtrů, žádné počítadlo, žádná Pro verze.

## Proč vzniklo

Google vydává oficiální „Google Analytics Opt-out Add-on" a existuje i jeho
sestavení pro Firefox. Problém je v tom **jak** funguje: vkládá do stránky prvek
`<script>`, a Firefox — stejně jako Safari — uplatňuje CSP stránky i na skripty
obsahu. Na jakémkoli webu s přísnou CSP je vložení zablokováno a odhlášení tiše
nedělá nic. Nic vám neřekne, že selhalo, což je nejhorší možný způsob, jak může
nástroj na ochranu soukromí selhat.

Hakarasenai používá stejný oficiální háček, ale umístí ho tam, kam žádná CSP
nedosáhne, a za něj postaví blokování sítě jako druhou vrstvu. Kdyby první vrstva
někdy selhala, data stejně neodejdou.

## Instalace

### Z AMO

Vyhledejte ho na [addons.mozilla.org](https://addons.mozilla.org/). Na Androidu
se instaluje stejně z AMO — doplněk deklaruje `gecko_android`, takže mu ho
Firefox pro Android nabídne.

### Dočasné načtení ze zdrojů

Není potřeba nic sestavovat. Otevřete `about:debugging#/runtime/this-firefox`,
zvolte **Načíst dočasný doplněk** a vyberte `manifest.json` z tohoto repozitáře.
Vydrží, dokud Firefox nezavřete.

Vyžaduje se Firefox 128 nebo novější, na počítači i na Androidu, protože skripty
obsahu s `world: "MAIN"` přišly až ve 128.

Sestavení zipu pro AMO:

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint` a `make run` používají `web-ext` (poprvé ho stáhne `npx`).
`make lint` záměrně hlásí dvě varování: deklarace sběru dat
(`data_collection_permissions: none`) se čte až od Firefoxu 140, zatímco
`strict_min_version` je 128, takže linter na ten rozdíl upozorňuje. Na 128–139 se
klíč prostě ignoruje a nestojí za to kvůli tomu zužovat podporu.

### Na Firefoxu pro Android, ze zdrojů

```bash
adb devices                      # zjistěte id zařízení
make run-android DEVICE=<id>
```

Potřebujete adb, ladění přes USB na telefonu a zapnuté *Vzdálené ladění přes USB*
v nastavení Firefoxu.

## Používání

Ovládací prvek je jediný: tlačítko na liště. Ukazuje stav aktuálního webu a
nabízí jedinou akci.

| Stav | Co znamená |
| --- | --- |
| **Blokuje se** | Obě vrstvy jsou na tomto webu aktivní. Všude je to výchozí stav |
| **Vyloučeno** | Obě vrstvy jsou na tomto webu vypnuté a ikona nese odznak `OFF` |

**Vyloučit tento web** zapíše web jak do dynamického pravidla `allow`, tak do
`excludeMatches` skriptu obsahu — vyloučení je tedy skutečné, ne jen kosmetické.
Vyloučení platí **pro registrovatelnou doménu a zahrnuje subdomény**: vyloučením
`example.com` vyloučíte i `www.example.com` a `shop.example.com`. Projeví se od
dalšího načtení stránky.

Hodí se, když chcete být změřeni schválně — třeba při ověřování GA na vlastním
webu. Odznak `OFF` se na Androidu nevykresluje; okénko přesto říká, v jakém stavu
jste.

## Jak to funguje

### Vrstva 1 — ohlásit odhlášení

`ga.js`, `analytics.js` i `gtag.js` před odesláním kontrolují
`window._gaUserPrefs.ioo()` (*ioo* = is opted out) a přestanou, pokud vrátí true.
Je to tentýž příznak, jaký nastavuje doplněk samotného Googlu — nouzový východ,
který Google Analytics nabízí sám.

`src/optout.js` se registruje jako skript obsahu `world: "MAIN"` v
`document_start`, takže příznak je na globálním objektu stránky dřív, než se
spustí jakýkoli kód webu. Do DOM se nic nevkládá, takže CSP nemá co blokovat. Web
příznak ani nepřepíše: setter je prázdná operace místo nezapisovatelné
vlastnosti, takže stránky v přísném režimu, které do něj přiřazují, jsou
ignorovány místo aby dostaly výjimku.

### Vrstva 2 — zablokovat odesílání

Pět statických pravidel declarativeNetRequest v `rules/ga.json`:

| Doména | Blokováno |
| --- | --- |
| `*.google-analytics.com` | jakákoli URL obsahující `/collect` — `/collect`, `/j/collect`, `/g/collect`, `/r/collect` a regionální hostitelé jako `region1.` |
| `*.google-analytics.com` | `/batch`, dávkový přenos analytics.js |
| `*.analytics.google.com` | `/g/collect` a `/g/s/collect`, regionální koncové body GA4 |
| `stats.g.doubleclick.net` | `/collect`, používá se při zapnutých signálech Google |

**Neblokuje se:** `googletagmanager.com` (`gtag.js`, `gtm.js`) ani skripty, které
servíruje samotné `google-analytics.com`. Odhlásit se znamená nechat kód načíst a
nenechat ho hlásit; zabít zavaděč by sebralo i všechno ostatní, co web řídí přes
Správce značek. Díky vrstvě 1 zůstává GA zticha, i když se načetlo.

Protože se neblokuje žádný zdroj stránky, prakticky nikdy tím nic nerozbijete.

## Ověření, že to funguje

1. Otevřete web, který používá GA
2. `F12` → **Síť**, filtrujte na `collect`
3. Požadavky na `www.google-analytics.com/g/collect` a podobné by se měly
   zobrazit jako blokované (`NS_ERROR_ABORTED`) — to je vrstva 2
4. V konzoli by `_gaUserPrefs.ioo()` mělo vrátit `true` — to je vrstva 1.
   `_gaUserPrefs is not defined` znamená, že se skript obsahu nezaregistroval;
   viz Řešení potíží

## Testy

```bash
make setup-test   # jednou: archiv Firefoxu, geckodriver a venv se selenium
make test
```

`setup-test` instaluje do `~/opt/firefox`, `~/.local/bin` a `.test/` — žádné
systémové balíčky, nic nepotřebuje root.

**`make unit`** pouští logiku vylučování proti záslepce WebExtension API. Jen
Node, bez prohlížeče.

**`make test-browser`** dvakrát řídí skutečný Firefox bez rozhraní — jednou s
načteným rozšířením a jednou bez — a obojí porovná. Kontrolní běh je to podstatné:
dokazuje, že síť je opravdu dostupná a že příznak odhlášení skutečně pochází z
rozšíření. Kontroluje se, že:

- příznak odhlášení je nastaven, **i na stránce s přísnou CSP** — tedy přesně
  tam, kde doplněk Googlu tiše selhává
- web, který přiřadí do `_gaUserPrefs`, se nemůže sám přihlásit zpět a přitom
  nevyvolá výjimku
- odeslání `/collect` z GA4, Universal Analytics i regionálních koncových bodů
  jsou blokována, i pod přísnou CSP
- `gtag.js` se stále načítá a `/collect` ze stejného původu zůstává nedotčen —
  pravidla tedy neblokují příliš široce

Sestavení pro Android nebylo vyzkoušeno na fyzickém zařízení. Každé použité API
bylo ověřeno v browser-compat-data od MDN a odpovídá podpoře na počítači, ale to
je papírová kontrola, ne test.

## Co nedokáže

- **Serverové GTM a first-party měření.** Pokud web sbírá na vlastní doméně,
  třeba `metrics.example.com`, a ze svého serveru to přeposílá do GA, je takový
  provoz nerozeznatelný od běžného provozu na ten web, takže vrstva 2 ho nechytí.
  Vrstva 1 stále platí, protože odesílatelem je gtag.js na stránce.
- **Jiné analytické nástroje než GA** jsou mimo rozsah. Toto rozšíření se odhlašuje
  z Google Analytics a z ničeho jiného.
- **Čistě serverové odesílání přes Measurement Protocol** se prohlížeče vůbec
  nedotkne, takže ho žádné rozšíření nezastaví.

## Soukromí

Toto rozšíření **nic nesbírá a nic nikam neposílá**. Samo neprovádí žádné síťové
požadavky. Jediné, co ukládá, je seznam názvů hostitelů, které jste vyloučili
(`storage.local`), a ten nikdy neopustí zařízení. V manifestu je to deklarováno
jako `data_collection_permissions: { required: ["none"] }`.

## Jazyky

26 jazyků, vybíraných automaticky podle jazykového nastavení prohlížeče — není co
konfigurovat:

angličtina, arabština, čeština, čínština (zjednodušená a tradiční), dánština,
finština, francouzština, hebrejština, hindština, indonéština, italština,
japonština, korejština, němčina, nizozemština, norština, polština,
portugalština (Brazílie), ruština, španělština, švédština, thajština, turečtina,
ukrajinština, vietnamština.

Většinu nepsali rodilí mluvčí, takže opravy jsou nejvítanějším druhem pull
requestu. Přidat jazyk znamená zkopírovat `_locales/en/messages.json` do
`_locales/<kód>/messages.json` a přeložit hodnoty `message`, klíče a pole
`description` nechat být. Řetězců je jedenáct. Co chybí, spadne zpět na angličtinu.

I tento README je přeložený — ostatní jazyky žijí v `translations/` a jsou
vypsané nahoře v tomto souboru. Angličtina je závazná verze; po přidání jazyka
spusťte `python3 Tools/sync-readme-nav.py`, aby se odkazy obnovily.

## Publikování (poznámky pro správce)

Firefox nenainstaluje nepodepsané rozšíření natrvalo, takže distribuce tak či tak
vede přes Mozillu:

- **V seznamu (listed)** — nahrajte `dist/*.zip` na
  [AMO Developer Hub](https://addons.mozilla.org/developers/). Projde revizí,
  podepsáním a publikací na addons.mozilla.org. Odeslání do seznamu nelze
  automatizovat; `web-ext sign --channel=listed` jen nahraje k revizi.
- **Mimo seznam (unlisted)**, tedy vlastní distribuce — `make sign` s
  [API klíčem AMO](https://addons.mozilla.org/developers/addon/api/key/) vrátí
  podepsaný `.xpi`, který si můžete hostovat sami. Pozor: vlastnoručně
  distribuovaný doplněk nelze nainstalovat do Firefoxu pro Android.

Zdrojové kódy přikládat netřeba: nic tu není minifikované ani zabalené.

## Řešení potíží

- **`_gaUserPrefs` je undefined** — nejspíš byl odebrán přístup k webům. V
  `about:addons` otevřete **Oprávnění** tohoto rozšíření a povolte přístup ke všem
  webům. Jakmile se oprávnění vrátí, rozšíření se samo znovu zaregistruje
- **Na Firefoxu 127 a starším se nic neděje** — skripty obsahu `world: "MAIN"`
  vyžadují Firefox 128. Aktualizujte
- **Vyloučení se neprojevilo** — vyloučení platí pro doménu, zahrnuje subdomény a
  projeví se od dalšího načtení stránky
- **Web se rozbil a vyloučení nepomohlo** — pak to nebylo tímto rozšířením.
  Blokují se jen požadavky `/collect`, nikdy skript ani zdroj stránky

## Podpora

Hakarasenai je zdarma a zůstane. Pokud vás drží mimo něčí přehledovou tabuli,
podpora přes [GitHub Sponsors](https://github.com/sponsors/omikuji) potěší a je
jediným financováním projektu.

Sponzoring platí údržbu, a v ní jsou skutečné náklady: Google přesouvá a přidává
sběrné koncové body a sada pravidel, která byla loni vyčerpávající, jí tiše být
přestává. Koupil by také android zařízení, proti kterému je doplněk zatím ověřen
jen na papíře.

Dotazy, problémy i nápady jsou vítány:

- [X (@omikuji_man)](https://x.com/omikuji_man)
- [Kontaktní formulář](https://omikuji.dev/contact/)
- [Nahlásit problém na GitHubu](https://github.com/omikuji/hakarasenai/issues)

## Licence

Licence MIT.
