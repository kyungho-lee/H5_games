# SameGame — Grid Protocol · 융합 아이디어 교차비평 리뷰

- **작성일:** 2026-06-09
- **방식:** 다중 에이전트 워크플로우 (9 agents) — 5 ideator 발산 → 3 critic 교차비평 → 1 synthesizer 수렴
- **산출:** raw concept 25개 → 최종 shortlist 10개
- **채택 결과:** **#1 The Daily Protocol** 선정 → 설계 스펙은 [`docs/superpowers/specs/2026-06-09-daily-protocol-design.md`](superpowers/specs/2026-06-09-daily-protocol-design.md)

> 이 문서는 위 브레인스토밍 세션에서 나온 **모든 아이디어**(채택·탈락 포함)의 상세 기록이다. 향후 다음 기능을 고를 때 재료로 쓴다.

---

## 1. 방법론

| 단계 | 에이전트 | 역할 |
|------|---------|------|
| Diverge | 5 ideator | 렌즈별(genre / mechanic / tech / narrative / format) 각 4~5개 융합 concept 발산 |
| Cross-critique | 3 critic | 전체 풀을 **FUN**(재미·리텐션) / **NOVELTY**(신선도·차별성) / **FIT**(이 코드베이스 적합·노력) 렌즈로 채점 + 교배(hybrid) 제안 |
| Synthesize | 1 lead | 점수·교배·다양성 고려해 10개로 수렴 |

- **제약 조건:** 발산 단계는 제약 없음(서버·AI·AR·블록체인 등 자유). FIT은 탈락 필터가 아니라 노력 주석으로만 사용.
- 점수는 각 1~10. 합산 만점 30.

## 2. 마스터 스코어카드 (raw 25개 전체)

`★` = 최종 10선 채택. 렌즈는 내용 기준 분류.

| # | 아이디어 | 렌즈 | FUN | NOV | FIT | 합 | 결과 |
|---|----------|------|-----|-----|-----|----|------|
| 1 | **The Daily Protocol** | format | 9 | 6 | 9 | **24** | ★ 채택(구현) |
| 2 | **Ghost Race** | format | 8 | 7 | 9 | **24** | ★ |
| 3 | **Grid Protocol: Descent** | genre(로그라이크) | 9 | 6 | 9 | **24** | ★ |
| 4 | Rewind Engine | mechanic(시간) | 7 | 8 | 8 | 23 | ★ |
| 5 | COUNTERMEASURE DUEL | narrative(비대칭) | 7 | 9 | 7 | 23 | ★ |
| 6 | Gravity Atlas | mechanic(회전·중력) | 8 | 7 | 7 | 22 | 탈락 |
| 7 | Bloom (Living Board) | mechanic(오토마타) | 7 | 9 | 6 | 22 | ★ |
| 8 | Combustion Protocol | mechanic(연쇄점화) | 8 | 8 | 5 | 21 | ★ |
| 9 | Color Forge | genre(덱빌더) | 8 | 6 | 7 | 21 | 탈락 |
| 10 | Ascendant Grid | genre(RPG) | 8 | 5 | 8 | 21 | 탈락 |
| 11 | INTRUSION: Live ICE Grid | narrative(능동 적) | 9 | 6 | 6 | 21 | 탈락 |
| 12 | DAEMON.LOG | narrative(추리) | 6 | 8 | 7 | 21 | 탈락 |
| 13 | PROTOCOL ASCENT | narrative(StS 메타) | 9 | 5 | 7 | 21 | 탈락 |
| 14 | One-Hand / Eyes-Free | format(접근성) | 6 | 7 | 8 | 21 | ★ |
| 15 | Protocol Forge | format(에디터) | 8 | 6 | 7 | 21 | ★ |
| 16 | Reactor (Elemental) | mechanic(연금/경제) | 7 | 7 | 6 | 20 | 탈락 |
| 17 | Seed Wars | tech(실시간 멀티) | 8 | 8 | 4 | 20 | 탈락(XL) |
| 18 | THE PUZZLE-BOX ARG | narrative(ARG) | 6 | 8 | 6 | 20 | 탈락 |
| 19 | 60-Second Cascade | format(하이퍼캐주얼) | 8 | 4 | 8 | 20 | 탈락 |
| 20 | Tabletop Protocol (AR) | tech(카메라/AR) | 5 | 9 | 4 | 18 | ★ |
| 21 | Pulse Grid | genre(리듬) | 6 | 6 | 6 | 18 | 탈락 |
| 22 | Tower Protocol | genre(타워디펜스) | 7 | 5 | 5 | 17 | 탈락 |
| 23 | Oracle (LLM) | tech(LLM) | 6 | 7 | 4 | 17 | 탈락(외부 API) |
| 24 | Resonance | tech(오디오반응) | 6 | 5 | 6 | 17 | 탈락 |
| 25 | Hivemind | tech(대규모 협동) | 5 | 8 | 3 | 16 | 탈락(백엔드) |

