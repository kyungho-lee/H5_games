# Error Boundary & User Notification — Design Spec

**Date**: 2026-06-10
**Scope**: Spec A of 2 (Spec B = polishing/optimization, follow-up)
**Project**: SameGame — Grid Protocol

---

## 1. Overview

게임 코드 전반에 흩어진 임시 에러 억제(suppressor, silent fail, 빈 catch) 코드를 제거하고, 외부 시스템(광고 SDK · Firebase) 경계에서 에러를 처리하는 단일 책임 아키텍처를 도입한다. 사용자 의도가 있는 작업이 실패하면 토스트로 정확히 알리고 자동·수동 재시도를 제공한다.

**Why**: 현재 코드는 sdkDisabled suppressor, `.catch(function(){})`, 빈 try/catch가 4개 HTML과 SDK 래퍼에 흩어져 있다. 임시 처방으로 콘솔은 깨끗하지만 사용자는 실패 상황을 알 수 없고, 재시도도 못 한다. boundary 패턴으로 cross-cutting concern을 한 곳에 모으면 게임 로직은 깨끗하게 유지되고, 정책 변경 시 한 곳만 수정한다.

**Out of Scope** (별도 Spec B):
- 파일 분할(endless.html ~1810줄), 데드 코드 제거, 중복 함수 통합
- 일반 console.log 정리 (단, 광고 디버그 로그는 본 spec 범위에 포함 — boundary 책임과 직결)

---

## 2. 아키텍처

```
┌──────────────────────────────────────────────────────────┐
│  게임 코드 (endless / daily / samegame / index .html)    │
│  - 비즈니스 로직만                                          │
│  - await SG.FB.* / SG.CG.* 호출 그대로                    │
│  - try/catch 없음, 결과 검사 없음                          │
└──────────────────────┬───────────────────────────────────┘
                       │ 호출 (변경 0줄)
                       ▼
┌──────────────────────────────────────────────────────────┐
│  경계 레이어 (firebase.js / playgama.js / crazygames.js)  │
│  - 사전 검증으로 throw 방지 (도메인·isReady·isSupported)   │
│  - 모든 외부 호출 내부 try/catch                            │
│  - 자동 재시도 정책 적용 (withRetry)                        │
│  - 실패 분류 → notify.js로 토스트 dispatch                  │
│  - 항상 안전한 표준 결과로 resolve (게임 흐름 단절 X)        │
└─────────────┬─────────────────────────────┬──────────────┘
              │ 정책 위임                    │ 정책 위임
              ▼                              ▼
┌──────────────────────────────────────────────────────────┐
│  notify.js (신규)                                          │
│  - Toast UI (4개 HTML 공통, 한 번만 작성)                  │
│  - withRetry(fn, policy) — 자동 백오프                     │
│  - 카테고리별 메시지 사전 + 수동 재시도 콜백                  │
└──────────────────────────────────────────────────────────┘
```

**의존 방향**: 게임 → 경계 → notify (단방향, 순환 없음). notify는 어디도 의존하지 않는 leaf 모듈.

**로드 순서** (4개 HTML 모두 동일):
```html
<script src="crazygames.js"></script>
<script src="playgama.js"></script>
<script src="notify.js"></script>      <!-- 신규, firebase.js 보다 앞 -->
<script src="firebase.js"></script>
<script src="core.js"></script>
<!-- ... -->
```

---

## 3. notify.js (신규 모듈)

### 3.1. 공개 API

```js
SG.Notify = {
  error(category, opts),     // 빨강 토스트 + 재시도 액션
  info(message, opts),       // 회색 토스트 (안내)
  withRetry(fn, policy),     // boundary 전용 — 게임 코드에서 호출 금지
};
```

### 3.2. Toast UI 규격

- **위치**: 화면 하단 중앙, `position: fixed`, `z-index: 9999` (오버레이보다 위)
- **크기**: 최대 폭 320px, 자동 줄바꿈
- **자동 닫힘**: error 6초, info 3.5초 (호버 시 일시정지, 재개 시 잔여시간 카운트)
- **동시 표시**: 최대 3개 스택 (오래된 것 위, 새것 아래)
- **중복 합치기**: 같은 카테고리 토스트가 살아있으면 새로 띄우지 않고 카운터 증가 (`Couldn't submit your score. (×3)`)
- **재시도 버튼**: `opts.retry` 콜백이 있을 때만 표시. 클릭 시 토스트 닫기 → 콜백 실행. 콜백 실행 중에는 토스트를 `Retrying…`으로 일시 표시.
- **테마**: 다크. 배경 `#1a1a1a`, 텍스트 `#e5e5e5`, error 좌측 보더 `#ff5050` (4px), info 좌측 보더 `#808080`
- **루트 컨테이너**: notify.js가 첫 호출 시 `<div id="sg-toast-root">`를 `body`에 자동 주입 (HTML 수정 불필요)

