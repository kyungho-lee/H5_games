/* firebase-config.js — H5 Puzzle Template
   ═══════════════════════════════════════════════════════════════════
   ★ 설정 방법 (5단계)

   Step 1. https://console.firebase.google.com → 프로젝트 추가
   Step 2. 프로젝트 설정 → </> 웹 앱 추가 → 아래 값 복사·붙여넣기
   Step 3. 빌드 → Firestore Database → "데이터베이스 만들기" (프로덕션 모드)
   Step 4. Firestore → 규칙(Rules) 탭에 아래 보안 규칙 붙여넣기 후 게시
   Step 5. 게임을 HTTPS 서버에 배포

   ── Firestore Security Rules (Step 4에서 사용) ─────────────────────
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /puzzle_scores/{id}   { allow read, write: if true; }
       match /puzzle_lb/{id}       { allow read, write: if true; }
     }
   }
   ────────────────────────────────────────────────────────────────────

   ── Firestore 컬렉션 구조 (자동 생성됨) ──────────────────────────
   puzzle_scores/{date}_{playerId}  ← 개인 점수 기록
   puzzle_lb/{date}                 ← Top-20 리더보드

   ── 동작 방식 ────────────────────────────────────────────────────
   · 아래 값이 "YOUR_..."이면 → 더미 데이터 표시 (DEMO 모드)
   · 실제 값으로 채우면 → 자동으로 Firestore 연결
*/

window.SG_FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT",
  storageBucket:     "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};
