/* star-fly.js — reusable "reward flies to a counter" FX. Zero dependencies.
   ════════════════════════════════════════════════════════════════════════
   Fly N reward glyphs (★ by default) one-by-one from a screen point into a
   HUD counter element, so earning a reward reads clearly: each glyph holds
   big at the source, then arcs slowly into the counter and ticks it up.

   No canvas, no SG modules, no build step. Browser globals only
   (document, requestAnimationFrame). Coordinate-injected so it works in any
   HTML: the caller passes a source screen-xy and a target DOM element.

     SG.StarFly.burst({
       from: { x, y },     // viewport coords — launch point          (required)
       to:   Element,      // HUD counter; re-measured each frame      (required)
       count: 5,           // glyphs to fly                            (default 1)
       onArrive: fn,       // called as each glyph lands — tick +1     (optional)
       onDone:   fn,       // called once after all have landed        (optional)
       glyph: '★', color: '#ffd23f', size: 28,   // appearance         (optional)
       stagger: 80,        // ms between successive launches           (default 80)
       maxCount: 12,       // hard cap on simultaneous glyphs          (default 12)
     });

   Date.now()/Math.random() are used only for timing/jitter (render-only). */
(function (global) {
  'use strict';

  const doc = global.document;
  if (!doc) {                                   // non-browser (node test load): no-op stub
    global.SG = global.SG || {};
    global.SG.StarFly = { burst: function () {} };
    return;
  }

  const STYLE_ID = 'sg-star-fly-style';
  const HOLD_MS = 500;     // dwell + pop at source
  const FLY_MS  = 700;     // arc into the counter

  function injectStyle() {
    if (doc.getElementById(STYLE_ID)) return;
    const s = doc.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '.sg-star-fly{position:fixed;left:0;top:0;pointer-events:none;z-index:99999;' +
      'will-change:transform,opacity;transform-origin:50% 50%;' +
      'font-family:sans-serif;line-height:1;text-align:center;}';
    (doc.head || doc.documentElement).appendChild(s);
  }

  const easeIn  = t => t * t;
  const easeOut = t => 1 - (1 - t) * (1 - t);

  // viewport-center of a DOM element (re-measured each frame so layout shifts
  // and scrolling don't desync the landing point).
  function elCenter(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // Active flyers + a single shared rAF loop (idle cost zero when empty).
  let flyers = [];
  let rafId = null;
  let lastTs = 0;

  function ensureLoop() {
    if (rafId != null) return;
    lastTs = 0;
    rafId = global.requestAnimationFrame(tick);
  }

  function tick(ts) {
    const dt = lastTs ? (ts - lastTs) : 16;
    lastTs = ts;

    for (const f of flyers) f.advance(dt, ts);
    flyers = flyers.filter(f => !f.done);

    if (flyers.length) {
      rafId = global.requestAnimationFrame(tick);
    } else {
      rafId = null;
    }
  }

  class Flyer {
    constructor(opts, index, onArrive) {
      this.from = opts.from;
      this.to = opts.to;                 // DOM element
      this.onArrive = onArrive;
      this.delay = index * (opts.stagger != null ? opts.stagger : 80);
      this.elapsed = 0;
      this.phase = 'wait';               // wait → hold → fly → done
      this.done = false;
      // control point for the arc: midpoint nudged upward + slight lateral jitter
      this._jitterX = (Math.random() - 0.5) * 60;
      this._arrived = false;

      const node = doc.createElement('div');
      node.className = 'sg-star-fly';
      node.textContent = opts.glyph || '★';
      const size = opts.size || 28;
      node.style.fontSize = size + 'px';
      node.style.color = opts.color || '#ffd23f';
      node.style.textShadow = '0 0 8px ' + (opts.color || '#ffd23f');
      node.style.opacity = '0';
      (doc.body || doc.documentElement).appendChild(node);
      this.node = node;
      this._half = size / 2;
      this._place(this.from.x, this.from.y, 0.1);
    }

    _place(x, y, scale, alpha) {
      // translate to viewport point; offset by half so the glyph centers on (x,y)
      this.node.style.transform =
        'translate(' + (x - this._half) + 'px,' + (y - this._half) + 'px) scale(' + scale + ')';
      if (alpha != null) this.node.style.opacity = String(alpha);
    }

    advance(dt) {
      if (this.done) return;
      this.elapsed += dt;

      if (this.phase === 'wait') {
        if (this.elapsed < this.delay) return;
        this.elapsed = 0; this.phase = 'hold';
      }

      if (this.phase === 'hold') {
        const t = Math.min(this.elapsed / HOLD_MS, 1);
        // pop big then settle: scale 1.6 → 1.0; fade in fast
        const scale = 1.6 - 0.6 * easeOut(t);
        const alpha = Math.min(t * 3, 1);
        this._place(this.from.x, this.from.y, scale, alpha);
        if (t >= 1) { this.elapsed = 0; this.phase = 'fly'; this._captureTarget(); }
        return;
      }

      if (this.phase === 'fly') {
        const t = Math.min(this.elapsed / FLY_MS, 1);
        const k = easeIn(t) * 0.4 + easeOut(t) * 0.6;   // slow-out, gentle-in
        const dst = elCenter(this.to);                   // re-measure each frame
        const sx = this.from.x, sy = this.from.y;
        const dx = dst.x, dy = dst.y;
        // quadratic bezier via control point (arc upward + lateral jitter)
        const cx = (sx + dx) / 2 + this._jitterX;
        const cy = Math.min(sy, dy) - 80;
        const mt = 1 - k;
        const x = mt * mt * sx + 2 * mt * k * cx + k * k * dx;
        const y = mt * mt * sy + 2 * mt * k * cy + k * k * dy;
        const scale = 1.0 - 0.45 * t;                    // shrink slightly as it flies
        const alpha = t > 0.85 ? (1 - (t - 0.85) / 0.15) : 1;  // fade at the very end
        this._place(x, y, scale, alpha);
        if (t >= 1) this._land();
        return;
      }
    }

    _captureTarget() {
      // nothing to precompute; target is re-measured each frame. Hook kept for clarity.
    }

    _land() {
      if (this._arrived) return;
      this._arrived = true;
      this.done = true;
      if (this.node && this.node.parentNode) this.node.parentNode.removeChild(this.node);
      if (typeof this.onArrive === 'function') {
        try { this.onArrive(); } catch (_) {}
      }
    }
  }

  function burst(opts) {
    if (!opts || !opts.from || !opts.to) return;       // safe no-op guard
    injectStyle();
    const cap = opts.maxCount != null ? opts.maxCount : 12;
    const count = Math.max(1, Math.min(opts.count || 1, cap));

    let landed = 0;
    const onArrive = function () {
      landed++;
      if (typeof opts.onArrive === 'function') { try { opts.onArrive(landed); } catch (_) {} }
      if (landed >= count && typeof opts.onDone === 'function') {
        try { opts.onDone(); } catch (_) {}
      }
    };

    for (let i = 0; i < count; i++) {
      flyers.push(new Flyer(opts, i, onArrive));
    }
    ensureLoop();
  }

  global.SG = global.SG || {};
  global.SG.StarFly = { burst };
})(typeof self !== 'undefined' ? self : this);
