/* notify.js — SameGame · Grid Protocol — Toast notifications + retry policy
   ═══════════════════════════════════════════════════════════════════
   Leaf module: no dependencies. Boundary files (firebase.js / playgama.js /
   crazygames.js) dispatch user-facing errors here. Game code MUST NOT call
   SG.Notify.withRetry directly — it's boundary-only.

   API:
     SG.Notify.error(category, opts)  — red toast + optional retry
     SG.Notify.info(message, opts)    — gray toast (no retry)
     SG.Notify.withRetry(fn, policy)  — boundary-only auto-retry helper
*/
(function (global) {
  'use strict';

  const SG = global.SG = global.SG || {};

  // ── 카테고리 사전 ─────────────────────────────────────────────────
  const MESSAGES = {
    FB_SUBMIT:    { text: "Couldn't submit your score.",                 manualRetry: true  },
    FB_FETCH:     { text: "Couldn't load the leaderboard.",              manualRetry: true  },
    FB_SDK_INIT:  { text: "Leaderboard unavailable. Playing offline.",   manualRetry: false },
    AD_REWARDED:  { text: "Couldn't load the ad.",                       manualRetry: true  },
    AD_INTER:     { text: "Ad failed to display.",                       manualRetry: false },
    SDK_INIT:     { text: "Ad SDK unavailable. Continuing without ads.", manualRetry: false },
    NETWORK:      { text: "Network connection problem.",                 manualRetry: true  },
  };

  // ── 활성 토스트 추적 (카테고리별 중복 합치기) ───────────────────
  const _active = new Map(); // category → { el, count, dismissAt, timerId, hovered }

  // ── 재시도 헬퍼 — boundary 내부에서만 사용 ──────────────────────
  // policy: { tries: 3, backoff: [500, 1500], retryOn: (err) => bool }
  async function withRetry(fn, policy) {
    const tries   = policy.tries  || 3;
    const backoff = policy.backoff || [];
    const retryOn = policy.retryOn || (() => true);

    let lastErr = null;
    for (let i = 0; i < tries; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        if (i === tries - 1)  throw e;        // 마지막 시도면 throw
        if (!retryOn(e))      throw e;        // 재시도 불가 에러
        const wait = backoff[i] || 0;
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
      }
    }
    throw lastErr;
  }

  // ── 공개 API (UI 부분은 다음 step에서 추가) ─────────────────────
  SG.Notify = {
    withRetry,
    _MESSAGES: MESSAGES,  // 테스트용 (외부 호출 X)
    _active:   _active,   // 테스트용 (외부 호출 X)
    error(/* category, opts */) { /* Step 2에서 구현 */ },
    info (/* message,  opts */) { /* Step 2에서 구현 */ },
  };

})(typeof window !== 'undefined' ? window : global);