### 3.3. withRetry 시그니처

```js
SG.Notify.withRetry(
  () => db.collection(...).set(...),     // 시도할 비동기 함수
  {
    tries: 3,                            // 첫 시도 + 재시도 2회 = 총 3회
    backoff: [500, 1500],                // 재시도 사이 ms (배열 길이 = tries - 1)
    retryOn: (err) => err.code !== 'permission-denied'  // 선택, true 시에만 재시도
  }
);
// 모두 실패하면 마지막 에러를 throw (boundary가 catch해서 토스트 노티)
```

### 3.4. 카테고리 사전

```js
const MESSAGES = {
  FB_SUBMIT:    { text: "Couldn't submit your score.",                       manualRetry: true  },
  FB_FETCH:     { text: "Couldn't load the leaderboard.",                    manualRetry: true  },
  FB_SDK_INIT:  { text: "Leaderboard unavailable. Playing offline.",         manualRetry: false },
  AD_REWARDED:  { text: "Couldn't load the ad.",                             manualRetry: true  },
  AD_INTER:     { text: "Ad failed to display.",                             manualRetry: false },
  SDK_INIT:     { text: "Ad SDK unavailable. Continuing without ads.",       manualRetry: false },
  NETWORK:      { text: "Network connection problem.",                       manualRetry: true  },
};
```

**UI 라벨**: 재시도 `Retry`, 닫기 `×`, 진행 중 `Retrying…`, 카운터 `(×N)`.

### 3.5. 파일 크기 예상

~180줄 (UI ~80, withRetry ~30, 사전 + dispatch ~70).

### 3.6. 단위 테스트

- withRetry: 3회 실패 → throw / 2회 실패 후 성공 → resolve / 백오프 ms 측정
- 중복 합치기: 같은 카테고리 2회 호출 → 토스트 1개 + `(×2)`
- 자동 닫힘: setTimeout 모킹으로 6초/3.5초 검증
- 호버 일시정지: mouseenter/mouseleave 핸들러 동작

---

## 4. firebase.js — 경계 처리

### 4.1. 함수 분류 및 정책

| 함수 | 사용자 의도 작업? | 정책 |
|------|-----------------|-----|
| `submitDailyScore` | ✅ 점수 등록 | 자동 재시도 3회 → 실패 시 `FB_SUBMIT` 토스트 + 수동 재시도 |
| `getDailyLeaderboard` | ✅ 랭킹 조회 | 자동 재시도 3회 → 실패 시 `FB_FETCH` 토스트 + 수동 재시도 |
| `submitEndlessScore` | ✅ 점수 등록 | 동일 |
| `getEndlessLeaderboard` | ✅ 랭킹 조회 | 동일 |
| `updateGlobalStats` | ❌ 부가 통계 | silent (console.debug only) |
| `getGlobalStats` | ❌ 부가 통계 표시 | silent — 결과 null이면 호출 사이트가 자연 분기 |
| `fetchLocation` (ip-api) | ❌ 부가 메타 | silent — 기존 패턴 유지 |

**원칙**: 사용자 의도가 명확한 작업만 토스트. 부가 메타(통계·위치)는 실패해도 사용자에게 알리지 않음.

### 4.2. 사용자-의도 함수 경계 패턴

```js
async function submitDailyScore(args) {
  if (!db) return null;                    // 미설정 — 정상 분기, 노티 없음

  if (!navigator.onLine) {                 // 네트워크 사전 감지
    SG.Notify.error('NETWORK', { retry: () => submitDailyScore(args) });
    return null;
  }

  try {
    return await SG.Notify.withRetry(
      () => _submitDailyScoreOnce(args),
      {
        tries: 3,
        backoff: [500, 1500],
        retryOn: (err) => err.code !== 'permission-denied'  // 권한 거부는 즉시 토스트
      }
    );
  } catch (e) {
    console.debug('[FB] submitDailyScore failed:', e);
    SG.Notify.error('FB_SUBMIT', { retry: () => submitDailyScore(args) });
    return null;
  }
}
```

