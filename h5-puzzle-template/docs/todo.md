# 새 퍼즐게임 구현 TODO

이 파일은 템플릿을 실제 게임으로 만들기 위한 단계별 체크리스트입니다.
**순서대로 진행**하면 빌드→테스트→배포 흐름이 막히지 않습니다.

---

## Phase 1 — 프로젝트 기본 설정

- [ ] **1-1** `index.html` `<title>` 태그를 게임 이름으로 변경
- [ ] **1-2** `index.html` `#game-title` 텍스트를 게임 이름으로 변경
- [ ] **1-3** `STORAGE_KEY_BEST`, `STORAGE_KEY_PLAYER` 상수를 게임 이름 기반 키로 변경
  - 예: `puzzle_best` → `mygame_best`
- [ ] **1-4** 로컬 HTTP 서버로 접속 확인
  ```
  cd src
  python -m http.server 3000
  # → http://localhost:3000/index.html
  ```

---

## Phase 2 — 캔버스 & 렌더링

- [ ] **2-1** `resizeCanvas()`에서 캔버스 종횡비 설정
  - 정사각형: `width = height = size`
  - 세로형: `width = size * 0.6`, `height = size`
- [ ] **2-2** `render()` 함수에 게임 보드/타일 그리기 구현
  - CSS 변수 `--c0` ~ `--c5` 색상 활용 가능
  - `ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--c0')`
- [ ] **2-3** `loop()` 안에 프레임별 업데이트 로직 추가 (있으면)

---

## Phase 3 — 게임 로직

- [ ] **3-1** 게임 상태 변수 정의 (보드, 점수, 레벨 등)
- [ ] **3-2** `startGame()` 내 게임 초기화 코드 작성
- [ ] **3-3** canvas `click` / `touchstart` 핸들러에 입력 처리 구현
- [ ] **3-4** 게임 종료 조건 판정 후 `endGame()` 호출
- [ ] **3-5** `updateStats()`에 표시할 스탯 추가 (레벨, 콤보 등)

---

## Phase 4 — UI / 오버레이

- [ ] **4-1** `#ol-start` 오버레이 — 게임 설명 텍스트 작성
- [ ] **4-2** `#ol-gameover` 오버레이 — 점수 외 추가 정보 레이아웃 (베스트, 랭킹 등)
- [ ] **4-3** 필요한 추가 오버레이 작성 (레벨 클리어, 일시정지 등)
- [ ] **4-4** 모바일 터치 UX 확인 (버튼 크기 44px 이상, 탭 영역 충분한지)

---

## Phase 5 — 사운드

- [ ] **5-1** `sound.js`의 `playRemove()`, `playCombo()`, `playClear()`, `playGameOver()` 음표 배열 교체
  - 음표 형식: `{ freq: 440, dur: 0.1, delay: 0 }`
  - waveform: `'square'` (8bit), `'sawtooth'` (harsh), `'triangle'` (soft)
- [ ] **5-2** `startGame()` / `endGame()` / 입력 처리에서 사운드 호출 연결
- [ ] **5-3** 뮤트 버튼 UI 추가 (선택)
  - `sound.toggleMute()` 호출

---

## Phase 6 — 광고 연동 (Playgama)

- [ ] **6-1** `playgama-bridge-config.json`에서 rewarded placement ID 확인/추가
  - 기본 제공: `retry_reward`, `level_complete`(inter)
  - 추가 필요 시: `{ "id": "YOUR_PLACEMENT" }` 추가
- [ ] **6-2** 리워드 버튼 구현 (재도전, 보너스 등)
  - 패턴: `docs/ad-patterns.md` 참고
- [ ] **6-3** 게임오버/레벨 전환 시 인터스티셜 호출
  - `await SG.CG.requestMidgameAd();` — `endGame()` 또는 `restartGame()` 안
- [ ] **6-4** 배너 광고 show/hide 타이밍 확인
  - 유휴 오버레이 진입: `SG.CG.showBanner()`
  - 리워드 광고 요청 직전: `SG.CG.hideBanner()`
- [ ] **6-5** `SG.PG._onAudioStateChanged` 핸들러에 실제 뮤트 로직 연결
- [ ] **6-6** 로컬 테스트: `?dev` 파라미터로 DEV BAR 확인

---

## Phase 7 — Firebase 리더보드 (선택)

- [ ] **7-1** `firebase-config.js`에 실제 Firebase 프로젝트 키 입력
- [ ] **7-2** `firebase.js`의 컬렉션명을 게임에 맞게 수정
  - `puzzle_scores` → `mygame_scores`
  - `puzzle_lb` → `mygame_lb`
- [ ] **7-3** Firestore 보안 규칙 설정 (`docs/firebase-setup.md` 참고)
- [ ] **7-4** `endGame()`에서 `SG.FB.submitScore()` 호출 파라미터 확인
- [ ] **7-5** 리더보드 UI 오버레이에 `SG.FB.fetchLeaderboard()` 결과 표시

---

## Phase 8 — Playgama 배포

- [ ] **8-1** `playgama.js`의 `_HOF_LB_ID` 를 Playgama 등록 후 발급받은 리더보드 ID로 교체
- [ ] **8-2** `playgama-bridge-config.json`의 `leaderboards[0].id` 동일하게 교체
- [ ] **8-3** zip 생성 (`src/` 폴더의 모든 파일을 flat 루트로 압축)
  ```powershell
  $files = Get-ChildItem -Path src -File | ForEach-Object { $_.FullName }
  Compress-Archive -Path $files -DestinationPath game.zip
  ```
- [ ] **8-4** Playgama QA Tool 업로드 후 체크리스트 확인
  - `game_ready` 수신
  - 인터스티셜 동작
  - 리워드 granted / skipped 시나리오
  - 배너 show/hide
- [ ] **8-5** 플랫폼 제출

---

## 참고

- 광고 연동 상세: `docs/ad-patterns.md`
- Firebase 설정: `docs/firebase-setup.md`
- 디자인 토큰: `docs/design-tokens.md`
- Playgama 광고 스킬: `.claude/skills/playgama-ad-integration/SKILL.md`
