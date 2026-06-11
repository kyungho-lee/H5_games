# Neon Drift — 아키텍처 & TDD 문서

> 상태: Draft v1.0 · 작성일 2026-06-11 · 짝 문서: [neon-drift-spec.md](./neon-drift-spec.md)
> 범위: 모듈 구조, 인터페이스, 데이터 플로우, 알고리즘, 에러 처리, 테스트 전략(TDD).

---

## 1. 설계 원칙

1. **순수 코어 분리**: 게임 규칙(slide/merge/chain/win/over)은 DOM·Canvas·SDK를 모르는 순수 함수. → 단위 테스트 가능, 추론 용이.
2. **결정론**: 코어는 `Date.now()`/`Math.random()` 미사용. 무작위성은 **RNG 함수 주입**으로만 들어옴. → 같은 seed = 같은 결과 = 재현 가능한 테스트.
3. **단방향 데이터 플로우**: 코어가 `{grid, moves[], merges[], chain, scoreGained, spawned}`를 반환 → 렌더러는 이를 받아 트윈/파티클만 담당. 렌더러→코어 역방향 의존 없음.
4. **무수정 재사용**: 기존 `playgama.js`/`firebase.js`/`notify.js`/`sound.js`는 호출만.

---

## 2. 모듈 구조

```
src/
  index.html        ─ 셸: 부트 IIFE, 오버레이, 방향 버튼, 입력→코어 연결, SG.* 호출
  neon-drift.js     ─ ⭐ 순수 게임 코어 (의존성 0)
  grid-render.js    ─ Canvas 렌더 + 슬라이드 트윈 (lerp 60fps), dev 숫자 표시
  particles.js      ─ ParticleSystem + FloatText (SameGame Grid Protocol에서 포팅)
  palette.js        ─ COLOR_PALETTE(포팅) + LEVELS(신규 작성, 3→6색 곡선)
  (기존, 무수정) playgama.js · crazygames.js · firebase.js · notify.js · sound.js
test/
  neon-drift.test.js ─ node:test 단위 테스트
package.json         ─ "test": "node --test" 1줄
```

### 책임 경계 요약

| 모듈 | 한다 | 안 한다 | 의존 |
|------|------|---------|------|
| `neon-drift.js` | 격자 규칙, 슬라이드, 병합, 체인, 점수, 승/패, 스폰(RNG 주입) | 렌더, 입력, 광고, 시간/난수 | 없음 |
| `grid-render.js` | Canvas 그리기, moves[] 트윈, dev 숫자 | 게임 규칙 판정 | `palette.js`, `particles.js` |
| `particles.js` | 파티클·FloatText 수명주기 | 게임 규칙 | 없음(Canvas ctx만) |
| `palette.js` | 색 토큰·난이도 테이블 | 로직 | 없음 |
| `index.html` | 부트·상태머신·입력·광고·영속성 | 격자 알고리즘 내부 | 위 전부 + SG.* |

---

## 3. 핵심 인터페이스 (neon-drift.js)

```js
// 타일: { color: number, size: number(2^k) } | null(빈칸)
// grid: Tile[8][8]  (row-major)

// 단일 라인(1차원) 슬라이드 — 4방향 로직의 단일 진실 공급원
// 반환: { line: Tile[], merges: [{index, size}], moved: bool }
slideLine(line)               // line: 길이 8의 Tile|null 배열, "왼쪽으로 압축" 기준

// 전체 격자 1회 밀기 (순수)
// dir: 'up'|'down'|'left'|'right'
// rng: () => number in [0,1) — 주입
// 반환: {
//   grid:        Tile[8][8],           // 결과 격자
//   moves:       [{from:[r,c], to:[r,c]}],   // 트윈용 타일 이동 경로
//   merges:      [{at:[r,c], size}],   // 파티클/FloatText 위치
//   chain:       number,               // 총 병합 수
//   scoreGained: number,
//   moved:       bool,                 // 변화 여부
//   won:         bool,                 // 스폰 이전 격자의 단색 판정 결과
//   spawned:     {at:[r,c], color} | null
// }
applyMove(grid, dir, rng)

chainMultiplier(chain)        // 1→1,2→2,3→3,4→4,>=5→5
spawnTile(grid, rng)          // 최다색 편향 가중 랜덤 → {at, color, size:1} | null(빈칸 없음)
                              //   distinct color ≤ 2 이면 주류색 고정(단색 임박 클램프)
checkWin(grid)                // distinct color === 1
checkGameOver(grid)           // 빈칸 0 && canMove()===false
canMove(grid)                 // 어느 방향이든 moved 가능?
```

회전 보조(내부): `applyMove`는 dir에 따라 grid를 "왼쪽 밀기" 기준으로 회전/반전 → 각 행에 `slideLine` 적용 → 역변환. 이로써 4방향이 `slideLine` 한 함수로 수렴.

