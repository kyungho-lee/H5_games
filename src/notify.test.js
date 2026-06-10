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
