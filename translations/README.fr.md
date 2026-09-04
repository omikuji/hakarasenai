# Hakarasenai

[English](../README.md) · [العربية](README.ar.md) · [Čeština](README.cs.md) · [Dansk](README.da.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Suomi](README.fi.md) · **Français** · [עברית](README.he.md) · [हिन्दी](README.hi.md) · [Bahasa Indonesia](README.id.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Norsk](README.nb.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Svenska](README.sv.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [Tiếng Việt](README.vi.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md)

Une extension Firefox qui se contente d'empêcher Google Analytics de vous
mesurer. Ordinateur et Android.

*Hakarasenai* signifie « ne le laisse pas mesurer » — c'est toute la liste des
fonctionnalités.

**Ce qu'elle fait :**

1. Elle indique au code Google Analytics de la page que vous avez refusé le suivi
2. Elle bloque les données de mesure qui partiraient malgré tout
3. Elle permet d'exclure un site donné depuis le bouton de la barre d'outils, si
   l'un d'eux se comporte mal

Pas de page d'options, pas d'abonnement à des filtres, pas de compteurs, pas de
version Pro.

## Pourquoi elle existe

Google publie un module officiel, le « Google Analytics Opt-out Add-on », et il
en existe une version Firefox. Le problème est **la manière** : il injecte un
élément `<script>` dans la page, et Firefox — comme Safari — applique la CSP de
la page aux scripts de contenu. Sur tout site à CSP stricte, l'injection est
bloquée et le refus ne fait silencieusement rien. Rien ne vous signale l'échec,
ce qui est la pire façon de tomber en panne pour un outil de confidentialité.

Hakarasenai utilise le même point d'accroche officiel, mais le place là où
aucune CSP ne l'atteint, et met un blocage réseau derrière, en seconde couche.
Si la première couche venait à échouer, les données ne sortent toujours pas.

## Installation

### Depuis AMO

Cherchez-la sur [addons.mozilla.org](https://addons.mozilla.org/). Sur Android,
l'installation se fait de la même façon depuis AMO — l'extension déclare
`gecko_android`, donc Firefox pour Android la propose.

### Chargement temporaire depuis les sources

Aucune compilation nécessaire. Ouvrez `about:debugging#/runtime/this-firefox`,
choisissez **Charger un module temporaire** et sélectionnez le `manifest.json`
de ce dépôt. Il reste jusqu'à la fermeture de Firefox.

Firefox 128 ou plus récent est requis, sur ordinateur comme sur Android, car les
scripts de contenu `world: "MAIN"` sont arrivés en 128.

Pour produire le zip destiné à AMO :

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint` et `make run` utilisent `web-ext` (récupéré par `npx` au premier
usage). `make lint` signale deux avertissements à dessein : la déclaration de
collecte de données (`data_collection_permissions: none`) n'est lue qu'à partir
de Firefox 140, et `strict_min_version` vaut 128 — le linter pointe donc l'écart.
Sur 128–139 la clé est simplement ignorée, ce qui ne justifie pas de réduire la
compatibilité.

### Sur Firefox pour Android, depuis les sources

```bash
adb devices                      # trouver l'identifiant de l'appareil
make run-android DEVICE=<id>
```

Nécessite adb, le débogage USB sur le téléphone et *Débogage distant via USB*
activé dans les paramètres de Firefox.

## Utilisation

Il n'y a qu'une commande : le bouton de la barre d'outils. Il affiche l'état du
site courant et propose une seule action.

| État | Signification |
| --- | --- |
| **Blocage** | Les deux couches sont actives sur ce site. C'est le comportement par défaut partout |
| **Exclu** | Les deux couches sont désactivées sur ce site, et l'icône porte un badge `OFF` |

**Exclure ce site** inscrit le site à la fois dans une règle `allow` dynamique
*et* dans les `excludeMatches` du script de contenu : l'exclusion est donc réelle
et non cosmétique. Les exclusions valent **par domaine enregistrable et couvrent
les sous-domaines** : exclure `example.com` exclut aussi `www.example.com` et
`shop.example.com`. Elles s'appliquent au chargement de page suivant.

C'est prévu pour les cas où l'on veut être mesuré volontairement — vérifier GA
sur son propre site, par exemple. Le badge `OFF` n'est pas dessiné sous Android ;
la fenêtre indique tout de même dans quel état vous êtes.

## Fonctionnement

### Couche 1 — annoncer le refus

`ga.js`, `analytics.js` et `gtag.js` vérifient tous
`window._gaUserPrefs.ioo()` (*ioo* = is opted out) avant d'envoyer, et
s'arrêtent si la fonction renvoie true. C'est le drapeau que pose le module de
Google lui-même — une porte de sortie que Google Analytics fournit de son propre chef.

`src/optout.js` est enregistré comme script de contenu `world: "MAIN"` à
`document_start`, si bien que le drapeau est déjà sur l'objet global de la page
avant que le moindre code du site ne s'exécute. Rien n'est inséré dans le DOM,
donc une CSP n'a rien à bloquer. Un site ne peut pas non plus écraser le
drapeau : le setter est une opération vide plutôt qu'une propriété non
inscriptible, de sorte que les pages en mode strict qui lui affectent une valeur
sont ignorées au lieu de recevoir une exception.

### Couche 2 — bloquer les envois

Cinq règles statiques declarativeNetRequest, dans `rules/ga.json` :

| Domaine | Bloqué |
| --- | --- |
| `*.google-analytics.com` | toute URL contenant `/collect` — `/collect`, `/j/collect`, `/g/collect`, `/r/collect`, et les hôtes régionaux comme `region1.` |
| `*.google-analytics.com` | `/batch`, le transport groupé d'analytics.js |
| `*.analytics.google.com` | `/g/collect` et `/g/s/collect`, les points de collecte régionaux de GA4 |
| `stats.g.doubleclick.net` | `/collect`, utilisé quand Google Signals est actif |

**Non bloqués :** `googletagmanager.com` (`gtag.js`, `gtm.js`) et les scripts
servis par `google-analytics.com` lui-même. Refuser le suivi, c'est laisser le
code se charger sans le laisser rapporter ; tuer le chargeur emporterait aussi
tout ce qu'un site pilote par le Tag Manager. La couche 1 garde GA silencieux
bien qu'il soit chargé.

Comme aucune ressource de page n'est bloquée, cela ne casse pratiquement jamais
un site.

## Vérifier que ça marche

1. Ouvrez un site qui utilise GA
2. `F12` → **Réseau**, filtrez sur `collect`
3. Les requêtes vers `www.google-analytics.com/g/collect` et consorts doivent
   apparaître comme bloquées (`NS_ERROR_ABORTED`) — c'est la couche 2
4. Dans la console, `_gaUserPrefs.ioo()` doit renvoyer `true` — c'est la couche 1.
   `_gaUserPrefs is not defined` signifie que le script de contenu ne s'est pas
   enregistré ; voir Dépannage

## Tests

```bash
make setup-test   # une fois : archive Firefox, geckodriver et un venv avec selenium
make test
```

`setup-test` installe dans `~/opt/firefox`, `~/.local/bin` et `.test/` — aucun
paquet système, rien n'exige root.

**`make unit`** exécute la logique d'exclusion contre un bouchon des API
WebExtension. Node seul, pas de navigateur.

**`make test-browser`** pilote deux fois un vrai Firefox sans interface — une fois
l'extension chargée, une fois sans — et compare les deux. L'exécution témoin est
l'essentiel : elle prouve que le réseau est bien joignable et que le drapeau de
refus vient réellement de l'extension. Elle vérifie que :

- le drapeau de refus est posé, **y compris sur une page servie avec une CSP
  stricte** — précisément le cas où le module de Google échoue en silence
- un site qui affecte `_gaUserPrefs` ne peut pas se réinscrire au suivi, et ne
  déclenche pas d'exception en essayant
- les envois `/collect` de GA4, d'Universal Analytics et des points régionaux
  sont bloqués, sous CSP stricte également
- `gtag.js` se charge toujours, et un `/collect` de même origine reste intact —
  autrement dit les règles ne bloquent pas trop large

La version Android n'a pas été éprouvée sur un appareil physique. Chaque API
utilisée a été vérifiée dans les browser-compat-data de MDN et reflète la prise
en charge du bureau, mais c'est une vérification sur le papier, pas un test.

## Ce qu'elle ne peut pas faire

- **GTM côté serveur et mesure first-party.** Si un site collecte sur son propre
  domaine, disons `metrics.example.com`, puis transmet à GA depuis son serveur,
  le trafic ne se distingue pas du trafic ordinaire vers ce site : la couche 2 ne
  peut pas l'attraper. La couche 1 s'applique toujours, puisque l'émetteur est
  gtag.js dans la page.
- **Les produits d'analyse autres que GA** sont hors périmètre. Cette extension
  refuse Google Analytics, rien d'autre.
- **Les envois purement serveur via le Measurement Protocol** ne passent jamais
  par le navigateur, donc aucune extension ne peut les arrêter.

## Confidentialité

Cette extension **ne collecte rien et n'envoie rien nulle part**. Elle ne fait
aucune requête réseau de son côté. La seule chose stockée est la liste des noms
d'hôtes que vous avez exclus (`storage.local`), et elle ne quitte jamais
l'appareil. Le manifeste le déclare ainsi :
`data_collection_permissions: { required: ["none"] }`.

## Langues

26 langues, choisies automatiquement d'après les réglages linguistiques du
navigateur — il n'y a rien à configurer :

allemand, anglais, arabe, chinois (simplifié et traditionnel), coréen, danois,
espagnol, finnois, français, hébreu, hindi, indonésien, italien, japonais,
néerlandais, norvégien, polonais, portugais (Brésil), russe, suédois, tchèque,
thaï, turc, ukrainien, vietnamien.

La plupart n'ont pas été écrites par des locuteurs natifs : les corrections sont
donc le type de pull request le plus bienvenu. Ajouter une langue consiste à
copier `_locales/en/messages.json` vers `_locales/<code>/messages.json` et à
traduire les valeurs `message`, en laissant les clés et les champs `description`
tels quels. Il y a onze chaînes. Ce qui manque retombe sur l'anglais.

Ce README est traduit lui aussi — les autres langues vivent dans
`translations/`, listées en haut de ce fichier. L'anglais est la version de
référence ; lancez `python3 Tools/sync-readme-nav.py` après en avoir ajouté une
pour rafraîchir ces liens.

## Publication (notes pour les mainteneurs)

Firefox n'installe pas durablement une extension non signée, la distribution
passe donc par Mozilla dans tous les cas :

- **Listée** — téléversez `dist/*.zip` sur le
  [AMO Developer Hub](https://addons.mozilla.org/developers/). Elle est
  examinée, signée, puis publiée sur addons.mozilla.org. Les soumissions listées
  ne peuvent pas être automatisées ; `web-ext sign --channel=listed` ne fait que
  téléverser pour examen.
- **Non listée**, c'est-à-dire auto-distribuée — `make sign` avec une
  [clé d'API AMO](https://addons.mozilla.org/developers/addon/api/key/) renvoie
  un `.xpi` signé que vous pouvez héberger vous-même. À noter qu'une extension
  auto-distribuée ne peut pas être installée sur Firefox pour Android.

Il n'est pas nécessaire de joindre les sources : rien ici n'est minifié ni empaqueté.

## Dépannage

- **`_gaUserPrefs` est undefined** — l'accès aux sites a probablement été
  révoqué. Dans `about:addons`, ouvrez les **Permissions** de cette extension et
  autorisez l'accès à tous les sites. Elle se réenregistre dès que la permission
  revient
- **Rien ne se passe sur Firefox 127 ou antérieur** — les scripts de contenu
  `world: "MAIN"` exigent Firefox 128. Mettez à jour
- **Une exclusion n'a pas pris effet** — les exclusions valent par domaine,
  incluent les sous-domaines et s'appliquent au chargement suivant
- **Un site s'est cassé et l'exclure n'a rien changé** — alors ce n'était pas
  cette extension. Seules les requêtes `/collect` sont bloquées, jamais un script
  ni une ressource de page

## Soutien

Hakarasenai est gratuite et le restera. Si elle vous garde hors du tableau de
bord de quelqu'un, un parrainage via
[GitHub Sponsors](https://github.com/sponsors/omikuji) est apprécié et constitue
le seul financement du projet.

Le parrainage paie l'entretien, et c'est là qu'est le vrai coût : Google déplace
et ajoute des points de collecte, et un jeu de règles exhaustif l'an dernier
cesse discrètement de l'être. Il achèterait aussi le matériel Android sur lequel
l'extension n'est pour l'instant vérifiée que sur le papier.

Questions, problèmes et idées sont tous les bienvenus :

- [X (@omikuji_man)](https://x.com/omikuji_man)
- [Formulaire de contact](https://omikuji.dev/contact/)
- [Signaler un problème sur GitHub](https://github.com/omikuji/hakarasenai/issues)

## Licence

Licence MIT.