### 3.1 좌표 역변환표 (라인 인덱스 → 격자 [r,c])

`slideLine`은 길이 8 라인의 좌측 패킹 인덱스 `j`(0=가장 왼쪽)를 반환한다. dir별로 `(라인번호 k, 인덱스 j)`를 원래 격자 `[r,c]`로 매핑한다. N=8.

| dir | 라인 = | 라인번호 k | 라인 진행방향(j 증가) | 역매핑 [r,c] |
|-----|--------|-----------|--------------------|-------------|
| `left`  | 각 행 | 행 r       | 왼→오 (열 0→7)   | `[k, j]` |
| `right` | 각 행(반전) | 행 r  | 오→왼 (열 7→0)   | `[k, N-1-j]` |
| `up`    | 각 열 | 열 c       | 위→아래 (행 0→7) | `[j, k]` |
| `down`  | 각 열(반전) | 열 c  | 아래→위 (행 7→0) | `[N-1-j, k]` |

`moves[]`의 `from`/`to`, `merges[]`의 `at`, `spawned.at`는 모두 이 표로 원래 방향 좌표로 환산해 반환한다. (테스트 케이스 9·20이 이 환산을 구체 좌표로 검증)

### 3.2 재사용 자원 실제 인터페이스 (검증됨)

자매 프로젝트 `samegame-grid-protocol/src/`에서 포팅. **인터페이스가 컨셉 가정과 다르므로 주의**:

- **`COLOR_PALETTE`** (render.js): hex 문자열이 아니라 **객체 배열** `[{fill, glow, dark}, …]` 6개. 캔버스에서 `ctx.fillStyle = COLOR_PALETTE[i].fill` 형태로 사용. `--c0..--c5` CSS 토큰(버튼용)과 **별개 색 소스**이므로 시각적으로 일치시킬 것.
- **`ParticleSystem.emit(x, y, colorObj, count)`**: 색 객체를 받음. 내부 `Math.random()` 사용 → **렌더 전용**(코어로 새지 않게 격리). FloatText: `new FloatText(x, y, text, color, scale)`.
- **`DIFFICULTIES`** (core.js): `{cols,rows,colors,minGroup,bias}` 형태의 **고정 보드 SameGame** 모델. Neon Drift는 8×8 고정 보드라 `cols/rows/minGroup`이 무의미 → **그대로 포팅 불가**. 테이블 대신 **수식 기반 `difficulty(level)` 순수 함수**로 신규 작성한다(§3.3).

### 3.3 난이도 — 수식 기반 `difficulty(level)`

레벨 테이블 대신 `level`(0부터)을 입력받아 난이도 팩터를 산출하는 **순수 함수**. 무한 레벨 확장 가능하고 코어의 결정론·테스트성과 일치.

```js
// difficulty(level) → { colors, bias, startBlocks, clampThreshold }
function difficulty(level) {
  return {
    colors:         Math.min(3 + level, 6),         // 활성 색상 수 3→6, max 6 클램프 (주 난이도 축)
    bias:           Math.max(0.6 - level * 0.05, 0.35), // 스폰 최다색 편향: 0.6→…→하한 0.35 (낮을수록 어려움)
    startBlocks:    Math.min(8 + level * 2, 16),    // 시작 블록 수 8→16
    clampThreshold: level >= 2 ? 1 : 2,             // 단색 임박 주류색 고정 임계(distinct color ≤ N)
  };
}
```

| 팩터 | 의미 | level 0 | level 1 | level 2 | level ≥3 |
|------|------|---------|---------|---------|----------|
| `colors` | 활성 색상 수(주 축) | 3 | 4 | 5 | 6 |
| `bias` | 스폰 최다색 편향(↓=어려움) | 0.60 | 0.55 | 0.50 | →0.35 |
| `startBlocks` | 시작 블록 수 | 8 | 10 | 12 | →16 |
| `clampThreshold` | 단색 클램프 임계(§FR-6) | 2 | 2 | 1 | 1 |

- 위 계수(0.05, ×2, 하한 0.35 등)는 **플레이테스트 튜닝 대상**이지만, 함수 형태는 고정.
- `spawnTile`은 `difficulty(level).bias`/`clampThreshold`를 인자로 받아 결정론 유지(난수는 여전히 주입 rng).
- 테스트(케이스 22 확장): `difficulty(0).colors===3`, `difficulty(3).colors===6`, `difficulty(10).colors===6`(클램프), `bias` 단조 감소+하한.

---

## 4. 데이터 플로우 — 한 번의 밀기

