# Hakarasenai

[English](../README.md) · [العربية](README.ar.md) · [Čeština](README.cs.md) · [Dansk](README.da.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Suomi](README.fi.md) · [Français](README.fr.md) · [עברית](README.he.md) · [हिन्दी](README.hi.md) · [Bahasa Indonesia](README.id.md) · **Italiano** · [日本語](README.ja.md) · [한국어](README.ko.md) · [Norsk](README.nb.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Svenska](README.sv.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [Tiếng Việt](README.vi.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md)

Un'estensione per Firefox che si limita a impedire a Google Analytics di
misurarti. Desktop e Android.

*Hakarasenai* significa «non lasciarglielo misurare» — è tutto l'elenco delle
funzioni.

**Cosa fa:**

1. Comunica al codice di Google Analytics nella pagina che hai rinunciato al
   tracciamento
2. Blocca i dati di misurazione che uscirebbero comunque
3. Permette di escludere un singolo sito dal pulsante nella barra degli
   strumenti, se qualcuno fa i capricci

Nessuna pagina di opzioni, nessun abbonamento a filtri, nessun contatore, nessuna
versione Pro.

## Perché esiste

Google distribuisce un componente ufficiale, il «Google Analytics Opt-out
Add-on», e ne esiste una build per Firefox. Il problema è **come** funziona:
inietta un elemento `<script>` nella pagina, e Firefox — come Safari — applica la
CSP della pagina anche agli script di contenuto. Su qualunque sito con una CSP
severa l'iniezione viene bloccata e la rinuncia non fa nulla, in silenzio. Niente
ti avvisa che è fallita, ed è il modo peggiore in cui uno strumento per la
privacy possa rompersi.

Hakarasenai usa lo stesso gancio ufficiale, ma lo mette dove nessuna CSP arriva,
e gli piazza dietro un blocco di rete come seconda linea. Se la prima dovesse
mai fallire, i dati continuano a non uscire.

## Installazione

### Da AMO

Cercala su [addons.mozilla.org](https://addons.mozilla.org/). Su Android si
installa allo stesso modo da AMO: il componente dichiara `gecko_android`, quindi
Firefox per Android lo propone.

### Caricarla temporaneamente dai sorgenti

Nessuna compilazione necessaria. Apri `about:debugging#/runtime/this-firefox`,
scegli **Carica componente aggiuntivo temporaneo** e seleziona il `manifest.json`
di questo repository. Resta finché non chiudi Firefox.

Serve Firefox 128 o successivo, sia su desktop sia su Android, perché gli script
di contenuto `world: "MAIN"` sono arrivati con la 128.

Per produrre lo zip da caricare su AMO:

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint` e `make run` usano `web-ext` (scaricato da `npx` la prima volta).
`make lint` segnala due avvisi di proposito: la dichiarazione di raccolta dati
(`data_collection_permissions: none`) viene letta solo da Firefox 140 in poi,
mentre `strict_min_version` è 128, quindi il linter fa notare lo scarto. Su
128–139 la chiave viene semplicemente ignorata, e non vale la pena restringere la
compatibilità per zittirlo.

### Su Firefox per Android, dai sorgenti

```bash
adb devices                      # trova l'id del dispositivo
make run-android DEVICE=<id>
```

Servono adb, il debug USB sul telefono e *Debug remoto via USB* attivo nelle
impostazioni di Firefox.

## Come si usa

C'è un solo comando: il pulsante nella barra degli strumenti. Mostra lo stato del
sito corrente e offre una sola azione.

| Stato | Cosa significa |
| --- | --- |
| **Blocco attivo** | Entrambe le linee sono attive su questo sito. È il comportamento predefinito ovunque |
| **Escluso** | Entrambe le linee sono spente su questo sito, e l'icona porta un badge `OFF` |

**Escludi questo sito** inserisce il sito sia in una regola `allow` dinamica *sia*
negli `excludeMatches` dello script di contenuto: l'esclusione è quindi reale e
non di facciata. Le esclusioni valgono **per dominio registrabile e includono i
sottodomini**: escludere `example.com` esclude anche `www.example.com` e
`shop.example.com`. Diventano effettive dal caricamento di pagina successivo.

Serve per quando vuoi essere misurato apposta — per verificare GA sul tuo sito,
per esempio. Il badge `OFF` non viene disegnato su Android; il pannello dice
comunque in quale stato sei.

## Come funziona

### Linea 1 — annunciare la rinuncia

`ga.js`, `analytics.js` e `gtag.js` controllano tutti
`window._gaUserPrefs.ioo()` (*ioo* = is opted out) prima di inviare, e si
fermano se restituisce true. È la stessa bandierina che imposta il componente di
Google — una via d'uscita che Google Analytics fornisce da sé.

`src/optout.js` è registrato come script di contenuto `world: "MAIN"` a
`document_start`, quindi la bandierina è già sull'oggetto globale della pagina
prima che venga eseguito qualsiasi codice del sito. Non viene inserito nulla nel
DOM, quindi non c'è nulla che una CSP possa bloccare. Nemmeno il sito può
sovrascriverla: il setter è un'operazione vuota anziché una proprietà non
scrivibile, così le pagine in strict mode che le assegnano un valore vengono
ignorate invece di ricevere un'eccezione.

### Linea 2 — bloccare gli invii

Cinque regole statiche declarativeNetRequest, in `rules/ga.json`:

| Dominio | Bloccato |
| --- | --- |
| `*.google-analytics.com` | qualsiasi URL che contenga `/collect` — `/collect`, `/j/collect`, `/g/collect`, `/r/collect` e host regionali come `region1.` |
| `*.google-analytics.com` | `/batch`, il trasporto in blocco di analytics.js |
| `*.analytics.google.com` | `/g/collect` e `/g/s/collect`, gli endpoint regionali di GA4 |
| `stats.g.doubleclick.net` | `/collect`, usato quando Google Signals è attivo |

**Non bloccati:** `googletagmanager.com` (`gtag.js`, `gtm.js`) e gli script
serviti da `google-analytics.com` stesso. Rinunciare significa lasciare che il
codice si carichi senza lasciarlo riferire; uccidere il loader porterebbe via
anche tutto il resto che un sito pilota tramite Tag Manager. La linea 1 tiene GA
in silenzio pur essendosi caricato.

Dato che nessuna risorsa di pagina viene bloccata, questo non rompe praticamente
mai un sito.

## Verificare che funzioni

1. Apri un sito che usa GA
2. `F12` → **Rete**, filtra su `collect`
3. Le richieste verso `www.google-analytics.com/g/collect` e simili devono
   comparire come bloccate (`NS_ERROR_ABORTED`) — quella è la linea 2
4. In console, `_gaUserPrefs.ioo()` deve restituire `true` — quella è la linea 1.
   `_gaUserPrefs is not defined` significa che lo script di contenuto non si è
   registrato; vedi Risoluzione dei problemi

## Test

```bash
make setup-test   # una volta sola: archivio di Firefox, geckodriver e un venv con selenium
make test
```

`setup-test` installa in `~/opt/firefox`, `~/.local/bin` e `.test/` — nessun
pacchetto di sistema, niente richiede root.

**`make unit`** esegue la logica di esclusione contro uno stub delle API
WebExtension. Solo Node, nessun browser.

**`make test-browser`** guida due volte un vero Firefox headless — una con
l'estensione caricata e una senza — e confronta i due esiti. L'esecuzione di
controllo è il punto: dimostra che la rete è davvero raggiungibile e che la
bandierina di rinuncia arriva veramente dall'estensione. Verifica che:

- la bandierina venga impostata, **anche su una pagina servita con una CSP
  severa** — esattamente il caso in cui il componente di Google fallisce in
  silenzio
- un sito che assegna a `_gaUserPrefs` non possa reiscriversi al tracciamento, e
  non sollevi un'eccezione nel tentarlo
- gli invii `/collect` di GA4, Universal Analytics e degli endpoint regionali
  vengano bloccati, anche sotto CSP severa
- `gtag.js` continui a caricarsi e un `/collect` della stessa origine resti
  intatto: le regole cioè non bloccano più del dovuto

La build per Android non è stata provata su un dispositivo fisico. Ogni API usata
è stata verificata sui browser-compat-data di MDN e rispecchia il supporto
desktop, ma è un controllo sulla carta, non un test.

## Cosa non può fare

- **GTM lato server e misurazione first-party.** Se un sito raccoglie sul proprio
  dominio, poniamo `metrics.example.com`, e inoltra a GA dal proprio server, il
  traffico è indistinguibile dal normale traffico verso quel sito, quindi la
  linea 2 non può intercettarlo. La linea 1 vale ancora, perché a inviare è
  gtag.js nella pagina.
- **I prodotti di analytics diversi da GA** sono fuori portata. Questa estensione
  rinuncia a Google Analytics, e a nient'altro.
- **Gli invii puramente server-side via Measurement Protocol** non toccano mai il
  browser, quindi nessuna estensione può fermarli.

## Privacy

Questa estensione **non raccoglie nulla e non invia nulla da nessuna parte**. Non
effettua richieste di rete per conto proprio. L'unica cosa memorizzata è l'elenco
dei nomi host che hai escluso (`storage.local`), e quello non lascia mai il
dispositivo. Il manifest lo dichiara come
`data_collection_permissions: { required: ["none"] }`.

## Lingue

26 lingue, scelte automaticamente dalle impostazioni di lingua del browser — non
c'è nulla da configurare:

arabo, ceco, cinese (semplificato e tradizionale), coreano, danese, ebraico,
finlandese, francese, giapponese, hindi, indonesiano, inglese, italiano,
norvegese, olandese, polacco, portoghese (Brasile), russo, spagnolo, svedese,
tailandese, tedesco, turco, ucraino, vietnamita.

La maggior parte non è stata scritta da madrelingua, perciò le correzioni sono il
tipo di pull request più gradito. Aggiungere una lingua significa copiare
`_locales/en/messages.json` in `_locales/<codice>/messages.json` e tradurre i
valori `message`, lasciando stare le chiavi e i campi `description`. Sono undici
stringhe. Ciò che manca ricade sull'inglese.

Anche questo README è tradotto — le altre lingue stanno in `translations/`,
elencate in cima a questo file. L'inglese è la versione canonica; dopo averne
aggiunta una esegui `python3 Tools/sync-readme-nav.py` per aggiornare quei link.

## Pubblicazione (note per chi mantiene il progetto)

Firefox non installa in modo permanente un'estensione non firmata, quindi la
distribuzione passa comunque da Mozilla:

- **Elencata** — carica `dist/*.zip` sull'
  [AMO Developer Hub](https://addons.mozilla.org/developers/). Viene revisionata,
  firmata e pubblicata su addons.mozilla.org. Gli invii elencati non si possono
  automatizzare; `web-ext sign --channel=listed` carica soltanto per la revisione.
- **Non elencata**, cioè autodistribuita — `make sign` con una
  [chiave API di AMO](https://addons.mozilla.org/developers/addon/api/key/)
  restituisce un `.xpi` firmato che puoi ospitare tu. Nota che un componente
  autodistribuito non si può installare su Firefox per Android.

Non serve allegare i sorgenti: qui non c'è nulla di minificato o impacchettato.

## Risoluzione dei problemi

- **`_gaUserPrefs` è undefined** — probabilmente è stato revocato l'accesso ai
  siti. In `about:addons` apri i **Permessi** di questa estensione e consenti
  l'accesso a tutti i siti. Si riregistra da sola appena il permesso torna
- **Su Firefox 127 o precedenti non succede nulla** — gli script di contenuto
  `world: "MAIN"` richiedono Firefox 128. Aggiorna
- **Un'esclusione non ha avuto effetto** — le esclusioni valgono per dominio,
  includono i sottodomini e si applicano dal caricamento successivo
- **Un sito si è rotto ed escluderlo non ha risolto** — allora non era questa
  estensione. Vengono bloccate solo le richieste `/collect`, mai uno script o una
  risorsa di pagina

## Sostegno

Hakarasenai è gratuita e lo resterà. Se ti tiene fuori dalla dashboard di
qualcuno, sostenere il lavoro tramite
[GitHub Sponsors](https://github.com/sponsors/omikuji) è apprezzato ed è l'unica
fonte di finanziamento del progetto.

Le sponsorizzazioni pagano la manutenzione, ed è lì il costo vero: Google sposta
e aggiunge endpoint di raccolta, e un insieme di regole che l'anno scorso era
esaustivo smette silenziosamente di esserlo. Comprerebbero anche l'hardware
Android su cui l'estensione, per ora, è verificata solo sulla carta.

Domande, problemi e idee sono tutti benvenuti:

- [X (@omikuji_man)](https://x.com/omikuji_man)
- [Modulo di contatto](https://omikuji.dev/contact/)
- [Segnala un problema su GitHub](https://github.com/omikuji/hakarasenai/issues)

## Licenza

Licenza MIT.
