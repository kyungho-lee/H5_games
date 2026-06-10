# Error Boundary & User Notification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize external-system error handling in boundary modules (firebase.js / playgama.js / crazygames.js) with a single notify.js module for toast UI + retry policy. Remove all temporary suppressors. Game code is untouched except for removing dead defensive try/catch.

**Architecture:** Boundary pattern. Game → `await SG.FB.* / SG.CG.*` unchanged. Boundary files own try/catch, sdk pre-validation, auto-retry with backoff, and dispatch to `SG.Notify`. notify.js is a leaf module (no deps), injects its toast root into DOM on first call.

**Tech Stack:** Vanilla JS (no transpilation), Node-runnable unit tests (`node src/*.test.js`), browser game (Canvas + HTML), Firebase v8 compat (Firestore), Playgama Bridge SDK v1, CrazyGames SDK v3.

**Spec:** [2026-06-10-error-boundary-design.md](../specs/2026-06-10-error-boundary-design.md)

---

## Task 1: notify.js — Pure logic (MESSAGES, withRetry, state)

**Files:**
- Create: `src/notify.js`

Build the non-DOM portions first so they're independently testable.

- [ ] **Step 1: Create skeleton with MESSAGES dictionary and module shell**

Create `src/notify.js`:

```js
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
```

- [ ] **Step 2: Run a quick sanity check that it loads in Node**

Run:
```bash
node -e "global.window=global; require('./src/notify.js'); console.log(Object.keys(global.SG.Notify))"
```

Expected output:
```
[ 'withRetry', '_MESSAGES', '_active', 'error', 'info' ]
```

- [ ] **Step 3: Commit**

```bash
git add src/notify.js
git commit -m "feat(notify): add notify.js shell with MESSAGES + withRetry"
```

---

## Task 2: notify.js — Toast UI (DOM rendering + lifecycle)

**Files:**
- Modify: `src/notify.js` (extend the shell with DOM-touching code)

- [ ] **Step 1: Add the DOM helpers and `error` / `info` implementations**

Replace the placeholder `error` / `info` methods at the bottom of `src/notify.js` with full implementations. Update the `SG.Notify` assignment block.

Find:
```js
  // ── 공개 API (UI 부분은 다음 step에서 추가) ─────────────────────
  SG.Notify = {
    withRetry,
    _MESSAGES: MESSAGES,  // 테스트용 (외부 호출 X)
    _active:   _active,   // 테스트용 (외부 호출 X)
    error(/* category, opts */) { /* Step 2에서 구현 */ },
    info (/* message,  opts */) { /* Step 2에서 구현 */ },
  };
```

Replace with:
```js
  // ── DOM 루트 (지연 주입) ────────────────────────────────────────
  let _root = null;
  function _ensureRoot() {
    if (_root) return _root;
    if (typeof document === 'undefined') return null;  // Node 환경 가드
    _root = document.getElementById('sg-toast-root');
    if (_root) return _root;
    _root = document.createElement('div');
    _root.id = 'sg-toast-root';
    _root.setAttribute('style',
      'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);' +
      'display:flex;flex-direction:column-reverse;gap:8px;z-index:9999;' +
      'pointer-events:none;');
    document.body.appendChild(_root);
    return _root;
  }

  function _makeToastEl(opts) {
    var el = document.createElement('div');
    var border = opts.kind === 'error' ? '#ff5050' : '#808080';
    el.setAttribute('style',
      'max-width:320px;background:#1a1a1a;color:#e5e5e5;' +
      'border-left:4px solid ' + border + ';' +
      'padding:10px 12px;border-radius:6px;font:13px/1.4 sans-serif;' +
      'display:flex;align-items:center;gap:10px;pointer-events:auto;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.4);');

    var msg = document.createElement('span');
    msg.style.flex = '1';
    msg.textContent = opts.text;
    el.appendChild(msg);

    if (opts.retry) {
      var btn = document.createElement('button');
      btn.textContent = 'Retry';
      btn.setAttribute('style',
        'background:#333;color:#fff;border:1px solid #555;' +
        'border-radius:4px;padding:3px 10px;font:12px sans-serif;cursor:pointer;');
      btn.addEventListener('click', function () {
        msg.textContent = 'Retrying…';
        btn.style.display = 'none';
        try { opts.retry(); } catch (e) { /* boundary에서 다시 노티 */ }
        _dismiss(opts.category);
      });
      el.appendChild(btn);
    }

    var x = document.createElement('button');
    x.textContent = '×';
    x.setAttribute('aria-label', 'Dismiss');
    x.setAttribute('style',
      'background:transparent;color:#888;border:none;font:16px sans-serif;' +
      'cursor:pointer;padding:0 4px;');
    x.addEventListener('click', function () { _dismiss(opts.category); });
    el.appendChild(x);

    return { el: el, msg: msg };
  }

  function _dismiss(category) {
    var entry = _active.get(category);
    if (!entry) return;
    clearTimeout(entry.timerId);
    if (entry.el && entry.el.parentNode) entry.el.parentNode.removeChild(entry.el);
    _active.delete(category);
  }

  function _scheduleDismiss(category, durationMs) {
    var entry = _active.get(category);
    if (!entry) return;
    entry.dismissAt = Date.now() + durationMs;
    entry.timerId = setTimeout(function () {
      if (entry.hovered) {
        // 호버 중이면 즉시 닫지 않고 leave 핸들러에서 처리
        return;
      }
      _dismiss(category);
    }, durationMs);
  }

  function _show(opts) {
    var category = opts.category;
    var existing = _active.get(category);

    // 중복 합치기 — 새로 띄우지 않고 카운터만 증가
    if (existing) {
      existing.count += 1;
      existing.msg.textContent = opts.text + ' (×' + existing.count + ')';
      clearTimeout(existing.timerId);
      _scheduleDismiss(category, opts.durationMs);
      return;
    }

    var root = _ensureRoot();
    if (!root) return;  // Node 환경 — silent

    var built = _makeToastEl(opts);
    root.appendChild(built.el);

    var entry = {
      el: built.el, msg: built.msg, count: 1,
      dismissAt: 0, timerId: null, hovered: false,
    };
    _active.set(category, entry);

    // 호버 일시정지 — leave 시 잔여시간 다시 카운트
    built.el.addEventListener('mouseenter', function () { entry.hovered = true; });
    built.el.addEventListener('mouseleave', function () {
      entry.hovered = false;
      _scheduleDismiss(category, opts.durationMs);
    });

    _scheduleDismiss(category, opts.durationMs);
  }

  // ── 공개 API ────────────────────────────────────────────────────
  SG.Notify = {
    withRetry,
    _MESSAGES: MESSAGES,
    _active:   _active,
    _dismiss:  _dismiss,

    /** Show a red error toast. category MUST be a key of MESSAGES.
     *  opts.retry: () => void — optional manual retry callback (renders "Retry" button)
     *  opts.detail: string — console.debug only, not shown to user
     */
    error: function (category, opts) {
      opts = opts || {};
      var meta = MESSAGES[category];
      if (!meta) {
        console.warn('[Notify] Unknown category:', category);
        return;
      }
      if (opts.detail) console.debug('[Notify]', category, opts.detail);
      _show({
        category:   category,
        kind:       'error',
        text:       meta.text,
        retry:      meta.manualRetry ? opts.retry : null,
        durationMs: 6000,
      });
    },

    /** Show a gray info toast. message is shown verbatim. */
    info: function (message, opts) {
      opts = opts || {};
      _show({
        category:   opts.category || ('_info_' + message.slice(0, 24)),
        kind:       'info',
        text:       message,
        retry:      null,
        durationMs: 3500,
      });
    },
  };
```