```
[입력 ↑↓←→]
   │  index.html: isAnimating 게이트 확인(잠겨 있으면 무시)
   ▼
applyMove(grid, dir, rng)            ← 순수 코어
   │  1. dir→회전/반전 (왼쪽 기준 정규화)
   │  2. 각 행 slideLine: compact → 인접 동색동size 병합(재병합 금지) → compact
   │  3. 역변환, moves[]/merges[] 좌표를 원래 방향으로 매핑 (§3.1 역변환표)
   │  4. chain=Σmerges, scoreGained=Σsize×chainMultiplier
   │  5. ⚠ 승리 판정을 스폰 *이전* 격자에서 수행(checkWin) → won 기록
   │  6. moved && !won 이면 spawnTile(rng)
   │       단, distinct color ≤ 2 이면 주류색 고정 스폰(단색 임박 클램프)
   │  7. {grid, moves, merges, chain, score, spawned, moved, won}
   ▼
index.html 상태 갱신 (score, level, chain UI)
   │  isAnimating=true
   ▼
grid-render.js: moves[] 트윈(50–80ms) → merges[]에 ParticleSystem/FloatText
   │  트윈 완료 콜백
   ▼
isAnimating=false
   │
   ▼
승/패 판정: result.won → WIN  ·  checkGameOver(grid) → GAMEOVER
레벨업 조건 → requestMidgameAd() 후 색상 수 +1
```

---

## 5. 슬라이드/병합 알고리즘 (slideLine 의사코드)

```
slideLine(line):
    tiles = line.filter(t => t != null)        # 1. 압축
    out = []
    i = 0
    while i < tiles.length:
        if i+1 < tiles.length
           and tiles[i].color == tiles[i+1].color
           and tiles[i].size  == tiles[i+1].size:
            out.push({color: tiles[i].color, size: tiles[i].size * 2})  # 병합·승급
            merges.push({index: out.length-1, size: tiles[i].size*2})
            i += 2                              # 두 타일 소비 → 재병합 금지
        else:
            out.push(tiles[i]); i += 1
    pad out with null to length 8               # 2. 재압축(이미 left-packed)
    # ⚠ moved는 반드시 원소별 비교 — JS에서 (out != line)은 배열 참조 비교라 항상 true!
    moved = not sameLine(out, line)             # 각 셀의 {color,size}/null을 인덱스별 대조
    return {line: out, merges, moved}

# sameLine(a, b): 길이 8 두 라인을 셀 단위로 비교
#   둘 다 null이면 같음; 한쪽만 null이면 다름; 둘 다 타일이면 color&&size 일치 여부
```

핵심:
- `i += 2`로 한 번 병합한 페어를 건너뛰어 **같은 밀기 내 재병합을 구조적으로 차단**.
- **`moved` 판정은 원소별 비교 필수**. `out != line`(참조 비교)은 항상 true가 되어 FR-5 스폰 게이트(케이스 4·8·10)를 깨뜨린다. 위 `sameLine` 헬퍼로 인덱스별 `{color,size}`/null을 대조한다.

---

## 6. 상태 머신 & 광고 (index.html)

```
BOOT ─SDK init→ READY ─START→ PLAYING ─┬─ WIN ──→ 레벨업(인터스티셜) → PLAYING
                                        └─ GAMEOVER ─리워드(블록2제거)→ PLAYING
                                                     └거절→ 점수제출 → 오버레이
```

광고 규칙(ad-patterns.md):
- 리워드 전 `hideBanner()`, 후 `showBanner()`.
- `isAvailable() && !granted` = 유저 취소 → 버튼 복구만.
- SDK 없음 → 폴백 보상 직접 지급(모달 X).

---

## 7. 에러 처리 & 불변식

| 상황 | 처리 |
|------|------|
| 트윈 중 추가 입력 | `isAnimating` 게이트로 무시 (1푸시=1애니) |
| 광고 실패/취소 | 버튼 복구, 게임 비차단 |
| 점수 제출 실패 | `SG.Notify.error('FB_SUBMIT', {retry})` — 비차단 |
| Undo 불가 | 스냅샷 없음/사용됨 → 버튼 비활성 |
| 격자 손상(dev) | `assertGridValid`: size는 2^k, color 0..활성수, 타일≤64. 위반 시 console.error (프로덕션 no-op) |

---

## 8. 테스트 전략 (TDD)

### 8.1 접근
- 대상: `neon-drift.js`의 순수·결정론 함수.
- 러너: **`node:test`**(내장, 외부 의존성 0). 실행 `node --test`.
- 방식: 각 케이스 Red(실패 테스트) → Green(구현) → 다음. 격자 표기는 `R1`(color R, size1), `□`(빈칸) 헬퍼로 가독성 확보.

### 8.2 TDD 케이스 명세

`R1`=color R/size 1, `R2`=color R/size 2, `□`=빈칸. 모든 라인은 "왼쪽 밀기" 기준.

