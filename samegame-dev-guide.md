# SameGame — Cowork 개발환경 & Git 설정 가이드

> 현재 단일 HTML 파일(`src/index.html`, ~52KB)을 기준으로  
> **Cowork에서 바로 이어서 작업**하기 위한 완전한 설정 가이드

---

## 목차

1. [프로젝트 구조](#1-프로젝트-구조)
2. [로컬 환경 설정](#2-로컬-환경-설정)
3. [Git 초기 설정](#3-git-초기-설정)
4. [GitHub 원격 저장소 연결](#4-github-원격-저장소-연결)
5. [브랜치 전략](#5-브랜치-전략)
6. [Cowork에서 작업하는 방법](#6-cowork에서-작업하는-방법)
7. [스크립트 & 자동화](#7-스크립트--자동화)
8. [GitHub Actions CI](#8-github-actions-ci)
9. [커밋 메시지 규칙](#9-커밋-메시지-규칙)
10. [다음 작업 로드맵](#10-다음-작업-로드맵)

---

## 1. 프로젝트 구조

Cowork에 올릴 디렉토리 레이아웃입니다. 지금 당장은 단일 HTML 파일이지만, 멀티플레이어 서버 추가를 고려한 구조로 잡아둡니다.

```
samegame-grid-protocol/        ← 루트 (GitHub 저장소)
│
├── src/
│   └── index.html             ← 게임 본체 (단일 파일, ~52KB)
│
├── tests/
│   └── gamelogic.test.js      ← GameLogic 단위 테스트 (15개)
│
├── scripts/
│   ├── build.js               ← 프로덕션 빌드 (주석 정리 → dist/)
│   └── lint.js                ← 아키텍처·문법·localStorage 키 검사
│
├── dist/                      ← 빌드 산출물 (.gitignore 처리)
│
├── .github/
│   └── workflows/
│       └── ci.yml             ← lint → test → build 자동화
│
├── .gitignore
├── package.json
├── README.md
└── CHANGELOG.md
```

### 핵심 파일 하나만 기억할 것

**`src/index.html` 이 파일 하나가 전부입니다.**  
내부 클래스 구조:

```
src/index.html
├── <style>          CSS (다크 SF 테마, scanline, 변수)
└── <script>
    ├── DIFFICULTIES  난이도 설정 (검증된 클리어율 포함)
    ├── COLOR_PALETTE 색상 팔레트 (6색)
    ├── scoreFormula  n*(n-1)*10
    ├── GameLogic     순수 상태머신 (DOM 의존 없음, 서버 공유 가능)
    ├── TutorialManager  4단계 인터랙티브 튜토리얼
    ├── ExponentialBackoff  재연결 백오프
    ├── NetworkManager  WebSocket stub (Colyseus 준비)
    ├── Particle / ParticleSystem  오브젝트 풀링
    ├── FloatText    점수 팝업
    ├── Renderer     Canvas 2D (파티클, 애니메이션, 스포트라이트)
    └── 게임 컨트롤러  init / loop / handleClick / startGame / endGame ...
```

---

## 2. 로컬 환경 설정

### 필수 요건

```
Node.js  >= 18.0.0   (권장: 20 LTS)
npm      >= 9.0.0
Git      >= 2.40
```

### 설치 순서

```bash
# 1. 저장소 클론 (GitHub 연결 후)
git clone https://github.com/<YOUR_USERNAME>/samegame-grid-protocol.git
cd samegame-grid-protocol

# 2. 의존성 설치 (devDependencies만, 런타임 의존성 없음)
npm install

# 3. 개발 서버 시작
npm run dev
# → http://localhost:3000 에서 게임 실행
```

> **의존성이 거의 없습니다.**  
> 게임 자체는 순수 HTML/CSS/JS — `serve` 패키지만 개발용으로 사용합니다.  
> 브라우저에서 `src/index.html`을 직접 열어도 동작합니다.

### VSCode 권장 익스텐션

```jsonc
// .vscode/extensions.json 로 팀 공유 가능
{
  "recommendations": [
    "esbenp.prettier-vscode",      // 코드 포맷
    "formulahendry.auto-rename-tag", // HTML 태그 자동 수정
    "ritwickdey.liveserver"         // Live Server (serve 대체)
  ]
}
```

---

## 3. Git 초기 설정

### 처음 한 번만 — 글로벌 설정

```bash
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"

# 기본 브랜치를 main으로 (Git 2.28+)
git config --global init.defaultBranch main

# 한국어 환경에서 파일명 깨짐 방지
git config --global core.quotepath false

# pull 전략 (rebase 권장)
git config --global pull.rebase true
```

### 로컬 저장소 초기화 (새로 시작할 경우)

```bash
# 프로젝트 폴더에서
git init
git branch -m main          # master → main 이름 변경

# 파일 추가 및 첫 커밋
git add -A
git commit -m "feat: initial release v1.0.0"

# develop 브랜치 생성 (일상 개발용)
git checkout -b develop
```

### .gitignore 내용

```gitignore
# 의존성
node_modules/

# 빌드 산출물 (CI에서 생성하므로 추적 불필요)
dist/

# OS
.DS_Store
Thumbs.db

# 에디터
.vscode/settings.json
.idea/
*.swp

# 환경변수 (나중에 서버 추가 시)
.env
.env.local
```

---

## 4. GitHub 원격 저장소 연결

### Step 1 — GitHub에서 저장소 생성

1. https://github.com/new 접속
2. Repository name: `samegame-grid-protocol`
3. Description: `SameGame — Grid Protocol | HTML5 Canvas puzzle game`
4. Visibility: Public (또는 Private)
5. **README, .gitignore, license는 체크하지 않음** (이미 로컬에 있으므로)
6. Create repository 클릭

### Step 2 — 원격 연결 및 Push

```bash
# 원격 저장소 연결
git remote add origin https://github.com/<YOUR_USERNAME>/samegame-grid-protocol.git

# 연결 확인
git remote -v

# main 브랜치 push (최초 1회)
git push -u origin main

# develop 브랜치도 push
git push -u origin develop
```

### Step 3 — 브랜치 보호 규칙 (GitHub 설정)

GitHub 저장소 → Settings → Branches → Add rule:

```
Branch name pattern: main

☑ Require a pull request before merging
  ☑ Require approvals: 1
☑ Require status checks to pass before merging
  → 체크: CI (workflow 이름)
☑ Do not allow bypassing the above settings
```

이렇게 하면 `main`에 직접 push가 막히고, PR + CI 통과 후에만 병합됩니다.

### SSH 키 설정 (HTTPS 대신 SSH 사용 시)

```bash
# SSH 키 생성
ssh-keygen -t ed25519 -C "you@example.com"

# 공개키 출력 → GitHub Settings > SSH keys 에 붙여넣기
cat ~/.ssh/id_ed25519.pub

# 원격 URL을 SSH로 변경
git remote set-url origin git@github.com:<YOUR_USERNAME>/samegame-grid-protocol.git
```

---

## 5. 브랜치 전략

단일 개발자 기준의 단순한 전략입니다. 나중에 멀티플레이어 개발로 복잡해지면 Gitflow로 전환할 수 있습니다.

```
main
 └─ 항상 배포 가능한 상태. 직접 push 금지.

develop
 └─ 일상 작업 브랜치. 여기서 직접 커밋하거나 feature/* 를 병합.

feature/<기능명>
 └─ 새 기능 개발. develop 에서 분기, 완료 후 develop 에 PR.

fix/<버그명>
 └─ 버그 수정. develop 에서 분기.

release/v<X.Y.Z>
 └─ 배포 준비. develop → release → main 에 머지 태그.
```

### 일상적인 작업 흐름

```bash
# 작업 시작: 항상 develop 에서 최신화
git checkout develop
git pull origin develop

# 새 기능 시작
git checkout -b feature/multiplayer-colyseus

# 작업... 커밋...
git add src/index.html
git commit -m "feat(network): add Colyseus room connection"

# 작업 완료 후 develop 에 병합
git checkout develop
git merge --no-ff feature/multiplayer-colyseus
git push origin develop

# 브랜치 정리
git branch -d feature/multiplayer-colyseus
```

### 릴리스 태그

```bash
# develop → main 병합 후 태그
git checkout main
git merge --no-ff develop
git tag -a v1.1.0 -m "feat: add multiplayer support"
git push origin main --tags
```

---

## 6. Cowork에서 작업하는 방법

Cowork는 Claude가 로컬 파일시스템에 직접 접근해 작업하는 환경입니다.  
아래 패턴을 따르면 세션 간 작업이 끊기지 않습니다.

### 세션 시작 시 Claude에게 전달할 컨텍스트

매 Cowork 세션 시작 때 아래 내용을 붙여서 요청하세요:

```
프로젝트: samegame-grid-protocol
파일: src/index.html (단일 파일, ~52KB)
현재 브랜치: develop
작업 내용: [오늘 할 작업 설명]

아키텍처:
- GameLogic: 순수 상태머신, DOM 의존 없음
- TutorialManager: interceptClick() / drawHint() 훅 구조
- Renderer: Canvas 2D, draw() 끝에 tutMgr.drawHint() 호출
- NetworkManager: WebSocket stub, Colyseus 연결 준비됨

규칙:
- src/index.html 한 파일만 수정
- 작업 후 반드시 node tests/gamelogic.test.js 실행
- 커밋 전 node scripts/lint.js 통과 확인
```

### Cowork에서 Claude가 직접 할 수 있는 작업

```bash
# 테스트 실행
node tests/gamelogic.test.js

# 린트 검사
node scripts/lint.js

# 빌드
node scripts/build.js

# Git 커밋 (Claude가 직접)
git add src/index.html
git commit -m "feat: [작업 내용]"
git push origin develop
```

### Cowork에서 할 수 없는 것 (직접 해야 함)

```bash
# GitHub에 push된 PR 생성 → GitHub UI에서 직접
# 브라우저에서 게임 확인 → 로컬에서 npm run dev
# GitHub Secrets 설정 → GitHub UI에서 직접
```

### 작업 후 체크리스트

```bash
# 1. 테스트 통과 확인
node tests/gamelogic.test.js      # 15 passed, 0 failed

# 2. 린트 통과 확인
node scripts/lint.js               # All lint checks passed

# 3. 커밋
git add src/index.html
git commit -m "feat: ..."

# 4. push
git push origin develop
```

---

## 7. 스크립트 & 자동화

### `npm test` — 단위 테스트

```bash
node tests/gamelogic.test.js
```

GameLogic을 Node.js에서 직접 실행해 15개 케이스를 검사합니다.  
**브라우저 없이 실행 가능** — Cowork/CI 모두에서 동작합니다.

테스트 항목:

| 스위트 | 케이스 |
|---|---|
| scoreFormula | n=2,5,10,25 검증 |
| getGroup | 4연결 그룹, 빈칸 처리 |
| applyInput | minGroup 미만 거부, BOARD_CLEAR 이벤트, 점수 계산 |
| _applyGravity | 타일 낙하 |
| _removeEmptyColumns | 빈 열 압축 |
| undo | 점수·타일 복원, 히스토리 없을 때 |
| getSnapshot | 직렬화 |
| 밸런스 | 고립 타일 비율 < 15% (100회 시뮬레이션) |

### `npm run lint` — 코드 검사

```bash
node scripts/lint.js
```

| 검사 항목 | 내용 |
|---|---|
| Syntax | JS `new Function()` 파싱 |
| Architecture | 필수 클래스 6개 존재 여부 |
| localStorage | 키 이름이 `samegame_` 접두사 규칙 준수 |
| Functions | 핵심 함수 8개 존재 여부 |

### `npm run build` — 프로덕션 빌드

```bash
node scripts/build.js
# src/index.html → dist/index.html
# 배너 주석·섹션 구분선 제거로 ~6% 경량화
```

### `npm run dev` — 로컬 개발 서버

```bash
npm run dev
# http://localhost:3000
```

`src/index.html`을 브라우저에서 직접 열어도 동작하지만,  
`serve`를 쓰면 올바른 MIME 타입과 로컬 네트워크 접근이 가능합니다.

---

## 8. GitHub Actions CI

`.github/workflows/ci.yml`이 `main`/`develop` push 및 PR 시 자동 실행됩니다.

```yaml
name: CI
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: node scripts/lint.js     # 1. 아키텍처 검사
      - run: node tests/gamelogic.test.js  # 2. 단위 테스트
      - run: node scripts/build.js    # 3. 빌드
      - uses: actions/upload-artifact@v4   # 4. dist 아티팩트 보존 (7일)
        with:
          name: samegame-dist
          path: dist/index.html
```

CI 배지를 README에 추가하려면:

```markdown
![CI](https://github.com/<YOUR_USERNAME>/samegame-grid-protocol/actions/workflows/ci.yml/badge.svg)
```

---

## 9. 커밋 메시지 규칙

[Conventional Commits](https://www.conventionalcommits.org/) 형식을 따릅니다.

```
<type>(<scope>): <subject>

[body — 선택]

[footer — 선택]
```

### type 목록

| type | 사용 상황 |
|---|---|
| `feat` | 새 기능 추가 |
| `fix` | 버그 수정 |
| `refactor` | 기능 변경 없는 코드 개선 |
| `perf` | 성능 개선 |
| `test` | 테스트 추가/수정 |
| `docs` | 문서만 변경 |
| `chore` | 빌드·설정 변경 |

### scope 예시 (이 프로젝트 기준)

```
feat(game):     게임 로직
feat(network):  NetworkManager / WebSocket
feat(render):   Renderer / 파티클
feat(tutorial): TutorialManager
feat(ui):       오버레이 / 스탯 UI
fix(balance):   난이도 밸런스
perf(canvas):   Canvas 최적화
```

### 좋은 커밋 예시

```bash
git commit -m "feat(network): add Colyseus room join with JWT auth"
git commit -m "fix(tutorial): step2 intercept ignoring non-cyan clicks"
git commit -m "perf(render): reduce particle pool GC pressure"
git commit -m "feat(game): add hard mode tile penalty for leftover tiles"
git commit -m "refactor(gamelogic): extract scoreFormula to shared/constants"
```

---

## 10. 다음 작업 로드맵

현재 `develop` 브랜치에서 이어나갈 수 있는 작업 목록입니다.  
각 항목은 독립적인 `feature/*` 브랜치로 작업하세요.

### Phase 1 — 게임 완성도 (단일 파일 유지)

```bash
git checkout -b feature/hint-system
# 막혔을 때 힌트 버튼 → 최대 그룹 하이라이트

git checkout -b feature/sound-effects
# Howler.js CDN import or Web Audio API
# 제거음 / 콤보음 / 클리어음

git checkout -b feature/animation-gravity
# 타일 낙하를 즉각이 아닌 0.2초 슬라이딩 애니메이션으로
```

### Phase 2 — 멀티플레이어 준비

NetworkManager stub → 실제 Colyseus 연결로 교체합니다.

```bash
git checkout -b feature/multiplayer-colyseus

# 작업 순서:
# 1. packages/server/ 디렉토리 생성 (모노레포 전환)
# 2. Colyseus GameRoom 작성
# 3. src/index.html의 NetworkManager.connect(url) 구현
# 4. MessagePack 직렬화 적용 (@msgpack/msgpack CDN)
# 5. 서버 권위 모델 검증 (GameLogic 서버에서 실행)
```

### Phase 3 — 인프라

```bash
# GitHub Pages 자동 배포 (CI 확장)
git checkout -b chore/gh-pages-deploy

# Lighthouse CI 추가 (성능 점수 트래킹)
git checkout -b chore/lighthouse-ci
```

### 빠른 참고

```bash
# 현재 상태 확인
git status
git log --oneline -10

# 테스트만 빠르게
node tests/gamelogic.test.js

# 빌드 후 미리보기
node scripts/build.js && npx serve dist -p 4000

# 특정 커밋으로 돌아가기 (src 파일만)
git checkout <commit-hash> -- src/index.html
```

---

## 빠른 치트시트

```bash
# ── 매일 작업 시작 ──────────────────────────────────
git checkout develop && git pull origin develop
npm run dev                        # 개발 서버 시작

# ── 기능 개발 ────────────────────────────────────────
git checkout -b feature/<name>
# ... 작업 ...
node tests/gamelogic.test.js      # 테스트
node scripts/lint.js               # 린트
git add src/index.html && git commit -m "feat: ..."
git push origin feature/<name>

# ── develop 병합 ─────────────────────────────────────
git checkout develop
git merge --no-ff feature/<name>
git push origin develop
git branch -d feature/<name>

# ── main 릴리스 ──────────────────────────────────────
git checkout main && git merge --no-ff develop
git tag -a v1.x.0 -m "..."
git push origin main --tags
```
