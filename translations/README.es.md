# Hakarasenai

[English](../README.md) · [العربية](README.ar.md) · [Čeština](README.cs.md) · [Dansk](README.da.md) · [Deutsch](README.de.md) · **Español** · [Suomi](README.fi.md) · [Français](README.fr.md) · [עברית](README.he.md) · [हिन्दी](README.hi.md) · [Bahasa Indonesia](README.id.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Norsk](README.nb.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Svenska](README.sv.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [Tiếng Việt](README.vi.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md)

Una extensión de Firefox que solo impide que Google Analytics te mida.
Escritorio y Android.

*Hakarasenai* significa «no dejar que mida» — esa es toda la lista de funciones.

**Qué hace:**

1. Le dice al código de Google Analytics de la página que has optado por no participar
2. Bloquea los datos de medición que saldrían de todos modos
3. Permite excluir un sitio concreto desde el botón de la barra de herramientas,
   si alguno se porta mal

Sin página de opciones, sin suscripciones a filtros, sin contadores, sin versión Pro.

## Por qué existe

Google publica un complemento oficial, «Google Analytics Opt-out Add-on», y hay
una versión para Firefox. El problema es **cómo** funciona: inyecta un elemento
`<script>` en la página, y Firefox —igual que Safari— aplica la CSP de la propia
página a los scripts de contenido. En cualquier sitio con una CSP estricta la
inyección queda bloqueada y la exclusión no hace nada, en silencio. Nada te avisa
de que ha fallado, que es la peor forma posible de fallar para una herramienta de
privacidad.

Hakarasenai usa el mismo gancho oficial, pero lo coloca donde ninguna CSP llega,
y pone detrás el bloqueo de red como segunda capa. Si la primera capa fallara
alguna vez, los datos siguen sin salir.

## Instalación

### Desde AMO

Búscala en [addons.mozilla.org](https://addons.mozilla.org/). En Android se
instala igual desde AMO: el complemento declara `gecko_android`, así que Firefox
para Android lo ofrece.

### Cargarla temporalmente desde el código

No hace falta compilar. Abre `about:debugging#/runtime/this-firefox`, elige
**Cargar complemento temporal** y selecciona el `manifest.json` de este
repositorio. Se mantiene hasta que cierres Firefox.

Se necesita Firefox 128 o posterior, tanto en escritorio como en Android, porque
los scripts de contenido con `world: "MAIN"` llegaron en la 128.

Para generar el zip de AMO:

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint` y `make run` usan `web-ext` (lo descarga `npx` la primera vez).
`make lint` da dos avisos a propósito: la declaración de recogida de datos
(`data_collection_permissions: none`) solo la lee Firefox 140 en adelante, y
`strict_min_version` es 128, así que el linter señala el desajuste. En 128–139 la
clave se ignora sin más, y no compensa recortar la compatibilidad para silenciarlo.

### En Firefox para Android, desde el código

```bash
adb devices                      # averigua el id del dispositivo
make run-android DEVICE=<id>
```

Requiere adb, depuración USB en el teléfono y *Depuración remota por USB*
activada en los ajustes de Firefox.

## Uso

Hay un único control: el botón de la barra de herramientas. Muestra el estado del
sitio actual y ofrece una sola acción.

| Estado | Qué significa |
| --- | --- |
| **Bloqueando** | Las dos capas están activas en este sitio. Es lo predeterminado en todas partes |
| **Excluido** | Las dos capas están desactivadas en este sitio, y el icono lleva una insignia `OFF` |

**Excluir este sitio** mete el sitio en una regla `allow` dinámica *y* en los
`excludeMatches` del script de contenido, de modo que la exclusión es real y no
cosmética. Las exclusiones son **por dominio registrable e incluyen subdominios**:
excluir `example.com` excluye también `www.example.com` y `shop.example.com`.
Se aplican a partir de la siguiente carga de página.

Sirve para cuando quieres que te midan a propósito, por ejemplo al verificar GA
en tu propio sitio. La insignia `OFF` no se dibuja en Android; la ventana
emergente sigue indicando en qué estado estás.

## Cómo funciona

### Capa 1 — anunciar la exclusión

`ga.js`, `analytics.js` y `gtag.js` comprueban todos
`window._gaUserPrefs.ioo()` (*ioo* = is opted out) antes de enviar, y se detienen
si devuelve true. Es la misma marca que pone el complemento de Google: una
salida de emergencia que ofrece el propio Google Analytics.

`src/optout.js` se registra como script de contenido `world: "MAIN"` en
`document_start`, así que la marca ya está en el objeto global de la página antes
de que se ejecute cualquier código del sitio. No se inserta nada en el DOM, de
modo que no hay nada que una CSP pueda bloquear. Un sitio tampoco puede
sobrescribir la marca: el setter es una operación vacía en lugar de una propiedad
no escribible, así que las páginas en modo estricto que le asignan un valor son
ignoradas en vez de recibir una excepción.

### Capa 2 — bloquear los envíos

Cinco reglas estáticas de declarativeNetRequest, en `rules/ga.json`:

| Dominio | Bloqueado |
| --- | --- |
| `*.google-analytics.com` | cualquier URL que contenga `/collect` — `/collect`, `/j/collect`, `/g/collect`, `/r/collect` y hosts regionales como `region1.` |
| `*.google-analytics.com` | `/batch`, el transporte por lotes de analytics.js |
| `*.analytics.google.com` | `/g/collect` y `/g/s/collect`, los extremos regionales de GA4 |
| `stats.g.doubleclick.net` | `/collect`, usado cuando Google Signals está activo |

**No se bloquea:** `googletagmanager.com` (`gtag.js`, `gtm.js`) ni los scripts que
sirve el propio `google-analytics.com`. Optar por no participar significa dejar
que el código cargue y no dejar que informe; matar el cargador se llevaría por
delante todo lo demás que un sitio gobierne con Tag Manager. La capa 1 mantiene a
GA callado aunque se haya cargado.

Como no se bloquea ningún recurso de página, esto prácticamente nunca rompe un sitio.

## Comprobar que funciona

1. Abre un sitio que use GA
2. `F12` → **Red**, filtra por `collect`
3. Las peticiones a `www.google-analytics.com/g/collect` y similares deberían
   aparecer como bloqueadas (`NS_ERROR_ABORTED`) — esa es la capa 2
4. En la consola, `_gaUserPrefs.ioo()` debería devolver `true` — esa es la capa 1.
   `_gaUserPrefs is not defined` significa que el script de contenido no se
   registró; consulta Resolución de problemas

## Pruebas

```bash
make setup-test   # una vez: archivo de Firefox, geckodriver y un venv con selenium
make test
```

`setup-test` instala en `~/opt/firefox`, `~/.local/bin` y `.test/` — sin paquetes
del sistema, nada necesita root.

**`make unit`** ejecuta la lógica de exclusión contra un doble de las API de
WebExtension. Solo Node, sin navegador.

**`make test-browser`** lanza dos veces un Firefox headless real —una con la
extensión cargada y otra sin ella— y compara. La ejecución de control es lo
importante: demuestra que la red es realmente alcanzable y que la marca de
exclusión viene de verdad de la extensión. Comprueba que:

- la marca de exclusión se pone, **incluso en una página servida con una CSP
  estricta** — justo el caso en que el complemento de Google falla en silencio
- un sitio que asigna a `_gaUserPrefs` no puede volver a incluirse, y no provoca
  una excepción al intentarlo
- los envíos `/collect` de GA4, Universal Analytics y los regionales quedan
  bloqueados, también bajo CSP estricta
- `gtag.js` sigue cargando y un `/collect` del mismo origen queda intacto, es
  decir, las reglas no bloquean de más

La versión para Android no se ha probado en un dispositivo físico. Todas las API
que usa se contrastaron con los browser-compat-data de MDN y reflejan el soporte
de escritorio, pero eso es una comprobación sobre el papel, no una prueba.

## Lo que no puede hacer

- **GTM del lado del servidor y medición first-party.** Si un sitio recoge en su
  propio dominio, digamos `metrics.example.com`, y reenvía a GA desde su servidor,
  ese tráfico no se distingue del tráfico normal hacia ese sitio, así que la capa 2
  no puede atraparlo. La capa 1 sigue aplicándose, porque quien envía es gtag.js
  en la página.
- **Otros productos de analítica distintos de GA** quedan fuera del alcance. Esta
  extensión se excluye de Google Analytics y de nada más.
- **Los envíos puramente de servidor por Measurement Protocol** nunca pasan por el
  navegador, así que ninguna extensión puede detenerlos.

## Privacidad

Esta extensión **no recoge nada ni envía nada a ninguna parte**. No hace
peticiones de red por su cuenta. Lo único que guarda es la lista de nombres de
host que has excluido (`storage.local`), y eso nunca sale del dispositivo. El
manifiesto lo declara como
`data_collection_permissions: { required: ["none"] }`.

## Idiomas

26 idiomas, elegidos automáticamente según la configuración del navegador — no
hay nada que configurar:

alemán, árabe, checo, chino (simplificado y tradicional), coreano, danés,
español, finés, francés, hebreo, hindi, indonesio, inglés, italiano, japonés,
neerlandés, noruego, polaco, portugués (Brasil), ruso, sueco, tailandés, turco,
ucraniano, vietnamita.

La mayoría no los escribieron hablantes nativos, así que las correcciones son el
tipo de pull request más bienvenido. Añadir un idioma consiste en copiar
`_locales/en/messages.json` a `_locales/<código>/messages.json` y traducir los
valores de `message`, dejando intactas las claves y los campos `description`. Son
once cadenas. Lo que falte recae en el inglés.

Este README también está traducido — los demás idiomas viven en `translations/`,
listados al principio de este archivo. El inglés es la versión canónica; ejecuta
`python3 Tools/sync-readme-nav.py` después de añadir uno para refrescar esos enlaces.

## Publicación (notas para quien mantiene el proyecto)

Firefox no instala de forma permanente una extensión sin firmar, así que la
distribución pasa por Mozilla en cualquier caso:

- **Listada** — sube `dist/*.zip` en el
  [AMO Developer Hub](https://addons.mozilla.org/developers/). Se revisa, se
  firma y se publica en addons.mozilla.org. Los envíos listados no se pueden
  automatizar; `web-ext sign --channel=listed` solo sube para revisión.
- **No listada**, es decir, autodistribución — `make sign` con una
  [clave de API de AMO](https://addons.mozilla.org/developers/addon/api/key/)
  devuelve un `.xpi` firmado que puedes alojar tú. Ten en cuenta que un
  complemento autodistribuido no se puede instalar en Firefox para Android.

No hace falta adjuntar el código fuente: aquí nada está minificado ni empaquetado.

## Resolución de problemas

- **`_gaUserPrefs` es undefined** — lo más probable es que se haya revocado el
  acceso a los sitios. En `about:addons`, abre los **Permisos** de esta extensión
  y permite el acceso a todos los sitios. Se vuelve a registrar sola en cuanto el
  permiso regresa
- **No pasa nada en Firefox 127 o anterior** — los scripts de contenido
  `world: "MAIN"` necesitan Firefox 128. Actualiza
- **Una exclusión no surtió efecto** — las exclusiones son por dominio, incluyen
  subdominios y se aplican desde la siguiente carga de página
- **Un sitio se rompió y excluirlo no arregló nada** — entonces no fue esta
  extensión. Solo se bloquean las peticiones `/collect`, nunca un script ni un
  recurso de página

## Apoyo

Hakarasenai es gratuita y siempre lo será. Si te mantiene fuera del panel de
alguien, patrocinar el trabajo mediante
[GitHub Sponsors](https://github.com/sponsors/omikuji) se agradece y es la única
financiación del proyecto.

El patrocinio paga el mantenimiento, que es el coste real aquí: Google mueve y
añade extremos de recogida, y un conjunto de reglas que el año pasado era
exhaustivo deja de serlo sin avisar. También compraría el hardware Android contra
el que la extensión, por ahora, solo está verificada sobre el papel.

Preguntas, problemas e ideas son todos bienvenidos:

- [X (@omikuji_man)](https://x.com/omikuji_man)
- [Formulario de contacto](https://omikuji.dev/contact/)
- [Informar de un problema en GitHub](https://github.com/omikuji/hakarasenai/issues)

## Licencia

Licencia MIT.
