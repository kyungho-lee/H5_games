/* make-screenshots.mjs
   Playgama submission screenshots — 5 scenes at 560×900 (mobile portrait).
   Output: scripts/_submit/
     ss-01-menu.png       — main menu
     ss-02-gameplay.png   — in-game board (filled)
     ss-03-mode2.png      — secondary mode or feature
     ss-04-gameover.png   — game over / result screen
     ss-05-fx.png         — visual FX / special moment

   CUSTOMIZE: update the page.evaluate() calls below to match your game's
   public JS functions (e.g. startGame(), doMove(), gameOver()).

   Prerequisites:
     npm install playwright
     npx playwright install chromium

   Run: node scripts/make-screenshots.mjs */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '_submit');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Points to src/index.html relative to this script.
// Change if your entry point is elsewhere.
const url = 'file://' + path.resolve(__dirname, '../src/index.html').replace(/\\/g, '/');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 560, height: 900 } });

const errors = [];
page.on('pageerror', e => errors.push(e.message));

await page.goto(url);
await page.waitForTimeout(1200);  // wait for SDK init + initial render

// ── Helper: force-close all overlay popups ───────────────────────────────
// Add overlay element IDs your game uses. Also resolves any pending async
// modal promises so the game doesn't stay paused after popup dismissal.
async function closeAllPopups() {
  await page.evaluate(() => {
    // TODO: replace these IDs with the overlay IDs in your index.html
    const ids = [
      'ol-unlock', 'ol-daily-over', 'ol-practice-over',
      'ol-collection-over', 'ol-theme-complete', 'ol-settings', 'ol-gallery',
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    // Resolve any pending modal promise so gameRunning can resume
    if (window._unlockResolve) { window._unlockResolve(); window._unlockResolve = null; }
    if (window._modalStack) window._modalStack.length = 0;
  });
  await page.waitForTimeout(200);
}

// ── Shot 1: Main menu ────────────────────────────────────────────────────
await page.screenshot({ path: path.join(outDir, 'ss-01-menu.png') });
console.log('✓ ss-01-menu.png');

// ── Shot 2: In-game board ────────────────────────────────────────────────
// TODO: replace with your game's function to start a session
await page.evaluate(() => window.openDaily && window.openDaily());
await page.waitForTimeout(500);

// TODO: replace with moves/actions that fill the board visually
const warmupMoves = ['left','down','right','up','left','down','right','up',
                     'left','down','right','up'];
for (const d of warmupMoves) {
  await page.evaluate(dir => window.doMove && window.doMove(dir), d);
  await page.waitForTimeout(160);
}
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, 'ss-02-gameplay.png') });
console.log('✓ ss-02-gameplay.png');

// ── Shot 3: Secondary mode / feature ────────────────────────────────────
// TODO: replace with your game's secondary mode entry function
await closeAllPopups();
await page.evaluate(() => window.startCollection && window.startCollection());
await page.waitForTimeout(500);
await closeAllPopups();

const mode2Moves = ['right','down','left','up','right','down','left','up',
                    'right','down','left','up'];
for (const d of mode2Moves) {
  await closeAllPopups();
  await page.evaluate(dir => window.doMove && window.doMove(dir), d);
  await page.waitForTimeout(200);
}
await closeAllPopups();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(outDir, 'ss-03-mode2.png') });
console.log('✓ ss-03-mode2.png');

// ── Shot 4: Game over / result screen ────────────────────────────────────
await closeAllPopups();
// TODO: replace with your game's start function
await page.evaluate(() => window.openDaily && window.openDaily());
await page.waitForTimeout(400);

const preMoves = ['left','down','right','up','left','down'];
for (const d of preMoves) {
  await page.evaluate(dir => window.doMove && window.doMove(dir), d);
  await page.waitForTimeout(150);
}
// TODO: replace with your game's game-over trigger function
await page.evaluate(() => {
  if (window.dailyGameOver) window.dailyGameOver();
});
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(outDir, 'ss-04-gameover.png') });
console.log('✓ ss-04-gameover.png');

// ── Shot 5: Visual FX / special moment ───────────────────────────────────
// Capture a mid-move frame for merge/animation FX
await closeAllPopups();
const fxMoves = ['up','right','down','left','up','right'];
for (const d of fxMoves) {
  await closeAllPopups();
  await page.evaluate(dir => window.doMove && window.doMove(dir), d);
  await page.waitForTimeout(190);
}
await page.evaluate(dir => window.doMove && window.doMove(dir), 'down');
await page.waitForTimeout(120);  // capture mid-FX
await page.screenshot({ path: path.join(outDir, 'ss-05-fx.png') });
console.log('✓ ss-05-fx.png');

await browser.close();

if (errors.length) {
  console.warn('\n⚠ Page errors during capture:');
  errors.forEach(e => console.warn(' -', e));
}
console.log('\n✅ Screenshots saved to:', outDir);
