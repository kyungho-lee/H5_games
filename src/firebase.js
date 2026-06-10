/* firebase.js — SameGame · Grid Protocol — Firebase Firestore backend
   ═══════════════════════════════════════════════════════════════════
   Firebase SDK v8 (compat) 래퍼.
   CDN 스크립트를 정적 <script>로 넣지 않고, 도메인 확인 후 동적 로드합니다.

   ┌─────────────────────────────────────────────────────────────────┐
   │  file://        →  SDK 로드 자체 생략  →  DEMO 모드 (에러 없음) │
   │  http(s):// CG  →  SDK 동적 로드 → Firestore 연결 → 실제 랭킹  │
   └─────────────────────────────────────────────────────────────────┘

   Firestore 컬렉션:
     sg_daily_scores/{date}_{diff}_{playerId}  — 개별 점수
     sg_daily_lb/{date}_{diff}                 — Top-20 리더보드
     sg_global_stats/{diff}                    — samegame.html 세션 통계
*/
(function (global) {
  'use strict';

  const SG = global.SG = global.SG || {};

  let db = null; // Firestore 인스턴스 (연결 후 설정)

  // ── 연결 상태 ─────────────────────────────────────────────────────
  function isConnected() { return !!db; }

  // ── 익명 플레이어 ID ──────────────────────────────────────────────
  function getPlayerId() {
    let id = localStorage.getItem('sg_player_id');
    if (!id) {
      try {
        const arr = new Uint8Array(8);
        (global.crypto || global.msCrypto).getRandomValues(arr);
        id = 'p_' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        id = 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      }
      localStorage.setItem('sg_player_id', id);
    }
    return id;
  }

  // ── IP 위치 정보 (ip-api.com, 키 불필요, 3s 타임아웃) ─────────────
  let _locCache = null;
  async function fetchLocation() {
    if (_locCache) return _locCache;
    try {
      const ctrl = new AbortController();
      const tmo  = setTimeout(() => ctrl.abort(), 3000);
      const r    = await fetch(
        'https://ip-api.com/json?fields=country,countryCode,city',
        { signal: ctrl.signal }
      );
      clearTimeout(tmo);
      if (r.ok) {
        const d = await r.json();
        _locCache = { country: d.country || '', code: d.countryCode || '', city: d.city || '' };
      } else {
        _locCache = { country: '', code: '', city: '' };
      }
    } catch (e) {
      _locCache = { country: '', code: '', city: '' };
    }
    return _locCache;
  }

  // ── 국가 코드 → 국기 이모지 ──────────────────────────────────────
  function countryFlag(code) {
    if (!code || code.length !== 2) return '🌐';
    const A = 0x1F1E6 - 65;
    return [...code.toUpperCase()].map(c => String.fromCodePoint(c.charCodeAt(0) + A)).join('');
  }

  // ── 일별 점수 제출 → 리더보드 갱신 ──────────────────────────────
  // 내부 1회 시도 — withRetry 가 감쌈
  async function _submitDailyScoreOnce({ date, diff, score, moves, cleared }) {
    const playerId = getPlayerId();
    const loc      = await fetchLocation();

    await db.collection('sg_daily_scores')
      .doc(date + '_' + diff + '_' + playerId)
      .set({
        date, diff, playerId, score, moves,
        cleared:     cleared ? 1 : 0,
        country:     loc.country,
        countryCode: loc.code,
        city:        loc.city,
        ts: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

    const lbRef = db.collection('sg_daily_lb').doc(date + '_' + diff);
    let lbSnap  = null;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(lbRef);
      const lb   = snap.exists ? snap.data() : { top: [], total: 0, clearedCount: 0 };
      // 구버전 문서에 clearedCount 필드가 없을 수 있음 → 항상 숫자로 보정
      if (typeof lb.clearedCount !== 'number') lb.clearedCount = 0;
      if (typeof lb.total        !== 'number') lb.total        = 0;
      const top     = lb.top || [];
      const prevIdx = top.findIndex(e => e.playerId === playerId);
      const isNew   = prevIdx < 0;

      if (isNew) {
        lb.total += 1;
        if (cleared) lb.clearedCount += 1;
      } else {
        if (cleared && !top[prevIdx].cleared) lb.clearedCount += 1;
      }

      const entry = {
        playerId, score, moves,
        cleared:     cleared ? 1 : 0,
        country:     loc.country,
        countryCode: loc.code,
        city:        loc.city,
      };

      if (prevIdx >= 0) {
        if (score > top[prevIdx].score) lb.top[prevIdx] = entry;
      } else {
        lb.top.push(entry);
      }

      lb.top.sort((a, b) => b.score - a.score);
      lb.top = lb.top.slice(0, 20);
      lb.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

      tx.set(lbRef, lb);
      lbSnap = { ...lb };
    });

    const myIdx = lbSnap.top.findIndex(e => e.playerId === playerId);
    return {
      rank:         myIdx >= 0 ? myIdx + 1 : lbSnap.total,
      top:          lbSnap.top,
      total:        lbSnap.total,
      clearedCount: lbSnap.clearedCount,
      playerId,
      flag:         countryFlag(loc.code),
    };
  }

  // 공개 wrapper — 사전 검증 + 재시도 + Notify dispatch
  async function submitDailyScore(args) {
    if (!db) return null;                                   // 미설정 — 정상 분기
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      SG.Notify.error('NETWORK', { retry: () => submitDailyScore(args) });
      return null;
    }
    try {
      return await SG.Notify.withRetry(
        () => _submitDailyScoreOnce(args),
        {
          tries:   3,
          backoff: [500, 1500],
          retryOn: (err) => err && err.code !== 'permission-denied',
        }
      );
    } catch (e) {
      SG.Notify.error('FB_SUBMIT', {
        retry:  () => submitDailyScore(args),
        detail: e && (e.code || e.message),
      });
      return null;
    }
  }

  // ── 리더보드 조회 ─────────────────────────────────────────────────
  async function getDailyLeaderboard(date, diff) {
    if (!db) throw new Error('Firebase not connected');
    const snap = await db.collection('sg_daily_lb').doc(date + '_' + diff).get();
    return snap.exists ? snap.data() : { top: [], total: 0, clearedCount: 0 };
  }

  // ── 글로벌 통계 갱신 (samegame.html 세션 종료 시) ─────────────────
  async function updateGlobalStats(diff, didClear) {
    if (!db) return;
    try {
      await db.collection('sg_global_stats').doc(diff).set({
        totalGames:   firebase.firestore.FieldValue.increment(1),
        clearedGames: firebase.firestore.FieldValue.increment(didClear ? 1 : 0),
      }, { merge: true });
    } catch (e) { /* 비필수 — 실패 무시 */ }
  }

  // ── 글로벌 통계 읽기 ─────────────────────────────────────────────
  async function getGlobalStats(diff) {
    if (!db) return null;
    try {
      const snap = await db.collection('sg_global_stats').doc(diff).get();
      return snap.exists ? snap.data() : null;
    } catch (e) { return null; }
  }

  // ── Endless 세션 점수 제출 → 난이도별 Top-20 갱신 ────────────────
  // sg_endless_lb/{diff} — Top-20 세션 점수 (최고점 유지)
  async function submitEndlessScore({ diff, score, level }) {
    if (!db) throw new Error('Firebase not connected');
    const playerId = getPlayerId();
    const loc      = await fetchLocation();
    const lbRef    = db.collection('sg_endless_lb').doc(diff);
    let   lbSnap   = null;

    await db.runTransaction(async (tx) => {
      const snap   = await tx.get(lbRef);
      const lb     = snap.exists ? snap.data() : { top: [], total: 0 };
      const top     = lb.top || [];
      const prevIdx = top.findIndex(e => e.playerId === playerId);

      if (prevIdx < 0) lb.total = (lb.total || 0) + 1;

      const entry = { playerId, score, level, countryCode: loc.code, city: loc.city };

      if (prevIdx >= 0) {
        if (score > top[prevIdx].score) lb.top[prevIdx] = entry;
      } else {
        lb.top.push(entry);
      }

      lb.top.sort((a, b) => b.score - a.score);
      lb.top = lb.top.slice(0, 20);
      lb.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      tx.set(lbRef, lb);
      lbSnap = { ...lb };
    });

    const myIdx = lbSnap.top.findIndex(e => e.playerId === playerId);
    return {
      top:      lbSnap.top,
      total:    lbSnap.total,
      playerId,
      rank:     myIdx >= 0 ? myIdx + 1 : lbSnap.total,
    };
  }

  // ── Endless 리더보드 조회 ─────────────────────────────────────────
  async function getEndlessLeaderboard(diff) {
    if (!db) return null;
    try {
      const snap = await db.collection('sg_endless_lb').doc(diff).get();
      return snap.exists ? snap.data() : { top: [], total: 0 };
    } catch (e) { return null; }
  }

  // ── Firebase 초기화 (SDK 로드 후 호출) ────────────────────────────
  function init(config) {
    if (typeof firebase === 'undefined') {
      console.warn('[SG.FB] Firebase SDK 미로드');
      return false;
    }
    try {
      if (!firebase.apps.length) firebase.initializeApp(config);
      db = firebase.firestore();
      console.log('[SG.FB] Firestore 연결됨 · 프로젝트:', config.projectId);
      return true;
    } catch (e) {
      console.error('[SG.FB] 초기화 실패:', e);
      return false;
    }
  }

  // ── SDK 동적 로드 헬퍼 ────────────────────────────────────────────
  function _loadScript(src) {
    return new Promise(function (resolve) {
      if (document.querySelector('script[src="' + src + '"]')) return resolve(true);
      var s    = document.createElement('script');
      s.src    = src;
      s.onload  = function () { resolve(true);  };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
  }

  // ── SG.FB 즉시 노출 (isConnected()로 실제 연결 여부 확인) ─────────
  SG.FB = {
    init, isConnected,
    getPlayerId, fetchLocation, countryFlag,
    submitDailyScore, getDailyLeaderboard,
    updateGlobalStats, getGlobalStats,
    submitEndlessScore, getEndlessLeaderboard,
  };

  // ── 도메인 체크 후 SDK 동적 로드 ─────────────────────────────────
  // file:// 및 localhost → SDK 로드 자체를 생략 (CORS / 권한 오류 원천 차단)
  var proto   = typeof location !== 'undefined' ? location.protocol : '';
  var host    = typeof location !== 'undefined' ? location.hostname  : '';
  var isLocal = proto === 'file:' || host === '' || host === 'localhost' || host === '127.0.0.1';

  if (isLocal) {
    console.log('[SG.FB] 로컬 환경 (' + (proto === 'file:' ? 'file://' : 'localhost') + ') — Firebase SDK 로드 생략 (DEMO 모드)');
    return; // IIFE 조기 종료 — SG.FB는 노출되나 isConnected()=false
  }

  // 비로컬 환경: firebase-config.js 동적 로드 → Firebase SDK → 초기화
  // config 파일이 없어도(404) 게임은 정상 동작 (isConnected()=false → 더미 데이터)
  (async function () {
    // firebase-config.js를 동적으로 로드 (없으면 조용히 건너뜀)
    await _loadScript('firebase-config.js');

    if (!global.SG_FIREBASE_CONFIG) return; // 설정 없으면 Firebase 비활성

    var BASE = 'https://www.gstatic.com/firebasejs/8.10.1/';
    var ok1  = await _loadScript(BASE + 'firebase-app.js');
    if (!ok1) { console.warn('[SG.FB] firebase-app.js 로드 실패'); return; }
    var ok2  = await _loadScript(BASE + 'firebase-firestore.js');
    if (!ok2) { console.warn('[SG.FB] firebase-firestore.js 로드 실패'); return; }

    init(global.SG_FIREBASE_CONFIG);
  })();

})(typeof window !== 'undefined' ? window : global);
