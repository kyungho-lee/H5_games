# Firebase 설정 가이드

---

## 1단계 — Firebase 프로젝트 생성

1. [https://console.firebase.google.com](https://console.firebase.google.com) 접속
2. **프로젝트 추가** → 이름 입력 → Google Analytics 선택(선택)
3. **프로젝트 설정** → **웹 앱 추가** (`</>`) → 앱 등록
4. 아래 config 값 복사

---

## 2단계 — firebase-config.js 설정

```javascript
// src/firebase-config.js
window.SG_FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",
  authDomain:        "yourproject.firebaseapp.com",
  projectId:         "yourproject",
  storageBucket:     "yourproject.firebasestorage.app",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abcdef",
};
```

값이 `"YOUR_..."` 상태면 **DEMO 모드** (더미 데이터 표시, Firestore 연결 안 함).

---

## 3단계 — Firestore 데이터베이스 생성

1. Firebase Console → **빌드** → **Firestore Database**
2. **데이터베이스 만들기** → 프로덕션 모드 → 리전 선택 (서울: `asia-northeast3`)

---

## 4단계 — 보안 규칙

Firestore → **규칙** 탭 → 아래 내용으로 교체 후 **게시**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /puzzle_scores/{id} {
      allow read:   if true;
      allow create: if true;
      allow update: if request.resource.data.playerId == resource.data.playerId;
    }
    match /puzzle_lb/{id} {
      allow read, write: if true;
    }
  }
}
```

> **주의**: `puzzle_scores`, `puzzle_lb`는 `firebase.js`의 컬렉션명과 일치해야 함.
> 게임 이름으로 변경했으면 규칙도 같이 변경.

---

## 컬렉션 구조

### `puzzle_scores/{date}_{playerId}`

| 필드 | 타입 | 설명 |
|------|------|------|
| `playerId` | string | 익명 플레이어 ID (`p_xxxxxxxx`) |
| `score` | number | 점수 |
| `date` | string | `YYYY-MM-DD` |
| `ts` | timestamp | 서버 타임스탬프 |
| (게임별 추가) | any | 난이도, 레벨 등 |

### `puzzle_lb/{date}`

Top-20 집계용. 필요 시 Cloud Functions로 자동 집계하거나,
게임에서 직접 `puzzle_scores`를 쿼리해서 사용.

---

## firebase.js 커스터마이징

컬렉션명 변경:
```javascript
// firebase.js 내 두 곳 수정
await db.collection('mygame_scores').doc(...)   // puzzle_scores → mygame_scores
const snap = await db.collection('mygame_scores').where(...)
```

`submitScore()` 추가 필드:
```javascript
await db.collection('puzzle_scores').doc(...).set({
  playerId: pid,
  score,
  date,
  level: currentLevel,      // 추가
  difficulty: 'hard',       // 추가
  ts: firebase.firestore.FieldValue.serverTimestamp(),
});
```

---

## 로컬 테스트

`firebase-config.js`가 `"YOUR_..."` 상태이면 자동으로 DEMO 모드로 동작하므로
로컬 개발 시 Firebase 설정 없이 더미 데이터로 UI 테스트 가능.

실제 Firestore 연결은 HTTPS 서버에서만 동작 (localhost도 가능):
```
python -m http.server 3000
# → http://localhost:3000/index.html
```
