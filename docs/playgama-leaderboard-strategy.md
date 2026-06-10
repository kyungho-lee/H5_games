# SameGame — Playgama 리더보드 전략

> 버전 1.0 | 작성일: 2026-06-11  
> 대상: Plain JS 단일 HTML 파일 빌드, Playgama Bridge SDK v1.x  
> 상태: **waiting for review 중 코드 작업 가능** (mock 플랫폼으로 로컬 테스트 지원)

---

## 목차

1. [핵심 전제](#1-핵심-전제)
2. [플랫폼별 리더보드 타입](#2-플랫폼별-리더보드-타입)
3. [리더보드 설계](#3-리더보드-설계)
4. [Config 파일 설정](#4-config-파일-설정)
5. [구현 코드](#5-구현-코드)
6. [Canvas UI 렌더링](#6-canvas-ui-렌더링)
7. [승인 후 활성화 절차](#7-승인-후-활성화-절차)
8. [자주 하는 실수](#8-자주-하는-실수)

---

## 1. 핵심 전제

**waiting for review 중에도 리더보드 코드를 완전히 구현하고 테스트할 수 있다.**

Playgama Bridge는 지원하지 않는 환경(로컬 개발, 리뷰 대기 중)에서 mock 플랫폼으로 동작한다. API 호출이 throw 대신 safe default를 반환하므로 게임 로직에 영향 없이 전체 흐름을 미리 구현해둘 수 있다.

```
리뷰 대기 중 할 수 있는 것:
  ✅ Config 파일에 leaderboards 항목 추가
  ✅ submitScore() 타입 분기 코드 구현
  ✅ getEntries() + Canvas UI 렌더링 구현
  ✅ 로컬 mock 플랫폼으로 전체 흐름 테스트
  ✅ 난이도별 3개 리더보드 ID 설계 확정

  ⏳ 승인 후 추가:
     → 플랫폼별 native ID 발급 → config 오버라이드만 추가
     → 코드 수정 없이 즉시 활성화
```

---

## 2. 플랫폼별 리더보드 타입

`bridge.leaderboards.type` 으로 현재 플랫폼의 리더보드 방식을 런타임에 확인한다.

| type | 지원 플랫폼 | 게임에서 할 일 |
|---|---|---|
| `not_available` | **Playgama.com**, CrazyGames, Poki, Discord 등 | 리더보드 UI 완전 숨김 |
| `in_game` | **Yandex**, Y8, BitQuest | `setScore` 제출 + `getEntries`로 직접 UI 렌더링 |
| `native` | **MSN**, YouTube, Lagged, GameSnacks, JioGames | `setScore`만 호출, 플랫폼이 UI 담당 |
| `native_popup` | **Facebook** | `setScore` + `showNativePopup` 호출 |

> **핵심**: Playgama.com 자체는 `not_available`이다.  
> 리더보드가 살아있는 파트너 플랫폼은 Yandex, MSN, Y8, Facebook, YouTube다.  
> 코드는 하나로 작성하고 타입에 따라 분기한다.

---

## 3. 리더보드 설계

SameGame은 난이도별 점수 구조이므로 리더보드 3개로 설계한다.

```
high_score          전체 최고 점수 (isMain: true)
                    → Easy·Normal·Hard 구분 없이 역대 최고
                    → 플랫폼 대표 리더보드

high_score_normal   Normal 난이도 최고 점수
                    → 중급 플레이어 타깃

high_score_hard     Hard 난이도 최고 점수
                    → 하드코어 플레이어 타깃, 고참여도 유저 형성
```

**점수 제출 타이밍:**

```
세션 종료 / 게임 오버 → submitScore(finalScore, difficulty)
레벨 클리어마다       → (제출 안 함, 세션 종료 시 한 번만)
per-frame, per-tile   → 절대 제출 금지 (플랫폼 레이트 리밋)
```

---

## 4. Config 파일 설정

`playgama-bridge-config.json`의 `leaderboards` 배열에 추가한다.

```json
{
  "platforms": {
    "game_distribution": { "gameId": "" },
    "msn":               { "gameId": "" }
  },
  "advertisement": {
    "interstitial": {
      "preloadOnStart": true,
      "placements": [
        { "id": "level_complete" },
        { "id": "game_over" }
      ]
    },
    "rewarded": {
      "preloadOnStart": true,
      "placements": [{ "id": "hint_reward" }]
    },
    "banner": {
      "placements": [{ "id": "main_banner" }]
    }
  },
  "leaderboards": [
    {
      "id": "high_score",
      "isMain": true,
      "yandex": "samegame_high_score"
    },
    {
      "id": "high_score_normal",
      "yandex": "samegame_normal"
    },
    {
      "id": "high_score_hard",
      "yandex": "samegame_hard"
    }
  ],
  "payments": []
}
```

> `yandex` 값은 Yandex 심사 승인 후 발급받은 native ID로 채운다.  
> 리뷰 대기 중에는 `"yandex": ""` 또는 항목 생략 상태로 둬도 무방하다.

---

## 5. 구현 코드

### 5-1. 점수 제출 (타입 분기 포함)

```javascript
// 게임 오버 / 세션 종료 시 호출
// difficulty: 'easy' | 'normal' | 'hard'
async function submitScore(score, difficulty) {
    const lbType = bridge.leaderboards.type;

    // not_available: Playgama.com, CrazyGames 등 — 아무것도 안 함
    if (lbType === 'not_available') return;

    try {
        // 전체 최고 점수 갱신 (공통)
        await bridge.leaderboards.setScore('high_score', score);

        // 난이도별 리더보드 갱신
        if (difficulty === 'normal') {
            await bridge.leaderboards.setScore('high_score_normal', score);
        }
        if (difficulty === 'hard') {
            await bridge.leaderboards.setScore('high_score_hard', score);
        }

        // 타입별 후속 처리
        if (lbType === 'native_popup') {
            // Facebook: 네이티브 팝업 열기
            await bridge.leaderboards.showNativePopup('high_score');
        }

        if (lbType === 'in_game') {
            // Yandex, Y8: getEntries로 데이터 받아 직접 렌더링
            await loadAndRenderLeaderboard('high_score');
        }

        // 'native' (MSN, YouTube 등): setScore만으로 완료

    } catch (e) {
        console.warn('[Leaderboard] submitScore failed:', e);
        // 리더보드 실패가 게임 진행을 막으면 안 됨
    }
}
```

### 5-2. 엔트리 로드 (`in_game` 타입 전용)

```javascript
// bridge.leaderboards.type === 'in_game' 인 경우만 호출
async function loadAndRenderLeaderboard(leaderboardId) {
    try {
        const entries = await bridge.leaderboards.getEntries(leaderboardId);
        // entries: [{ id, name, photo, score, rank }, ...]
        renderLeaderboardOverlay(entries);
    } catch (e) {
        console.warn('[Leaderboard] getEntries failed:', e);
        // 실패 시 UI 없이 게임 오버 화면만 표시
    }
}
```

### 5-3. 게임 오버 흐름에 통합

```javascript
// 기존 게임 오버 핸들러에 추가
async function handleGameOver(finalScore, difficulty) {
    // 1. 광고 표시
    await showInterstitialAd('game_over');

    // 2. 점수 저장 (Bridge Storage)
    await saveProgress();

    // 3. 리더보드 제출 (비동기, 실패해도 게임 오버 화면은 표시)
    submitScore(finalScore, difficulty); // await 없이 fire-and-forget

    // 4. 게임 오버 UI 표시
    showGameOverScreen(finalScore);
}
```

---

## 6. Canvas UI 렌더링

`in_game` 타입 플랫폼(Yandex 등)에서 `getEntries` 데이터로 직접 그린다.

```javascript
function renderLeaderboardOverlay(entries) {
    const top5 = entries.slice(0, 5);

    // 반투명 오버레이
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 타이틀
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏆  TOP SCORES', canvas.width / 2, 70);

    // 구분선
    ctx.strokeStyle = 'rgba(255,215,0,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 85);
    ctx.lineTo(canvas.width - 60, 85);
    ctx.stroke();

    // 엔트리 목록
    top5.forEach((entry, i) => {
        const y = 130 + i * 52;
        const isCurrentPlayer = entry.rank === 1; // 1위 강조 (필요 시 플레이어 ID 비교)

        ctx.fillStyle = isCurrentPlayer ? '#FFD700' : '#FFFFFF';
        ctx.font = `${isCurrentPlayer ? 'bold ' : ''}20px sans-serif`;

        // 순위
        ctx.textAlign = 'left';
        ctx.fillText(`${entry.rank}.`, 70, y);

        // 이름 (최대 12자 truncate)
        const name = (entry.name || 'Anonymous').slice(0, 12);
        ctx.fillText(name, 110, y);

        // 점수
        ctx.textAlign = 'right';
        ctx.fillText(Number(entry.score).toLocaleString(), canvas.width - 70, y);
    });

    // 닫기 안내
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('탭하여 계속', canvas.width / 2, canvas.height - 30);

    ctx.restore();

    // 클릭/탭으로 오버레이 닫기
    canvas.addEventListener('pointerdown', closeLeaderboardOverlay, { once: true });
}

function closeLeaderboardOverlay() {
    showGameOverScreen(); // 일반 게임 오버 화면으로 전환
}
```

---

## 7. 승인 후 활성화 절차

코드는 이미 완성된 상태이므로 config 값만 채우면 된다.

```
1. Yandex Games 심사 통과
   → Yandex 개발자 콘솔에서 leaderboard ID 발급
   → config의 "yandex" 값 업데이트:
      "yandex": "실제_발급된_ID"

2. MSN Games 심사 통과
   → platforms.msn.gameId 업데이트

3. Y8 심사 통과
   → platforms.y8.gameId 업데이트

4. Facebook Instant Games 심사 통과
   → native_popup 흐름 자동 활성화 (코드 수정 없음)

→ 수정된 config를 포함한 zip 재업로드
→ 리더보드 즉시 활성화
```

---

## 8. 자주 하는 실수

| 실수 | 해결 |
|---|---|
| `not_available`인데 UI 표시 | `bridge.leaderboards.type` 체크 후 조건부 렌더링 |
| `getEntries`를 모든 타입에서 호출 | `in_game` 타입일 때만 호출, `native`·`native_popup`에서는 작동 안 함 |
| per-tile 클리어마다 `setScore` 호출 | 세션 종료(게임 오버) 시 1회만 호출 |
| 리더보드 실패로 게임 오버 화면 막힘 | `submitScore`는 `await` 없이 fire-and-forget |
| Yandex ID 미설정 | config `"yandex"` 값 빈 문자열이면 Yandex에서 리더보드 비활성화 |
| `showNativePopup` 타이밍 | `setScore` 완료 후 호출해야 최신 점수 반영 |

---

## 참고 링크

| 자료 | URL |
|---|---|
| Leaderboards API 공식 문서 | https://wiki.playgama.com/playgama/bridge-sdk/api/leaderboards.md |
| Config Editor | https://playgama.github.io/bridge-config-editor/ |
| Bridge SDK 셋업 | https://wiki.playgama.com/playgama/sdk/setup |
| 플랫폼 지원 목록 | https://wiki.playgama.com/playgama/sdk/getting-started |