**관찰**
- **종합 1위 3개(Daily·Ghost·Descent, 각 24)** 가 채택 상위. 단 synthesizer는 점수만으로 뽑지 않고 **다양성**을 강제(아래 §5).
- FIT 최저군(Hivemind 3, Seed Wars/Oracle/Tabletop 4)은 백엔드·외부 API·무거운 렌더 경로 비용. 이 중 Tabletop만 **NOVELTY 9**라 "대담한 한 방"으로 예외 채택.
- 가장 generic(60-Second, NOVELTY 4 / Tower·Ascendant NOVELTY 5)은 탈락.

## 3. 최종 10선 (상세)

### 📦 FORMAT
**#1 The Daily Protocol** · `S` · fun9/nov6/fit9
> Wordle식 매일 동일 시드 1판 + 스포일러 없는 이모지 공유 + 스트릭.
- 동작: `GameLogic._init`의 `Math.random` 2곳(셔플·색선택)을 `mulberry32(dateHash)`로 교체 → 결정적 보드. 1일 1회, undo 제한. `getSnapshot`을 공유스트링으로 인코딩.
- 적합성: 풀 내 **최저노력·최고적합**. PRNG 2곳 교체 + 기존 직렬화. 백엔드 불필요.
- 리스크: 진짜 solver 없으면 PAR는 근사치. 1일1회가 세션을 제약.
- 한 방: 검증된 습관형 리텐션 엔진을 거의 0 비용으로.

**#2 Ghost Race (Async Versus)** · `S` · fun8/nov7/fit9
> 동일 시드 위에서 친구/세계기록의 클릭 replay를 반투명 고스트로 실시간 경주.
- 동작: 모든 런을 `(r,c)+timestamp` 배열로 기록 → 두 번째 `GameLogic`에 `applyInput`으로 재생. 시드 공유라 좌표 스트림이 항상 유효.
- 적합성: 순수·부작용 없는 `applyInput`에 완벽. 고스트는 영상이 아니라 작은 좌표배열. NetworkManager 스텁 실체화 불필요.
- 한 방: 서버 0으로 라이브 상대의 스릴. #1과 합치면 "Daily Ghost".

**#15 Protocol Forge (Creator + Share Codes)** · `L` · fun8/nov6/fit7
> 에디터로 보드 제작 → 내장 solver가 클리어 가능성 인증 + PAR 각인 → 공유 코드.
- 동작: 보드 출처가 랜덤→저작. special 셀(콤보로만 풀리는 잠금, 아무거나 매칭하는 와일드카드). 저장 시 lookahead solver가 클리어 가능 검증·PAR 계산, 불가 레이아웃 거부. `getSnapshot` RLE 직렬화.
- 리스크: 클리어 가능 인증+PAR엔 실제 탐색 solver 필요(조합 폭발 → 휴리스틱 바운딩).
- 한 방: 인증된 PAR 코드 기반 UGC = 자가증식 무한 콘텐츠.

**#14 One-Hand / Eyes-Free Edition** · `M` · fun6/nov7/fit8
> 색맹·한손·스크린리더 대응. 색→글리프+음높이, ARIA 라이브로 그룹/점수 음성 안내.
- 동작: 픽셀클릭 추상화 → 키보드/단일버튼 커서가 보드를 순회, Enter로 `getGroup` 제거. 색마다 글리프+SoundManager 음높이. 커밋 전 그룹 크기·점수를 ARIA로 낭독.
- 적합성: `getGroup`+ARIA, SoundManager 색별 음높이 무료. 단일파일·중간 UI 개편.
- 한 방: 완전 시각장애 플레이 가능한 오디오 SameGame — 윤리적 가치·차별성 높음.

