# Daily Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract shared logic/rendering into `core.js` + `render.js`, then build a Wordle-style daily puzzle mode in `daily.html` with seeded boards, one-attempt lock, streak/best tracking, and an emoji share string.

**Architecture:** `core.js` (namespace `window.SG`) holds pure logic — `DIFFICULTIES`, `scoreFormula`, `GameLogic` (with optional `cfg.rng` injection), `HintSystem`, `seededRandom` (mulberry32), `dateSeed`, and `DailyManager`. `render.js` extends the same `window.SG` with the Canvas stack (`COLOR_PALETTE`, `Particle`, `ParticleSystem`, `FloatText`, `Renderer`). Both are loaded via classic `<script src>` tags — no ES modules (they break under `file://`). `samegame.html` is refactored to destructure from `SG`; behavior is preserved. `daily.html` is a new thin controller that wires `DailyManager` to the shared Canvas stack.

**Tech Stack:** Vanilla HTML5 Canvas, Web Audio API, `localStorage`, `navigator.clipboard`, Node.js (for `node --check` and `node core.test.js`).

**Design spec:** `docs/superpowers/specs/2026-06-09-daily-protocol-design.md`

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/core.js` | CREATE | DIFFICULTIES, scoreFormula, seededRandom, dateSeed, GameLogic (+cfg.rng), HintSystem, DailyManager, LocalAdapter |
| `src/render.js` | CREATE | COLOR_PALETTE, Particle, ParticleSystem, FloatText, Renderer |
| `src/samegame.html` | MODIFY | Remove extracted classes; add `<script src>` tags; destructure from SG |
| `src/daily.html` | CREATE | Daily controller, overlay, share string UI |
| `src/core.test.js` | CREATE | Framework-free Node.js test suite for pure-logic layer |

---

## Task 1: Create `src/core.js` — pure logic + seeded PRNG

**Files:**
- Create: `src/core.js`

The file wraps everything in an IIFE attached to `window.SG`. The GameLogic class is copied verbatim from `samegame.html` lines 440–605, with **one targeted modification** in `_init()`.

- [ ] **Step 1: Create the file skeleton**

Create `src/core.js` with this exact structure:

```javascript
/* core.js — SameGame · Grid Protocol shared pure logic
   Attaches exports to window.SG (classic script, file:// safe).
   Load order: core.js → render.js → page inline script.         */
(function (global) {
  'use strict';

  // ── DIFFICULTIES ────────────────────────────────────────────────
  // (paste from samegame.html lines 418-422)

  // ── scoreFormula ────────────────────────────────────────────────
  // (paste from samegame.html line 434)

  // ── seededRandom (mulberry32) ────────────────────────────────────
  // (Step 2)

  // ── dateSeed (FNV-style hash) ────────────────────────────────────
  // (Step 3)

  // ── GameLogic ────────────────────────────────────────────────────
  // (paste from samegame.html lines 440-605, _init modified — Step 4)

  // ── HintSystem ───────────────────────────────────────────────────
  // (paste from samegame.html lines 613-670)

  // ── DailyManager & LocalAdapter ──────────────────────────────────
  // (added in Task 4)

  // ── namespace export ────────────────────────────────────────────
  global.SG = global.SG || {};
  Object.assign(global.SG, {
    DIFFICULTIES, scoreFormula,
    seededRandom, dateSeed,
    GameLogic, HintSystem,
  });
})(typeof window !== 'undefined' ? window : global);
```

- [ ] **Step 2: Paste DIFFICULTIES + scoreFormula + add seededRandom**

Fill in the sections from `samegame.html` and add `seededRandom`:

```javascript
const DIFFICULTIES = {
  easy:   { cols: 10, rows: 10, colors: 3, minGroup: 2, bias: 0.60 },
  normal: { cols: 15, rows: 11, colors: 4, minGroup: 2, bias: 0.75 },
  hard:   { cols: 16, rows: 12, colors: 5, minGroup: 2, bias: 0.75 },
};

const scoreFormula = n => n * (n - 1) * 10;

