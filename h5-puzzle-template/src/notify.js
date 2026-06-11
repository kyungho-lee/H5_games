/* notify.js — H5 Puzzle Template — Toast notifications + retry policy
   ═══════════════════════════════════════════════════════════════════
   Leaf module: no dependencies. Platform adapters dispatch errors here.

   API:
     SG.Notify.error(category, opts)  — red toast + optional retry
     SG.Notify.info(message, opts)    — gray toast (no retry)
     SG.Notify.withRetry(fn, policy)  — boundary-only auto-retry helper
*/
(function (global) {
  'use strict';

  const SG = global.SG = global.SG || {};

  // ── TODO: 게임에 맞게 카테고리 수정 ──────────────────────────────
  const MESSAGES = {
    FB_SUBMIT:    { text: "Couldn't submit your score.",                 manualRetry: true  },
    FB_FETCH:     { text: "Couldn't load the leaderboard.",              manualRetry: true  },
    FB_SDK_INIT:  { text: "Leaderboard unavailable. Playing offline.",   manualRetry: false },
    AD_REWARDED:  { text: "Couldn't load the ad.",                       manualRetry: true  },
    AD_INTER:     { text: "Ad failed to display.",                       manualRetry: false },
    SDK_INIT:     { text: "Ad SDK unavailable. Continuing without ads.", manualRetry: false },
    NETWORK:      { text: "Network connection problem.",                 manualRetry: true  },
  };

  const _active = new Map();

  async function withRetry(fn, policy) {
    const tries   = policy.tries  || 3;
    const backoff = policy.backoff || [];
    const retryOn = policy.retryOn || (() => true);
    let lastErr = null;
    for (let i = 0; i < tries; i++) {
      try { return await fn(); }
      catch (e) {
        lastErr = e;
        if (i === tries - 1)  throw e;
        if (!retryOn(e))      throw e;
        const wait = backoff[i] || 0;
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
      }
    }
    throw lastErr;
  }

  let _root = null;
  function _ensureRoot() {
    if (_root) return _root;
    if (typeof document === 'undefined') return null;
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
        try { opts.retry(); } catch (e) {}
        _dismiss(opts.category);
      });
      el.appendChild(btn);
    }
    var x = document.createElement('button');
    x.textContent = '×';
    x.setAttribute('aria-label', 'Dismiss');
    x.setAttribute('style',
      'background:transparent;color:#888;border:none;font:16px sans-serif;cursor:pointer;padding:0 4px;');
    x.addEventListener('click', function () { _dismiss(opts.category); });
    el.appendChild(x);
    return { el, msg };
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
    clearTimeout(entry.timerId);
    entry.dismissAt = Date.now() + durationMs;
    entry.timerId = setTimeout(function () {
      if (entry.hovered) return;
      _dismiss(category);
    }, durationMs);
  }

  function _show(opts) {
    var category = opts.category;
    var existing = _active.get(category);
    if (existing) {
      existing.count += 1;
      existing.msg.textContent = opts.text + ' (×' + existing.count + ')';
      clearTimeout(existing.timerId);
      _scheduleDismiss(category, opts.durationMs);
      return;
    }
    var root = _ensureRoot();
    if (!root) return;
    var built = _makeToastEl(opts);
    root.appendChild(built.el);
    var entry = { el: built.el, msg: built.msg, count: 1, dismissAt: 0, timerId: null, hovered: false };
    _active.set(category, entry);
    built.el.addEventListener('mouseenter', function () { entry.hovered = true; });
    built.el.addEventListener('mouseleave', function () {
      entry.hovered = false;
      var remaining = entry.dismissAt - Date.now();
      if (remaining > 0) { _scheduleDismiss(category, remaining); }
      else { _dismiss(category); }
    });
    _scheduleDismiss(category, opts.durationMs);
  }

  SG.Notify = {
    withRetry,
    _MESSAGES: MESSAGES,
    _active,
    _dismiss,
    error: function (category, opts) {
      opts = opts || {};
      var meta = MESSAGES[category];
      if (!meta) { console.warn('[Notify] Unknown category:', category); return; }
      if (opts.detail) console.debug('[Notify]', category, opts.detail);
      _show({ category, kind: 'error', text: meta.text, retry: meta.manualRetry ? opts.retry : null, durationMs: 6000 });
    },
    info: function (message, opts) {
      opts = opts || {};
      _show({ category: opts.category || ('_info_' + message.slice(0, 24)), kind: 'info', text: message, retry: null, durationMs: 3500 });
    },
  };

})(typeof window !== 'undefined' ? window : global);
