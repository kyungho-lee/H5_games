# H5 Puzzle Template

SameGame Grid Protocol의 톤앤매너와 플랫폼 인프라를 그대로 가져온 H5 퍼즐게임 스타터 템플릿.  
Playgama 배포 기준으로 구성되어 있으며, 게임 로직만 채우면 즉시 배포 가능한 구조다.

---

## 폴더 구조

```
h5-puzzle-template/
├── src/                          ← zip 압축 대상 (Playgama 배포 단위)
│   ├── index.html                ← 진입점 + 게임 메인 (TODO 주석 포함)
│   ├── crazygames.js             ← CrazyGames SDK 어댑터 (수정 불필요)
│   ├── playgama.js               ← Playgama Bridge SDK 어댑터 (_HOF_LB_ID 교체)
│   ├── playgama-bridge-config.json ← 광고 placement / 리더보드 ID 설정
│   ├── firebase.js               ← Firebase Firestore 래퍼 (컬렉션명 교체)
│   ├── firebase-config.js        ← Firebase 프로젝트 키 입력
│   ├── notify.js                 ← 토스트 알림 (수정 불필요)
│   └── sound.js                  ← Web Audio 8-bit 사운드 (음표 배열 교체)
├── docs/
│   ├── todo.md                   ← 단계별 구현 체크리스트 ← 여기서 시작
│   ├── ad-patterns.md            ← 광고 연동 패턴 레퍼런스
│   ├── design-tokens.md          ← CSS 변수 / 타이포그래피 레퍼런스
│   └── firebase-setup.md         ← Firebase 설정 가이드
├── .claude/
│   ├── settings.local.json       ← Claude Code 권한 설정
│   └── skills/
│       └── playgama-ad-integration/
│           └── SKILL.md          ← Playgama 광고 연동 Claude 스킬
└── README.md
```

---

## 빠른 시작

### 1. 로컬 서버 실행

```bash
cd src
python -m http.server 3000
# → http://localhost:3000/index.html
# → http://localhost:3000/index.html?dev  (DEV BAR 활성화)
```

> `file://`로 직접 열면 Bridge SDK가 CORS로 skip됨. 반드시 HTTP 서버 사용.

### 2. TODO 순서대로 진행

`docs/todo.md`를 열어 Phase 1부터 순서대로 체크하면서 구현.

### 3. Playgama 배포 zip 생성

```powershell
$files = Get-ChildItem -Path src -File | ForEach-Object { $_.FullName }
Compress-Archive -Path $files -DestinationPath game.zip -CompressionLevel Optimal
```

---

## 각 파일에서 할 일 요약

| 파일 | 할 일 |
|------|-------|
| `src/index.html` | 게임 제목, 렌더링, 게임 로직, 입력 처리 구현 |
| `src/sound.js` | `playXxx()` 음표 배열을 게임에 맞게 교체 |
| `src/playgama.js` | `_HOF_LB_ID` 를 Playgama 리더보드 ID로 교체 |
| `src/playgama-bridge-config.json` | rewarded placement ID, 리더보드 ID 교체 |
| `src/firebase-config.js` | 실제 Firebase 프로젝트 키 입력 |
| `src/firebase.js` | 컬렉션명 교체, `submitScore()` 필드 추가 |

---

## 플랫폼 SDK 동작 방식

```
게임 코드 → SG.CG.* (공통 인터페이스)
              ↑
    Playgama  → playgama.js가 SG.CG.* 를 Bridge로 패치
    CrazyGames → crazygames.js 처리
    로컬/기타  → no-op (에러 없음)
```

게임 코드에서 플랫폼 분기 없이 `SG.CG.*`만 호출하면 됨.

---

## 디자인 시스템

SameGame Grid Protocol과 동일한 레트로-퓨처리스틱 테마:

- **배경**: `#060810` (거의 검정) + 격자 패턴 오버레이
- **포인트**: `#00f5c8` (시안 글로우)
- **경고**: `#ff4060` (레드)
- **폰트**: `Rajdhani` (제목/숫자) + `Share Tech Mono` (UI/본문)

자세한 내용: `docs/design-tokens.md`

---

## 광고 연동 핵심 규칙

1. **정적 Bridge 태그 필수** — `index.html`에 반드시 포함
   ```html
   <script src="https://bridge.playgama.com/v1/stable/playgama-bridge.js"></script>
   ```

2. **`granted: false` 처리** — 사용자 취소 vs SDK 없음을 반드시 구분
   ```javascript
   if (SG.CG.isAvailable()) {
     const res = await SG.CG.requestRewardedAd('placement_id');
     if (res.granted) { grantReward(); return; }
     restoreButton();  // 사용자 취소 → 버튼 복원만
     return;
   }
   showFallbackModal(); // SDK 없을 때만
   ```

3. **버튼 노출에 `isAvailable()` 사용 금지** — SDK 없어도 버튼은 항상 표시

자세한 내용: `docs/ad-patterns.md`, `.claude/skills/playgama-ad-integration/SKILL.md`

---

## 참고 프로젝트

SameGame Grid Protocol (`../samegame-grid-protocol/`) — 이 템플릿의 원본.  
`daily.html` (= `index.html`) 기준으로 QA Tool 검증 완료된 광고 연동 코드가 들어있다.