### 🎮 GENRE
**#3 Grid Protocol: Descent (Roguelike)** · `M` · fun9/nov6/fit9
> 보드=던전 층, move 예산=HP, 층 클리어 시 cfg 재생성, relic 드래프트, permadeath.
- 동작: move 예산 클릭마다 감소·큰 그룹에 환급. `BOARD_CLEAR`→새 cfg(+1색/축소). 층 사이 relic 3택1(getGroup 인접/ applyInput 후처리 래핑) — Catalyst/Alchemist/Frugal. 미클리어 `GAME_OVER`=permadeath.
- 적합성: 거의 순수 재사용. 층 전환=cfg 재생성, relic=얇은 래퍼, 예산=카운터 1개.
- 리스크: 퍼즐 로그라이크는 흔함. relic 밸런스 튜닝 부담.
- 한 방: 검증된 "한 판 더" 루프 + 최소 신규코드 대비 최고 숙련 천장.

### ⚙️ MECHANIC (핵심 동사 재발명)
**#8 Combustion Protocol (Chain-Reaction Automata)** · `L` · fun8/nov8/fit5
> 클릭=점화. 불이 tick마다 같은 색 이웃으로 산불처럼 번짐('oil' 색은 아무 이웃이나).
- 동작: `applyInput`이 즉시 제거 대신 'burning' 상태 시드. `step()` tick이 오토마타 전진(인접 동색 점화→ash). 연쇄 길수록 배수↑. burn 정착 후 gravity. `getGroup`=점화 frontier 프리뷰.
- 리스크: 마스터 전까진 운빨처럼 느껴짐 → burn 가독성 필수.
- 한 방: 풀 내 핵심 동사의 가장 신선한 재발명.

**#7 Rewind Engine (Time as a Resource)** · `M` · fun7/nov8/fit8
> undo를 'Chrono' 자원으로. 기존 10-history를 양방향 타임라인으로 일반화, 과거로 분기.
- 동작: history 스택을 플레이헤드 있는 양방향 타임라인으로. 되감기에 time-charge 소모(클리어로 충전). 분기 시 옛 미래는 'ghost target' 점수로 잔존. slow 모드로 cascade 프리뷰.
- 적합성: 기존 10-history + `getSnapshot/applySnapshot`을 직접 일반화. 신규 기술 거의 없음.
- 한 방: 평범한 undo를 '분기하는 인과'로 — 기존 인프라 재활용하며 미답의 프레이밍.

**#7-b(목록 #7) Bloom (Living Board Automata)** · `M` · fun7/nov9/fit6
> 보드가 살아있음. 매 move 후 셀이 번식/사멸(Conway식). 목표가 "다양성 유지"로 역전.
- 동작: gravity 정착 후 `mutate()` tick — 셀이 8이웃 다수색을 확률 p로 채택, 고립 싱글톤 사멸, 빈칸은 3+ 동색 인접 시 발아(재성장). 큰 클리어가 만든 void를 우세색이 메움 → 다양성 유지가 스킬. stability 미터.
- 리스크: 창발 혼돈이 통제불능·답답함 → 강한 온보딩 필요.
- 한 방: 풀에서 가장 이질적. shrink-to-empty를 생태계 가지치기로 역전.

### 🧠 TECH
**#20 Tabletop Protocol (Camera-AR)** · `L` · fun5/nov9/fit4
> 카메라로 현실 표면(레고/사탕/타일)을 색 양자화해 라이브 보드, AR 오버레이로 "현실 지우기".
- 동작: `getUserMedia` 프레임을 cols×rows로 다운샘플·팔레트 양자화 → 시작 보드. 클리어 애니를 라이브 프레임 위 AR 합성. rescan으로 리필.
- 적합성: 보드 포맷이 외부 2D 색배열 수용(TutorialManager 정적보드로 입증). 양자화는 독립 프론트 모듈.
- 리스크: 킬러 데모지만 루프 약함 — 양자화 보드는 좋은 퍼즐을 잘 못 만듦, AR 합성은 무거운 렌더 경로.
- 한 방: 풀 최고 첫인상 훅 — "현실을 지운다"는 그 자체로 데모.