`_submitDailyScoreOnce` = 현재 `submitDailyScore` 본문 로직 (트랜잭션 등) 그대로 분리.

### 4.3. SDK 동적 로드 실패

Firebase SDK는 광고가 아니므로 `FB_SDK_INIT` 카테고리를 사용 (사전에 정의됨).

```js
var ok1 = await _loadScript(BASE + 'firebase-app.js');
if (!ok1) {
  SG.Notify.error('FB_SDK_INIT');          // manualRetry:false — 정보 안내만
  return;
}
```

### 4.4. isLocal 처리

현재 패턴 유지: `file://` / localhost → SDK 로드 자체 skip. 노티 없음 (개발 환경 정상 분기).

### 4.5. fetchLocation

현재 패턴 유지 — silent + 빈 객체 반환. 부가 메타이므로 토스트 안 띄움. `console.debug` 로깅만 추가.

### 4.6. 호출 사이트 영향

**`await SG.FB.*` 호출 그 자체는 0줄 변경**. 게임 코드는 결과만 받는다.

다만 boundary가 throw하지 않고 항상 resolve하므로, 호출 사이트의 **방어 try/catch는 무의미**해진다. 이를 정리하는 작업은 본 spec Step 5–6에 포함 (게임 로직 변경 아님, 죽은 코드 제거):
- `_submitEndlessLb` (endless.html) — try/catch 제거, `result || _makeDummyEndless()` 로 단순화
- `submitToFirebase` (daily.html) — try/catch 제거, 동일 단순화
- `endless.html:1718` `.catch(function(){})` — 제거 (boundary가 항상 resolve)

---

## 5. crazygames.js — sdkDisabled 근본 차단

### 5.1. 문제

비-CrazyGames 도메인에서 `_sdk.init()` 호출 → 비동기 throw `sdkDisabled`. 현재는 `endless.html` 부트 IIFE의 `unhandledrejection` suppressor로 임시 억제.

### 5.2. 근본 해결

```js
async function init() {
  var host = location.hostname;
  var isCG = host.endsWith('.crazygames.com')
          || host.endsWith('.crazygames.io')
          || host === 'crazygames.com';

  if (!isCG) {
    console.debug('[CG] non-CG host — SDK init skipped');
    return;  // _ready = false 유지 → 모든 SG.CG.* 함수가 no-op fallback
  }

  // 기존 SDK 동적 로드 + init 로직
}
```

### 5.3. 결과

- sdkDisabled 에러 발생 자체가 차단됨
- `endless.html` boot IIFE의 `unhandledrejection` suppressor → **삭제**
- `endless.html` boot IIFE 끝 `.catch(function(){})` → **삭제**

---

## 6. playgama.js — Playgama QA 인바리언트 + 노티 통합

### 6.1. QA 패스 절대 인바리언트

**1. game_ready 전송 — 부트 완료 시 반드시 발생**
```js
SG.CG.loadingStop = function () {
  if (_bridge) {
    try { _bridge.platform.sendMessage('game_ready'); }
    catch (e) { console.debug('[PG] sendMessage failed:', e); }
  }
};
```
사전 검증으로 막지 않음. `_bridge` 인스턴스만 있으면 무조건 호출.

**2. mock(QA) 모드에서는 isSupported 우회 — 무조건 SDK 호출**
```js
var isMock = _bridge.platform.id === 'mock';
if (!isMock && !_bridge.advertisement.isInterstitialSupported) return null;
// mock에서는 isSupported가 false여도 무조건 호출 → QA가 intercept할 기회 확보
_bridge.advertisement.showInterstitial('level_complete');
```
이 패턴은 현재 코드에서 이미 보존됨. 변경 없음.

**3. listener `off→on` 재등록 패턴 (mock failed 후)**
```js
if (state === 'failed') {
  if (isMockR) {
    try { _bridge.advertisement.off(evRew, onState); } catch (e) {}
    try { _bridge.advertisement.on(evRew, onState);  } catch (e) {}
    // finish() 호출 안 함 — QA의 rewarded→closed 주입 대기
  } else {
    try { _bridge.advertisement.off(evRew, onState); } catch (e) {}
    finish();
  }
}
```
listener off/on의 빈 catch는 **정당함** — 유지 (실패해도 무해, 다음 listener 동작 계속).

### 6.2. 광고 실패 토스트 정책

