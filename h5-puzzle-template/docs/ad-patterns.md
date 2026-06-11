# 광고 연동 패턴

SameGame Grid Protocol에서 검증된 Playgama 광고 패턴 레퍼런스.

---

## 아키텍처 요약

```
게임 코드 (index.html)
  └─ SG.CG.requestRewardedAd()   ← 항상 이 인터페이스만 호출
       ├─ CrazyGames 환경    → crazygames.js 처리
       └─ Playgama 환경     → playgama.js가 Bridge로 패치
```

SDK가 없으면 모든 `SG.CG.*` 호출은 no-op 또는 `{granted:false}` 반환.

---

## 정상 리워드 광고 상태 흐름

```
showRewarded() 호출
  → state: loading
  → state: opened
  → state: rewarded   ← granted = true 설정
  → state: closed     ← finish() → resolve({ granted: true })
```

사용자가 중간에 닫으면:
```
  → state: loading → opened → closed (rewarded 없음)
  → granted = false → resolve({ granted: false })
```

---

## 리워드 버튼 구현 패턴

```javascript
async function requestReward(btn, placementId, grantFn) {
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Loading…'; }

  if (SG.CG.isAvailable()) {
    SG.CG.hideBanner();
    const res = await SG.CG.requestRewardedAd(placementId);

    if (res && res.granted) {
      grantFn();        // 보상 지급
      return;
    }

    // granted:false = 사용자 취소 → 버튼 복원만 (폴백 모달 없음)
    SG.CG.showBanner();
    if (btn) { btn.disabled = false; btn.textContent = '📺 광고 시청'; }
    return;
  }

  // SDK 없음(로컬/기타 플랫폼) → 폴백 모달
  showFallbackModal(grantFn);
}
```

**핵심 규칙**:
- `isAvailable() === true` + `granted: false` → **버튼 복원만** (사용자 취소)
- `isAvailable() === false` → **폴백 모달** (SDK 없음)
- 두 경우를 반드시 구분할 것

---

## 인터스티셜 (미드게임) 패턴

```javascript
async function onLevelEnd() {
  SG.CG.gameplayStop();
  await SG.CG.requestMidgameAd();   // 광고 닫힐 때까지 대기
  showLevelClearOverlay(score);      // 이후 UI 표시
}
```

`requestMidgameAd()`는 SDK 없으면 즉시 resolve되므로 항상 await해도 안전.

---

## 배너 광고 타이밍

| 시점 | 호출 |
|------|------|
| START / GAMEOVER 오버레이 진입 | `SG.CG.showBanner()` |
| 리워드 광고 요청 직전 | `SG.CG.hideBanner()` |
| 리워드 완료 / 취소 후 | `SG.CG.showBanner()` |
| 게임플레이 시작 시 | `SG.CG.hideBanner()` (선택) |

---

## 폴백 모달 (SDK 없는 환경)

SDK가 없는 환경(로컬, 기타 플랫폼)에서도 광고 버튼이 동작하도록 자체 모달을 제공.
타이머 방식으로 일정 시간 후 보상 지급.

```javascript
// 기본 패턴 (index.html에 구현)
function showFallbackModal(grantCallback) {
  const modal = document.getElementById('ad-modal');
  modal.classList.remove('hidden');
  // 5~30초 카운트다운 후 grantCallback() 호출
}
```

자세한 구현은 SameGame Grid Protocol `src/index.html`의 `_startMockAd()` 참고.

---

## placement ID 관리

`playgama-bridge-config.json`에 사용할 placement를 선언해야 QA Tool이 인식한다.

```json
{
  "advertisement": {
    "rewarded": {
      "placements": [
        { "id": "retry_reward"  },
        { "id": "bonus_score"   },
        { "id": "continue_game" }
      ]
    }
  }
}
```

게임 코드에서는 ID 문자열로 직접 호출:
```javascript
SG.CG.requestRewardedAd('bonus_score')
```

---

## QA Tool 테스트 시나리오

| 시나리오 | QA Tool 조작 | 기대 결과 |
|----------|-------------|----------|
| 광고 시청 완료 | `rewarded` → `closed` 주입 | `granted: true` → 보상 지급 |
| 광고 건너뜀 | `closed`만 주입 | `granted: false` → 버튼 복원 |
| 광고 로드 실패 | 아무것도 안 함 → 15초 | 타임아웃 → `granted: false` → 버튼 복원 |
| 인터스티셜 | `closed` 주입 | 게임 정상 진행 |

---

## 자주 하는 실수

### ❌ isAvailable() 체크로 버튼 숨기기

```javascript
// ❌ SDK 없으면 버튼이 항상 숨겨짐
btn.style.display = SG.CG.isAvailable() ? 'block' : 'none';
```

버튼은 항상 표시하고, SDK 체크는 `requestRewardedAd()` 내부에서 처리.

### ❌ granted:false 시 폴백 모달 진입

```javascript
// ❌ 사용자 취소 시에도 모달이 뜸
if (SG.CG.isAvailable()) {
  const res = await SG.CG.requestRewardedAd();
  if (res.granted) { grantFn(); return; }
  // granted:false → 폴백 모달로 fall-through ← BUG
}
showFallbackModal();
```

### ✅ 올바른 패턴

```javascript
if (SG.CG.isAvailable()) {
  const res = await SG.CG.requestRewardedAd();
  if (res.granted) { grantFn(); return; }
  restoreButton();  // 사용자 취소 → 버튼 복원만
  return;           // ← 반드시 return
}
showFallbackModal(); // SDK 없을 때만 도달
```
