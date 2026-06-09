# Version Note

## v1.1.0 — feature/hint-system (2026-06-08)

최적 그룹 하이라이트(힌트) 기능 추가. STANDALONE 단일 파일 유지, 외부 라이브러리·빌드툴 도입 없음.

### 추가 (Added)

- **HintSystem 클래스** (`src/samegame.html`)
  - `findOptimalGroup()` — 현재 보드에서 가장 점수 높은 제거 가능 그룹 1개 반환. `GameLogic.getGroup()`(순수 flood-fill)과 전역 `scoreFormula(n)=n·(n-1)·10` 재사용. `moveCount` 기반 캐싱(같은 보드면 재계산 생략, "그룹 없음" 결과도 캐싱).
  - `getAllGroups()` — 제거 가능 그룹 전체를 점수 내림차순으로 enumerate (디버깅용).
  - `invalidate()` — 캐시 무효화.
- **Renderer.renderHint(ctx, ts)**
  - 최적 그룹 셀에 펄스 글로우 테두리 렌더. `alpha = 0.7 + 0.3·sin(hintTime·2π/0.8)` → 알파 0.4~1.0, 주기 800ms.
  - 시안(`#7df9ff`) shadowBlur 글로우 + 흰 테두리. 타일/애니메이션 렌더 직후·board border 직전(shake translate 공간 내)에서 호출 → 타일 정렬 일치.
  - 펄스 시간은 `Renderer.update(dt)`에서 `hintTime = (hintTime + dt) % 0.8`로 누적 — **requestAnimationFrame 프레임 단위, setTimeout/setInterval 미사용**.
- **HUD 💡 힌트 토글**
  - footer에 `💡` 버튼(`#btn-hint`) + 키보드 단축키 `H`.
  - 상태는 `localStorage['hint_enabled']`에 영속(기본 OFF).
- **난이도별 차등 정책** (`applyHintPolicy()`)
  - EASY: 레벨 시작 시 자동 ON (버튼 표시)
  - NORMAL: 기본 OFF, 토글 가능 (영속 선호 유지)
  - HARD: 완전 비활성 — 버튼 hide(`display:none`), 토글/`H` no-op (도전 모드)

### 동작 (Behavior)

- move(그룹 제거)·undo 직후 힌트 자동 재계산(`refreshHint()`).
- 튜토리얼 진행 중에는 힌트 미표시(튜토리얼 우선). GAME OVER·레벨 종료 시 힌트 클리어.

### 변경 영향 (Impact)

- 수정 파일: `src/samegame.html` 1건 (약 +162 LOC).
- 기존 로직 변경 0줄: GameLogic / SoundManager / TutorialManager / NetworkManager / ParticleSystem / FloatText 내부 무수정.
- 힌트 OFF 기본값(NORMAL) → 기존 플레이 흐름과 동일.
- `dist/index.html` 미변경 (별도 빌드 단계 필요 시 수동 반영).

### 검증 (Verification)

- `<script>` 블록 추출 후 `node --check` 통과 (구문 정합성).
- 수동 검증: 브라우저로 `src/samegame.html` 열고 EASY 자동 ON / 그룹 제거 시 힌트 이동 / 💡·H 토글 / NORMAL 토글 / HARD 버튼 hide / 튜토리얼 중 미표시 확인.

---

## v1.0.x — sound & tutorial (이전)

- SoundManager — Web Audio API 8-bit 합성 효과음 추가.
- 튜토리얼 버그 수정.

## v1.0.0 — initial release

- HTML5 Canvas SameGame 퍼즐. GameLogic(순수 상태머신) / Renderer / TutorialManager / NetworkManager(스텁) / ParticleSystem.
- 난이도 3종(EASY 10×10·3색 / NORMAL 15×11·4색 / HARD 16×12·5색).