- [ ] **Step 2: Node sanity check (verify no crash, no DOM)**

Run:
```bash
node -e "global.window=global; require('./src/notify.js'); global.SG.Notify.error('FB_SUBMIT'); global.SG.Notify.info('hi'); console.log('OK', global.SG.Notify._active.size)"
```

Expected output:
```
OK 0
```

(Toasts are silently dropped in Node since `document` is undefined — `_active.size` stays 0.)

- [ ] **Step 3: Commit**

```bash
git add src/notify.js
git commit -m "feat(notify): add toast UI (dedup, hover-pause, retry button)"
```

---

## Task 3: notify.test.js — Unit tests for withRetry + dedup

**Files:**
- Create: `src/notify.test.js`

Test runs with `node src/notify.test.js`. Provides a minimal DOM stub so toast lifecycle can be tested without a real browser.

- [ ] **Step 1: Create the test file with DOM stub + withRetry suite**

Create `src/notify.test.js`:

```js
'use strict';
// Set up minimal DOM stub so notify.js can run in Node
global.window = global;
global.SG = {};

// ── Minimal DOM stub ─────────────────────────────────────────────
const _elements = new Map();
function makeEl(tag) {
  const handlers = {};
  const el = {
    tagName: tag.toUpperCase(),
    id: '',
    style: {},
    children: [],
    parentNode: null,
    textContent: '',
    setAttribute(k, v) { this[k] = v; },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    removeChild(c) {
      this.children = this.children.filter(x => x !== c);
      c.parentNode = null;
      return c;
    },
    addEventListener(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); },
    dispatchEvent(ev) { (handlers[ev.type] || []).forEach(fn => fn(ev)); },
    _handlers: handlers,
  };
  return el;
}
const _root = makeEl('body');
global.document = {
  body: _root,
  getElementById(id) {
    function find(node) {
      if (node.id === id) return node;
      for (const c of node.children) { const r = find(c); if (r) return r; }
      return null;
    }
    return find(_root);
  },
  createElement(tag) { return makeEl(tag); },
};

require('./notify.js');
const assert = require('assert');
const { withRetry, _MESSAGES, _active, _dismiss, error, info } = global.SG.Notify;

// ── withRetry: success on first try ──────────────────────────────
(async () => {
  let calls = 0;
  const result = await withRetry(async () => { calls++; return 42; }, { tries: 3 });
  assert.strictEqual(result, 42);
  assert.strictEqual(calls, 1, 'no retry on success');
  console.log('✓ withRetry succeeds on first try');
})();

// ── withRetry: succeeds after 2 failures ─────────────────────────
(async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls++;
    if (calls < 3) throw new Error('fail ' + calls);
    return 'ok';
  }, { tries: 3, backoff: [10, 10] });
  assert.strictEqual(result, 'ok');
  assert.strictEqual(calls, 3, 'retried twice');
  console.log('✓ withRetry succeeds after 2 retries');
})();

// ── withRetry: throws after exhausting tries ─────────────────────
(async () => {
  let calls = 0;
  try {
    await withRetry(async () => { calls++; throw new Error('boom ' + calls); },
                    { tries: 3, backoff: [5, 5] });
    assert.fail('should have thrown');
  } catch (e) {
    assert.strictEqual(calls, 3);
    assert.match(e.message, /boom 3/);
    console.log('✓ withRetry throws after exhausting tries');
  }
})();

// ── withRetry: retryOn=false stops immediately ──────────────────
(async () => {
  let calls = 0;
  try {
    await withRetry(async () => { calls++; const e = new Error('x'); e.code = 'permission-denied'; throw e; },
                    { tries: 3, backoff: [5, 5], retryOn: (err) => err.code !== 'permission-denied' });
    assert.fail('should have thrown');
  } catch (e) {
    assert.strictEqual(calls, 1, 'no retry when retryOn=false');
    console.log('✓ withRetry respects retryOn');
  }
})();
```