| 상황 | mock(QA) | 실서버 |
|------|----------|--------|
| 인터스티셜 failed/timeout | silent | silent (게임 이미 진행 중 — 토스트는 방해) |
| 리워드 failed/timeout | silent | `AD_REWARDED` 토스트 + 수동 재시도 |
| 리워드 isSupported=false | — | `info` 토스트: `"Ad not available right now."` |
| SDK 초기화 실패 | silent | `SDK_INIT` 토스트 |
| game_ready 호출 실패 | silent (console.debug) | silent (console.debug) |

### 6.3. 리워드 boundary 패턴

```js
SG.CG.requestRewardedAd = async function (placementId) {
  if (!_ready || !_bridge) return { granted: false };

  var isMockR = _bridge.platform.id === 'mock';
  if (!isMockR && !_bridge.advertisement.isRewardedSupported) {
    SG.Notify.info("Ad not available right now.");
    return { granted: false };
  }

  // 기존 Promise + listener + timeout 로직 유지
  // 결과 분기:
  //   granted=true → 그대로 resolve, 토스트 없음
  //   granted=false (mock) → silent (QA 시나리오)
  //   granted=false (실서버) → SG.Notify.error('AD_REWARDED', {
  //                                retry: () => requestRewardedAd(placementId)
  //                            })
};
```

### 6.4. 디버그 로그 정리

`[PG.inter]`, `[PG.rewarded]`, `[PG.banner]` 등 `console.log`는 `?dev` URL 파라미터가 있을 때만 출력. 본 spec에서는 게이트만 적용 (전체 삭제는 Spec B 폴리싱 범위).

```js
const DEV = new URLSearchParams(location.search).has('dev');
function dlog() { if (DEV) console.log.apply(console, arguments); }
```

### 6.5. playgama.js의 의미 없는 빈 catch — 제거 대상

| 위치 | 코드 | 처리 |
|------|------|------|
| listener `off`/`on` | `try {...} catch (e) {}` | **유지** — 정당함 (실패 무해) |
| `setMinimumDelayBetweenInterstitial` | `try {...} catch (e) {}` | **유지** — 정당함 (선택적 SDK 메서드) |
| `rewardedPlacement` 읽기 | `try {...} catch (e) {}` | **유지** — 정당함 (옵션 속성) |
| `platform.on('audioStateChanged')` | `try {...} catch (e) {}` | **유지** — 정당함 (이벤트 등록 실패 무해) |

playgama.js의 모든 빈 catch는 SDK 옵션 메서드 보호 목적으로 **정당**. 본 spec 범위에서 제거하지 않음. (Spec B 폴리싱에서 재검토.)

---

## 7. 호출 사이트 변경 요약

| 파일 | 변경 줄 수 | 변경 내용 |
|------|----------|----------|
| `daily.html` | -5 | `try/catch` 단순화 (`submitToFirebase`) |
| `endless.html` | -15 | 임시 억제 코드 삭제 (3건) + `try/catch` 단순화 (`_submitEndlessLb`) |
| `samegame.html` | 0 | 호출 그대로 |
| `index.html` | 0 | 호출 그대로 |

### endless.html 삭제 목록

| 위치 | 코드 | 삭제 사유 |
|------|------|----------|
| boot IIFE 앞 | `unhandledrejection` sdkDisabled suppressor | crazygames.js 도메인 검사로 근본 차단 |
| boot IIFE 끝 | `.catch(function(){})` | boundary가 throw 안 함 |
| L1718 | `.catch(function(){})` on `getGlobalStats()` | boundary가 항상 resolve |

---

## 8. 회귀 방지

### 8.1. daily.html 베이스라인

daily.html의 광고 통합은 QA에서 확인됨 (리워드 광고 + 게임오버 인터스티셜). boundary 리팩토링 후 daily.html을 가장 먼저 회귀 테스트. 동일 동작 확인 후 endless.html로 적용 확장.

### 8.2. 핵심 회귀 시나리오

**A. QA 인바리언트 (Step 4 이후)**
- mock 모드에서 `loadingStop()` 호출 → `game_ready` 전송 확인 (Playgama dev console)
- mock 모드에서 `showInterstitial('level_complete')` 호출 (QA intercept 가능)
- mock 모드에서 `showRewarded('continue_game')` 호출 → QA의 `rewarded→closed` 주입 수신
- listener `off→on` 재등록 패턴 보존

