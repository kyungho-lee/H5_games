/* firebase-config.js — SameGame · Grid Protocol
   ═══════════════════════════════════════════════════════════════════
   ★ 설정 방법 (5단계)

   Step 1. https://console.firebase.google.com → 프로젝트 추가
   Step 2. 프로젝트 설정 → </> 웹 앱 추가 → 아래 값 복사·붙여넣기
   Step 3. 빌드 → Firestore Database → "데이터베이스 만들기" (프로덕션 모드, 서울 리전)
   Step 4. Firestore → 규칙(Rules) 탭에 아래 보안 규칙 붙여넣기 후 게시
   Step 5. 게임을 HTTPS 서버에 배포 (GitHub Pages / Netlify / CrazyGames 등)

   ── Firestore Security Rules (Step 4에서 사용) ─────────────────────
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /sg_daily_scores/{id} {
         allow read:   if true;
         allow create: if true;
         allow update: if request.resource.data.playerId == resource.data.playerId;
       }
       match /sg_daily_lb/{id}     { allow read, write: if true; }
       match /sg_endless_lb/{id}   { allow read, write: if true; }
       match /sg_global_stats/{id} { allow read, write: if true; }
     }
   }
   ────────────────────────────────────────────────────────────────────

   ── Firestore 컬렉션 구조 (자동 생성됨) ──────────────────────────
   sg_daily_scores/{date}_{diff}_{playerId}  ← 개인 점수 기록
   sg_daily_lb/{date}_{diff}                 ← Top-20 리더보드
   sg_global_stats/{diff}                    ← samegame.html 세션 통계

   ── 동작 방식 ────────────────────────────────────────────────────
   · firebase-config.js의 값이 "YOUR_..."이면 → 더미 데이터 표시 (DEMO 모드)
   · 실제 값으로 채우면 → 자동으로 Firestore 연결 (재시작 불필요)
   · file:// 로컬 환경에서도 동작하나, CORS 제한으로 위치정보만 생략됨
*/

window.SG_FIREBASE_CONFIG = {
  apiKey:            "AIzaSyA7K-aKyyuNZdWP4ml5hOClhOwSrXWPuN8",
  authDomain:        "kevin-h5-samegame.firebaseapp.com",
  projectId:         "kevin-h5-samegame",
  storageBucket:     "kevin-h5-samegame.firebasestorage.app",
  messagingSenderId: "466045677286",
  appId:             "1:466045677286:web:c310a2331388ff8489d527",
};

/* ── Google AdSense 보상형 광고 (선택사항, HTTPS + AdSense 계정 필요) ──
   1. https://www.google.com/adsense → 보상형 광고 단위 생성
   2. 아래 주석 해제 후 네트워크코드/광고단위경로 입력
   3. daily.html <head>에 GPT 스크립트 추가:
      <script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"></script>
      <script>window.googletag = window.googletag || { cmd: [] };</script>

   window.SG_FIREBASE_CONFIG.gptAdUnit = '/NETWORK_CODE/ad-unit-path';
*/
