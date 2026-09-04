# Hakarasenai

[English](../README.md) · [العربية](README.ar.md) · [Čeština](README.cs.md) · [Dansk](README.da.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Suomi](README.fi.md) · [Français](README.fr.md) · [עברית](README.he.md) · [हिन्दी](README.hi.md) · [Bahasa Indonesia](README.id.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · **한국어** · [Norsk](README.nb.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Svenska](README.sv.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [Tiếng Việt](README.vi.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md)

Google Analytics가 당신을 측정하지 못하게 하는 일만 하는 Firefox 확장 기능.
데스크톱과 Android 모두 지원한다.

*Hakarasenai*는 "측정하게 두지 않는다"는 뜻이며, 그것이 기능의 전부다.

**하는 일:**

1. 페이지의 Google Analytics 코드에 사용자가 옵트아웃했음을 알린다
2. 그래도 나가려는 측정 데이터를 차단한다
3. 문제가 생기는 사이트는 툴바 버튼에서 그 사이트만 제외할 수 있다

옵션 페이지 없음, 필터 구독 없음, 카운터 없음, Pro 버전 없음.

## 왜 만들었나

Google은 공식 "Google Analytics 옵트아웃 부가 기능"을 제공하고 Firefox 빌드도 있다.
문제는 **작동 방식**이다. 페이지에 `<script>` 요소를 주입하는데,
Firefox는 Safari와 마찬가지로 콘텐츠 스크립트에도 페이지의 CSP를 적용한다.
CSP가 엄격한 사이트에서는 주입 자체가 차단되어 옵트아웃이 조용히 아무 일도 하지 않는다.
실패했다는 사실을 알려주는 것이 아무것도 없다 —
프라이버시 도구로서 최악의 실패 방식이다.

Hakarasenai는 같은 공식 후크를 사용하되 CSP가 닿을 수 없는 곳에 두고,
그 뒤에 네트워크 차단을 두 번째 층으로 놓는다.
첫 번째 층이 실패하더라도 데이터는 여전히 나가지 않는다.

## 설치

### AMO에서

[addons.mozilla.org](https://addons.mozilla.org/)에서 검색한다.
Android에서도 같은 방식으로 AMO에서 설치한다.
`gecko_android`를 선언했기 때문에 Firefox for Android가 설치 대상으로 인식한다.

### 소스에서 임시로 불러오기

빌드가 필요 없다. `about:debugging#/runtime/this-firefox`를 열고
**임시 부가 기능 로드**를 선택한 뒤 이 저장소의 `manifest.json`을 고른다.
Firefox를 닫을 때까지 유지된다.

데스크톱과 Android 모두 Firefox 128 이상이 필요하다.
`world: "MAIN"` 콘텐츠 스크립트가 128부터 지원되기 때문이다.

AMO에 올릴 zip을 만들려면:

```bash
make build   # → dist/hakarasenai-<version>.zip
```

`make lint`와 `make run`은 `web-ext`를 사용한다(`npx`가 처음에 내려받는다).
`make lint`는 의도적으로 경고 2건을 낸다. 데이터 수집 선언
(`data_collection_permissions: none`)은 Firefox 140 이상에서만 읽히는 키인데
`strict_min_version`이 128이라 린터가 그 간극을 지적한다.
128~139에서는 그냥 무시되므로, 이를 없애려고 지원 범위를 좁힐 가치는 없다.

### Firefox for Android에 소스에서 설치

```bash
adb devices                      # 기기 ID 확인
make run-android DEVICE=<id>
```

adb, 휴대폰의 USB 디버깅, 그리고 Firefox 설정의
*USB를 통한 원격 디버깅*이 켜져 있어야 한다.

## 사용법

조작하는 것은 툴바 버튼 하나뿐이다.
현재 사이트의 상태를 보여주고 동작 하나만 제공한다.

| 상태 | 의미 |
| --- | --- |
| **차단 중** | 이 사이트에서 두 층이 모두 작동 중. 어디서나 이것이 기본값 |
| **제외됨** | 이 사이트에서 두 층이 모두 꺼져 있고, 아이콘에 `OFF` 배지가 붙는다 |

**이 사이트 제외하기**를 누르면 그 사이트가 동적 `allow` 규칙과
콘텐츠 스크립트의 `excludeMatches` 양쪽에 들어간다.
겉모습만이 아니라 실제로 멈춘다. 제외는 **등록 도메인 단위이며 하위 도메인을 포함**한다.
`example.com`을 제외하면 `www.example.com`과 `shop.example.com`도 함께 제외된다.
다음 페이지 로드부터 적용된다.

일부러 측정되고 싶을 때 — 자기 사이트의 GA를 검증할 때 등 — 쓰는 기능이다.
`OFF` 배지는 Android에서는 그려지지 않지만, 팝업에는 어느 상태인지 표시된다.

## 작동 방식

### 1층 — 옵트아웃을 알린다

`ga.js`, `analytics.js`, `gtag.js`는 모두 전송 전에
`window._gaUserPrefs.ioo()`(*ioo* = is opted out)를 확인하고,
true를 반환하면 전송을 멈춘다.
Google 자신의 부가 기능이 세우는 것과 같은 플래그이며,
Google Analytics가 스스로 마련해 둔 탈출구다.

`src/optout.js`를 `world: "MAIN"` 콘텐츠 스크립트로 `document_start`에 등록하므로,
사이트 코드가 실행되기 전에 이미 플래그가 페이지의 전역 객체에 올라와 있다.
DOM에 아무것도 삽입하지 않으므로 CSP가 막을 대상이 없다.
사이트가 플래그를 덮어쓸 수도 없다. 쓰기 불가 속성 대신 setter를 no-op으로 두었기 때문에,
strict 모드 페이지가 대입해도 예외가 나지 않고 조용히 무시된다.

### 2층 — 측정 데이터를 차단한다

`rules/ga.json`에 있는 declarativeNetRequest 정적 규칙 5개가 전부다:

| 도메인 | 차단 대상 |
| --- | --- |
| `*.google-analytics.com` | `/collect`를 포함하는 모든 URL — `/collect`, `/j/collect`, `/g/collect`, `/r/collect`, `region1.` 같은 지역별 호스트 포함 |
| `*.google-analytics.com` | `/batch`, analytics.js의 묶음 전송 |
| `*.analytics.google.com` | `/g/collect`와 `/g/s/collect`, GA4 지역별 엔드포인트 |
| `stats.g.doubleclick.net` | `/collect`, Google 신호 데이터가 켜져 있을 때 사용된다 |

**차단하지 않는 것:** `googletagmanager.com`(`gtag.js`, `gtm.js`)과
`google-analytics.com`이 제공하는 스크립트 자체.
옵트아웃이란 코드를 불러오게 두되 보고하지 못하게 하는 것이며,
로더까지 죽이면 사이트가 태그 관리자를 통해 돌리는 다른 기능까지 함께 무너진다.
1층이 있으므로 불러와도 GA는 조용하다.

페이지 리소스를 하나도 막지 않으므로, 이것 때문에 사이트가 깨지는 일은 거의 없다.

## 작동하는지 확인하기

1. GA를 쓰는 사이트를 연다
2. `F12` → **네트워크**에서 `collect`로 필터링한다
3. `www.google-analytics.com/g/collect` 같은 요청이 차단됨(`NS_ERROR_ABORTED`)으로
   표시되면 2층이 작동한 것이다
4. 콘솔에서 `_gaUserPrefs.ioo()`가 `true`를 반환하면 1층도 작동한 것이다.
   `_gaUserPrefs is not defined`가 나오면 콘텐츠 스크립트가 등록되지 않은 것이다
   — 문제 해결을 참고한다

## 테스트

```bash
make setup-test   # 최초 1회: Firefox 압축본, geckodriver, selenium이 든 venv
make test
```

`setup-test`는 `~/opt/firefox`, `~/.local/bin`, `.test/`에 설치한다.
시스템 패키지는 건드리지 않고 root도 필요 없다.

**`make unit`**은 제외 로직을 WebExtension API 스텁에 대해 실행한다.
node만 있으면 되고 브라우저는 필요 없다.

**`make test-browser`**는 실제 headless Firefox를 두 번 —
확장을 넣은 상태와 넣지 않은 상태로 — 실행해 비교한다.
이 대조 실행이 핵심이다. 네트워크가 실제로 닿는지, 그리고 그 플래그가
정말 확장에서 온 것인지를 이것이 증명한다. 확인하는 항목:

- 옵트아웃 플래그가 세워진다. **엄격한 CSP가 걸린 페이지에서도** —
  Google 자신의 부가 기능이 조용히 실패하는 바로 그 경우다
- `_gaUserPrefs`에 대입하는 사이트가 스스로 옵트인으로 되돌릴 수 없고,
  그 과정에서 예외도 나지 않는다
- GA4, 유니버설 애널리틱스, 지역별 `/collect` 요청이 차단된다. 엄격한 CSP 아래에서도
- `gtag.js`는 여전히 로드되고 같은 출처의 `/collect`는 그대로 통과한다 —
  즉 과도하게 차단하지 않는다

Android 빌드는 실제 기기에서 돌려보지 않았다. 사용하는 모든 API를 MDN의
browser-compat-data로 확인해 데스크톱과 동일한 지원임을 알았지만,
그것은 문서상의 확인이지 테스트가 아니다.

## 할 수 없는 일

- **서버사이드 GTM과 퍼스트파티 측정.** 사이트가 자기 도메인
  (예: `metrics.example.com`)으로 받아서 서버에서 GA로 전달하는 구성은,
  트래픽이 그 사이트로 가는 평범한 트래픽과 구분되지 않으므로 2층이 잡을 수 없다.
  보내는 주체는 페이지의 gtag.js이므로 1층은 여전히 적용된다.
- **GA 외의 분석 도구**는 범위 밖이다. 이 확장은 Google Analytics만 옵트아웃한다.
- **순수 서버사이드 Measurement Protocol** 전송은 브라우저를 거치지 않으므로
  어떤 브라우저 확장으로도 막을 수 없다.

## 프라이버시

이 확장은 **아무것도 수집하지 않고 어디로도 보내지 않는다**.
스스로 네트워크 요청을 하지도 않는다. 저장하는 것은 사용자가 제외한 호스트 이름
목록(`storage.local`)뿐이며, 그것도 기기를 벗어나지 않는다.
매니페스트에도 `data_collection_permissions: { required: ["none"] }`으로 선언되어 있다.

## 언어

26개 언어. 브라우저의 언어 설정에서 자동으로 선택되므로 설정할 것이 없다:

아랍어, 중국어(간체·번체), 체코어, 덴마크어, 네덜란드어, 영어, 핀란드어,
프랑스어, 독일어, 히브리어, 힌디어, 인도네시아어, 이탈리아어, 일본어, 한국어,
노르웨이어, 폴란드어, 포르투갈어(브라질), 러시아어, 스페인어, 스웨덴어,
태국어, 터키어, 우크라이나어, 베트남어.

대부분 원어민이 쓴 것이 아니므로, 수정은 가장 환영하는 종류의 풀 리퀘스트다.
언어를 추가하려면 `_locales/en/messages.json`을
`_locales/<코드>/messages.json`으로 복사하고 `message` 값만 번역한다
(키와 `description`은 건드리지 않는다). 문자열은 11개다.
빠진 것은 영어로 대체된다.

이 README도 번역되어 있다. 다른 언어는 `translations/`에 있고
이 파일 맨 위에 목록이 있다. 영어판이 정본이며,
언어를 추가한 뒤에는 `python3 Tools/sync-readme-nav.py`를 실행해 링크를 갱신한다.

## 배포하기 (관리자용 메모)

Firefox는 서명되지 않은 확장을 영구적으로 설치하지 않으므로,
배포는 어느 쪽이든 Mozilla를 거친다:

- **목록 공개(listed)** — [AMO Developer Hub](https://addons.mozilla.org/developers/)에
  `dist/*.zip`을 업로드한다. 검토 → 서명 → addons.mozilla.org에 게시된다.
  이 경로는 자동화할 수 없다. `web-ext sign --channel=listed`도 검토 제출까지다.
- **비공개(unlisted)**, 즉 자체 배포 —
  [AMO API 키](https://addons.mozilla.org/developers/addon/api/key/)를 준비해
  `make sign`을 실행하면 서명된 `.xpi`를 얻어 직접 배포할 수 있다.
  다만 자체 배포된 부가 기능은 Firefox for Android에 설치할 수 없다.

소스 첨부는 필요 없다. 여기에는 minify나 번들링이 없다.

## 문제 해결

- **`_gaUserPrefs`가 undefined** — 사이트 접근 권한이 해제되었을 가능성이 높다.
  `about:addons`에서 이 확장의 **권한**을 열고 모든 사이트 접근을 허용한다.
  권한이 돌아오면 스스로 다시 등록한다
- **Firefox 127 이하에서 아무 일도 일어나지 않는다** — `world: "MAIN"` 콘텐츠
  스크립트는 Firefox 128부터다. 업그레이드한다
- **제외가 적용되지 않는다** — 제외는 도메인 단위이고 하위 도메인을 포함하며,
  다음 페이지 로드부터 적용된다
- **사이트가 깨졌는데 제외해도 고쳐지지 않는다** — 그것은 이 확장 탓이 아니다.
  차단하는 것은 `/collect` 요청뿐이고, 스크립트나 페이지 리소스는 절대 막지 않는다

## 후원

Hakarasenai는 무료이며 앞으로도 계속 무료다.
이것이 누군가의 대시보드에서 당신을 계속 빼내고 있다면,
[GitHub Sponsors](https://github.com/sponsors/omikuji)를 통한 후원이 고맙다.
이 프로젝트의 유일한 재원이다.

후원이 감당하는 것은 유지 비용이고, 실제 비용은 거기에 있다.
Google은 수집 엔드포인트를 옮기거나 추가하므로,
작년에 빠짐없던 규칙 집합이 어느새 그렇지 않게 된다.
지금은 문서상으로만 확인한 Android 실기기도 후원이 있으면 마련할 수 있다.

질문, 문제, 아이디어 모두 환영한다:

- [X (@omikuji_man)](https://x.com/omikuji_man)
- [문의 양식](https://omikuji.dev/contact/)
- [GitHub에 이슈 등록](https://github.com/omikuji/hakarasenai/issues)

## 라이선스

MIT License.
