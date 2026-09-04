# Hakarasenai

[English](../README.md) · [العربية](README.ar.md) · [Čeština](README.cs.md) · [Dansk](README.da.md) · [Deutsch](README.de.md) · [Español](README.es.md) · **Suomi** · [Français](README.fr.md) · [עברית](README.he.md) · [हिन्दी](README.hi.md) · [Bahasa Indonesia](README.id.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Norsk](README.nb.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Svenska](README.sv.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [Tiếng Việt](README.vi.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md)

Firefox-laajennus, joka vain estää Google Analyticsia mittaamasta sinua.
Työpöytä ja Android.

*Hakarasenai* tarkoittaa "ei anna mitata" — siinä on koko ominaisuuslista.

**Mitä se tekee:**

1. Kertoo sivun Google Analytics -koodille, että olet kieltäytynyt seurannasta
2. Estää mittausdatan, joka lähtisi silti
3. Antaa ohittaa yksittäisen sivuston työkalupalkin painikkeesta, jos jokin
   temppuilee

Ei asetussivua, ei suodatintilauksia, ei laskureita, ei Pro-versiota.

## Miksi tämä on olemassa

Google julkaisee virallisen "Google Analytics Opt-out Add-on" -lisäosan, ja siitä
on Firefox-käännös. Ongelma on **miten** se toimii: se pistää sivulle
`<script>`-elementin, ja Firefox soveltaa — kuten Safari — sivun omaa CSP:tä myös
sisältöskripteihin. Millä tahansa tiukan CSP:n sivustolla pistäminen estyy, ja
kieltäytyminen ei tee hiljaa mitään. Mikään ei kerro sinulle, että se epäonnistui,
ja se on pahin mahdollinen tapa, jolla yksityisyystyökalu voi hajota.

Hakarasenai käyttää samaa virallista koukkua, mutta sijoittaa sen paikkaan, johon
mikään CSP ei ylety, ja panee sen taakse verkkoeston toiseksi kerrokseksi. Jos
ensimmäinen kerros joskus pettää, data ei silti lähde.

## Asennus

### AMO:sta

Etsi se osoitteesta [addons.mozilla.org](https://addons.mozilla.org/). Androidilla
asennus tapahtuu samoin AMO:sta — laajennus ilmoittaa `gecko_android`-avaimen,
joten Firefox for Android tarjoaa sitä.

### Väliaikainen lataus lähdekoodista

Käännöstä ei tarvita. Avaa `about:debugging#/runtime/this-firefox`, valitse
**Lataa väliaikainen lisäosa** ja osoita tämän arkiston `manifest.json`. Se pysyy,
kunnes suljet Firefoxin.

Firefox 128 tai uudempi vaaditaan sekä työpöydällä että Androidilla, koska
`world: "MAIN"` -sisältöskriptit tulivat vasta versiossa 128.

AMO:hon vietävän zipin rakentaminen:

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint` ja `make run` käyttävät `web-ext`iä (`npx` hakee sen ensimmäisellä
kerralla). `make lint` antaa tarkoituksella kaksi varoitusta: tiedonkeruuilmoitus
(`data_collection_permissions: none`) luetaan vasta Firefox 140:stä alkaen, ja
`strict_min_version` on 128, joten linteri huomauttaa erosta. Versioissa 128–139
avain vain ohitetaan, eikä tuen kaventaminen sen vaientamiseksi kannata.

### Firefox for Androidilla, lähdekoodista

```bash
adb devices                      # selvitä laitteen id
make run-android DEVICE=<id>
```

Vaatii adb:n, USB-vianetsinnän puhelimessa ja Firefoxin asetuksista päälle
kytketyn *Etävianetsintä USB:n kautta*.

## Käyttö

Hallintaelimiä on yksi: työkalupalkin painike. Se näyttää nykyisen sivuston tilan
ja tarjoaa yhden ainoan toiminnon.

| Tila | Mitä se tarkoittaa |
| --- | --- |
| **Estetään** | Molemmat kerrokset ovat päällä tällä sivustolla. Näin on oletuksena kaikkialla |
| **Ohitettu** | Molemmat kerrokset ovat pois päältä tällä sivustolla, ja kuvakkeessa on `OFF`-merkki |

**Ohita tämä sivusto** kirjaa sivuston sekä dynaamiseen `allow`-sääntöön *että*
sisältöskriptin `excludeMatches`-listaan, joten ohitus on aito eikä pelkkää
koristetta. Ohitukset koskevat **rekisteröitävää verkkotunnusta ja kattavat
aliverkkotunnukset**: kun ohitat `example.com`in, ohitat myös `www.example.com`in
ja `shop.example.com`in. Ne astuvat voimaan seuraavasta sivulatauksesta.

Tämä on niitä tilanteita varten, joissa haluat tulla mitatuksi tarkoituksella —
esimerkiksi kun tarkistat GA:ta omalla sivustollasi. `OFF`-merkkiä ei piirretä
Androidilla; ponnahdusikkuna kertoo silti, kummassa tilassa olet.

## Miten se toimii

### Kerros 1 — ilmoita kieltäytyminen

`ga.js`, `analytics.js` ja `gtag.js` tarkistavat kaikki ennen lähetystä
`window._gaUserPrefs.ioo()` (*ioo* = is opted out) ja lopettavat, jos se palauttaa
true. Se on sama lippu, jonka Googlen oma lisäosa asettaa — varauloskäynti, jonka
Google Analytics tarjoaa itse.

`src/optout.js` rekisteröidään `world: "MAIN"` -sisältöskriptinä kohtaan
`document_start`, joten lippu on sivun globaalissa objektissa jo ennen kuin
mikään sivuston koodi suoritetaan. DOM:iin ei lisätä mitään, joten CSP:llä ei ole
mitään estettävää. Sivusto ei myöskään voi ylikirjoittaa lippua: setteri on tyhjä
operaatio eikä kirjoitussuojattu ominaisuus, joten strict mode -sivut, jotka
sijoittavat siihen arvon, ohitetaan sen sijaan että ne saisivat poikkeuksen.

### Kerros 2 — estä lähetykset

Viisi staattista declarativeNetRequest-sääntöä tiedostossa `rules/ga.json`:

| Verkkotunnus | Estetään |
| --- | --- |
| `*.google-analytics.com` | mikä tahansa URL, jossa on `/collect` — `/collect`, `/j/collect`, `/g/collect`, `/r/collect` sekä alueelliset isännät kuten `region1.` |
| `*.google-analytics.com` | `/batch`, analytics.js:n niputettu lähetystapa |
| `*.analytics.google.com` | `/g/collect` ja `/g/s/collect`, GA4:n alueelliset päätepisteet |
| `stats.g.doubleclick.net` | `/collect`, käytössä kun Google Signals on päällä |

**Ei estetä:** `googletagmanager.com` (`gtag.js`, `gtm.js`) eikä skriptejä, joita
`google-analytics.com` itse tarjoaa. Kieltäytyminen tarkoittaa, että koodin
annetaan latautua muttei raportoida; latausohjelman tappaminen veisi mukanaan
kaiken muunkin, mitä sivusto ohjaa Tag Managerin kautta. Kerros 1 pitää GA:n
hiljaisena, vaikka se latautuikin.

Koska mitään sivun resurssia ei estetä, tämä ei käytännössä koskaan riko sivustoa.

## Tarkistus, että se toimii

1. Avaa sivusto, joka käyttää GA:ta
2. `F12` → **Verkko**, suodata sanalla `collect`
3. Pyyntöjen osoitteeseen `www.google-analytics.com/g/collect` ja vastaaviin
   pitäisi näkyä estettyinä (`NS_ERROR_ABORTED`) — se on kerros 2
4. Konsolissa `_gaUserPrefs.ioo()` pitäisi palauttaa `true` — se on kerros 1.
   `_gaUserPrefs is not defined` tarkoittaa, ettei sisältöskripti rekisteröitynyt;
   katso Vianetsintä

## Testit

```bash
make setup-test   # kerran: Firefox-paketti, geckodriver ja venv, jossa selenium
make test
```

`setup-test` asentaa hakemistoihin `~/opt/firefox`, `~/.local/bin` ja `.test/` —
ei järjestelmäpaketteja, mikään ei vaadi rootia.

**`make unit`** ajaa ohituslogiikan WebExtension-rajapintojen tynkää vasten.
Pelkkä Node, ei selainta.

**`make test-browser`** ajaa oikeaa headless-Firefoxia kahdesti — kerran laajennus
ladattuna ja kerran ilman — ja vertaa tuloksia. Vertailuajo on koko juju: se
todistaa, että verkko todella on tavoitettavissa ja että kieltäytymislippu tulee
oikeasti laajennukselta. Tarkistettavat asiat:

- kieltäytymislippu asetetaan, **myös tiukalla CSP:llä tarjotulla sivulla** —
  juuri se tapaus, jossa Googlen oma lisäosa epäonnistuu hiljaa
- sivusto, joka sijoittaa arvon `_gaUserPrefs`iin, ei voi liittää itseään takaisin
  seurantaan eikä aiheuta yrittäessään poikkeusta
- GA4:n, Universal Analyticsin ja alueellisten päätepisteiden `/collect`-lähetykset
  estetään, myös tiukan CSP:n alla
- `gtag.js` latautuu edelleen ja saman alkuperän `/collect` jää koskematta — eli
  säännöt eivät estä liikaa

Android-käännöstä ei ole kokeiltu fyysisellä laitteella. Jokainen käytetty
rajapinta on tarkistettu MDN:n browser-compat-datasta ja vastaa työpöydän tukea,
mutta se on paperitarkistus, ei testi.

## Mitä se ei osaa

- **Palvelinpuolen GTM ja first party -mittaus.** Jos sivusto kerää dataa omalla
  verkkotunnuksellaan, vaikkapa `metrics.example.com`, ja välittää sen GA:lle
  palvelimeltaan, liikennettä ei voi erottaa tavallisesta liikenteestä kyseiselle
  sivustolle, joten kerros 2 ei saa siitä kiinni. Kerros 1 pätee yhä, koska
  lähettäjä on sivun gtag.js.
- **Muut analytiikkatuotteet kuin GA** ovat rajauksen ulkopuolella. Tämä laajennus
  kieltäytyy Google Analyticsista eikä mistään muusta.
- **Puhtaasti palvelinpuolen Measurement Protocol -lähetykset** eivät koskaan
  kosketa selainta, joten mikään selainlaajennus ei voi pysäyttää niitä.

## Yksityisyys

Tämä laajennus **ei kerää mitään eikä lähetä mitään minnekään**. Se ei tee omia
verkkopyyntöjä. Ainoa tallennettava asia on lista ohittamistasi isäntänimistä
(`storage.local`), eikä sekään poistu laitteelta. Manifestissa tämä on ilmoitettu
muodossa `data_collection_permissions: { required: ["none"] }`.

## Kielet

26 kieltä, valitaan automaattisesti selaimen kieliasetusten perusteella — mitään
ei tarvitse säätää:

arabia, englanti, espanja, heprea, hindi, hollanti, indonesia, italia, japani,
kiina (yksinkertaistettu ja perinteinen), korea, norja, portugali (Brasilia),
puola, ranska, ruotsi, saksa, suomi, tanska, thai, tsekki, turkki, ukraina,
venäjä, vietnam.

Useimpia ei ole kirjoittanut äidinkielinen puhuja, joten korjaukset ovat
tervetullein pull request -laji. Kielen lisääminen tarkoittaa tiedoston
`_locales/en/messages.json` kopioimista nimelle `_locales/<koodi>/messages.json`
ja `message`-arvojen kääntämistä, avaimiin ja `description`-kenttiin koskematta.
Merkkijonoja on yksitoista. Puuttuvat palautuvat englantiin.

Myös tämä README on käännetty — muut kielet asuvat hakemistossa `translations/`
ja on lueteltu tämän tiedoston alussa. Englanti on kanoninen versio; aja
`python3 Tools/sync-readme-nav.py` kielen lisäämisen jälkeen, jotta linkit
päivittyvät.

## Julkaisu (muistiinpanoja ylläpitäjille)

Firefox ei asenna allekirjoittamatonta laajennusta pysyvästi, joten jakelu kulkee
joka tapauksessa Mozillan kautta:

- **Listattuna** — lataa `dist/*.zip` palveluun
  [AMO Developer Hub](https://addons.mozilla.org/developers/). Se tarkistetaan,
  allekirjoitetaan ja julkaistaan osoitteessa addons.mozilla.org. Listattuja
  lähetyksiä ei voi automatisoida; `web-ext sign --channel=listed` vain lataa
  tarkistettavaksi.
- **Listaamattomana**, eli omana jakeluna — `make sign` ja
  [AMO:n API-avain](https://addons.mozilla.org/developers/addon/api/key/) palauttaa
  allekirjoitetun `.xpi`-tiedoston, jonka voit jakaa itse. Huomaa, että itse
  jaeltua lisäosaa ei voi asentaa Firefox for Androidiin.

Lähdekoodia ei tarvitse liittää: täällä ei ole mitään minifioitua tai niputettua.

## Vianetsintä

- **`_gaUserPrefs` on undefined** — pääsy sivustoihin on todennäköisesti peruttu.
  Avaa `about:addons`-sivulta tämän laajennuksen **Oikeudet** ja salli pääsy
  kaikkiin sivustoihin. Laajennus rekisteröi itsensä uudelleen heti kun oikeus
  palaa
- **Firefox 127:llä tai vanhemmalla ei tapahdu mitään** — `world: "MAIN"`
  -sisältöskriptit vaativat Firefox 128:n. Päivitä
- **Ohitus ei tullut voimaan** — ohitukset koskevat verkkotunnusta, kattavat
  aliverkkotunnukset ja astuvat voimaan seuraavasta sivulatauksesta
- **Sivusto hajosi eikä ohittaminen korjannut mitään** — silloin syy ei ollut tämä
  laajennus. Vain `/collect`-pyynnöt estetään, ei koskaan skriptiä tai sivun
  resurssia

## Tuki

Hakarasenai on ilmainen ja pysyy sellaisena. Jos se pitää sinut poissa jonkun
koontinäytöltä, tuki
[GitHub Sponsorsin](https://github.com/sponsors/omikuji) kautta on arvossaan ja on
projektin ainoa rahoitus.

Tuki maksaa ylläpidon, ja siinä on todellinen kustannus: Google siirtää ja lisää
keräyspäätepisteitä, ja viime vuonna kattava sääntöjoukko lakkaa hiljaa olemasta
kattava. Se ostaisi myös Android-laitteen, jota vasten laajennus on toistaiseksi
tarkistettu vain paperilla.

Kysymykset, ongelmat ja ideat ovat kaikki tervetulleita:

- [X (@omikuji_man)](https://x.com/omikuji_man)
- [Yhteydenottolomake](https://omikuji.dev/contact/)
- [Ilmoita ongelmasta GitHubissa](https://github.com/omikuji/hakarasenai/issues)

## Lisenssi

MIT-lisenssi.
