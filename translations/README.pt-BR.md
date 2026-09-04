# Hakarasenai

[English](../README.md) · [العربية](README.ar.md) · [Čeština](README.cs.md) · [Dansk](README.da.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Suomi](README.fi.md) · [Français](README.fr.md) · [עברית](README.he.md) · [हिन्दी](README.hi.md) · [Bahasa Indonesia](README.id.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Norsk](README.nb.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · **Português** · [Русский](README.ru.md) · [Svenska](README.sv.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [Tiếng Việt](README.vi.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md)

Uma extensão do Firefox que apenas impede o Google Analytics de medir você.
Desktop e Android.

*Hakarasenai* quer dizer «não deixar medir» — é toda a lista de recursos.

**O que ela faz:**

1. Informa ao código do Google Analytics na página que você recusou o rastreamento
2. Bloqueia os dados de medição que sairiam mesmo assim
3. Permite excluir um site específico pelo botão da barra de ferramentas, se
   algum se comportar mal

Sem página de opções, sem assinaturas de filtros, sem contadores, sem versão Pro.

## Por que ela existe

O Google publica um complemento oficial, o «Google Analytics Opt-out Add-on», e
existe uma versão para Firefox. O problema é **como** ele funciona: injeta um
elemento `<script>` na página, e o Firefox — como o Safari — aplica a CSP da
própria página aos scripts de conteúdo. Em qualquer site com CSP rígida a injeção
é bloqueada e a recusa silenciosamente não faz nada. Nada avisa que falhou, o que
é o pior modo possível de uma ferramenta de privacidade quebrar.

A Hakarasenai usa o mesmo gancho oficial, mas o coloca onde nenhuma CSP alcança,
e põe atrás dele um bloqueio de rede como segunda camada. Se a primeira camada
falhar, os dados continuam não saindo.

## Instalação

### Pela AMO

Procure em [addons.mozilla.org](https://addons.mozilla.org/). No Android a
instalação é igual, pela AMO — o complemento declara `gecko_android`, então o
Firefox para Android o oferece.

### Carregar temporariamente a partir do código

Não precisa compilar. Abra `about:debugging#/runtime/this-firefox`, escolha
**Carregar extensão temporária** e selecione o `manifest.json` deste repositório.
Ela fica até você fechar o Firefox.

É preciso Firefox 128 ou mais recente, tanto no desktop quanto no Android, porque
scripts de conteúdo com `world: "MAIN"` chegaram na 128.

Para gerar o zip da AMO:

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint` e `make run` usam o `web-ext` (baixado pelo `npx` na primeira vez).
`make lint` emite dois avisos de propósito: a declaração de coleta de dados
(`data_collection_permissions: none`) só é lida a partir do Firefox 140, e
`strict_min_version` é 128, então o linter aponta a diferença. Em 128–139 a chave
é simplesmente ignorada, e não compensa estreitar o suporte só para silenciar isso.

### No Firefox para Android, a partir do código

```bash
adb devices                      # descubra o id do aparelho
make run-android DEVICE=<id>
```

Precisa de adb, depuração USB no celular e *Depuração remota via USB* ligada nas
configurações do Firefox.

## Usando

Há um único controle: o botão da barra de ferramentas. Ele mostra o estado do
site atual e oferece uma única ação.

| Estado | O que significa |
| --- | --- |
| **Bloqueando** | As duas camadas estão ativas neste site. É o padrão em todo lugar |
| **Excluído** | As duas camadas estão desligadas neste site, e o ícone leva um selo `OFF` |

**Excluir este site** coloca o site tanto em uma regra `allow` dinâmica *quanto*
nos `excludeMatches` do script de conteúdo, de modo que a exclusão é real e não
cosmética. As exclusões valem **por domínio registrável e cobrem subdomínios**:
excluir `example.com` também exclui `www.example.com` e `shop.example.com`.
Elas passam a valer a partir do próximo carregamento de página.

Serve para quando você quer ser medido de propósito — ao verificar o GA no seu
próprio site, por exemplo. O selo `OFF` não é desenhado no Android; o painel
ainda assim diz em qual estado você está.

## Como funciona

### Camada 1 — anunciar a recusa

`ga.js`, `analytics.js` e `gtag.js` verificam todos
`window._gaUserPrefs.ioo()` (*ioo* = is opted out) antes de enviar, e param se
ela retornar true. É a mesma marcação que o complemento do próprio Google define
— uma saída de emergência que o Google Analytics oferece por conta própria.

`src/optout.js` é registrado como script de conteúdo `world: "MAIN"` em
`document_start`, então a marcação já está no objeto global da página antes de
qualquer código do site rodar. Nada é inserido no DOM, portanto não há o que uma
CSP bloqueie. O site também não consegue sobrescrever a marcação: o setter é uma
operação vazia em vez de uma propriedade somente leitura, de modo que páginas em
modo estrito que atribuem a ela são ignoradas em vez de receberem uma exceção.

### Camada 2 — bloquear os envios

Cinco regras estáticas de declarativeNetRequest, em `rules/ga.json`:

| Domínio | Bloqueado |
| --- | --- |
| `*.google-analytics.com` | qualquer URL contendo `/collect` — `/collect`, `/j/collect`, `/g/collect`, `/r/collect` e hosts regionais como `region1.` |
| `*.google-analytics.com` | `/batch`, o transporte em lote do analytics.js |
| `*.analytics.google.com` | `/g/collect` e `/g/s/collect`, os endpoints regionais do GA4 |
| `stats.g.doubleclick.net` | `/collect`, usado quando o Google Sinais está ligado |

**Não bloqueados:** `googletagmanager.com` (`gtag.js`, `gtm.js`) e os scripts
servidos pelo próprio `google-analytics.com`. Recusar significa deixar o código
carregar e não deixá-lo reportar; derrubar o carregador levaria junto tudo o mais
que um site conduz pelo Gerenciador de tags. A camada 1 mantém o GA calado mesmo
tendo carregado.

Como nenhum recurso de página é bloqueado, isso praticamente nunca quebra um site.

## Conferindo que funciona

1. Abra um site que use GA
2. `F12` → **Rede**, filtre por `collect`
3. Requisições para `www.google-analytics.com/g/collect` e afins devem aparecer
   como bloqueadas (`NS_ERROR_ABORTED`) — essa é a camada 2
4. No console, `_gaUserPrefs.ioo()` deve retornar `true` — essa é a camada 1.
   `_gaUserPrefs is not defined` significa que o script de conteúdo não se
   registrou; veja Solução de problemas

## Testes

```bash
make setup-test   # uma vez: pacote do Firefox, geckodriver e um venv com selenium
make test
```

`setup-test` instala em `~/opt/firefox`, `~/.local/bin` e `.test/` — nenhum
pacote de sistema, nada exige root.

**`make unit`** roda a lógica de exclusão contra um dublê das APIs de
WebExtension. Só Node, sem navegador.

**`make test-browser`** conduz duas vezes um Firefox headless de verdade — uma
com a extensão carregada e outra sem — e compara. A execução de controle é o
ponto: ela prova que a rede está de fato acessível e que a marcação de recusa vem
mesmo da extensão. Ela verifica que:

- a marcação de recusa é definida, **inclusive numa página servida com CSP
  rígida** — exatamente o caso em que o complemento do Google falha em silêncio
- um site que atribui a `_gaUserPrefs` não consegue voltar a ser rastreado, e não
  lança exceção ao tentar
- envios `/collect` do GA4, do Universal Analytics e dos endpoints regionais são
  bloqueados, também sob CSP rígida
- `gtag.js` continua carregando e um `/collect` de mesma origem fica intocado —
  ou seja, as regras não bloqueiam demais

A build para Android não foi exercitada em um aparelho físico. Toda API usada foi
conferida nos browser-compat-data do MDN e espelha o suporte do desktop, mas isso
é conferência no papel, não teste.

## O que ela não consegue fazer

- **GTM do lado do servidor e medição first-party.** Se um site coleta no próprio
  domínio, digamos `metrics.example.com`, e repassa ao GA a partir do servidor, o
  tráfego é indistinguível do tráfego comum para aquele site, então a camada 2 não
  o pega. A camada 1 continua valendo, porque quem envia é o gtag.js na página.
- **Produtos de análise que não sejam o GA** estão fora do escopo. Esta extensão
  recusa o Google Analytics, mais nada.
- **Envios puramente do servidor via Measurement Protocol** nunca passam pelo
  navegador, então nenhuma extensão consegue impedi-los.

## Privacidade

Esta extensão **não coleta nada e não envia nada para lugar nenhum**. Ela não faz
requisições de rede próprias. A única coisa armazenada é a lista de nomes de host
que você excluiu (`storage.local`), e isso nunca sai do aparelho. O manifesto
declara isso como `data_collection_permissions: { required: ["none"] }`.

## Idiomas

26 idiomas, escolhidos automaticamente pelas configurações de idioma do navegador
— não há nada para configurar:

alemão, árabe, checo, chinês (simplificado e tradicional), coreano, dinamarquês,
espanhol, finlandês, francês, hebraico, hindi, indonésio, inglês, italiano,
japonês, neerlandês, norueguês, polonês, português (Brasil), russo, sueco,
tailandês, turco, ucraniano, vietnamita.

A maioria não foi escrita por falantes nativos, então correções são o tipo de
pull request mais bem-vindo. Adicionar um idioma é copiar
`_locales/en/messages.json` para `_locales/<código>/messages.json` e traduzir os
valores de `message`, deixando as chaves e os campos `description` em paz. São
onze textos. O que faltar recai no inglês.

Este README também é traduzido — os outros idiomas ficam em `translations/`,
listados no topo deste arquivo. O inglês é a versão canônica; rode
`python3 Tools/sync-readme-nav.py` depois de adicionar um para atualizar esses links.

## Publicação (notas para quem mantém)

O Firefox não instala permanentemente uma extensão sem assinatura, então a
distribuição passa pela Mozilla de um jeito ou de outro:

- **Listada** — envie `dist/*.zip` no
  [AMO Developer Hub](https://addons.mozilla.org/developers/). Ela é revisada,
  assinada e publicada em addons.mozilla.org. Envios listados não podem ser
  automatizados; `web-ext sign --channel=listed` só envia para revisão.
- **Não listada**, ou seja, autodistribuída — `make sign` com uma
  [chave de API da AMO](https://addons.mozilla.org/developers/addon/api/key/)
  devolve um `.xpi` assinado que você pode hospedar. Note que um complemento
  autodistribuído não pode ser instalado no Firefox para Android.

Não é preciso anexar os fontes: aqui nada é minificado nem empacotado.

## Solução de problemas

- **`_gaUserPrefs` está undefined** — o acesso aos sites provavelmente foi
  revogado. Em `about:addons`, abra as **Permissões** desta extensão e libere o
  acesso a todos os sites. Ela se registra de novo assim que a permissão volta
- **Nada acontece no Firefox 127 ou anterior** — scripts de conteúdo
  `world: "MAIN"` exigem o Firefox 128. Atualize
- **Uma exclusão não fez efeito** — exclusões valem por domínio, incluem
  subdomínios e passam a valer no próximo carregamento
- **Um site quebrou e excluí-lo não resolveu** — então não foi esta extensão. Só
  requisições `/collect` são bloqueadas, nunca um script ou recurso de página

## Apoio

A Hakarasenai é gratuita e sempre será. Se ela mantém você fora do painel de
alguém, patrocinar o trabalho pelo
[GitHub Sponsors](https://github.com/sponsors/omikuji) é bem-vindo e é o único
financiamento do projeto.

O patrocínio paga a manutenção, que é o custo real aqui: o Google muda e acrescenta
endpoints de coleta, e um conjunto de regras que no ano passado era completo
deixa de ser sem avisar. Também compraria o hardware Android contra o qual a
extensão, por ora, só foi conferida no papel.

Dúvidas, problemas e ideias são todos bem-vindos:

- [X (@omikuji_man)](https://x.com/omikuji_man)
- [Formulário de contato](https://omikuji.dev/contact/)
- [Relatar um problema no GitHub](https://github.com/omikuji/hakarasenai/issues)

## Licença

Licença MIT.
