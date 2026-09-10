# H5 Puzzle Games

> HTML5 캔버스 퍼즐게임 그룹 저장소 · Playgama / CrazyGames 배포

각 게임은 **독립된 GitHub 저장소**이며, 이 저장소에 git submodule로 등록되어 있다.
게임끼리는 서로 영향을 주지 않지만, 배포·수익화·분석 같은 **라이브옵스 계층은 공통 규격**을 따른다.

---

## 게임 목록

| 게임 | 장르 | 상태 |
|------|------|------|
| [Bassil's Sort](H5-PUZZLE-BassilsSort/) | 볼/워터 소트 퍼즐 | 기획·R&D |
| [Neon Drift](H5-PUZZLE-NeonDrift-v1/) | 밀어서 합치는 색상 병합 퍼즐 | 배포 |
| [Earth & Beyond](H5-PUZZLE-EarthBeyond/) | 머지 퍼즐 (원시 지구 → 우주) | 배포 · 토스 POC |
| [MOKO: Tiles of Memory](H5-PUZZLE-MOKO/) | SameGame 기반 발견 퍼즐 + 고양이 | 배포 |
| [SameGame — Grid Protocol](samegame-grid-protocol/) | 같은 색 그룹 제거 퍼즐 | 배포 · 톤앤매너 원본 |

`h5-puzzle-template/`은 게임이 아니라 **새 게임의 시드**다.

---

## 클론

서브모듈을 포함해야 게임 코드가 딸려온다.

```bash
git clone --recursive https://github.com/kyungho-lee/H5_games.git
```

이미 클론했다면:

```bash
git submodule update --init --recursive
```

> MOKO의 기본 브랜치는 `master`, 나머지는 `main`이다.

---

## 핵심 원칙: 게임은 독립, 라이브옵스는 공통

이 저장소의 구조를 이해하는 가장 중요한 규칙이다.

### 게임 코드는 완전히 독립적이다

게임은 각각 별도 플랫폼에 개별 심사·배포되는 **독립 배포 단위**다.
따라서 한 게임의 수정이 다른 게임을 절대 깨뜨리면 안 된다.

- 게임 간 **공유 모듈·크로스 참조 금지**
- 폴더를 통째로 복사해 꺼내도 **단독 실행**되어야 한다
- 템플릿은 참조용 시드일 뿐, **런타임 의존성이 아니다** (복사 후 분리)

검증:

```powershell
.\scripts\verify-standalone.ps1 <게임폴더명>
```

폴더 밖을 참조하는 경로(`../`, 절대경로)를 찾아낸다. 단, `.md`는 검사하지 않으므로
문서의 상대경로는 직접 확인해야 한다.

### 라이브옵스는 공통 규격을 따른다

반면 **플랫폼 SDK·수익화·분석**은 게임마다 새로 설계할 이유가 없고, 규격이 흔들리면
배포 심사와 정산이 함께 흔들린다. 그래서 아래 계층은 **동일한 인터페이스**를 공유한다.

| 파일 | 역할 |
|------|------|
| `src/playgama.js` | Playgama Bridge 어댑터 — 광고·리더보드 |
| `src/crazygames.js` | CrazyGames SDK 어댑터 |
| `src/playgama-bridge-config.json` | 광고 placement / 리더보드 ID |
| `src/firebase.js` | Firestore 랭킹·저장 래퍼 |
| `src/notify.js` | 토스트 알림 |
| `src/sound.js` | Web Audio 8-bit 사운드 |

현재 5개 게임 모두 이 6개 파일을 갖고 있다.

**단, 공유하는 것은 '규격'이지 '파일 실체'가 아니다.**
각 게임은 자기 사본을 갖고, 게임에 맞게 고쳐 쓴다. 이 구분이 핵심이다.

- 개선이 생기면 → 템플릿에 반영하고, 각 게임이 **필요할 때 가져다 적용**한다
- 절대 만들지 말 것 → 템플릿 수정을 게임들에 **자동 전파하는 sync 스크립트**

자동 전파는 편해 보이지만, 배포 직전인 게임에 예고 없이 변경을 밀어넣어
독립성을 훼손한다. 좋은 영향은 **가져다 쓰는 방향**으로만 흐르게 한다.

---

## 새 게임 만들기

템플릿을 시드 복사한 뒤 독립 저장소로 분리하고, 서브모듈로 등록까지 한 번에 처리한다.

```powershell
.\scripts\new-game.ps1 H5-PUZZLE-MyGame
```

수행 내용: 템플릿 복사(`.git`/`.claude` 제외) → git init → GitHub 비공개 저장소 생성·푸시
→ 부모에 서브모듈 등록. 부모 저장소 푸시는 직접 해야 한다.

저장소명은 영문·숫자·`-`·`_`·`.`만 쓸 수 있다(아포스트로피 불가).
표시용 게임 제목은 `index.html`에서 따로 지정하므로 저장소명과 달라도 된다.

**스캐폴드 직후 정리할 것** — 시드 복사라 템플릿에 있던 다른 게임 문서가 딸려온다.
무관한 `docs/` 문서를 지우고, README의 형제 프로젝트 상대경로를 제거한다.

---

## 개발 환경

게임은 빌드 도구 없는 **바닐라 JS 단일 HTML**이다. 번들러·`package.json`이 없고,
`src/` 폴더를 그대로 zip으로 압축해 배포한다. 외부 의존은 CDN `<script>` 태그만 쓴다.

```bash
cd <게임폴더>/src
python -m http.server 3000
# → http://localhost:3000/index.html
# → http://localhost:3000/index.html?dev   (DEV BAR)
```

### 브라우저 자동화

`.mcp.json`에 Chrome DevTools MCP 서버가 등록되어 있어, 클론한 어느 컴퓨터에서든
브라우저 제어가 가능하다(렌더링 확인, 콘솔 검사, 레퍼런스 게임 분석).

MCP 도구는 **세션 시작 시 로드**되므로, 클론 후 Claude Code를 새로 시작해야 한다.
프로젝트 스코프 서버라 컴퓨터마다 최초 1회 승인이 필요하다.

---

## 저장소 구조

```
H5-games/
├── H5-PUZZLE-*/            ← 게임 (서브모듈, 각각 독립 저장소)
├── samegame-grid-protocol/ ← 원본 게임 (서브모듈)
├── h5-puzzle-template/     ← 새 게임 시드 (서브모듈 아님)
├── scripts/
│   ├── new-game.ps1        ← 스캐폴드
│   └── verify-standalone.ps1 ← 독립성 검증
├── .mcp.json               ← Chrome DevTools MCP
└── README.md
```
