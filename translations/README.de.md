# Hakarasenai

[English](../README.md) · [العربية](README.ar.md) · [Čeština](README.cs.md) · [Dansk](README.da.md) · **Deutsch** · [Español](README.es.md) · [Suomi](README.fi.md) · [Français](README.fr.md) · [עברית](README.he.md) · [हिन्दी](README.hi.md) · [Bahasa Indonesia](README.id.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Norsk](README.nb.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Svenska](README.sv.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [Tiếng Việt](README.vi.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md)

Eine Firefox-Erweiterung, die nur eines tut: Google Analytics daran hindern,
dich zu messen. Für Desktop und Android.

*Hakarasenai* heißt „lässt sich nicht messen" — das ist die gesamte Funktionsliste.

**Was sie tut:**

1. Sie teilt dem Google-Analytics-Code auf der Seite mit, dass du widersprochen hast
2. Sie blockiert die Messdaten, die trotzdem hinausgingen
3. Über die Symbolleisten-Schaltfläche lässt sich eine einzelne Website ausnehmen,
   falls eine zickt

Keine Einstellungsseite, keine Filterlisten, keine Zähler, keine Pro-Version.

## Warum es das gibt

Google liefert ein offizielles „Google Analytics Opt-out Add-on" aus, es gibt
auch einen Firefox-Build davon. Das Problem ist das **Wie**: Es fügt ein
`<script>`-Element in die Seite ein, und Firefox wendet — wie Safari — die CSP
der Seite auch auf Content-Skripte an. Auf jeder Website mit strenger CSP wird
das Einfügen blockiert und das Opt-out tut still gar nichts. Nichts sagt dir,
dass es fehlgeschlagen ist, und das ist die denkbar schlechteste Art, wie ein
Datenschutzwerkzeug versagen kann.

Hakarasenai benutzt denselben offiziellen Haken, legt ihn aber dorthin, wo keine
CSP hinreicht, und stellt eine Netzwerksperre als zweite Schicht dahinter. Sollte
die erste Schicht je versagen, verlassen die Daten den Rechner trotzdem nicht.

## Installation

### Aus AMO

Auf [addons.mozilla.org](https://addons.mozilla.org/) danach suchen. Unter
Android genauso aus AMO installieren — das Add-on deklariert `gecko_android`,
also bietet Firefox für Android es an.

### Vorübergehend aus dem Quellcode laden

Kein Build nötig. `about:debugging#/runtime/this-firefox` öffnen,
**Temporäres Add-on laden** wählen und die `manifest.json` dieses Repositorys
auswählen. Es bleibt, bis Firefox geschlossen wird.

Auf Desktop und Android wird Firefox 128 oder neuer benötigt, weil
`world: "MAIN"`-Content-Skripte erst in 128 dazugekommen sind.

Um das ZIP für AMO zu erzeugen:

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint` und `make run` benutzen `web-ext` (beim ersten Mal von `npx` geholt).
`make lint` meldet absichtlich zwei Warnungen: Die Datenerhebungs-Deklaration
(`data_collection_permissions: none`) wird erst ab Firefox 140 gelesen, und
`strict_min_version` steht auf 128 — also weist der Linter auf die Lücke hin.
Auf 128–139 wird der Schlüssel schlicht ignoriert, und dafür die Unterstützung
einzuschränken lohnt nicht.

### Auf Firefox für Android, aus dem Quellcode

```bash
adb devices                      # Geräte-ID herausfinden
make run-android DEVICE=<id>
```

Braucht adb, USB-Debugging auf dem Telefon und *Remote-Debugging über USB* in
den Firefox-Einstellungen.

## Bedienung

Es gibt genau ein Bedienelement: die Schaltfläche in der Symbolleiste. Sie zeigt
den Zustand der aktuellen Website und bietet eine einzige Aktion an.

| Zustand | Bedeutung |
| --- | --- |
| **Blockiert** | Beide Schichten sind für diese Website aktiv. Das ist überall die Voreinstellung |
| **Ausgenommen** | Beide Schichten sind für diese Website aus, und das Symbol trägt ein `OFF`-Abzeichen |

**Diese Website ausnehmen** trägt die Website sowohl in eine dynamische
`allow`-Regel als auch in die `excludeMatches` des Content-Skripts ein — die
Ausnahme ist also echt und nicht bloß kosmetisch. Ausnahmen gelten **pro
registrierbarer Domain und schließen Subdomains ein**: Wer `example.com`
ausnimmt, nimmt auch `www.example.com` und `shop.example.com` aus. Sie greifen ab
dem nächsten Seitenaufruf.

Das ist für die Fälle gedacht, in denen man absichtlich gemessen werden will —
etwa beim Prüfen von GA auf der eigenen Website. Das `OFF`-Abzeichen wird unter
Android nicht gezeichnet; das Pop-up sagt trotzdem, in welchem Zustand du bist.

## Wie es funktioniert

### Schicht 1 — das Opt-out ankündigen

`ga.js`, `analytics.js` und `gtag.js` prüfen alle vor dem Senden
`window._gaUserPrefs.ioo()` (*ioo* = is opted out) und hören auf, wenn es true
zurückgibt. Es ist dieselbe Markierung, die Googles eigenes Add-on setzt — ein
Notausgang, den Google Analytics selbst bereitstellt.

`src/optout.js` wird als `world: "MAIN"`-Content-Skript zu `document_start`
registriert, die Markierung liegt also schon auf dem globalen Objekt der Seite,
bevor irgendein Seitencode läuft. Es wird nichts ins DOM eingefügt, also gibt es
für eine CSP nichts zu blockieren. Eine Website kann die Markierung auch nicht
überschreiben: Der Setter ist eine Leeroperation statt einer nicht
beschreibbaren Eigenschaft, damit Seiten im Strict Mode beim Zuweisen ignoriert
werden, statt eine Ausnahme zu bekommen.

### Schicht 2 — die Treffer blockieren

Fünf statische declarativeNetRequest-Regeln, in `rules/ga.json`:

| Domain | Blockiert |
| --- | --- |
| `*.google-analytics.com` | jede URL mit `/collect` — `/collect`, `/j/collect`, `/g/collect`, `/r/collect` sowie regionale Hosts wie `region1.` |
| `*.google-analytics.com` | `/batch`, der gebündelte Transport von analytics.js |
| `*.analytics.google.com` | `/g/collect` und `/g/s/collect`, die regionalen GA4-Endpunkte |
| `stats.g.doubleclick.net` | `/collect`, genutzt wenn Google Signals an ist |

**Nicht blockiert:** `googletagmanager.com` (`gtag.js`, `gtm.js`) und die
Skripte, die `google-analytics.com` selbst ausliefert. Opt-out heißt, den Code
laden zu lassen und ihn nicht berichten zu lassen; den Loader zu killen würde
auch alles andere abräumen, was eine Website über den Tag Manager steuert.
Schicht 1 hält GA still, obwohl es geladen wurde.

Weil keine Seitenressource blockiert wird, geht dadurch praktisch nie eine
Website kaputt.

## Prüfen, ob es wirkt

1. Eine Website öffnen, die GA benutzt
2. `F12` → **Netzwerkanalyse**, nach `collect` filtern
3. Anfragen an `www.google-analytics.com/g/collect` und Verwandte sollten als
   blockiert (`NS_ERROR_ABORTED`) erscheinen — das ist Schicht 2
4. In der Konsole sollte `_gaUserPrefs.ioo()` `true` liefern — das ist Schicht 1.
   `_gaUserPrefs is not defined` heißt, das Content-Skript wurde nicht
   registriert; siehe Fehlersuche

## Tests

```bash
make setup-test   # einmalig: Firefox-Tarball, geckodriver und ein venv mit selenium
make test
```

`setup-test` installiert nach `~/opt/firefox`, `~/.local/bin` und `.test/` —
keine Systempakete, nichts braucht root.

**`make unit`** lässt die Ausnahmelogik gegen einen Stub der WebExtension-APIs
laufen. Nur Node, kein Browser.

**`make test-browser`** startet zweimal ein echtes Headless-Firefox — einmal mit
geladener Erweiterung, einmal ohne — und vergleicht beides. Der Kontrolllauf ist
der springende Punkt: Er belegt, dass das Netz tatsächlich erreichbar ist und
dass die Opt-out-Markierung wirklich von der Erweiterung stammt. Geprüft wird:

- Die Opt-out-Markierung wird gesetzt, **auch auf einer Seite mit strenger CSP** —
  genau der Fall, in dem Googles eigenes Add-on still versagt
- Eine Website, die `_gaUserPrefs` zuweist, kann sich nicht selbst wieder
  einbuchen und bekommt dabei auch keine Ausnahme
- GA4-, Universal-Analytics- und regionale `/collect`-Treffer werden blockiert,
  auch unter strenger CSP
- `gtag.js` lädt weiterhin, und ein `/collect` derselben Herkunft bleibt
  unangetastet — die Regeln blockieren also nicht über das Ziel hinaus

Der Android-Build wurde auf keinem echten Gerät ausprobiert. Jede benutzte API
wurde gegen MDNs browser-compat-data geprüft und spiegelt die Desktop-Unterstützung,
aber das ist eine Papierprüfung, kein Test.

## Was sie nicht kann

- **Serverseitiges GTM und First-Party-Messung.** Sammelt eine Website auf ihrer
  eigenen Domain, etwa `metrics.example.com`, und leitet vom Server an GA weiter,
  ist der Verkehr von gewöhnlichem Verkehr zu dieser Website nicht zu
  unterscheiden — Schicht 2 kann ihn nicht fassen. Schicht 1 gilt weiterhin, denn
  der Absender ist gtag.js auf der Seite.
- **Andere Analyseprodukte als GA** sind nicht im Umfang. Diese Erweiterung
  widerspricht Google Analytics, sonst nichts.
- **Rein serverseitige Treffer über das Measurement Protocol** berühren den
  Browser nie, also kann keine Browser-Erweiterung sie aufhalten.

## Datenschutz

Diese Erweiterung **erhebt nichts und sendet nichts irgendwohin**. Sie stellt
keine eigenen Netzwerkanfragen. Gespeichert wird einzig die Liste der Hostnamen,
die du ausgenommen hast (`storage.local`), und die verlässt das Gerät nie. Im
Manifest ist das als `data_collection_permissions: { required: ["none"] }`
deklariert.

## Sprachen

26 Sprachen, automatisch nach den Spracheinstellungen des Browsers gewählt —
es gibt nichts zu konfigurieren:

Arabisch, Chinesisch (vereinfacht und traditionell), Dänisch, Deutsch, Englisch,
Finnisch, Französisch, Hebräisch, Hindi, Indonesisch, Italienisch, Japanisch,
Koreanisch, Niederländisch, Norwegisch, Polnisch, Portugiesisch (Brasilien),
Russisch, Schwedisch, Spanisch, Thai, Tschechisch, Türkisch, Ukrainisch,
Vietnamesisch.

Die meisten davon stammen nicht von Muttersprachlern, Korrekturen sind also die
willkommenste Art von Pull Request. Eine Sprache hinzuzufügen heißt,
`_locales/en/messages.json` nach `_locales/<code>/messages.json` zu kopieren und
die `message`-Werte zu übersetzen, ohne die Schlüssel und die
`description`-Felder anzufassen. Es sind elf Zeichenketten. Was fehlt, fällt auf
Englisch zurück.

Diese README ist ebenfalls übersetzt — die anderen Sprachen liegen in
`translations/` und sind oben in dieser Datei aufgeführt. Englisch ist die
maßgebliche Fassung; nach dem Hinzufügen einer Sprache
`python3 Tools/sync-readme-nav.py` ausführen, um die Links aufzufrischen.

## Veröffentlichen (Notizen für Betreuer)

Firefox installiert keine unsignierte Erweiterung dauerhaft, die Verteilung
läuft also so oder so über Mozilla:

- **Gelistet** — `dist/*.zip` im
  [AMO Developer Hub](https://addons.mozilla.org/developers/) hochladen. Es wird
  geprüft, signiert und auf addons.mozilla.org veröffentlicht. Gelistete
  Einreichungen lassen sich nicht automatisieren; `web-ext sign --channel=listed`
  lädt nur zur Prüfung hoch.
- **Ungelistet**, also Eigenverteilung — `make sign` mit einem
  [AMO-API-Schlüssel](https://addons.mozilla.org/developers/addon/api/key/)
  liefert eine signierte `.xpi`, die du selbst hosten kannst. Beachte, dass ein
  eigenverteiltes Add-on nicht auf Firefox für Android installiert werden kann.

Quellen müssen nicht beigelegt werden: Hier ist nichts minifiziert oder gebündelt.

## Fehlersuche

- **`_gaUserPrefs` ist undefined** — vermutlich wurde der Website-Zugriff
  entzogen. In `about:addons` die **Berechtigungen** dieser Erweiterung öffnen
  und Zugriff auf alle Websites erlauben. Sobald die Berechtigung zurück ist,
  registriert sie sich von selbst neu
- **Auf Firefox 127 oder älter passiert nichts** — `world: "MAIN"`-Content-Skripte
  brauchen Firefox 128. Aktualisieren
- **Eine Ausnahme hat nicht gegriffen** — Ausnahmen gelten pro Domain, schließen
  Subdomains ein und greifen ab dem nächsten Seitenaufruf
- **Eine Website ging kaputt und die Ausnahme hat nichts geändert** — dann war es
  nicht diese Erweiterung. Blockiert werden nur `/collect`-Anfragen, nie ein
  Skript oder eine Seitenressource

## Unterstützung

Hakarasenai ist kostenlos und bleibt es. Wenn es dich aus dem Dashboard von
irgendwem heraushält, ist eine Förderung über
[GitHub Sponsors](https://github.com/sponsors/omikuji) willkommen und die einzige
Finanzierung des Projekts.

Was Förderung hier bezahlt, ist Pflege, und dort liegen die eigentlichen Kosten:
Google verschiebt und ergänzt Sammelendpunkte, und ein Regelsatz, der letztes
Jahr vollständig war, hört still auf, es zu sein. Sie würde außerdem die
Android-Hardware kaufen, gegen die das Add-on bislang nur auf dem Papier geprüft ist.

Fragen, Probleme und Ideen sind alle willkommen:

- [X (@omikuji_man)](https://x.com/omikuji_man)
- [Kontaktformular](https://omikuji.dev/contact/)
- [Ein Problem auf GitHub melden](https://github.com/omikuji/hakarasenai/issues)

## Lizenz

MIT-Lizenz.