| # | 그룹 | 케이스 | 입력 → 기대 |
|---|------|--------|------------|
| 1 | `slideLine` | 단순 압축 | `□ R1 □ □` → `R1 □ □ □`, moved=true |
| 2 | `slideLine` | 동색동크기 병합 | `R1 R1 □ □` → `R2 □ □ □`, merges=1 |
| 3 | `slideLine` | 간격 둔 병합 | `R1 □ R1 □` → `R2 □ □ □` |
| 4 | `slideLine` | 동색 다른크기 비병합 | `R1 R2 □ □` → `R1 R2 □ □`, moved=false |
| 5 | `slideLine` | 다른색 비병합 | `R1 G1 □ □` → `R1 G1 □ □` |
| 6 | `slideLine` | 재병합 금지 | `R1 R1 R1 □` → `R2 R1 □ □` (1병합) |
| 7 | `slideLine` | 4연속 2쌍 | `R1 R1 R1 R1` → `R2 R2 □ □`, merges=2 |
| 8 | `slideLine` | 변화 없음 | `R2 R1 □ □` → `R2 R1 □ □`, moved=false |
| 8b | `slideLine` | 다른크기 선행+병합쌍 | `R2 R1 R1 □` → `R2 R2 □ □`, merges=1 (i-진행 엣지) |
| 9 | `applyMove` | 4방향 회전 좌표 | 워크드 예제 격자로 ↑↓←→ 각각 **구체 [r,c] from/to 단언**(§3.1 역변환 검증) |
| 10 | `applyMove` | moved=false면 스폰 없음 | 변화 없는 밀기 → spawned=null |
| 11 | `applyMove` | moved=true면 스폰 1개 | 변화 있는 밀기 → spawned≠null, size 1 |
| 12 | `chainMultiplier` | 배율 곡선 | 1→1, 2→2, 4→4, 5→5, 7→5 |
| 13 | `applyMove` | 점수 계산 | (R1+R1),(R1+R1) chain2 → (2+2)×2=8 |
| 13b | `applyMove` | 병합 없음 점수 | chain=0 → scoreGained=0 |
| 14 | `spawnTile` | 색상 편향 분포 | seed 고정 시 결정론 **AND** 최다색이 균등분포 대비 과대표집(편향 실재 검증) |
| 14b | `spawnTile` | 단색 임박 클램프 | distinct color≤2 → 신규 타일 반드시 주류색 |
| 15 | `spawnTile` | 빈칸 없음 | 꽉 찬 격자 → null |
| 16 | `checkWin` | 단색 판정 | distinct color==1 → true |
| 17 | `checkWin` | 다색 | distinct color≥2 → false |
| 18 | `applyMove` | 승리=스폰 이전 | 단색 직전 격자 + 마지막 병합 → won=true **AND** spawned=null(스폰 억제) |
| 19 | `checkGameOver` | 꽉 참+이동불가 | 빈칸0 & canMove false → true |
| 20 | `checkGameOver` | 꽉 참+병합가능 | 빈칸0 but 인접 동색동size → false |
| 20b | `canMove` | 세로만 병합가능 | 가로 불가·세로 동색동size → canMove=true(4방향 모두 검사 확인) |
| 21 | `applyMove` | moves[] 좌표 정확 | from→to가 §3.1로 환산된 실제 격자 좌표 |
| 22 | (lifecycle) | 레벨업 색상 증가 | won 처리 → activeColors+1, **max 6 클램프**(6에서 won → 6 유지) |
| 23 | (lifecycle) | Undo 1회 | 스냅샷 복원으로 직전 격자 일치; 2회째 호출 불가/비활성 |

### 8.3 이중 검증
자동 단위 테스트(위) + dev 모드 size 숫자 표시(수동 시각 대조) = 로직 신뢰성 확보. 시각 검증은 "RR□□ → □□R2"(병합) vs "RG□□ → □□RG"(비병합)을 화면에서 즉시 확인.

### 8.4 범위 밖(테스트 안 함)
- Canvas 픽셀 출력, 트윈 애니메이션 타이밍, 광고 SDK 통합(수동 QA Tool).

---

## 9. 구현 순서 권장

1. `palette.js` (색·난이도 테이블)
2. `neon-drift.js` 코어 — TDD 케이스 1→20 순서로 Red/Green
3. `particles.js` 포팅(SameGame)
4. `grid-render.js` 렌더+트윈, dev 숫자 표시
5. `index.html` 상태머신·입력·광고·영속성 연결
6. Playgama QA Tool 배포 검증

---

## 10. 미해결

- 스폰 색상 편향 가중 배수: 프로토타입 플레이테스트로 튜닝.
- chain≥5 와일드카드 병합 규칙(임의 color/size vs size만): 구현 1차 결정 후 케이스 추가.
