# itch.io 런칭 계획: MOKO: Tap Tap Oops (MOKO_ch)

_PD 서지현 · 2026-10-12 · H5_games 공통 문서. 다른 게임을 itch.io에 올릴 때도 이 순서를 그대로 쓴다._
_근거: itch.io 공식 문서 [butler](https://itch.io/docs/butler/) · [설치](https://itch.io/docs/butler/installing.html) · [로그인](https://itch.io/docs/butler/login.html) · [푸시](https://itch.io/docs/butler/pushing.html) · [HTML5 업로드](https://itch.io/docs/creators/html5) · Playgama Bridge 위키 `api/platform` · MOKO_ch `docs/release/challenge-plan.md`._

---

## 0. 먼저 정할 것: 런칭 시점 (감독 결정)

- 챌린지 수상 자격은 **Playgama에서 세션 100개 초과 · 평균 플레이 5분 이상**이다. 마감은 10/21 10:00 KST.
- itch.io 판은 별도 페이지라서 그 세션은 Playgama 자격에 **잡히지 않는다**. 같은 기간에 공개하면 유입이 둘로 갈린다.
- 챌린지 페이지에 다른 플랫폼 배포를 금지하는 규칙은 없다(10/8 원문 재확인). 다만 확인된 사실은 「규칙이 없다」까지다.

| 안 | 내용 |
|---|---|
| **A (PD 권고)** | 10/21 마감 전에는 itch 페이지를 **Restricted**(비밀 링크)로 만들어 업로드와 검증만 끝낸다. 마감 뒤 **Public**으로 바꾼다. |
| B | 지금 바로 Public. itch 페이지 본문에 Playgama 플레이 링크를 함께 둔다. |

## 1. 사실 정리 (리서치 결과)

**butler (업로드 도구)**
- itch.io 공식 CLI다. `butler push <폴더|zip> <user>/<game>:<channel>` 형식이다.
- `user/game`은 소문자로 쓴다.
- `--userversion 0.1.8`로 버전 이름을 붙인다. `--if-changed`는 바뀐 게 없으면 건너뛴다. `--dry-run`은 올릴 목록만 보여 준다.
- 채널 이름으로 자동 태그되는 건 win/linux/mac/android뿐이다. **HTML5는 자동 태그되지 않는다.** 첫 푸시 뒤 대시보드에서 그 파일을 「브라우저에서 플레이(HTML5)」로 직접 지정한다.
- butler는 **이미 있는 프로젝트에만** 올린다. 게임 페이지는 웹 대시보드에서 먼저 만든다.

**인증**
- 방법은 둘이다. `butler login`(브라우저 승인, Windows는 `%USERPROFILE%\.config\itch\butler_creds`에 저장) 또는 환경변수 `BUTLER_API_KEY`.
- 문서 기준 키는 `wharf` 출처 키다. 이번에 발급한 키가 안 되면 `butler login`으로 받은 키를 쓴다.
- 키가 유출되면 itch API 키 설정 페이지에서 **폐기**한다. `butler logout`은 로컬 파일만 지운다.

**HTML5 zip 규칙**
- `index.html`이 루트에 있어야 한다. 경로는 상대 경로만, 파일명은 대소문자를 구분한다.
- 한도: 파일 1,000개 이하 · 경로 240자 이하 · 합계 500MB · 파일당 200MB.
- 외부 요청은 HTTPS만 된다. CDN이 js/html/css/wav를 gzip으로 압축해서 보낸다.

**페이지 설정**
- 보여 주기 방식: 「Embed in page」(크기 지정) 또는 「Click to launch in fullscreen」.
- 옵션: Click to Play(기본 on, 오디오 해제에 유리) · Fullscreen 버튼 · Scrollbars · **Mobile Friendly**(켜면 모바일은 항상 전체 화면 실행).
- HTML5 게임은 **판매 불가, 기부만 가능**하다. 이 게임은 무료 + (선택) 기부로 간다.

**Bridge SDK와 광고**
- Playgama Bridge 지원 플랫폼 25곳에 **itch.io는 없다.** itch에서 Bridge를 실으면 bridge.playgama.com 외부 호출만 생기고 광고와 저장은 의미가 없다.
- itch는 광고를 금지하지는 않지만 권장하지 않는다. 강제 시청이나 막는 광고는 품질 지침 위반이다.
- itch 도메인 iframe 안에서는 일반 광고 네트워크 승인도 어렵다(포럼 기준, 공식 확정 아님).

**결론: itch판은 Bridge 없음 · 광고 없음 · 저장은 localStorage인 별도 빌드로 만든다.**

## 2. itch 빌드 (TD): `npm run build:itch`

Playgama 빌드(`build:playgama`)와 그 게이트는 **건드리지 않는다.** Playgama 업로드판에 영향이 없어야 한다는 감독 원칙 때문이다.

| 항목 | Playgama판 | itch판 |
|---|---|---|
| 스크립트 | `scripts/build-playgama.mjs` | 새 `scripts/build-itch.mjs`(SHIP 목록 재사용) |
| 어댑터 | `playgama.js`(Bridge) | `itch-adapter.js`를 같은 `SG.PG` API로 만들어 zip 안에서 `playgama.js` 자리에 넣는다 |
| 저장 | Bridge Storage | **localStorage**(`mokoch_*` 7키 그대로 · 접근 실패 시 세션 메모리로 폴백) |
| 광고 | 인터스티셜 · 리워드 | **없음.** `interstitialSupported`와 `rewardedSupported`는 false |
| 설정 파일 | `playgama-bridge-config.json` | 뺀다 |
| 공유 링크 | playgama.ai/play/muahxc7hiq · #playgama | itch 페이지 주소 · Playgama 해시태그 제거 |
| 외부 URL 게이트 | Bridge URL 허용 | **허용 0개**(공유 글 안 itch 링크 문자열만 예외) |
| zip 이름 | `moko-ch-v<ver>-<hash>.zip` | `dist/itch/moko-ch-itch-v<ver>-<hash>.zip` |

TD가 꼭 확인할 것:
1. **광고가 없을 때의 흐름**
   - 런 이어하기 카드와 희귀 파츠 제안 카드가 **아예 뜨지 않는지**, 또는 「광고 없이 그냥 주기」로 바뀌는지 정한다.
   - PD 권고는 itch판에서 **희귀 제안을 끄고(`RARE_ENABLED` false) 이어하기 카드도 숨기는 것**이다. 실험 데이터는 Playgama판에서만 본다.
   - 어느 쪽이든 소프트락은 0이어야 한다.
2. **`game_version`**: itch판임을 구분할 수 있게 표기한다(예: `0.1.8-itch+<hash>`).
3. **iframe 안 공유 버튼**: itch iframe이 `web-share`를 허용하지 않으면 복사로 폴백되는지 확인한다.
4. **오디오**: Click to Play가 켜져 있어도 첫 탭에 소리가 나는지 확인한다(0.1.5 오디오 해제 로직).
5. **저장 유지**: 새로고침 뒤에도 앨범 · 도감 · 벽이 남아 있는지 확인한다.

## 3. 페이지 구성 (AD · 운영)

| 항목 | 값 |
|---|---|
| Kind of project | **HTML** |
| 제목 / URL | MOKO: Tap Tap Oops / `<itch-user>.itch.io/moko-tap-tap-oops`(감독 계정명으로 확정) |
| 보여 주기 | Embed in page · **세로 480×854** 안팎(실기기 게임 영역 약 384×650 기준, AD 확정) · Fullscreen 버튼 on · Click to Play on · Scrollbars off |
| Mobile Friendly | on · 방향 Portrait |
| 가격 | No payments 또는 Donate(감독 선택) |
| 분류 | Genre Puzzle · 태그 cats · casual · cute · puzzle · one-button 등 |
| 커버 | **630×500 PNG** — AD가 `docs/release/covers/`에서 새로 자른다(지금 커버는 1920×1080 · 1080×1920 · 800×800) |
| 스크린샷 | 3~5장(`npm run store:shots` 재사용) · 선택 GIF 1장 |
| 설명 | 영문 기본 + 한국어 한 단락 · 조작(탭) · 저장은 브라우저에 남음 |
| AI 사용 표기 | 업로드 폼에 생성형 AI 표기 항목이 있으면 사실대로 적는다(감독 확인) |
| 공개 상태 | Draft → **Restricted**(검증) → Public(§0 결정에 따라) |

## 4. 단계

| # | 단계 | 담당 | 승인 |
|---|---|---|---|
| 1 | §0 시점 결정(A/B) | 감독 | ● |
| 2 | itch 계정에서 프로젝트 페이지 만들기(Draft, HTML) · 계정명 · URL 알려 주기 | **감독(웹)** | — |
| 3 | butler 설치(Windows zip을 `C:\butler`에 풀고 PATH 추가 → `butler version`) | 감독 또는 TD(설치만) | — |
| 4 | 인증: 감독이 **본인 터미널에서** `butler login` 실행. 또는 그 세션에서만 `$env:BUTLER_API_KEY = "…"` 설정. **키는 채팅 · 저장소 · 문서에 붙이지 않는다.** | **감독** | — |
| 5 | `build:itch` 구현 + 게이트 + 테스트(0.1.8 확정본 기준) | TD | — |
| 6 | 로컬 확인(itch판 zip 풀어서 `npm run dev`와 같은 방식) | 감독 플레이 | ● |
| 7 | `butler push dist/itch/<zip> <user>/moko-tap-tap-oops:html5 --userversion 0.1.8 --dry-run` → 목록 확인 → 실제 푸시 | TD(감독 승인 뒤) | ● |
| 8 | 대시보드에서 업로드 파일을 「played in the browser」로 지정 · 보여 주기 크기 · Mobile Friendly · 커버 · 스크린샷 입력 | 감독(웹) / AD 자료 | — |
| 9 | Restricted 링크로 PC · 모바일 실기기 검증(저장 · 소리 · 공유 · 전체 화면 · 외부 요청 0) | 운영 · 감독 | — |
| 10 | Public 전환 | 감독 | ● |
| 11 | 이후 업데이트: 같은 채널에 `butler push … --userversion <새 버전> --if-changed` · `butler status <user>/moko-tap-tap-oops`로 확인 | TD(감독 승인 뒤) | ● |

● = 감독의 명시 승인 뒤에만 실행.

## 5. 보안 · 운영 원칙

- **API 키**
  - 감독만 다룬다(본인 터미널 · `butler login` 또는 세션 환경변수).
  - 저장소 · `.env` · 문서 · 채팅 · CI 로그에 남기지 않는다. 유출이 의심되면 itch API 키 페이지에서 즉시 폐기한다.
- **분리 원칙**
  - Playgama판 zip · 설정 · 게이트는 itch 작업 때문에 바꾸지 않는다.
  - MOKO 본편(심사 중 앱)과는 무관하다.
- **측정**: itch판은 텔레메트리가 없다. 챌린지 실험(희귀 파츠 수락률 등)은 Playgama 데이터로만 판정한다. itch 대시보드의 조회수와 플레이 수는 참고만 한다.
- **커밋**: 커밋 · 푸시는 감독이 지시할 때만 한다. raw 자료는 커밋하지 않는다.

## 6. 미확인 (확인 뒤 이 문서 갱신)

- 이번에 발급한 키가 `wharf` 출처가 아니어도 `BUTLER_API_KEY`로 동작하는지 → 첫 `butler status`로 확인한다.
- itch iframe의 `allow` 속성(web-share · clipboard-write 허용 여부) → 9단계 실기기에서 확인한다.
- 생성형 AI 표기 항목의 정확한 문구 → 2단계 폼에서 확인한다.