### 🕵️ NARRATIVE
**#5 COUNTERMEASURE DUEL (Hacker vs Sysadmin)** · `M` · fun7/nov9/fit7
> 해커 vs 시스템관리자 비대칭. 짝수 챕터엔 타일을 **놓아** 적의 큰 그룹을 막음.
- 동작: 역방향 모드 추가 — 시스관리자는 클릭으로 `board[r][c]`에 색 배치(예산 제한)해 클러스터 분쇄, 점수=상대를 얼마나 낮게 묶나(=`hasValidMove`). 'breach integrity'가 역할 간 이월.
- 적합성: 역방향 `placeTile()`은 순수로직에 작은 메서드 하나. 시스관리자 성공지표가 곧 기존 `hasValidMove`.
- 리스크: 정적 배치는 지루할 위험 → 진짜 전술적으로 만들어야.
- 한 방: 진짜 기계적 신규성 — 보드 '빌더' 쪽을 플레이하는 SameGame은 거의 없음.

## 4. 탈락 15선 (간략 + 탈락 사유)

### MECHANIC
- **Gravity Atlas** (8/7/7=22) — 4방향 중력·회전으로 더미 재배치. `_applyGravity` 축 파라미터화로 적합도 양호. *탈락: Bloom/Rewind/Combustion이 mechanic 슬롯을 더 신선하게 채움(다양성 컷).*
- **Reactor (Elemental)** (7/7/6=20) — 5색=5원소, 둘레 반응 변환 + 원소 인벤토리/시약. *탈락: 인벤토리·예산 부기가 스내피한 루프를 복잡화.*

### GENRE
- **Color Forge (Deckbuilder)** (8/6/7=21) — 핸드에서 'spell card'로 클릭 변형(Recolor/Bomb/Freeze Gravity). *탈락: 덱빌더 슬롯은 PROTOCOL ASCENT와 중복, 핸드관리가 클릭 흐름 저하.*
- **Ascendant Grid (RPG)** (8/5/8=21) — 색별 XP·스킬트리로 색마다 플레이스타일. *탈락: match-3 RPG는 P&D/E&P로 포화, 초반 구조적 비가시.*
- **Tower Protocol (Tower Defense)** (7/5/5=17) — 부패 타일이 코어로 전진, 그룹 제거로 레인 방어. *탈락: 실시간 tick+push-row 리라이트가 applyInput 턴제 순수성과 충돌.*
- **Pulse Grid (Rhythm)** (6/6/6=18) — 비트 타이밍 윈도우로 Perfect 배수. *탈락: 타이밍이 퍼즐 사고시간과 충돌, 두 게임 stapled.*

### TECH (대부분 백엔드/외부 의존으로 FIT 최저)
- **Seed Wars** (8/8/4=20) — 동일 시드 실시간 미러 대전 + salt 주입. *탈락: 실제 Colyseus 서버 필요(스텁은 noop). XL.*
- **Hivemind** (5/8/3=16) — 단일 거대 보드, vote-to-clear 군중 협동. *탈락: 서버 권위 집계+스케일 인프라, 개인 숙련 희석.*
- **Oracle (LLM)** (6/7/4=17) — 자연어 퍼즐 저작 + 소크라테스식 코치. *탈락: 외부 LLM API·키 관리, STANDALONE 단일파일 파괴.*
- **Resonance (Audio-Reactive)** (6/5/6=17) — FFT 비트 클록, 다운비트 클리어 배수. *탈락: Pulse Grid와 중복, 신선도가 주로 미적.*