function seededRandom(seed) {
  return function () {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 3: Add dateSeed**

```javascript
function dateSeed(dateStr, diff) {
  const s = dateStr + '|' + diff;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
}
```

- [ ] **Step 4: Paste GameLogic from `samegame.html` lines 440–605, then modify `_init()`**

Copy `class GameLogic { ... }` verbatim. Then apply this targeted change inside `_init()`:

Replace the **first line** of `_init()`:
```javascript
// old
const { cols, rows, colors, bias = 0.6 } = this.cfg;
```
with:
```javascript
// new — rng injection: daily mode passes seededRandom(); endless falls back to Math.random
const { cols, rows, colors, bias = 0.6 } = this.cfg;
const rnd = this.cfg.rng || Math.random;
```

Then replace **every** `Math.random()` call inside `_init()` with `rnd()`. There are exactly **four** occurrences (three in the loop, one in the shuffle):

| Old | New |
|-----|-----|
| `Math.floor(Math.random() * (i + 1))` | `Math.floor(rnd() * (i + 1))` |
| `Math.random() < bias` | `rnd() < bias` |
| `Math.floor(Math.random() * neighbors.length)` | `Math.floor(rnd() * neighbors.length)` |
| `Math.floor(Math.random() * colors)` | `Math.floor(rnd() * colors)` |

No other lines in `GameLogic` change.

- [ ] **Step 5: Paste HintSystem from `samegame.html` lines 613–670 verbatim**

No changes needed.

- [ ] **Step 6: Verify syntax**

```
node --check src/core.js
```

Expected: no output (exit 0). If errors appear, fix them before continuing.

- [ ] **Step 7: Commit**

```
git add src/core.js
git commit -m "feat: extract core.js with seededRandom, dateSeed, cfg.rng injection"
```

---

## Task 2: Create `src/render.js` — Canvas stack

**Files:**
- Create: `src/render.js`

`render.js` depends on `core.js` being loaded first (it reads `SG.scoreFormula`).

- [ ] **Step 1: Create the file**

```javascript
/* render.js — SameGame · Grid Protocol Canvas rendering stack
   Depends on core.js (reads SG.scoreFormula). Load after core.js. */
(function (global) {
  'use strict';
  const { scoreFormula } = global.SG; // core.js must be loaded first

  // ── COLOR_PALETTE ────────────────────────────────────────────────
  const COLOR_PALETTE = [
    { fill: '#ff3050', glow: '#ff0030', dark: '#800018' },
    { fill: '#00c8ff', glow: '#0090ff', dark: '#004878' },
    { fill: '#88ff20', glow: '#44cc00', dark: '#204800' },
    { fill: '#ff9020', glow: '#ff6000', dark: '#782800' },
    { fill: '#c050ff', glow: '#9020e8', dark: '#500080' },
    { fill: '#ffe020', glow: '#ffb000', dark: '#705000' },
  ];

  // ── Particle ─────────────────────────────────────────────────────
  // (paste from samegame.html lines 1121-1143 verbatim)

  // ── ParticleSystem ───────────────────────────────────────────────
  // (paste from samegame.html lines 1145-1166 verbatim)

  // ── FloatText ────────────────────────────────────────────────────
  // (paste from samegame.html lines 1171-1186 verbatim)

  // ── Renderer ─────────────────────────────────────────────────────
  // (paste from samegame.html lines 1191-1446 verbatim)

  // ── namespace export ─────────────────────────────────────────────
  Object.assign(global.SG, { COLOR_PALETTE, Particle, ParticleSystem, FloatText, Renderer });
})(typeof window !== 'undefined' ? window : global);
```

- [ ] **Step 2: Paste Particle, ParticleSystem, FloatText, Renderer verbatim**

Copy the four classes from `samegame.html` exactly:
- `class Particle { ... }` — lines 1121–1143
- `class ParticleSystem { ... }` — lines 1145–1166
- `class FloatText { ... }` — lines 1171–1186
- `class Renderer { ... }` — lines 1191–1446

No changes. All internal references (`COLOR_PALETTE`, `scoreFormula`, `Particle`, `ParticleSystem`, `FloatText`) are in scope within the IIFE.

**Note:** `Renderer.draw()` line 1411 has `if (window.tutMgr) window.tutMgr.drawHint(ctx, this);` — leave it as-is. `window.tutMgr` is set by the controller in `samegame.html`; `daily.html` has no `tutMgr` so the guard handles it.

- [ ] **Step 3: Verify syntax**

```
node --check src/render.js
```

Expected: no output (exit 0).

- [ ] **Step 4: Commit**

```
git add src/render.js
git commit -m "feat: extract render.js (COLOR_PALETTE, Particle, ParticleSystem, FloatText, Renderer)"
```

---

## Task 3: Refactor `samegame.html` to consume shared scripts

**Files:**
- Modify: `src/samegame.html`

This task has three parts: (A) add `<script src>` tags, (B) add the destructure line, (C) delete the extracted classes from the inline `<script>` block.

- [ ] **Step 1: Add script tags before the inline `<script>` (line 398)**

Find this line (it is line 398):
```html
<script>
```

Replace it with:
```html
<script src="core.js"></script>
<script src="render.js"></script>
<script>
```

- [ ] **Step 2: Add destructure at the top of the inline script**

The inline `<script>` block begins with an ASCII-art banner comment (lines 399–411) followed by `// ── CONFIG ──` (line 413). Insert the destructure line immediately after the banner comment block (after line 411, before the `// ── CONFIG ──` comment):

```javascript
// ── shared namespace ─────────────────────────────────────────────
const { DIFFICULTIES, scoreFormula, GameLogic, HintSystem, COLOR_PALETTE, Renderer } = SG;
```

- [ ] **Step 3: Delete the extracted class blocks from the inline script**

Remove the following contiguous regions from the inline `<script>` block (after the previous steps the line numbers shift slightly — locate by content, not number):

**Block A** — DIFFICULTIES + COLOR_PALETTE + scoreFormula comment + scoreFormula + GameLogic architecture comment:
```
// ── CONFIG ─────────────────...
// 클리어율 ...
const DIFFICULTIES = { ... };  ← 5 lines

const COLOR_PALETTE = [ ... ]; ← 8 lines

// score formula comment
const scoreFormula = ...;

/* === GameLogic architecture comment === */
class GameLogic { ... }        ← lines 440-605
```
Delete everything from `// ── CONFIG ──` through the closing `}` of `class GameLogic`.

**Block B** — HintSystem:
```
/* === HintSystem banner === */
class HintSystem { ... }       ← lines 613-670
```
Delete from the banner comment through the closing `}` of `class HintSystem`.

**Block C** — Particle + ParticleSystem + FloatText + Renderer:
```
class Particle { ... }         ← lines 1121-1143
class ParticleSystem { ... }   ← lines 1145-1166
/* FloatText banner */
class FloatText { ... }        ← lines 1171-1186
/* RENDERER banner */
class Renderer { ... }         ← lines 1191-1446
```
Delete all four classes and their banner comments.

After deletion the inline script begins with the banner comment → destructure line → `SoundManager` → `ExponentialBackoff` → `NetworkManager` → `TutorialManager` → controller code (unchanged).

- [ ] **Step 4: Verify syntax**

```
node --check src/samegame.html
```

`node --check` ignores HTML and only parses `<script>` blocks. Expected: no output (exit 0).

- [ ] **Step 5: Smoke-test in browser**

Open `src/samegame.html` directly in a browser (double-click or `file://` URL). Verify:
- [ ] Game loads and shows Start overlay
- [ ] EASY difficulty: start game, click a group, tiles remove, score updates, hint auto-ON works
- [ ] NORMAL: toggle hint with H key
- [ ] HARD: hint button hidden
- [ ] Undo works (removes last move)
- [ ] BOARD_CLEAR and GAME_OVER overlays appear correctly
- [ ] Tutorial flow (first run) works

If the browser console shows errors, fix before committing.

- [ ] **Step 6: Commit**

```
git add src/samegame.html
git commit -m "refactor: samegame.html consumes core.js + render.js; behavior unchanged"
```

---

## Task 4: Add `DailyManager` + `LocalAdapter` to `src/core.js`

**Files:**
- Modify: `src/core.js`

- [ ] **Step 1: Add `DailyManager` class before the namespace export**

Insert after the `HintSystem` class and before the `Object.assign(global.SG, ...)` line:

```javascript
/* ================================================================
   DailyManager — seeded board, one-attempt lock, streak, share
   Fully injectable (storage, now) for testing without mocks.
================================================================ */
class DailyManager {
  constructor(adapter, storage, now) {
    this._adapter = adapter || new LocalAdapter(storage);
    this._storage = storage || localStorage;
    this._now = now || (() => new Date());
  }

  todayKey() {
    return this._now().toISOString().slice(0, 10); // UTC YYYY-MM-DD
  }

  makeGame(diff) {
    const seed = dateSeed(this.todayKey(), diff);
    return new GameLogic({ ...DIFFICULTIES[diff], rng: seededRandom(seed) });
  }

  isPlayedToday(diff) {
    return !!this._storage.getItem('sg_daily_result_' + this.todayKey() + '_' + diff);
  }

  recordResult(diff, run) {
    const today = this.todayKey();
    const seed  = dateSeed(today, diff);
    const record = { date: today, diff, seed, score: run.score, moves: run.moves, cleared: run.cleared, trail: run.trail || [] };

    this._storage.setItem(
      'sg_daily_result_' + today + '_' + diff,
      JSON.stringify({ score: run.score, moves: run.moves, cleared: run.cleared, ts: new Date().toISOString() })
    );
    this._updateStreak(today);
    this._updateBest(diff, run.score);

    const history = JSON.parse(this._storage.getItem('sg_daily_history') || '[]');
    history.unshift(record);
    if (history.length > 30) history.pop();
    this._storage.setItem('sg_daily_history', JSON.stringify(history));

    this._adapter.submit(record);
  }

  getStats(diff) {
    const raw    = this._storage.getItem('sg_daily_streak');
    const streak = raw ? JSON.parse(raw) : { count: 0, lastDate: null };
    const best   = +(this._storage.getItem('sg_daily_best_' + diff) || 0);
    const today  = this.todayKey();
    const todayRaw = this._storage.getItem('sg_daily_result_' + today + '_' + diff);
    return { streak: streak.count, lastDate: streak.lastDate, best, todayResult: todayRaw ? JSON.parse(todayRaw) : null };
  }

  buildShareString(diff, run) {
    const today = this.todayKey();
    const stats = this.getStats(diff);
    const EMOJI = { big: '🟩', mid: '🟨', sml: '🟦' };
    const trail = (run.trail || []).map(t =>
      t.n >= 10 ? EMOJI.big : t.n >= 5 ? EMOJI.mid : EMOJI.sml
    ).join('');
    return [
      'SameGame · Grid Protocol',
      'Daily ' + today + ' · ' + diff.toUpperCase(),
      'Score ' + run.score.toLocaleString() + ' · ' + run.moves + ' moves · 🔥' + stats.streak,
      trail,
    ].join('\n');
  }

  _updateStreak(today) {
    const raw    = this._storage.getItem('sg_daily_streak');
    let streak   = raw ? JSON.parse(raw) : { count: 0, lastDate: null };
    if (streak.lastDate === today) return;
    const d = new Date(today + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    const yesterday = d.toISOString().slice(0, 10);
    streak = { count: streak.lastDate === yesterday ? streak.count + 1 : 1, lastDate: today };
    this._storage.setItem('sg_daily_streak', JSON.stringify(streak));
  }

  _updateBest(diff, score) {
    const key  = 'sg_daily_best_' + diff;
    const prev = +(this._storage.getItem(key) || 0);
    if (score > prev) this._storage.setItem(key, score);
  }
}

class LocalAdapter {
  constructor(storage) { this._storage = storage; }
  submit(record) { /* client-only phase: record already persisted in sg_daily_history */ }
}
```

- [ ] **Step 2: Add `DailyManager` and `LocalAdapter` to the namespace export**

Update the `Object.assign` line at the bottom of `core.js`:

```javascript
Object.assign(global.SG, {
  DIFFICULTIES, scoreFormula,
  seededRandom, dateSeed,
  GameLogic, HintSystem,
  DailyManager, LocalAdapter,
});
```

- [ ] **Step 3: Verify syntax**

```
node --check src/core.js
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```
git add src/core.js
git commit -m "feat: add DailyManager + LocalAdapter to core.js"
```

---

## Task 5: Create `src/daily.html`

**Files:**
- Create: `src/daily.html`

`daily.html` is a self-contained controller. It shares the visual language of `samegame.html` (same CSS variables, same Canvas stack from `render.js`). No undo button, no tutorial, no sound in this phase.

- [ ] **Step 1: Create `src/daily.html`**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>DAILY PROTOCOL — GRID PROTOCOL</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@300;500;700&display=swap');
  :root {
    --bg:      #08090d;
    --panel:   #0d0f18;
    --border:  #1a2040;
    --accent:  #00f5c8;
    --warn:    #ff4060;
    --dim:     #2a3060;
    --text:    #c8d4f0;
    --textdim: #4a5880;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 100%; height: 100%;
    background: var(--bg); color: var(--text);
    font-family: 'Share Tech Mono', monospace;
    overflow: hidden; user-select: none;
  }
  body::before {
    content: ''; position: fixed; inset: 0;
    background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,.18) 2px, rgba(0,0,0,.18) 4px);
    pointer-events: none; z-index: 999;
  }
  #wrapper {
    position: relative; z-index: 1;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    width: 100%; height: 100%; gap: 0;
  }
  #header {
    width: 100%; max-width: 820px;
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 16px 6px; border-bottom: 1px solid var(--border);
  }
  #header h1 {
    font-family: 'Rajdhani', sans-serif; font-weight: 700;
    font-size: clamp(14px, 2.5vw, 22px);
    letter-spacing: .25em; color: var(--accent);
    text-shadow: 0 0 18px rgba(0,245,200,.5);
  }
  #daily-badge {
    font-size: 11px; letter-spacing: .1em;
    color: var(--accent); border: 1px solid var(--accent);
    padding: 2px 8px; border-radius: 2px;
  }
  #stats-bar {
    width: 100%; max-width: 820px;
    display: flex; gap: 24px; padding: 6px 16px;
    border-bottom: 1px solid var(--border);
    font-size: 12px; color: var(--textdim);
  }
  #stats-bar span b { color: var(--text); }
  #diff-row {
    display: flex; gap: 8px; padding: 8px 0;
  }
  .diff-btn {
    background: var(--panel); border: 1px solid var(--border);
    color: var(--textdim); font-family: inherit; font-size: 12px;
    letter-spacing: .1em; padding: 5px 16px; cursor: pointer;
    transition: border-color .15s, color .15s;
  }
  .diff-btn.active { border-color: var(--accent); color: var(--accent); }
  #canvas-wrap {
    flex: 1; width: 100%; max-width: 820px; position: relative; overflow: hidden;
  }
  canvas { display: block; width: 100%; height: 100%; }
  #msg-bar {
    height: 24px; line-height: 24px;
    font-size: 11px; letter-spacing: .08em;
    color: var(--textdim); text-align: center;
    width: 100%; max-width: 820px;
  }

  /* ── overlays ── */
  .overlay {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: rgba(8,9,13,.92); z-index: 10; gap: 16px;
  }
  .overlay.hidden { display: none; }
  .ol-title {
    font-family: 'Rajdhani', sans-serif; font-weight: 700;
    font-size: clamp(22px, 4vw, 36px); letter-spacing: .3em;
    color: var(--accent); text-shadow: 0 0 20px rgba(0,245,200,.6);
  }
  .ol-sub { font-size: 12px; letter-spacing: .1em; color: var(--textdim); }
  .ol-score { font-size: 28px; color: var(--text); letter-spacing: .1em; }
  .ol-streak { font-size: 16px; color: var(--warn); letter-spacing: .05em; }
  .ol-share-box {
    background: var(--panel); border: 1px solid var(--border);
    padding: 12px 20px; font-size: 12px; white-space: pre;
    color: var(--textdim); max-width: 320px;
    line-height: 1.7; letter-spacing: .03em;
  }
  .btn-ol {
    background: transparent; border: 1px solid var(--accent);
    color: var(--accent); font-family: inherit; font-size: 13px;
    letter-spacing: .15em; padding: 8px 32px; cursor: pointer;
    transition: background .15s;
  }
  .btn-ol:hover { background: rgba(0,245,200,.08); }
  .btn-ol.secondary {
    border-color: var(--border); color: var(--textdim);
  }
  .btn-ol.secondary:hover { background: rgba(255,255,255,.04); }
  .btn-row { display: flex; gap: 12px; }
</style>
</head>
<body>
<div id="wrapper">
  <div id="header">
    <h1>SAME PUZZLE <span>— GRID PROTOCOL</span></h1>
    <span id="daily-badge">DAILY</span>
  </div>
  <div id="stats-bar">
    <span>🔥 STREAK <b id="sv-streak">0</b></span>
    <span>BEST <b id="sv-best">0</b></span>
    <span id="sv-date"></span>
  </div>
  <div id="diff-row">
    <button class="diff-btn active" onclick="setDiff('easy')">EASY</button>
    <button class="diff-btn" onclick="setDiff('normal')">NORMAL</button>
    <button class="diff-btn" onclick="setDiff('hard')">HARD</button>
  </div>
  <div id="canvas-wrap">
    <canvas id="gameCanvas"></canvas>

    <!-- START / LOCKED overlay -->
    <div class="overlay" id="ol-start">
      <div class="ol-title" id="ol-start-title">DAILY PROTOCOL</div>
      <div class="ol-sub" id="ol-start-sub">One attempt · No undo · Same board worldwide</div>
      <div class="btn-row">
        <button class="btn-ol" onclick="beginPlay()">BEGIN</button>
        <button class="btn-ol secondary" id="btn-practice" onclick="beginPractice()" style="display:none">PRACTICE</button>
        <a href="samegame.html"><button class="btn-ol secondary">ENDLESS</button></a>
      </div>
    </div>

    <!-- SUMMARY overlay (shown after play ends) -->
    <div class="overlay hidden" id="ol-summary">
      <div class="ol-title" id="ol-result-title">COMPLETE</div>
      <div class="ol-score" id="ol-score">0</div>
      <div class="ol-sub" id="ol-moves-line"></div>
      <div class="ol-streak" id="ol-streak-line"></div>
      <div class="ol-share-box" id="ol-share-text"></div>
      <div class="btn-row">
        <button class="btn-ol" onclick="copyShare()">📋 COPY</button>
        <button class="btn-ol secondary" onclick="beginPractice()">PRACTICE</button>
        <a href="samegame.html"><button class="btn-ol secondary">ENDLESS</button></a>
      </div>
      <div class="ol-sub" id="ol-copied" style="color:var(--accent);opacity:0;transition:opacity .3s">Copied!</div>
    </div>
  </div>
  <div id="msg-bar" id="msg-bar"></div>
</div>

<script src="core.js"></script>
<script src="render.js"></script>
<script>
'use strict';
const { DIFFICULTIES, scoreFormula, GameLogic, COLOR_PALETTE, Renderer, DailyManager, LocalAdapter } = SG;

// ── DOM refs ──────────────────────────────────────────────────────
const canvas      = document.getElementById('gameCanvas');
const canvasWrap  = document.getElementById('canvas-wrap');
const msgBar      = document.getElementById('msg-bar');
const olStart     = document.getElementById('ol-start');
const olStartTitle= document.getElementById('ol-start-title');
const olStartSub  = document.getElementById('ol-start-sub');
const btnPractice = document.getElementById('btn-practice');
const olSummary   = document.getElementById('ol-summary');
const olResultTitle = document.getElementById('ol-result-title');
const olScore     = document.getElementById('ol-score');
const olMovesLine = document.getElementById('ol-moves-line');
const olStreakLine = document.getElementById('ol-streak-line');
const olShareText = document.getElementById('ol-share-text');
const olCopied    = document.getElementById('ol-copied');
const svStreak    = document.getElementById('sv-streak');
const svBest      = document.getElementById('sv-best');
const svDate      = document.getElementById('sv-date');
const diffBtns    = document.querySelectorAll('.diff-btn');

// ── State ─────────────────────────────────────────────────────────
let renderer    = null;
let logic       = null;
let dailyMgr    = null;
let currentDiff = localStorage.getItem('sg_daily_lastdiff') || 'easy';
let isRanked    = false;  // false = practice mode (no recordResult call)
let gameActive  = false;
let lastTime    = 0;
let trail       = [];     // [{r, c, t, n}] click trail for RunRecord + share
let lastRun     = null;   // populated on game end for share/summary

// ── Boot ──────────────────────────────────────────────────────────
function init() {
  dailyMgr = new DailyManager(new LocalAdapter(), localStorage);
  renderer = new Renderer(canvas);
  resizeCanvas();
  applyDiffUI();
  refreshStats();
  showStartOverlay();
  requestAnimationFrame(loop);
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  if (!renderer || !logic) {
    renderer && renderer.resize(canvasWrap.offsetWidth, canvasWrap.offsetHeight, 15, 12);
    return;
  }
  renderer.resize(canvasWrap.offsetWidth, canvasWrap.offsetHeight, logic.cfg.cols, logic.cfg.rows);
}

function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  if (renderer && logic) {
    renderer.update(dt, logic.board, logic.cfg.cols, logic.cfg.rows);
    renderer.draw(logic.board, logic.cfg.cols, logic.cfg.rows);
  }
  requestAnimationFrame(loop);
}

// ── Difficulty ────────────────────────────────────────────────────
function setDiff(d) {
  currentDiff = d;
  localStorage.setItem('sg_daily_lastdiff', d);
  applyDiffUI();
  refreshStats();
  showStartOverlay();
}

function applyDiffUI() {
  diffBtns.forEach(b => b.classList.toggle('active', b.textContent === currentDiff.toUpperCase()));
}

function refreshStats() {
  const stats = dailyMgr.getStats(currentDiff);
  svStreak.textContent = stats.streak;
  svBest.textContent   = stats.best.toLocaleString();
  svDate.textContent   = dailyMgr.todayKey();
}

// ── Overlay helpers ───────────────────────────────────────────────
function showStartOverlay() {
  olSummary.classList.add('hidden');
  olStart.classList.remove('hidden');
  const played = dailyMgr.isPlayedToday(currentDiff);
  if (played) {
    olStartTitle.textContent = 'ALREADY PLAYED';
    olStartSub.textContent   = 'Today\'s board is locked. Practice anytime.';
    btnPractice.style.display = '';
    // hide BEGIN button — replace with lock message
    olStart.querySelector('.btn-ol').style.display = 'none';
  } else {
    olStartTitle.textContent = 'DAILY PROTOCOL';
    olStartSub.textContent   = 'One attempt · No undo · Same board worldwide';
    btnPractice.style.display = 'none';
    olStart.querySelector('.btn-ol').style.display = '';
  }
}

function showSummary(run) {
  const stats = dailyMgr.getStats(currentDiff);
  olStart.classList.add('hidden');
  olSummary.classList.remove('hidden');
  olResultTitle.textContent = run.cleared ? 'CLEARED!' : 'GAME OVER';
  olScore.textContent       = run.score.toLocaleString();
  olMovesLine.textContent   = run.moves + ' moves';
  olStreakLine.textContent   = '🔥 Streak: ' + stats.streak + (run.cleared ? ' 🎉' : '');
  olShareText.textContent   = dailyMgr.buildShareString(currentDiff, run);
  lastRun = run;
  refreshStats();
}

// ── Play flow ─────────────────────────────────────────────────────
function beginPlay() {
  isRanked = true;
  trail    = [];
  startBoard();
}

function beginPractice() {
  isRanked = false;
  trail    = [];
  startBoard();
}

function startBoard() {
  logic = dailyMgr.makeGame(currentDiff);
  resizeCanvas();
  renderer.hintCells  = [];
  renderer.hoverGroup = [];
  gameActive = true;
  olStart.classList.add('hidden');
  olSummary.classList.add('hidden');
  msgBar.textContent = isRanked ? 'RANKED · no undo' : 'PRACTICE · unranked';
}

function endGame(cleared) {
  gameActive = false;
  renderer.hintCells = [];
  const run = { score: logic.score, moves: logic.moveCount, cleared, trail };
  if (isRanked && !dailyMgr.isPlayedToday(currentDiff)) {
    dailyMgr.recordResult(currentDiff, run);
  }
  showSummary(run);
}

// ── Input ─────────────────────────────────────────────────────────
function onCanvasClick(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  handleClick((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
}

function onTouchStart(e) {
  e.preventDefault();
  const t = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  handleClick((t.clientX - rect.left) * scaleX, (t.clientY - rect.top) * scaleY);
}

function handleClick(px, py) {
  if (!gameActive || !logic || !renderer) return;
  const { r, c } = renderer.cellFromPointer(px, py);
  if (r < 0 || r >= logic.cfg.rows || c < 0 || c >= logic.cfg.cols) return;

  const result = logic.applyInput(r, c);
  if (!result.valid) {
    msgBar.textContent = 'Group too small (min 2)';
    return;
  }

  const colorIdx = result.group.length > 0
    ? logic.board[r] !== undefined ? -1 : 0  // color was removed; use removed color
    : 0;

  // record trail entry (group size is on result)
  trail.push({ r, c, t: Date.now() - lastTime, n: result.group.length });

  // find removed color for animation (board cell is now -1, use group's first cell before removal)
  const removedColor = result.group.length > 0 ? 0 : 0; // handled via patchLogicForColor below
  renderer.spawnRemoveAnim(result.group, _removedColorIdx(result));
  renderer.triggerShake();
  msgBar.textContent = '+' + result.gained + '  (' + result.group.length + ' tiles)';

  for (const ev of result.events) {
    if (ev.type === 'BOARD_CLEAR') { endGame(true);  return; }
    if (ev.type === 'GAME_OVER')  { endGame(false); return; }
  }
}

// Determine the color index of the just-removed group.
// applyInput() has already cleared the cells, so we read from the last history snapshot.
function _removedColorIdx(result) {
  const h = logic.history;
  if (!h.length) return 0;
  const [r, c] = result.group[0];
  return h[h.length - 1].board[r][c];
}

// ── Share ─────────────────────────────────────────────────────────
function copyShare() {
  const text = olShareText.textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(flashCopied, fallbackCopy.bind(null, text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
  flashCopied();
}

function flashCopied() {
  olCopied.style.opacity = '1';
  setTimeout(() => { olCopied.style.opacity = '0'; }, 1500);
}

init();
</script>
</body>
</html>
```

- [ ] **Step 2: Fix the removed-color bug**

The `_removedColorIdx` helper reads from the undo history to recover the pre-removal color. But `daily.html` has no undo button and the history still grows. Verify in the browser that tiles animate with the correct color. If the animation is wrong (tiles flash wrong color), the fix is:

In `handleClick`, replace:
```javascript
renderer.spawnRemoveAnim(result.group, _removedColorIdx(result));
```
with:
```javascript
// Peek the board BEFORE applyInput removes the tile
const colorBeforeRemove = logic.history.length
  ? logic.history[logic.history.length - 1].board[result.group[0][0]][result.group[0][1]]
  : 0;
renderer.spawnRemoveAnim(result.group, colorBeforeRemove);
```

(This is identical logic — just written inline for clarity. Only change if the first form produces wrong colors.)

- [ ] **Step 3: Test in browser**

Open `src/daily.html`. Verify:
- [ ] EASY/NORMAL/HARD buttons switch difficulty; stats update
- [ ] "BEGIN" starts a game; board appears with correct tile count
- [ ] Clicking a group removes tiles, score updates in msg-bar, particles fire
- [ ] After GAME_OVER or BOARD_CLEAR: summary overlay appears with score, moves, streak, share text
- [ ] Share text contains date, difficulty, score, move count, streak emoji, emoji trail (no raw coordinates)
- [ ] 📋 COPY button copies to clipboard (check "Copied!" flash)
- [ ] "PRACTICE" starts unranked game (summary still shows but streak unchanged on second play)
- [ ] Second "BEGIN" on same day: start overlay shows "ALREADY PLAYED" + PRACTICE button

- [ ] **Step 4: Commit**

```
git add src/daily.html
git commit -m "feat: add daily.html — Daily Protocol mode with seeded boards, lock, streak, share"
```

---

## Task 6: Write and run `src/core.test.js`

**Files:**
- Create: `src/core.test.js`

Framework-free — runs with `node core.test.js`. Uses Node.js built-in `assert`.

- [ ] **Step 1: Create the file**

```javascript
'use strict';
// Set up a fake browser environment so core.js can be require()'d in Node
global.window = global;
global.SG = {};

require('./core.js');

const { DIFFICULTIES, scoreFormula, seededRandom, dateSeed, GameLogic, HintSystem, DailyManager, LocalAdapter } = global.SG;
const assert = require('assert');

// ── Helper ───────────────────────────────────────────────────────
function makeFakeStorage() {
  const store = {};
  return {
    getItem:    k      => k in store ? store[k] : null,
    setItem:    (k, v) => { store[k] = String(v); },
    removeItem: k      => { delete store[k]; },
  };
}

// ── seededRandom determinism ──────────────────────────────────────
{
  const r1 = seededRandom(42);
  const r2 = seededRandom(42);
  const seq1 = Array.from({ length: 10 }, r1);
  const seq2 = Array.from({ length: 10 }, r2);
  assert.deepStrictEqual(seq1, seq2, 'seededRandom: same seed → same sequence');

  const r3 = seededRandom(99);
  const s99 = Array.from({ length: 10 }, r3);
  assert.notDeepStrictEqual(seq1, s99, 'seededRandom: different seed → different sequence');
  console.log('✓ seededRandom determinism');
}

// ── dateSeed stability ────────────────────────────────────────────
{
  assert.strictEqual(
    dateSeed('2026-06-09', 'normal'),
    dateSeed('2026-06-09', 'normal'),
    'dateSeed: same inputs → same seed'
  );
  assert.notStrictEqual(
    dateSeed('2026-06-09', 'easy'),
    dateSeed('2026-06-09', 'hard'),
    'dateSeed: diff param → different seed'
  );
  assert.notStrictEqual(
    dateSeed('2026-06-09', 'normal'),
    dateSeed('2026-06-10', 'normal'),
    'dateSeed: date param → different seed'
  );
  console.log('✓ dateSeed stability');
}

// ── Board determinism ─────────────────────────────────────────────
{
  const seed = dateSeed('2026-06-09', 'normal');
  const g1 = new GameLogic({ ...DIFFICULTIES.normal, rng: seededRandom(seed) });
  const g2 = new GameLogic({ ...DIFFICULTIES.normal, rng: seededRandom(seed) });
  assert.deepStrictEqual(g1.board, g2.board, 'Board determinism: same seed → identical board');

  // Endless mode (no rng) should still produce a valid (non-seeded) board
  const gRandom = new GameLogic({ ...DIFFICULTIES.easy });
  assert.ok(Array.isArray(gRandom.board), 'Endless GameLogic still initializes');
  console.log('✓ Board determinism');
}

// ── GameLogic.applyInput basic ────────────────────────────────────
{
  const g = new GameLogic({ ...DIFFICULTIES.easy, rng: seededRandom(dateSeed('2026-01-01', 'easy')) });
  // find a valid group to remove
  let found = null;
  outer: for (let r = 0; r < g.cfg.rows; r++) {
    for (let c = 0; c < g.cfg.cols; c++) {
      if (g.board[r][c] !== -1 && g.getGroup(r, c).length >= g.cfg.minGroup) {
        found = [r, c]; break outer;
      }
    }
  }
  assert.ok(found, 'Board has at least one valid move');
  const res = g.applyInput(found[0], found[1]);
  assert.ok(res.valid, 'applyInput returns valid=true for a valid group');
  assert.ok(res.gained > 0, 'applyInput returns positive score');
  console.log('✓ GameLogic.applyInput');
}

// ── Streak boundaries ─────────────────────────────────────────────
{
  const storage = makeFakeStorage();

  const dm1 = new DailyManager(new LocalAdapter(storage), storage, () => new Date('2026-06-09T12:00:00Z'));
  dm1.recordResult('normal', { score: 100, moves: 5, cleared: false, trail: [] });
  assert.strictEqual(dm1.getStats('normal').streak, 1, 'Streak: first play → 1');

  // Same day repeat — streak must not change
  dm1.recordResult('normal', { score: 200, moves: 6, cleared: false, trail: [] });
  assert.strictEqual(dm1.getStats('normal').streak, 1, 'Streak: same day → unchanged');

  // Consecutive day → +1
  const dm2 = new DailyManager(new LocalAdapter(storage), storage, () => new Date('2026-06-10T12:00:00Z'));
  dm2.recordResult('normal', { score: 150, moves: 4, cleared: false, trail: [] });
  assert.strictEqual(dm2.getStats('normal').streak, 2, 'Streak: consecutive day → +1');

  // Skip a day → reset to 1
  const dm3 = new DailyManager(new LocalAdapter(storage), storage, () => new Date('2026-06-12T12:00:00Z'));
  dm3.recordResult('normal', { score: 120, moves: 7, cleared: false, trail: [] });
  assert.strictEqual(dm3.getStats('normal').streak, 1, 'Streak: skipped day → reset to 1');

  console.log('✓ Streak boundaries');
}

// ── Personal best ─────────────────────────────────────────────────
{
  const storage = makeFakeStorage();
  const dm = new DailyManager(new LocalAdapter(storage), storage, () => new Date('2026-06-09T10:00:00Z'));
  dm.recordResult('easy', { score: 500, moves: 10, cleared: false, trail: [] });
  assert.strictEqual(dm.getStats('easy').best, 500, 'Best: first score recorded');

  const dm2 = new DailyManager(new LocalAdapter(storage), storage, () => new Date('2026-06-10T10:00:00Z'));
  dm2.recordResult('easy', { score: 300, moves: 8, cleared: false, trail: [] });
  assert.strictEqual(dm2.getStats('easy').best, 500, 'Best: lower score does not overwrite');

  const dm3 = new DailyManager(new LocalAdapter(storage), storage, () => new Date('2026-06-11T10:00:00Z'));
  dm3.recordResult('easy', { score: 800, moves: 12, cleared: false, trail: [] });
  assert.strictEqual(dm3.getStats('easy').best, 800, 'Best: higher score replaces');

  console.log('✓ Personal best');
}

// ── buildShareString ──────────────────────────────────────────────
{
  const storage = makeFakeStorage();
  const dm = new DailyManager(new LocalAdapter(storage), storage, () => new Date('2026-06-09T08:00:00Z'));
  const run = {
    score: 12340, moves: 14, cleared: true,
    trail: [
      { r: 0, c: 0, t: 0,   n: 12 }, // big → 🟩
      { r: 1, c: 1, t: 100, n: 5  }, // mid → 🟨
      { r: 2, c: 2, t: 200, n: 2  }, // sml → 🟦
    ],
  };
  dm.recordResult('normal', run);
  const share = dm.buildShareString('normal', run);

  assert.ok(share.includes('Daily 2026-06-09'), 'Share: contains date');
  assert.ok(share.includes('NORMAL'),           'Share: contains difficulty');
  assert.ok(share.includes('12,340'),           'Share: contains formatted score');
  assert.ok(share.includes('🔥'),              'Share: contains streak emoji');
  assert.ok(share.includes('🟩'),              'Share: big group → 🟩');
  assert.ok(share.includes('🟨'),              'Share: mid group → 🟨');
  assert.ok(share.includes('🟦'),              'Share: small group → 🟦');
  // spoiler-free: no raw board coordinate or color info
  assert.ok(!share.includes('"r"'),            'Share: no raw r/c in output');
  assert.ok(!share.includes('board'),          'Share: no "board" in output');

  console.log('✓ buildShareString');
}

console.log('\nAll tests passed.');
```

- [ ] **Step 2: Run the tests**

```
node src/core.test.js
```

Expected output:
```
✓ seededRandom determinism
✓ dateSeed stability
✓ Board determinism
✓ GameLogic.applyInput
✓ Streak boundaries
✓ Personal best
✓ buildShareString

All tests passed.
```

If any test fails, read the error, fix `core.js`, and re-run. Do not skip a failing test.

- [ ] **Step 3: Commit**

```
git add src/core.test.js
git commit -m "test: add core.test.js — seededRandom, dateSeed, board determinism, streak, share"
```

---

## Task 7: Final manual verification

No code changes — this task is a checklist-driven browser test of both pages.

- [ ] **Step 1: Test `samegame.html` (regression)**

Open `src/samegame.html` in a browser. Verify:
- [ ] All three difficulties start a new game without errors
- [ ] Tiles remove, gravity + column-collapse work
- [ ] Score accumulates; combo text appears for combos ≥3 in a row with groups ≥5
- [ ] Undo restores previous board state and score
- [ ] BOARD_CLEAR shows "LEVEL CLEAR" overlay with bonus; GAME_OVER shows game-over overlay
- [ ] Hint (💡 / H key) highlights the best group; auto-ON in EASY, hidden in HARD
- [ ] Tutorial runs on first visit (clear `samegame_tut_done` from localStorage to re-trigger)
- [ ] Sound mute toggle works

- [ ] **Step 2: Test `daily.html`**

Open `src/daily.html`. Verify:
- [ ] Stats bar shows correct streak/best/date
- [ ] Each difficulty shows a different board
- [ ] After playing and completing, summary overlay appears with correct score/moves/streak
- [ ] Share text is spoiler-free (no tile positions, only emoji buckets)
- [ ] 📋 COPY button triggers "Copied!" flash
- [ ] Second visit to the same difficulty shows "ALREADY PLAYED" + PRACTICE
- [ ] PRACTICE play does NOT change streak or best (simulate by checking stats before/after)

- [ ] **Step 3: Simulate "next day" via injectable `now`**

In the browser console on `daily.html`, test that the streak increments:
```javascript
// Verify today's result is locked
SG.DailyManager; // should exist
const dm = new SG.DailyManager(
  new SG.LocalAdapter(),
  localStorage,
  () => new Date('2026-06-10T00:01:00Z') // "tomorrow"
);
console.log(dm.isPlayedToday('normal')); // should be false (new day)
dm.recordResult('normal', { score: 999, moves: 3, cleared: false, trail: [] });
console.log(dm.getStats('normal').streak); // should be 2 if yesterday was played
```

- [ ] **Step 4: Commit summary**

```
git add -A
git commit -m "chore: Daily Protocol feature complete — core.js, render.js, samegame.html refactor, daily.html, core.test.js"
```

---

## Self-review against spec

| Spec requirement | Task |
|-----------------|------|
| `seededRandom` mulberry32 | Task 1 Step 2 |
| `dateSeed` cyrb-style hash | Task 1 Step 3 |
| `cfg.rng` injection, endless mode unchanged | Task 1 Step 4 |
| `core.js` namespace `window.SG` | Task 1 Step 1 |
| `render.js` namespace, load after core.js | Task 2 |
| `samegame.html` refactored, behavior preserved | Task 3 |
| `DailyManager.makeGame` | Task 4 |
| `DailyManager.isPlayedToday` / lock | Task 4, Task 5 |
| `DailyManager.recordResult` | Task 4 |
| `DailyManager.getStats` | Task 4 |
| `DailyManager.buildShareString` (spoiler-free) | Task 4 |
| `LocalAdapter` (no-op submit) | Task 4 |
| `SubmitAdapter` seam (extensible) | Task 4 — `LocalAdapter.submit` signature |
| `RunRecord` with `trail: [{r,c,t,n}]` | Task 4 (recordResult), Task 5 (handleClick) |
| `daily.html` difficulty picker | Task 5 |
| `daily.html` already-played lock | Task 5 |
| `daily.html` no undo | Task 5 (no undo button; `GameLogic.undo` never called) |
| `daily.html` summary overlay | Task 5 |
| `daily.html` share + clipboard copy | Task 5 |
| `daily.html` practice mode | Task 5 |
| `localStorage` prefix `sg_daily_*` | Task 4 (no collision with `samegame_best_*`) |
| `core.test.js` framework-free | Task 6 |
| Board determinism test | Task 6 |
| Streak boundary tests | Task 6 |
| `buildShareString` spoiler-free test | Task 6 |
| Regression verification `samegame.html` | Task 7 |