**B. 게임 흐름 회복력**
- 네트워크 끊김 상태에서 점수 등록 시도 → 토스트 + 재시도 가능 + 게임은 계속 진행
- 광고 SDK 응답 없음 → 타임아웃(3s/15s/30s) 후 게임 정상 진행
- Firebase 권한 거부 → `FB_SUBMIT` 토스트, retry 콜백 없음(권한 거부는 재시도 무의미)

**C. UI 일관성**
- 토스트 4개 HTML 공통 — 같은 스타일/위치/동작
- 게임 오버레이가 떠 있어도 토스트가 위에 표시 (z-index 9999)
- 광고가 떠 있는 동안에는 토스트 큐에만 적재, 광고 닫힌 후 표시 (선택 고도화 — 본 spec MVP에서는 즉시 표시)

---

## 9. 마이그레이션 단계

각 단계는 독립 커밋. 회귀 발생 시 롤백 지점 명확.

```
Step 1. notify.js 추가
        - 단위 테스트 + 4개 HTML <script> 태그
        - 게임 동작 변화 없음 (호출되지 않음)

Step 2. firebase.js boundary 패턴 적용
        - submitDailyScore / getDailyLeaderboard / submitEndlessScore / getEndlessLeaderboard
        - withRetry + Notify dispatch + 표준 결과 (null)
        - silent 함수(updateGlobalStats / getGlobalStats / fetchLocation) 그대로

Step 3. crazygames.js 도메인 검사 추가 (sdkDisabled 근본 차단)

Step 4. playgama.js 노티 정책 통합 + 디버그 로그 정리(?dev 게이트)

Step 5. endless.html 임시 억제 코드 삭제 + 호출 사이트 단순화

Step 6. daily.html / samegame.html / index.html 호출 사이트 단순화
```

### 테스트 매트릭스

| Step | 단위 테스트 | 로컬 회귀 | mock(QA) 회귀 | 실서버 검증 |
|------|----------|---------|--------------|-----------|
| 1 | `notify.test.js` (withRetry, 중복 합치기, 자동 닫힘, 호버 일시정지) | 4개 HTML 부팅 | — | — |
| 2 | — | daily 점수 등록 (config 없을 때 더미 표시) | — | 실서버 정상 등록/조회 |
| 3 | — | 비-CG 도메인에서 sdkDisabled 콘솔 없음 | — | crazygames.com 실배포 광고 동작 |
| 4 | — | console 정리 확인 | **Playgama QA 통과** (start pass + 광고 노출) | — |
| 5 | — | endless 풀게임 + 토스트 동작 | endless 광고 QA 재검증 | — |
| 6 | — | daily/samegame/index 풀게임 회귀 | daily 광고 QA 재검증 | — |

---

## 10. Definition of Done

- [ ] 임시 억제 코드 모두 제거 (endless.html 3건)
- [ ] `unhandledrejection` 핸들러 없음
- [ ] notify.js 단위 테스트 통과 (4개 시나리오)
- [ ] mock(QA) 모드 광고 흐름 회귀 없음 (daily.html + endless.html)
- [ ] 실서버 1회 전체 플레이 검증 (4개 HTML)
- [ ] console 노이즈 최소화 (광고 디버그 로그는 `?dev` URL에서만)
- [ ] daily.html · endless.html · samegame.html · index.html 부팅 정상

---

## 11. Glossary

- **Boundary**: 외부 시스템(SDK · 네트워크)과 게임 코드의 경계 파일 — `firebase.js`, `playgama.js`, `crazygames.js`. 모든 외부 호출의 try/catch · 재시도 · 노티 정책이 이곳에 모인다.
- **사용자 의도 작업**: 사용자가 명확히 트리거하고 결과를 기대하는 작업 (점수 등록, 랭킹 조회, 광고 시청). 부가 메타(글로벌 통계, IP 위치)와 구분.
- **mock 모드**: `_bridge.platform.id === 'mock'`. Playgama QA 검증기 또는 로컬 Chrome에서 발생. mock에서는 isSupported 사전 차단을 우회하고 SDK 호출이 무조건 발생해야 한다 (QA intercept 보장).
- **QA 인바리언트**: Playgama 검증기 통과를 위해 절대 위반 불가한 동작 — `game_ready` 전송, `showInterstitial/showRewarded` 호출, listener `off→on` 재등록.
- **임시 억제(suppressor)**: `window.addEventListener('unhandledrejection', ...)`, `.catch(function(){})`, 의미 없는 `try{}catch(e){}` 등 에러를 콘솔에서 숨길 뿐 사용자에게 알리지 않고 재시도도 못 하는 코드. 본 spec의 제거 대상.