### NARRATIVE
- **INTRUSION: Live ICE Grid** (9/6/6=21) — 능동 적 daemon이 수 사이 보드를 역변이, exploit 경제. *탈락: 사실상 Tower/로그라이크의 사이버펑크 리스킨(novelty 낮음). Descent로 대표.*
- **PROTOCOL ASCENT** (9/5/7=21) — StS식 노드맵·팩션·영속 언락. *탈락: Descent와 거의 동형(StS-clone), 다양성 위해 한 개만.*
- **DAEMON.LOG** (6/8/7=21) — 클리어 순서가 스테가노그래픽 로그·분기 서사. *탈락: 서사가 일회성, 리플레이 적음.*
- **THE PUZZLE-BOX ARG** (6/8/6=20) — 특정 모양 클리어가 glyph 방출, 패스프레이즈로 히든 보드. *탈락: 하드코어 소수 취향, 일부러 비최적 플레이 강요가 다수를 좌절.*

### FORMAT
- **60-Second Cascade** (8/4/8=20) — 리필+60초 타이머 하이퍼캐주얼. *탈락: 풀에서 가장 generic(novelty 4), 깊이 천장 낮음.*

## 5. Synthesizer의 다양성 논리

> 점수 상위 클러스터(로그라이크 트리오 Descent/ASCENT/INTRUSION)에 몰지 않고 **5개 카테고리 전부**에 분산.

- **FORMAT 3+1**: Daily·Ghost·Forge — 최저노력/최고적합, 셋이 **공통 solver + 시드 PRNG + getSnapshot** 공유. One-Hand는 다른 종류의 format(접근성).
- **GENRE 1**: Descent — 로그라이크 클러스터 대표로 최고적합·최소스코프 1개만(ASCENT와 동형 중복 회피).
- **MECHANIC 3**: Combustion·Bloom·Rewind — 핵심 동사의 구조적으로 다른 3가지 재발명.
- **TECH 1**: Tabletop — 가장 대담한 tech, novelty 최고. format 편중을 상쇄하는 고천장 한 방.
- **NARRATIVE 1**: COUNTERMEASURE — 순수 lore가 아닌 역방향 플레이의 기계적 신규성으로 대표.
- **제외**: XL 성향(Seed Wars/Hivemind/Oracle) — 백엔드·외부 API 비용으로 FIT 최저라 의도적 배제.

## 6. 교배(Cross-pollination) — critic이 제안한 9개 hybrid

