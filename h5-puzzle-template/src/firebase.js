/* firebase.js — H5 Puzzle Template — Firebase Firestore backend
   ═══════════════════════════════════════════════════════════════════
   Firebase SDK v8 (compat) 래퍼. 도메인 확인 후 동적 로드.

   ┌─────────────────────────────────────────────────────────────────┐
   │  firebase-config.js 값이 "YOUR_..."  →  DEMO 모드 (더미 데이터) │
   │  실제 값 입력 + HTTPS 서버           →  Firestore 연결         │
   └─────────────────────────────────────────────────────────────────┘

   TODO: 컬렉션명을 게임에 맞게 수정하세요.
   현재 컬렉션:
     puzzle_scores/{date}_{playerId}  ← 개인 점수
     puzzle_lb/{date}                 ← Top-20 리더보드
*/
(function (global) {
  'use strict';

  const SG = global.SG = global.SG || {};

  let db = null;

  function isConnected() { return !!db; }

  function getPlayerId() {
    let id = localStorage.getItem('puzzle_player_id');
    if (!id) {
      try {
        const arr = new Uint8Array(8);
        (global.crypto || global.msCrypto).getRandomValues(arr);
        id = 'p_' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        id = 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      }
      localStorage.setItem('puzzle_player_id', id);
    }
    return id;
  }

  // ── Firebase SDK 동적 로드 ────────────────────────────────────────
  async function _loadFirebase() {
    if (global.firebase) return true;
    const scripts = [
      'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
      'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js',
    ];
    for (const src of scripts) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src; s.onload = () => res(); s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    return true;
  }

  // ── 초기화 ───────────────────────────────────────────────────────
  async function init() {
    const cfg = global.SG_FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey || cfg.apiKey.startsWith('YOUR_')) {
      console.log('[SG.FB] No config — DEMO mode');
      return false;
    }
    const proto = typeof location !== 'undefined' ? location.protocol : '';
    if (proto === 'file:') {
      console.log('[SG.FB] file:// — Firestore skipped');
      return false;
    }
    try {
      await _loadFirebase();
      if (!global.firebase.apps.length) global.firebase.initializeApp(cfg);
      db = global.firebase.firestore();
      console.log('[SG.FB] Firestore connected');
      return true;
    } catch (e) {
      console.warn('[SG.FB] init failed:', e);
      if (SG.Notify) SG.Notify.error('FB_SDK_INIT');
      return false;
    }
  }

  // ── 점수 저장 ────────────────────────────────────────────────────
  // TODO: 컬렉션명/필드 구조를 게임에 맞게 수정
  async function submitScore(score, meta) {
    if (!db) return;
    const pid  = getPlayerId();
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    try {
      await db.collection('puzzle_scores').doc(date + '_' + pid).set({
        playerId: pid,
        score,
        date,
        ...meta,
        ts: global.firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.warn('[SG.FB] submitScore failed:', e);
      if (SG.Notify) SG.Notify.error('FB_SUBMIT', {
        retry: () => submitScore(score, meta),
      });
    }
  }

  // ── 리더보드 조회 ────────────────────────────────────────────────
  // TODO: 컬렉션명/정렬 필드를 게임에 맞게 수정
  async function fetchLeaderboard(date) {
    if (!db) return _demoLeaderboard();
    try {
      const snap = await db.collection('puzzle_scores')
        .where('date', '==', date || new Date().toISOString().slice(0, 10))
        .orderBy('score', 'desc')
        .limit(20)
        .get();
      return snap.docs.map(d => d.data());
    } catch (e) {
      console.warn('[SG.FB] fetchLeaderboard failed:', e);
      if (SG.Notify) SG.Notify.error('FB_FETCH', { retry: () => fetchLeaderboard(date) });
      return _demoLeaderboard();
    }
  }

  function _demoLeaderboard() {
    return [
      { playerId: 'demo_1', score: 9800 },
      { playerId: 'demo_2', score: 7200 },
      { playerId: 'demo_3', score: 5100 },
    ];
  }

  SG.FB = { init, isConnected, getPlayerId, submitScore, fetchLeaderboard };

})(typeof window !== 'undefined' ? window : global);