- [ ] **Step 2: Run withRetry tests**

Run:
```bash
node src/notify.test.js
```

Expected output (all 4 ✓ lines, plus async ordering may differ):
```
✓ withRetry succeeds on first try
✓ withRetry succeeds after 2 retries
✓ withRetry throws after exhausting tries
✓ withRetry respects retryOn
```

- [ ] **Step 3: Add toast dedup test**

Append to `src/notify.test.js`:

```js
// ── Toast: dedup increments counter, doesn't add new element ─────
(() => {
  _active.clear();
  for (const c of [..._root.children]) _root.removeChild(c);

  error('FB_SUBMIT');
  error('FB_SUBMIT');
  error('FB_SUBMIT');

  assert.strictEqual(_active.size, 1, 'only 1 active toast');
  const entry = _active.get('FB_SUBMIT');
  assert.strictEqual(entry.count, 3);
  assert.match(entry.msg.textContent, /\(×3\)/);
  console.log('✓ Toast dedup: 3 calls → 1 toast with (×3)');

  _dismiss('FB_SUBMIT');
  assert.strictEqual(_active.size, 0);
  console.log('✓ Dismiss clears active entry');
})();

// ── Toast: unknown category warns instead of throwing ────────────
(() => {
  const origWarn = console.warn;
  let warned = null;
  console.warn = (...args) => { warned = args.join(' '); };
  error('NOT_A_REAL_KEY');
  console.warn = origWarn;
  assert.match(warned, /Unknown category/);
  assert.strictEqual(_active.size, 0);
  console.log('✓ Unknown category warns instead of throwing');
})();
```

- [ ] **Step 4: Re-run all tests**

Run:
```bash
node src/notify.test.js
```

Expected: all 6 ✓ lines.

- [ ] **Step 5: Commit**

```bash
git add src/notify.test.js
git commit -m "test(notify): cover withRetry policies + toast dedup"
```

---

## Task 4: Wire `<script src="notify.js">` into 4 HTML files

**Files:**
- Modify: `src/daily.html`
- Modify: `src/endless.html`
- Modify: `src/samegame.html`
- Modify: `src/index.html`

notify.js must load BEFORE firebase.js and playgama.js (they call `SG.Notify`).

- [ ] **Step 1: Add notify.js script tag to daily.html**

In `src/daily.html`, find:
```html
<script src="playgama.js"></script>     <!-- Playgama Bridge (fallback) -->
<!-- Firebase: config + SDK는 firebase.js가 동적 로드 (없어도 게임 정상 동작) -->
<script src="firebase.js"></script>
```

Replace with:
```html
<script src="playgama.js"></script>     <!-- Playgama Bridge (fallback) -->
<!-- Toast/retry helper (leaf module, no deps — must precede firebase.js) -->
<script src="notify.js"></script>
<!-- Firebase: config + SDK는 firebase.js가 동적 로드 (없어도 게임 정상 동작) -->
<script src="firebase.js"></script>
```

- [ ] **Step 2: Add to endless.html**

In `src/endless.html`, find:
```html
<script src="playgama.js"></script>     <!-- Playgama Bridge (fallback) -->
<!-- Firebase: config + SDK는 firebase.js가 동적 로드 (없어도 게임 정상 동작) -->
<script src="firebase.js"></script>
```

Replace with:
```html
<script src="playgama.js"></script>     <!-- Playgama Bridge (fallback) -->
<!-- Toast/retry helper (leaf module, no deps — must precede firebase.js) -->
<script src="notify.js"></script>
<!-- Firebase: config + SDK는 firebase.js가 동적 로드 (없어도 게임 정상 동작) -->
<script src="firebase.js"></script>
```

- [ ] **Step 3: Add to samegame.html**

In `src/samegame.html`, find:
```html
<script src="playgama.js"></script>     <!-- Playgama Bridge (fallback) -->
<!-- Firebase: config + SDK는 firebase.js가 동적 로드 (없어도 게임 정상 동작) -->
<script src="firebase.js"></script>
```

Replace with:
```html
<script src="playgama.js"></script>     <!-- Playgama Bridge (fallback) -->
<!-- Toast/retry helper (leaf module, no deps — must precede firebase.js) -->
<script src="notify.js"></script>
<!-- Firebase: config + SDK는 firebase.js가 동적 로드 (없어도 게임 정상 동작) -->
<script src="firebase.js"></script>
```

- [ ] **Step 4: Add to index.html**

In `src/index.html`, find:
```html
<script src="playgama.js"></script>     <!-- Playgama Bridge wrapper -->
<!-- Firebase: config + SDK는 firebase.js가 동적 로드 (없어도 게임 정상 동작) -->
<script src="firebase.js"></script>
```

Replace with:
```html
<script src="playgama.js"></script>     <!-- Playgama Bridge wrapper -->
<!-- Toast/retry helper (leaf module, no deps — must precede firebase.js) -->
<script src="notify.js"></script>
<!-- Firebase: config + SDK는 firebase.js가 동적 로드 (없어도 게임 정상 동작) -->
<script src="firebase.js"></script>
```

- [ ] **Step 5: Smoke test — open one HTML in browser and check console**

