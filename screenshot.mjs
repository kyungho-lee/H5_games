// screenshot.mjs — SameGame · Grid Protocol — gameplay screenshot generator
// Navigates past tutorial, selects NORMAL, starts game, then captures.

import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GAME_URL = 'http://localhost:8765/samegame.html';
const OUT_DIR  = path.join(__dirname, 'screenshots');

const SIZES = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '800x800',   width:  800, height:  800  },
  { name: '1080x1920', width: 1080, height: 1920  },
];

// ------------------------------------------------------------------
// Helper: wait for element and click it
async function clickSel(page, selector, timeout = 5000) {
  await page.waitForSelector(selector, { visible: true, timeout });
  await page.click(selector);
}

// Helper: wait ms
const wait = ms => new Promise(r => setTimeout(r, ms));

// ------------------------------------------------------------------
// Play a few moves so the board looks lively in the screenshot
async function playMoves(page) {
  // Click canvas at positions where colored groups usually appear (middle area)
  const canvas = await page.$('canvas');
  if (!canvas) return;
  const box = await canvas.boundingBox();
  if (!box) return;

  // Grid is roughly 10 cols × 15 rows inside the canvas (normal mode)
  // Click a few likely-group spots in the lower-center area
  const clicks = [
    [0.25, 0.80], [0.50, 0.75], [0.70, 0.85],
    [0.35, 0.60], [0.60, 0.65],
  ];
  for (const [fx, fy] of clicks) {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await wait(400);
  }
}

// ------------------------------------------------------------------
async function captureSize({ name, width, height }, browser) {
  console.log(`\n── ${name} ──`);
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });

  // Clear tutorial-done flag so overlay always starts fresh, then set SKIP
  await page.evaluateOnNewDocument(() => {
    localStorage.removeItem('samegame_tut_done');
  });

  await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 15000 });
  await page.waitForSelector('canvas', { timeout: 8000 });
  await wait(1500);

  // ① Click SKIP on tutorial intro overlay
  try {
    await clickSel(page, '#tut-skip-link button', 3000);
    console.log('  ✓ Tutorial skipped');
    await wait(800);
  } catch (e) {
    console.log('  ⚠ Skip button not found, continuing');
  }

  // ② Select NORMAL difficulty (already default, but click to be sure)
  try {
    await clickSel(page, '#btn-normal', 2000);
    console.log('  ✓ NORMAL selected');
    await wait(300);
  } catch (e) { /* already selected */ }

  // ③ Click INITIATE (overlay action button)
  try {
    await clickSel(page, '#overlay-action-btn', 3000);
    console.log('  ✓ Game started');
    await wait(1200);
  } catch (e) {
    console.log('  ⚠ INITIATE button not found');
  }

  // ④ Play a few moves so board looks interesting
  await playMoves(page);
  await wait(600);

  // ⑤ Screenshot
  const outPath = path.join(OUT_DIR, `samegame_${name}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`  → saved: ${outPath}`);

  await page.close();
}

// ------------------------------------------------------------------
(async () => {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--allow-file-access-from-files',
    ],
  });

  for (const size of SIZES) {
    await captureSize(size, browser);
  }

  await browser.close();
  console.log('\n✅ All screenshots saved to:', OUT_DIR);
})();
