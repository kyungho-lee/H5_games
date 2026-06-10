# Hall of Fame Leaderboard — 설계 문서

> 버전 1.0 | 작성일: 2026-06-11
> 대상: endless.html (Hard 모드), Playgama Bridge SDK v1.x
> Public Token: cmq6qfj41018klc0hcbc0qxsl
> 리더보드 ID: samegame-grid-protocol_rank

---

## 1. 요약

Playgama Bridge 리더보드를 Endless Hard 모드 게임오버 시 제출하고,
국가 이모지 + 왕관 휘장을 갖춘 Hall of Fame 풀스크린 오버레이를 표시한다.

---

## 2. 제출 조건

| 조건 | 값 |
|---|---|
| 난이도 | Hard 전용 |
| 트리거 | 게임오버 (`endGame(false)`) |
| 컨티뉴 | 사용 무관 — 최종 `sessionScore` 제출 |
| 최소 점수 | **33,600점** (Hard 레벨 7 예상 누적의 50%) |
| 버튼 노출 | 최소 점수 충족 + `in_game` 타입 플랫폼만 |

---

## 3. 플랫폼 분기

```
bridge.leaderboards.type
  not_available  → setScore 스킵, 버튼 숨김  (Playgama.com, CrazyGames 등)
  in_game        → setScore + getEntries → Hall of Fame UI 렌더  (Yandex, Y8)
  native         → setScore만, 버튼 숨김  (MSN, YouTube 등)
  native_popup   → setScore + showNativePopup, 버튼 숨김  (Facebook)
```

---

## 4. 게임오버 흐름

```
endGame(false)
  → sessionScore += levelScore
  → await SG.CG.requestMidgameAd()        // 인터스티셜
  → if currentDiff === 'hard'
      → SG.PG.leaderboard.submit(sessionScore)  // fire-and-forget
  → showOverlay('gameover', sessionScore)
      → if Hard + score >= 33600 + in_game
          → [🏆 HALL OF FAME] 버튼 표시 (금색)
```

---

## 5. Hall of Fame UI

### 진입 흐름
게임오버 오버레이 → `🏆 HALL OF FAME` 버튼 클릭 → 풀스크린 오버레이

### 레이아웃
```
┌─────────────────────────────────┐
│  ★ HALL OF FAME ★               │  금색 글로우 타이틀
│  GRID PROTOCOL · HARD MODE      │  서브타이틀
├─────────────────────────────────┤
│  👑 #1  🇰🇷 ABCD   128,400      │  금왕관 + 노란 글로우
│  👑 #2  🇯🇵 EFGH    98,200      │  은왕관 + 흰 글로우
│  👑 #3  🇺🇸 IJKL    87,100      │  동왕관 + 주황 글로우
│  ⭐ #4  🇩🇪 MNOP    76,300      │
│  ⭐ #5  🇬🇧 QRST    65,100  ◀ME │  내 순위 accent 색
│  ...                            │
│  ⭐ #10 🇧🇷 UVWX    44,200      │
├─────────────────────────────────┤
│  MY RANK: #5 / 1,203 players    │
│  [ ✕ CLOSE ]                    │
└─────────────────────────────────┘
```

### 휘장 규칙
| 순위 | 이모지 | 글로우 색 |
|---|---|---|
| 1위 | 👑 (금왕관) | `#ffe020` |
| 2위 | 👑 (은왕관) | `#c0c8d8` |
| 3위 | 👑 (동왕관) | `#ff8040` |
| 4~10위 | ⭐ | `#00f5c8` (accent) |

---

## 6. SG.PG.leaderboard 인터페이스 (playgama.js)

```javascript
SG.PG.leaderboard = {
  submit(score),    // bridge.leaderboards.setScore('samegame-grid-protocol_rank', score)
  getEntries(),     // bridge.leaderboards.getEntries('samegame-grid-protocol_rank')
  getType(),        // bridge.leaderboards.type  ('not_available'|'in_game'|'native'|'native_popup')
}
```

- `submit()` / `getEntries()` : Bridge 미초기화 시 silent no-op / null 반환
- `getType()` : Bridge 미초기화 시 `'not_available'` 반환

---

## 7. playgama-bridge-config.json 변경

```json
"leaderboards": [
  {
    "id": "samegame-grid-protocol_rank",
    "isMain": true
  }
]
```

---

## 8. 상수

```javascript
const HOF_MIN_SCORE = 33600;  // Hard 레벨 7 예상 누적의 50%
const HOF_LB_ID     = 'samegame-grid-protocol_rank';
```

---

## 9. 자주 하는 실수

| 실수 | 해결 |
|---|---|
| `not_available`인데 버튼 표시 | `getType() === 'in_game'` 체크 후 조건부 노출 |
| 레벨 클리어마다 제출 | 게임오버(`endGame(false)`) 시만 제출 |
| `getEntries` 실패로 버튼 막힘 | fire-and-forget, 실패 시 버튼 숨김 처리 |
| 최소 점수 미달인데 버튼 노출 | `sessionScore >= HOF_MIN_SCORE` 체크 필수 |