Open `src/daily.html` in a browser (file:// is fine for boot smoke test).

In DevTools console, run:
```js
SG.Notify.error('FB_SUBMIT', { retry: () => console.log('retry clicked') })
```

Expected: red toast appears bottom-center with "Couldn't submit your score." + Retry button + ×.

- Click `Retry` → console logs `retry clicked`, toast closes.
- Run `SG.Notify.error('FB_SUBMIT')` 3 times → single toast with `(×3)` counter.
- Run `SG.Notify.info('hello')` → gray toast appears, auto-closes in 3.5s.

- [ ] **Step 6: Commit**

```bash
git add src/daily.html src/endless.html src/samegame.html src/index.html
git commit -m "feat(notify): wire notify.js script tag into 4 game HTMLs"
```

---

## Task 5: firebase.js — boundary for `submitDailyScore`

**Files:**
- Modify: `src/firebase.js` (lines 73–141)

Extract current body into `_submitDailyScoreOnce`. Wrap public `submitDailyScore` with pre-validation + withRetry + Notify dispatch.

- [ ] **Step 1: Rename existing body to `_submitDailyScoreOnce`**

In `src/firebase.js`, find:
```js
  // ── 일별 점수 제출 → 리더보드 갱신 ──────────────────────────────
  async function submitDailyScore({ date, diff, score, moves, cleared }) {
    if (!db) throw new Error('Firebase not connected');
    const playerId = getPlayerId();
    const loc      = await fetchLocation();
```

Replace with:
```js
  // ── 일별 점수 제출 → 리더보드 갱신 ──────────────────────────────
  // 내부 1회 시도 — withRetry 가 감쌈
  async function _submitDailyScoreOnce({ date, diff, score, moves, cleared }) {
    const playerId = getPlayerId();
    const loc      = await fetchLocation();
```

(Just rename the function and drop the `if (!db) throw` line — pre-validation moves to the public wrapper.)

- [ ] **Step 2: Add public `submitDailyScore` wrapper**

Find the closing brace of `_submitDailyScoreOnce` (was originally around line 141):
```js
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
```

Immediately after that closing `}`, insert:
```js

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
```

- [ ] **Step 3: Smoke test in browser**

Open `src/daily.html` in browser. Since Firebase is unset locally (or `db=null`), `submitDailyScore` returns null without any error or toast — current daily.html behavior should be identical.

In DevTools:
```js
await SG.FB.submitDailyScore({date:'2026-06-10', diff:'easy', score:1000, moves:5, cleared:true})
```
Expected: returns `null` (no toast — Firebase not connected locally).

- [ ] **Step 4: Commit**

```bash
git add src/firebase.js
git commit -m "refactor(firebase): boundary pattern for submitDailyScore"
```

---

## Task 6: firebase.js — boundary for remaining user-intent functions

**Files:**
- Modify: `src/firebase.js`

Apply the same pattern to `getDailyLeaderboard`, `submitEndlessScore`, `getEndlessLeaderboard`.

- [ ] **Step 1: Refactor `getDailyLeaderboard`**

In `src/firebase.js`, find:
```js
  // ── 리더보드 조회 ─────────────────────────────────────────────────
  async function getDailyLeaderboard(date, diff) {
    if (!db) throw new Error('Firebase not connected');
    const snap = await db.collection('sg_daily_lb').doc(date + '_' + diff).get();
    return snap.exists ? snap.data() : { top: [], total: 0, clearedCount: 0 };
  }
```

Replace with:
```js
  // ── 리더보드 조회 ─────────────────────────────────────────────────
  async function _getDailyLeaderboardOnce(date, diff) {
    const snap = await db.collection('sg_daily_lb').doc(date + '_' + diff).get();
    return snap.exists ? snap.data() : { top: [], total: 0, clearedCount: 0 };
  }

  async function getDailyLeaderboard(date, diff) {
    if (!db) return null;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      SG.Notify.error('NETWORK', { retry: () => getDailyLeaderboard(date, diff) });
      return null;
    }
    try {
      return await SG.Notify.withRetry(
        () => _getDailyLeaderboardOnce(date, diff),
        {
          tries:   3,
          backoff: [500, 1500],
          retryOn: (err) => err && err.code !== 'permission-denied',
        }
      );
    } catch (e) {
      SG.Notify.error('FB_FETCH', {
        retry:  () => getDailyLeaderboard(date, diff),
        detail: e && (e.code || e.message),
      });
      return null;
    }
  }
```

- [ ] **Step 2: Refactor `submitEndlessScore`**

In `src/firebase.js`, find:
```js
  // ── Endless 세션 점수 제출 → 난이도별 Top-20 갱신 ────────────────
  // sg_endless_lb/{diff} — Top-20 세션 점수 (최고점 유지)
  async function submitEndlessScore({ diff, score, level }) {
    if (!db) throw new Error('Firebase not connected');
    const playerId = getPlayerId();
    const loc      = await fetchLocation();
```

Replace the first line of the function body (`if (!db) throw ...`) by renaming to internal helper:
```js
  // ── Endless 세션 점수 제출 → 난이도별 Top-20 갱신 ────────────────
  // sg_endless_lb/{diff} — Top-20 세션 점수 (최고점 유지)
  async function _submitEndlessScoreOnce({ diff, score, level }) {
    const playerId = getPlayerId();
    const loc      = await fetchLocation();
```

Then find the end of that function (the return block):
```js
    const myIdx = lbSnap.top.findIndex(e => e.playerId === playerId);
    return {
      top:      lbSnap.top,
      total:    lbSnap.total,
      playerId,
      rank:     myIdx >= 0 ? myIdx + 1 : lbSnap.total,
    };
  }
```

Immediately after that closing `}`, insert the public wrapper:
```js

  async function submitEndlessScore(args) {
    if (!db) return null;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      SG.Notify.error('NETWORK', { retry: () => submitEndlessScore(args) });
      return null;
    }
    try {
      return await SG.Notify.withRetry(
        () => _submitEndlessScoreOnce(args),
        {
          tries:   3,
          backoff: [500, 1500],
          retryOn: (err) => err && err.code !== 'permission-denied',
        }
      );
    } catch (e) {
      SG.Notify.error('FB_SUBMIT', {
        retry:  () => submitEndlessScore(args),
        detail: e && (e.code || e.message),
      });
      return null;
    }
  }
```

- [ ] **Step 3: Refactor `getEndlessLeaderboard`**

In `src/firebase.js`, find:
```js
  // ── Endless 리더보드 조회 ─────────────────────────────────────────
  async function getEndlessLeaderboard(diff) {
    if (!db) return null;
    try {
      const snap = await db.collection('sg_endless_lb').doc(diff).get();
      return snap.exists ? snap.data() : { top: [], total: 0 };
    } catch (e) { return null; }
  }
```

Replace with:
```js
  // ── Endless 리더보드 조회 ─────────────────────────────────────────
  async function _getEndlessLeaderboardOnce(diff) {
    const snap = await db.collection('sg_endless_lb').doc(diff).get();
    return snap.exists ? snap.data() : { top: [], total: 0 };
  }

  async function getEndlessLeaderboard(diff) {
    if (!db) return null;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      SG.Notify.error('NETWORK', { retry: () => getEndlessLeaderboard(diff) });
      return null;
    }
    try {
      return await SG.Notify.withRetry(
        () => _getEndlessLeaderboardOnce(diff),
        {
          tries:   3,
          backoff: [500, 1500],
          retryOn: (err) => err && err.code !== 'permission-denied',
        }
      );
    } catch (e) {
      SG.Notify.error('FB_FETCH', {
        retry:  () => getEndlessLeaderboard(diff),
        detail: e && (e.code || e.message),
      });
      return null;
    }
  }
```

- [ ] **Step 4: Browser smoke test**

Open `src/endless.html` in browser. In DevTools:
```js
await SG.FB.getEndlessLeaderboard('easy')   // → null  (local: db is null)
await SG.FB.submitEndlessScore({diff:'easy', score:100, level:2})  // → null
```
Expected: both return `null`, no toast, no console error.

- [ ] **Step 5: Commit**

```bash
git add src/firebase.js
git commit -m "refactor(firebase): boundary pattern for 3 remaining user-intent fns"
```

---

## Task 7: firebase.js — SDK load failure → `FB_SDK_INIT` notify

**Files:**
- Modify: `src/firebase.js` (the dynamic SDK load IIFE at the bottom)

Currently, SDK script load failure only logs `console.warn`. Replace with `SG.Notify.error('FB_SDK_INIT')`.

- [ ] **Step 1: Replace silent warns with Notify dispatch**

In `src/firebase.js`, find:
```js
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
```

Replace with:
```js
  // 비로컬 환경: firebase-config.js 동적 로드 → Firebase SDK → 초기화
  // config 파일이 없어도(404) 게임은 정상 동작 (isConnected()=false → 더미 데이터)
  (async function () {
    // firebase-config.js를 동적으로 로드 (없으면 조용히 건너뜀 — 정상 분기)
    await _loadScript('firebase-config.js');
    if (!global.SG_FIREBASE_CONFIG) return; // 설정 없으면 Firebase 비활성 (정상)

    // 설정은 있는데 SDK 로드가 실패한 경우 — 사용자에게 안내
    var BASE = 'https://www.gstatic.com/firebasejs/8.10.1/';
    var ok1  = await _loadScript(BASE + 'firebase-app.js');
    if (!ok1) {
      console.debug('[SG.FB] firebase-app.js 로드 실패');
      if (SG.Notify) SG.Notify.error('FB_SDK_INIT');
      return;
    }
    var ok2  = await _loadScript(BASE + 'firebase-firestore.js');
    if (!ok2) {
      console.debug('[SG.FB] firebase-firestore.js 로드 실패');
      if (SG.Notify) SG.Notify.error('FB_SDK_INIT');
      return;
    }

    if (!init(global.SG_FIREBASE_CONFIG)) {
      if (SG.Notify) SG.Notify.error('FB_SDK_INIT');
    }
  })();
```

- [ ] **Step 2: Smoke test (no behavior change locally)**

Open `src/daily.html` in browser. Local `file://` skips the SDK load entirely — no toast. Expected: console shows `[SG.FB] 로컬 환경 — Firebase SDK 로드 생략 (DEMO 모드)`.

- [ ] **Step 3: Commit**

```bash
git add src/firebase.js
git commit -m "feat(firebase): notify FB_SDK_INIT on SDK load failure"
```

---

## Task 8: crazygames.js — replace `isLocal` with `isCG` host check (sdkDisabled root fix)

**Files:**
- Modify: `src/crazygames.js` (lines 44–54)

Currently, SDK loads on any non-`file://`/`localhost` host, then `_sdk.init()` throws `sdkDisabled` on non-CG domains. Root fix: only attempt SDK load when host is actually a CrazyGames domain. Everything else gets the no-op path.

- [ ] **Step 1: Replace the `isLocal` gate with an `isCG` gate**

In `src/crazygames.js`, find:
```js
  // ── 초기화 ─────────────────────────────────────────────────────
  async function init() {
    // ① 로컬 환경 감지 → SDK 완전 생략 (sdkDisabled 에러 원천 차단)
    var proto   = (typeof location !== 'undefined') ? location.protocol : '';
    var host    = (typeof location !== 'undefined') ? location.hostname  : '';
    var isLocal = proto === 'file:' || host === '' ||
                  host === 'localhost' || host === '127.0.0.1';

    if (isLocal) {
      console.log('[SG.CG] 로컬 환경 — CG SDK 로드 생략 (no-op 모드)');
      return false;
    }
```

Replace with:
```js
  // ── 초기화 ─────────────────────────────────────────────────────
  async function init() {
    // ① 비-CrazyGames 호스트면 SDK 로드 자체를 건너뜀.
    //    (init 후 SDK 내부 background promise 가 sdkDisabled 를 throw 하는 것을
    //     호출 시점이 아닌 호스트 시점에서 차단)
    var host = (typeof location !== 'undefined') ? location.hostname : '';
    var isCG = host === 'crazygames.com'
            || host.endsWith('.crazygames.com')
            || host.endsWith('.crazygames.io');

    if (!isCG) {
      console.debug('[SG.CG] non-CrazyGames host (' + (host || 'unknown') + ') — SDK init skipped');
      return false;
    }
```

- [ ] **Step 2: Smoke test in browser**

Open `src/endless.html` in browser (file://). Console should show:
```
[SG.CG] non-CrazyGames host (...) — SDK init skipped
```
**No more `sdkDisabled` error.**

- [ ] **Step 3: Commit**

```bash
git add src/crazygames.js
git commit -m "fix(crazygames): gate SDK init on isCG host (root-cause sdkDisabled fix)"
```

---

## Task 9: playgama.js — `?dev` debug log gate + rewarded failure notify

**Files:**
- Modify: `src/playgama.js`

Two changes: (1) gate noisy `console.log` calls behind `?dev` URL param, (2) on real-server rewarded failure/timeout, dispatch `AD_REWARDED` toast with retry callback.

- [ ] **Step 1: Add the `dlog` helper near the top of the IIFE**

In `src/playgama.js`, find the IIFE opening:
```js
(function (global) {
  'use strict';

  const SG = global.SG = global.SG || {};
```

Insert immediately after `const SG = ...` line:
```js

  // ── 디버그 로그 게이트: ?dev 일 때만 출력 ───────────────────────
  const _DEV = (typeof location !== 'undefined') &&
               new URLSearchParams(location.search).has('dev');
  function dlog() { if (_DEV) console.log.apply(console, arguments); }
```

- [ ] **Step 2: Replace `[PG.inter]` / `[PG.rewarded]` / `[PG.banner]` console.log → dlog**

In `src/playgama.js`, use the editor's find & replace (the strings are unique enough):

| Find                           | Replace            |
|--------------------------------|--------------------|
| `console.log('[PG.inter]`      | `dlog('[PG.inter]` |
| `console.log('[PG.rewarded]`   | `dlog('[PG.rewarded]` |
| `console.log('[PG.banner]`     | `dlog('[PG.banner]` |

(Apply replace-all for each pattern. `console.warn` and other levels remain unchanged.)

- [ ] **Step 3: Add `sawFailed` tracking + rewarded failure notify (production only)**

The spec policy distinguishes "user-intentional skip" (silent) from "ad load failure" (notify).
In Playgama state machine: `failed` event = SDK failure, `closed` without prior `failed` = user skip.
We track `sawFailed` and only notify on real-server failures.

Find the `SG.CG.requestRewardedAd` patched function in playgama.js. Inside the `return new Promise(...)` callback, find:

```js
      return new Promise(function (resolve) {
        var granted = false;
        var done    = false;
        var timeout = null;

        function finish() {
          if (done) return;
          done = true;
          clearTimeout(timeout);
          // 오디오 복원은 플랫폼 audioStateChanged 이벤트가 자동 처리
          resolve({ granted });
        }
```

Replace with:
```js
      return new Promise(function (resolve) {
        var granted    = false;
        var done       = false;
        var sawFailed  = false;   // ★ 실서버 실패 여부 (closed-only = 사용자 스킵)
        var timeout    = null;

        function finish() {
          if (done) return;
          done = true;
          clearTimeout(timeout);
          // 실서버에서 실제 광고 로드 실패(failed) 또는 타임아웃 → 토스트 + 재시도.
          // 사용자가 광고를 의도적으로 닫은(closed-only) 경우는 silent.
          // mock 모드는 QA 시나리오이므로 항상 silent.
          if (!granted && !isMockR && sawFailed && SG.Notify) {
            SG.Notify.error('AD_REWARDED', {
              retry: function () { SG.CG.requestRewardedAd(pid); }
            });
          }
          resolve({ granted });
        }
```

Then find the `onState` function inside the same Promise. Look for the `failed` branch — it currently looks like:
```js
          if (state === 'failed') {
            if (isMockR) {
              try { _bridge.advertisement.off(evRew, onState); } catch (e) {}
              try { _bridge.advertisement.on(evRew, onState);  } catch (e) {}
            } else {
              try { _bridge.advertisement.off(evRew, onState); } catch (e) {}
              finish();
            }
          }
```

Replace with:
```js
          if (state === 'failed') {
            sawFailed = true;
            if (isMockR) {
              try { _bridge.advertisement.off(evRew, onState); } catch (e) {}
              try { _bridge.advertisement.on(evRew, onState);  } catch (e) {}
            } else {
              try { _bridge.advertisement.off(evRew, onState); } catch (e) {}
              finish();
            }
          }
```

And find the timeout setter inside the same Promise:
```js
        timeout = setTimeout(function () {
          try { _bridge.advertisement.off(evRew, onState); } catch (e) {}
          finish();
        }, _rewardTimeout);
```

Replace with:
```js
        timeout = setTimeout(function () {
          sawFailed = true;  // 타임아웃도 실패로 분류
          try { _bridge.advertisement.off(evRew, onState); } catch (e) {}
          finish();
        }, _rewardTimeout);
```

(`pid` and `isMockR` are already in scope — both are at the outer async function level.)

- [ ] **Step 4: Add isRewardedSupported=false info notify (real server only)**

Find:
```js
      var isMockR = _bridge.platform.id === 'mock';
      if (!isMockR && !_bridge.advertisement.isRewardedSupported) {
        console.warn('[PG.rewarded] isRewardedSupported = false → skipped');
        return { granted: false };
      }
```

Replace with:
```js
      var isMockR = _bridge.platform.id === 'mock';
      if (!isMockR && !_bridge.advertisement.isRewardedSupported) {
        console.debug('[PG.rewarded] isRewardedSupported = false → skipped');
        if (SG.Notify) SG.Notify.info('Ad not available right now.');
        return { granted: false };
      }
```

- [ ] **Step 5: Smoke test in browser**

Open `src/endless.html` (file://). No `[PG.*]` logs in console.
Open `src/endless.html?dev`. `[PG.*]` logs reappear when boot runs.

- [ ] **Step 6: Commit**

```bash
git add src/playgama.js
git commit -m "feat(playgama): ?dev log gate + AD_REWARDED notify on real-server failure"
```

---

## Task 10: endless.html — delete 3 suppressors + simplify `_submitEndlessLb`

**Files:**
- Modify: `src/endless.html`

Now that crazygames.js root-fixes sdkDisabled and boundary always resolves safely, the temporary suppressors are dead weight.

- [ ] **Step 1: Delete the `unhandledrejection` sdkDisabled suppressor**

In `src/endless.html`, find inside the boot IIFE (around line 1754):
```js
(async () => {
  // CrazyGames SDK가 비-CG 도메인에서 sdkDisabled를 비동기 throw할 수 있음
  // → console 오류 억제 (게임 동작에는 영향 없음)
  window.addEventListener('unhandledrejection', function (evt) {
    var r = evt.reason;
    if (r && (r.code === 'sdkDisabled' ||
        (typeof r.message === 'string' && r.message.indexOf('sdkDisabled') !== -1))) {
      evt.preventDefault();
    }
  });

  // Playgama Bridge 또는 CrazyGames SDK 초기화
```

Replace with:
```js
(async () => {
  // Playgama Bridge 또는 CrazyGames SDK 초기화
```

- [ ] **Step 2: Delete the boot `.catch(function(){})`**

In `src/endless.html`, find at the bottom of the boot IIFE (around line 1808):
```js
})().catch(function () {/* boot 에러 무시 */});
```

Replace with:
```js
})();
```

- [ ] **Step 3: Delete the `getGlobalStats().then().catch()` swallow**

In `src/endless.html`, find (around line 1718):
```js
      if (SG.FB && SG.FB.isConnected()) {
        SG.FB.getGlobalStats(currentDiff).then(stats => {
          if (!stats || !stats.totalGames) return;
          const rate = Math.round(stats.clearedGames / stats.totalGames * 100);
          olGlobalRate.textContent =
            `global ${currentDiff.toUpperCase()} clear rate: ${rate}%`
            + ` (${stats.clearedGames.toLocaleString()}/${stats.totalGames.toLocaleString()} sessions)`;
          olGlobalRate.style.display = 'block';
        }).catch(function () {});  // Firebase 실패 시 통계 미표시 (silent)
      }
```

Replace with:
```js
      if (SG.FB && SG.FB.isConnected()) {
        SG.FB.getGlobalStats(currentDiff).then(stats => {
          if (!stats || !stats.totalGames) return;
          const rate = Math.round(stats.clearedGames / stats.totalGames * 100);
          olGlobalRate.textContent =
            `global ${currentDiff.toUpperCase()} clear rate: ${rate}%`
            + ` (${stats.clearedGames.toLocaleString()}/${stats.totalGames.toLocaleString()} sessions)`;
          olGlobalRate.style.display = 'block';
        });
      }
```

(getGlobalStats is silent-policy — always resolves. The `.catch` is dead.)

- [ ] **Step 4: Simplify `_submitEndlessLb`**

In `src/endless.html`, find (around line 1403):
```js
async function _submitEndlessLb(score, lvl) {
  try {
    const result = await SG.FB.submitEndlessScore({ diff: currentDiff, score, level: lvl });
    _renderEndlessLb(result);
  } catch (e) {
    _renderEndlessLb(_makeDummyEndless(score, lvl));
  }
}
```

Replace with:
```js
async function _submitEndlessLb(score, lvl) {
  // boundary는 throw 하지 않음. null 이면 더미 렌더링.
  const result = await SG.FB.submitEndlessScore({ diff: currentDiff, score, level: lvl });
  _renderEndlessLb(result || _makeDummyEndless(score, lvl));
}
```

- [ ] **Step 5: Browser smoke test**

Open `src/endless.html` (file://). Console should be clean — no `sdkDisabled` error, no `[PG.*]` debug spam (unless `?dev`). Play a full game (clear level 1, fail level 2, see gameover overlay). Expected: gameover shows dummy leaderboard (Firebase unconfigured locally) without console errors.

- [ ] **Step 6: Commit**

```bash
git add src/endless.html
git commit -m "refactor(endless): remove 3 suppressors + simplify _submitEndlessLb"
```

---

## Task 11: daily.html — simplify `submitToFirebase`

**Files:**
- Modify: `src/daily.html`

- [ ] **Step 1: Replace try/catch with null check**

In `src/daily.html`, find exactly (lines 723–741):
```js
async function submitToFirebase(run) {
  // 글로벌 통계 갱신 (비필수 — 내부에서 실패 무시)
  SG.FB.updateGlobalStats(currentDiff, run.cleared);
  try {
    const today  = dailyMgr.todayKey();
    const result = await SG.FB.submitDailyScore({
      date:    today,
      diff:    currentDiff,
      score:   run.score,
      moves:   run.moves,
      cleared: run.cleared,
    });
    renderLeaderboard(result);
  } catch (e) {
    // Firebase 실패 → 더미 데이터로 조용히 폴백
    console.warn('[SG] Firebase submission failed (fallback to demo):', e);
    renderLeaderboard(makeDummyResult(run));
  }
}
```

Replace with:
```js
async function submitToFirebase(run) {
  // 글로벌 통계 갱신 (비필수 — silent 정책, boundary가 console.debug만)
  SG.FB.updateGlobalStats(currentDiff, run.cleared);

  // boundary는 throw하지 않음. null 이면 더미 렌더링.
  const today  = dailyMgr.todayKey();
  const result = await SG.FB.submitDailyScore({
    date:    today,
    diff:    currentDiff,
    score:   run.score,
    moves:   run.moves,
    cleared: run.cleared,
  });
  renderLeaderboard(result || makeDummyResult(run));
}
```

- [ ] **Step 2: Browser smoke test (daily.html regression baseline)**

Open `src/daily.html` (file://). Play through one game: pick difficulty → play → game over. Expected: dummy leaderboard shows on game over (since Firebase is offline locally), no console errors, no toast.

- [ ] **Step 3: Commit**

```bash
git add src/daily.html
git commit -m "refactor(daily): simplify submitToFirebase via boundary null contract"
```

---

## Task 12: Regression matrix walkthrough + Definition of Done

**Files:**
- Read-only verification across all changed files.

This is not a code task — it's the final manual verification.

- [ ] **Step 1: Run unit tests**

Run:
```bash
node src/notify.test.js
node src/core.test.js
```
Expected: both print all `✓` lines and end with `All tests passed.` (core.test.js) / no thrown assertions.

- [ ] **Step 2: Smoke test daily.html (QA-verified baseline — must not regress)**

Open `src/daily.html` in browser (file://).
- ✓ Boot — no `sdkDisabled` in console, no `[PG.*]` spam
- ✓ Pick difficulty → play through 1 game → game over → dummy leaderboard renders
- ✓ DevTools `SG.Notify.error('FB_SUBMIT')` → toast appears

- [ ] **Step 3: Smoke test endless.html**

Open `src/endless.html` in browser (file://).
- ✓ Boot — clean console
- ✓ Play through level 1 → level clear overlay → level 2 → game over → dummy endless leaderboard
- ✓ 2× SCORE button visible after level clear (until grid is full)
- ✓ CONTINUE button visible after game over (until used)

- [ ] **Step 4: Smoke test samegame.html and index.html boot**

Open each in browser. Confirm:
- ✓ No `sdkDisabled` error
- ✓ Boot logs clean (only intentional info logs)
- ✓ `SG.Notify` is defined in console

- [ ] **Step 5: Verify no dead suppressors remain**

Run:
```bash
grep -rn "sdkDisabled\|unhandledrejection" src/*.html src/*.js
```

Expected: only matches inside `crazygames.js` legacy comment (root-fix means suppressor is gone). No `unhandledrejection` event listener in any HTML.

Run:
```bash
grep -rn "catch *( *) *{}\|catch *(e) *{ */\* *.*무시" src/*.html
```
Expected: no matches in HTML (boundary owns error handling).

- [ ] **Step 6: Produce Playgama-ready ZIP for QA**

Run (PowerShell):
```powershell
Compress-Archive -Path "src\*" -DestinationPath "samegame-grid.zip" -Force
```

Upload to Playgama developer console. Run QA checks:
- ✓ Start pass — `game_ready` received within 30s
- ✓ Interstitial — `showInterstitial('level_complete')` intercepted (mock)
- ✓ Rewarded — `showRewarded('continue_game')` intercepted, QA injects `rewarded → closed`, button proceeds
- ✓ Rewarded — `showRewarded('score_double')` same as above
- ✓ daily.html retry reward same as endless.html

- [ ] **Step 7: Final commit (optional — only if any cleanup edits happened during regression)**

```bash
git status
# If clean, no commit needed
```

---

## Definition of Done Checklist

- [ ] All 12 tasks committed
- [ ] `node src/notify.test.js` — 6/6 tests pass
- [ ] `node src/core.test.js` — existing tests still pass
- [ ] No `sdkDisabled` console errors on file:// for all 4 HTMLs
- [ ] No `unhandledrejection` listener in any HTML file
- [ ] daily.html full playthrough regression — no console errors
- [ ] endless.html full playthrough regression — no console errors
- [ ] Playgama mock QA — start pass + interstitial + 2 rewarded variants all intercept correctly
- [ ] `?dev` URL flag toggles `[PG.*]` debug logs
- [ ] DevTools `SG.Notify.error('FB_SUBMIT', { retry: () => {} })` shows toast + retry button across all 4 HTMLs

---

## Notes for the implementing engineer

- **Read the spec first**: `docs/superpowers/specs/2026-06-10-error-boundary-design.md`. The plan implements it; the spec explains why.
- **Never re-introduce `try { ... } catch (e) {}` empty catches** in game code. The boundary handles error paths.
- **Game logic untouched**: tasks 10–11 only delete dead defensive code, not change game flow. If you find yourself editing scoring, board logic, level progression, or input handling — stop, you're outside scope.
- **Playgama QA invariants are sacred**: do NOT add pre-validation that would prevent `showInterstitial` / `showRewarded` from being called in mock mode. The current pattern (skip only when `!isMock && !isSupported`) must be preserved.
- **daily.html is the verified baseline**: if anything in daily.html breaks after task 11, the boundary refactor is wrong. Revert and investigate before continuing.
