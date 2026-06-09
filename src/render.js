/* render.js — SameGame · Grid Protocol Canvas rendering stack
   Depends on core.js (reads SG.scoreFormula). Load after core.js. */
(function (global) {
  'use strict';
  const { scoreFormula } = global.SG; // core.js must be loaded first

  const COLOR_PALETTE = [
    { fill: '#ff3050', glow: '#ff0030', dark: '#800018' },
    { fill: '#00c8ff', glow: '#0090ff', dark: '#004878' },
    { fill: '#88ff20', glow: '#44cc00', dark: '#204800' },
    { fill: '#ff9020', glow: '#ff6000', dark: '#782800' },
    { fill: '#c050ff', glow: '#9020e8', dark: '#500080' },
    { fill: '#ffe020', glow: '#ffb000', dark: '#705000' },
  ];

  class Particle {
    constructor() { this.active = false; }
    spawn(x, y, color, vx, vy, life, size) {
      Object.assign(this, { x, y, color, vx, vy, life, maxLife: life, size, active: true });
    }
    update(dt) {
      if (!this.active) return;
      this.x += this.vx * dt;
      this.y += (this.vy + 200 * (1 - this.life / this.maxLife)) * dt;
      this.vx *= 0.97;
      this.life -= dt * 1000;
      if (this.life <= 0) this.active = false;
    }
    draw(ctx) {
      if (!this.active) return;
      const alpha = Math.max(0, this.life / this.maxLife);
      ctx.globalAlpha = alpha * .9;
      ctx.fillStyle = this.color;
      const s = this.size * alpha;
      ctx.fillRect(this.x - s / 2, this.y - s / 2, s, s);
      ctx.globalAlpha = 1;
    }
  }

  class ParticleSystem {
    constructor(maxParticles = 600) {
      this.pool = Array.from({ length: maxParticles }, () => new Particle());
    }
    emit(x, y, colorObj, count = 12) {
      for (let i = 0; i < count; i++) {
        const p = this.pool.find(p => !p.active);
        if (!p) break;
        const angle = Math.random() * Math.PI * 2;
        const spd = 80 + Math.random() * 220;
        p.spawn(x, y,
          Math.random() < .5 ? colorObj.fill : colorObj.glow,
          Math.cos(angle) * spd,
          Math.sin(angle) * spd - 60,
          300 + Math.random() * 400,
          3 + Math.random() * 5
        );
      }
    }
    update(dt) { this.pool.forEach(p => p.update(dt)); }
    draw(ctx) { this.pool.forEach(p => p.draw(ctx)); }
  }

  class FloatText {
    // scale: 1 = small group (2–3 tiles), up to ~3.5 for large groups (10+ tiles)
    constructor(x, y, text, color, scale = 1) {
      const life = 900 + Math.min(scale, 3.5) * 160; // larger group → longer display
      const vy   = -68 - scale * 14;                  // larger group → floats faster
      Object.assign(this, { x, y, text, color, scale, life, maxLife: life, vy });
    }
    update(dt) { this.y += this.vy * dt; this.life -= dt * 1000; }
    get alive()  { return this.life > 0; }
    draw(ctx) {
      const alpha    = Math.min(1, this.life / 280);
      // Font grows slightly as it rises (feels more dynamic)
      const baseSize = 13 + this.scale * 4.5;
      const fontSize = Math.round(baseSize + (1 - this.life / this.maxLife) * 3);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font        = `bold ${fontSize}px 'Rajdhani', sans-serif`;
      ctx.textAlign   = 'center';
      // Glow halo for large-score texts (scale ≥ 2)
      if (this.scale >= 2) {
        ctx.shadowColor = this.color;
        ctx.shadowBlur  = 6 + this.scale * 3;
      }
      ctx.fillStyle = this.color;
      ctx.fillText(this.text, this.x, this.y);
      ctx.restore();
    }
  }

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.tileSize = 32;
      this.offX = 0;
      this.offY = 0;
      this.particles = new ParticleSystem(800);
      this.floatTexts = [];
      this.hoverGroup = [];
      this.hoverR = -1;
      this.hoverC = -1;
      this.hintCells = [];   // optimal-group highlight (set by controller)
      this.hintTime  = 0;    // accumulates dt → drives the pulse sin wave
      this.animTiles = new Map(); // key→{r,c, scale, alpha, dy}
      this.shakeTime = 0;
      this.flashCells = new Map(); // key→ttl for white flash
    }

    resize(containerW, containerH, cols, rows) {
      const padW = 24, padH = 24;
      const ts = Math.floor(Math.min(
        (containerW - padW * 2) / cols,
        (containerH - padH * 2) / rows
      ));
      this.tileSize = Math.max(ts, 12);
      const bw = this.tileSize * cols;
      const bh = this.tileSize * rows;
      this.canvas.width  = containerW;
      this.canvas.height = containerH;
      this.offX = Math.floor((containerW - bw) / 2);
      this.offY = Math.floor((containerH - bh) / 2);
    }

    cellFromPointer(px, py) {
      const c = Math.floor((px - this.offX) / this.tileSize);
      const r = Math.floor((py - this.offY) / this.tileSize);
      return { r, c };
    }

    triggerShake() { this.shakeTime = 200; }

    spawnRemoveAnim(group, colorIdx) {
      const ts = this.tileSize;
      group.forEach(([r, c]) => {
        const key = r * 1000 + c;
        this.animTiles.set(key, { r, c, scale: 1, alpha: 1, colorIdx, ttl: 300 });
        const cx = this.offX + c * ts + ts / 2;
        const cy = this.offY + r * ts + ts / 2;
        this.particles.emit(cx, cy, COLOR_PALETTE[colorIdx], 14);
      });
      if (group.length > 0) {
        // Use group centroid so the score floats from the middle of removed tiles
        const avgR = group.reduce((s, [r])    => s + r, 0) / group.length;
        const avgC = group.reduce((s, [, c])  => s + c, 0) / group.length;
        const fx   = this.offX + avgC * ts + ts / 2;
        const fy   = this.offY + avgR * ts + ts / 2;
        // Scale: 1 for tiny groups, up to ~3.5 for large ones
        const scale = Math.min(3.5, 1 + (group.length - 2) * 0.22);
        this.floatTexts.push(new FloatText(fx, fy,
          '+' + scoreFormula(group.length).toLocaleString(),
          COLOR_PALETTE[colorIdx].glow,
          scale
        ));
      }
    }

    flashGroup(group) {
      group.forEach(([r, c]) => {
        this.flashCells.set(r * 1000 + c, 120);
      });
    }

    // Pulsing glow border around hintCells. Called inside draw() within the
    // shake-translated space so it aligns with the tiles. Pulse: 800ms period,
    // alpha 0.4→1.0 sin wave driven by hintTime (accumulated in update()).
    renderHint(ctx, ts) {
      if (!this.hintCells.length) return;
      const pulse = 0.7 + 0.3 * Math.sin(this.hintTime * (Math.PI * 2 / 0.8));
      const pad = 2, sz = ts - pad * 2;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#ffffff';
      ctx.shadowColor = '#7df9ff';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2;
      for (const [r, c] of this.hintCells) {
        const x = this.offX + c * ts;
        const y = this.offY + r * ts;
        ctx.strokeRect(x + pad + .5, y + pad + .5, sz - 1, sz - 1);
      }
      ctx.restore();
    }

    draw(board, cols, rows, ts) {
      ts = ts || this.tileSize;
      const ctx = this.ctx;
      const W = this.canvas.width, H = this.canvas.height;

      // ── shake offset ──
      let sx = 0, sy = 0;
      if (this.shakeTime > 0) {
        const mag = (this.shakeTime / 200) * 4;
        sx = (Math.random() - .5) * mag;
        sy = (Math.random() - .5) * mag;
      }

      // ── clear ──
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#08090d';
      ctx.fillRect(0, 0, W, H);

      // ── background grid dots ──
      ctx.fillStyle = 'rgba(26,32,64,.4)';
      for (let r = 0; r <= rows; r++)
        for (let c = 0; c <= cols; c++) {
          ctx.fillRect(this.offX + c * ts - 1, this.offY + r * ts - 1, 2, 2);
        }

      ctx.save();
      ctx.translate(sx, sy);

      // ── draw tiles ──
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const colorIdx = board[r][c];
          if (colorIdx === -1) continue;

          const key = r * 1000 + c;
          const isAnim   = this.animTiles.has(key);
          const isHover  = this.hoverGroup.some(([hr, hc]) => hr === r && hc === c);
          const isFlash  = this.flashCells.has(key);

          let x = this.offX + c * ts;
          let y = this.offY + r * ts;
          let scale = 1, alpha = 1;

          if (isAnim) {
            const a = this.animTiles.get(key);
            scale = a.scale; alpha = a.alpha;
          }

          const pad = 2;
          const sz = ts - pad * 2;
          const pal = COLOR_PALETTE[colorIdx];

          ctx.save();
          ctx.globalAlpha = alpha;

          const cx = x + ts / 2, cy = y + ts / 2;
          ctx.translate(cx, cy);
          ctx.scale(scale, scale);
          ctx.translate(-cx, -cy);

          // cell bg
          ctx.fillStyle = isFlash ? '#ffffff' :
                          isHover ? pal.fill  :
                          pal.dark;
          ctx.fillRect(x + pad, y + pad, sz, sz);

          if (!isFlash) {
            // inner highlight
            ctx.fillStyle = pal.fill;
            ctx.fillRect(x + pad + 2, y + pad + 2, sz - 4, 6);

            // center dot
            ctx.fillStyle = isHover ? '#fff' : pal.glow;
            const dsz = Math.max(4, sz * .28);
            ctx.fillRect(cx - dsz / 2, cy - dsz / 2, dsz, dsz);

            // glow on hover
            if (isHover) {
              ctx.shadowColor = pal.glow;
              ctx.shadowBlur = 16;
              ctx.fillStyle = 'rgba(255,255,255,.15)';
              ctx.fillRect(x + pad, y + pad, sz, sz);
              ctx.shadowBlur = 0;
            }

            // border
            ctx.strokeStyle = isHover ? pal.glow : 'rgba(255,255,255,.08)';
            ctx.lineWidth = isHover ? 1.5 : 1;
            ctx.strokeRect(x + pad + .5, y + pad + .5, sz - 1, sz - 1);
          }

          ctx.restore();
        }
      }

      // ── anim tiles (popping out) ──
      for (const [key, a] of this.animTiles) {
        const pal = COLOR_PALETTE[a.colorIdx];
        const x = this.offX + a.c * ts;
        const y = this.offY + a.r * ts;
        const pad = 2, sz = ts - pad * 2;
        const cx = x + ts / 2, cy = y + ts / 2;
        ctx.save();
        ctx.globalAlpha = a.alpha;
        ctx.shadowColor = pal.glow;
        ctx.shadowBlur = 20 * (1 - a.scale);
        ctx.translate(cx, cy);
        ctx.scale(a.scale, a.scale);
        ctx.translate(-cx, -cy);
        ctx.fillStyle = pal.fill;
        ctx.fillRect(x + pad, y + pad, sz, sz);
        ctx.restore();
      }

      // ── hint highlight (pulsing glow border around the suggested group) ──
      this.renderHint(ctx, ts);

      // ── board border ──
      ctx.strokeStyle = 'rgba(26,32,64,.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(this.offX, this.offY, cols * ts, rows * ts);

      ctx.restore();

      // ── particles ──
      this.particles.draw(ctx);

      // ── float texts ──
      for (const ft of this.floatTexts) ft.draw(ctx);

      // ── tutorial overlay (drawn last, on top of everything) ──
      if (window.tutMgr) window.tutMgr.drawHint(ctx, this);
    }

    update(dt, board, cols, rows) {
      // anim tiles: shrink + fade
      for (const [key, a] of this.animTiles) {
        a.ttl -= dt * 1000;
        const t = 1 - Math.max(0, a.ttl / 300);
        a.scale = 1 - t * t * .5;
        a.alpha = 1 - t;
        if (a.ttl <= 0) this.animTiles.delete(key);
      }

      // flash cells
      for (const [key, ttl] of this.flashCells) {
        this.flashCells.set(key, ttl - dt * 1000);
        if (ttl <= 0) this.flashCells.delete(key);
      }

      // particles
      this.particles.update(dt);

      // float texts
      this.floatTexts = this.floatTexts.filter(ft => ft.alive);
      this.floatTexts.forEach(ft => ft.update(dt));

      // shake decay
      this.shakeTime = Math.max(0, this.shakeTime - dt * 1000);

      // hint pulse clock (wrap at the 800ms period to keep the value small)
      if (this.hintCells.length) this.hintTime = (this.hintTime + dt) % 0.8;

      // tutorial pulse update
      if (window.tutMgr) window.tutMgr.update(dt);
    }
  }

  Object.assign(global.SG, { COLOR_PALETTE, Particle, ParticleSystem, FloatText, Renderer });
})(typeof window !== 'undefined' ? window : global);