**FUN critic**
1. **Kernel Ascent: Subroutine Forge** = PROTOCOL ASCENT + Color Forge — 드래프트한 덱이 곧 보드조작 툴킷. 풀 최고 리플레이.
2. **Daily Ghost Protocol** = Daily + Ghost — 습관형 의식 + 동일보드 위 고스트 경주. 넷코드 0. *(→ 채택 #1/#2의 권장 결합)*
3. **Descent into ICE** = INTRUSION + Descent — 각 로그라이크 층이 진화하는 AI 워든과의 라이브 듀얼.

**NOVELTY critic**
4. **Cultivar War** = Bloom + COUNTERMEASURE — 시스관리자가 성장 패턴을 시드, 해커가 가지치기. 두 신선 아이디어가 서로 약점 보완.
5. **Reality Cipher** = Tabletop + PUZZLE-BOX ARG — 현실 스캔으로 보드 생성 + glyph가 물리 위치에 연동된 지오캐시형 ARG.
6. **Ashes & Forks** = Combustion + Rewind — 점화 후 정착을 보고 되감아 재경로 → 연쇄를 읽기·마스터 가능하게(혼돈 문제 해결).

**FIT critic**
7. **Protocol Run** = Descent + Color Forge + Ghost Race — 하나의 순수로직 spine이 로그라이크 진행·저작 콤보·비동기 versus를 모두 운반, 백엔드 0.
8. **The Forge Protocol** = Daily + Forge + Ghost — 셋 다 필요한 단 하나의 미싱피스(lookahead solver)를 한 번 만들어 PAR랭킹·인증·고스트타깃에 amortize. **백엔드 프리, 신규 엔진코드당 최대 기능 표면.**
9. **ROOTKIT** = INTRUSION + DAEMON.LOG + COUNTERMEASURE — 세 narrative가 한 fiction·한 기술(daemon이 `findOptimalGroup` 호출)을 공유 → solver·병렬그리드·'firewall=예약색' 한 규칙으로 풀 캠페인.

## 7. 권장 로드맵 (시너지 기반)

solver/시드/getSnapshot을 공유하는 **format 클러스터**가 단계적 확장에 최적:

1. **#1 Daily Protocol** (client-only standalone) ← **현재 채택·설계 완료**
2. **#2 Ghost Race** — Daily의 시드 위에 trail 재생만 추가 (이미 설계에 `RunRecord.trail` 시ম 마련)
3. **#15 Protocol Forge** — Daily/Ghost가 필요로 한 lookahead solver를 여기서 본격화 (PAR·인증 공유)
4. 이후 **#3 Descent**(독립 깊이) 또는 **#7 Rewind**(기존 history 재활용) 중 택1

→ 즉, 채택된 **#8 "The Forge Protocol" 머지 경로**(Daily→Ghost→Forge)를 점진 구현하면 신규 엔진코드(solver) 1개를 3기능에 분산할 수 있다.

## 8. 확정 사항 (Daily Protocol)

| 항목 | 결정 |
|------|------|
| 채택 | #1 The Daily Protocol |
| 경쟁 레이어 | client-only 먼저, `SubmitAdapter` 시ম으로 확장 가능 |
| 목표 기준 | 개인 best + 스트릭 (solver/PAR 없음) |
| 분리 | 별도 `daily.html` + 공유 `core.js`/`render.js` |
| 기존 게임 | 동작 보존 리팩터(가) |
| 모듈 | classic script(`file://` 호환), ES module 금지 |

상세는 → [`docs/superpowers/specs/2026-06-09-daily-protocol-design.md`](superpowers/specs/2026-06-09-daily-protocol-design.md)

---

## 부록 A — raw concept 원문 디테일 (25개)

각 concept의 발산 단계 원본 mechanic/maps_to 요지. (점수는 §2 참조)

**Combustion Protocol** — `applyInput`이 'burning' 상태 시드, `step()` tick 오토마타(인접 동색 점화, oil=아무 이웃, →ash), 연쇄 배수. burn 정착 후 gravity. GameLogic에 상태 평면 + step() 추가, ParticleSystem 재사용.

**Reactor** — 5색=5원소, 클리어 시 `element[color]+=group.length`, 둘레 반응표(Fire+Water=Steam 와일드카드), 시약 소비로 보드 액션. 순수 `reactionTable()` 추가.

**Rewind Engine** — 10-history → 양방향 타임라인+플레이헤드, 되감기 time-charge 소모, 분기 시 옛 미래=ghost target, slow 프리뷰. `getSnapshot/applySnapshot` 직접 확장.

**Gravity Atlas** — `setGravity(dir)`/`rotateBoard(cw)`로 더미 재정착, 레벨당 제한. `_applyGravity`/`_removeEmptyColumns`를 `settle(dir)`로 파라미터화, `hasValidMove`는 4방향 탐색.

**Bloom** — gravity 후 `mutate()` tick(다수색 확산 확률 p, 싱글톤 사멸, 빈칸 발아), stability 미터, dominance 감소 클리어 2배. 시드 RNG로 Colyseus-replayable.

**Seed Wars** — 동일 시드 실시간 미러, 상대 클리어가 내 보드에 ghost-removal, salt로 상대 보드에 재색 타일 주입. **시드 PRNG가 유일 필수 변경**(Math.random 2곳). 실시간은 Colyseus 필요.

**Oracle** — LLM이 보드 2D배열 + 히든 'solution spine' 저작, `hasValidMove`로 서버 검증, HintSystem이 후보군을 모델에 컨텍스트로. `applySnapshot`이 ingestion 포인트. 외부 API 필요.

**Resonance** — SoundManager 마스터버스에 AnalyserNode 1개, 비트 윈도우 클리어 배수, FFT 밴드가 색 glow/shake 변조. 오디오 인프라 추가 0, 생성 트랙·비트클록은 신규.

**Tabletop Protocol** — `getUserMedia` 프레임 다운샘플·k-means 양자화 → 보드, AR 오버레이 합성, rescan 리필. `applySnapshot`이 양자화 그리드 수용.

**Hivemind** — 단일 서버권위 보드, 클릭='pledge', 1.5s 윈도우 임계 초과 시 서버가 `applyInput` 1회 후 broadcast. 클라는 순수 렌더러. 최고 백엔드 비용.

**The Daily Protocol** — `_init` 시드 PRNG(`mulberry32(dateHash)`), 1일1회·undo 제한, `getSnapshot`→base64 공유스트링(무브+점수+색 이모지 trail), HintSystem→PAR solver, NetworkManager 스텁은 비동기 리더보드 POST로 전용(옵션).

**Ghost Race** — 런=정렬된 `(r,c)+ts` 배열, 두 번째 GameLogic에 `applyInput`으로 결정적 재생, 반투명 오버레이+진행바. NetworkManager는 좌표배열 fetch만(비실시간).

**One-Hand / Eyes-Free** — 커서가 보드 순회 Enter로 `getGroup` 제거, 색=글리프+음높이, ARIA 라이브로 그룹/점수 낭독, 한손 arc 레이아웃. TutorialManager를 스크린리더 온보딩으로.

**Protocol Forge** — 에디터로 셀 페인트+special 셀(잠금/와일드카드), 저장 시 best-first solver가 클리어가능 검증·PAR, `getSnapshot` RLE 공유코드. NetworkManager로 커뮤니티 피드.

**60-Second Cascade** — `_applyGravity`를 시드 색스트림 backfill로 확장(영속 보드), 60s 타이머, 콤보 decay 배수, 종료 시 공유 스코어카드.

**Grid Protocol: Descent** — move 예산 카운터, `BOARD_CLEAR`→새 cfg, relic 3택1(getGroup/applyInput 데코레이터), 미클리어 GAME_OVER=permadeath. cfg/snapshot 재사용.

**Color Forge** — 매 턴 3카드 드로우, 카드가 클릭 변형(Recolor/Bomb/Freeze Gravity/Siphon), 에너지 비용, 보드클리어로 카드 획득·영속 덱. applyInput 이벤트 스트림에 훅.

**Tower Protocol** — 부패 타일이 timer로 전진, 그룹 제거=레인 데미지(=scoreFormula(n)), 코어 도달 시 라이프 손실. `_pushRow()` setInterval tick.

**Ascendant Grid** — 색별 XP 풀, 레벨업 시 색별 패시브(Red 3+가 아래 row 제거 등), 스킬트리 분기, 세션 영속. applyInput의 색 라우팅(이미 1676 패치).

**Pulse Grid** — `applyInput`을 비트 윈도우 게이팅(Perfect/Good/Miss 배수), 바마다 beat-event(row pulse/recolor), comboCount=리듬 streak. SoundManager `AudioContext.currentTime`이 클록.

**INTRUSION: Live ICE Grid** — 매 수 후 'ICE tick': daemon이 `findOptimalGroup`을 자기편으로 실행해 역변이(FIREWALL 예약색=중력 차단), 실패 시 minGroup 상승, 클리어=access로 exploit 구매. daemon은 getGroup의 두 번째 소비자.

**DAEMON.LOG** — 저작 보드 + 병렬 metadata 그리드(fragment id), 태그 클러스터 제거 시 로그 조각 해금, 잘못된 순서는 인접 조각 스크램블, 점수=data recovered%. TutorialManager 정적보드 패턴 확장.

**PROTOCOL ASCENT** — run-scoped 모디파이어가 score 공식·그룹 규칙 변이(COMPILER/QUANTUM/GREED/VIRUS), 팩션보스가 DIFFICULTIES 오버라이드, 메타통화로 영속 언락. applyInput 데코레이터(1676 seam).

**THE PUZZLE-BOX ARG** — 클리어 셀 좌표가 모양 마스크 매칭 시 `GLYPH_CAPTURED` 방출, glyph가 keyring에 축적, Konami식 히든 터미널로 19번째 보드. getGroup 좌표 재사용.

**COUNTERMEASURE DUEL** — 대칭 `placeTile()`(색 기록+history+hasValidMove 재실행), 스크립트 침입자는 `findOptimalGroup` AI, 역할 핸드오프는 getSnapshot. NetworkManager가 라이브 비대칭 seam.
