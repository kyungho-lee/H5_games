/* make-cover.mjs
   Playgama submission cover images — 3 sizes.
   Output: scripts/_submit/
     cover-square.png    800×800   (1:1)
     cover-portrait.png  1080×1920 (9:16)
     cover-landscape.png 1920×1080 (16:9)

   CUSTOMIZE:
     - GAME_CONFIG at the top: title, tagline, slogan, colors
     - BLOCKS array: tile values and colors matching your game's palette
     - Background gradient colors in makeCoverHtml() if needed

   Prerequisites:
     npm install playwright
     npx playwright install chromium

   Run: node scripts/make-cover.mjs */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '_submit');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// ── CUSTOMIZE THIS SECTION ───────────────────────────────────────────────
const GAME_CONFIG = {
  title:    'GAME TITLE',            // main title text
  subtitle: 'VERB · VERB · VERB',   // 3-word tagline (pink neon)
  slogan:   'MODE · DESCRIPTION',   // secondary label (dim)
  titleColor:    '#00e5ff',          // title glow color
  subtitleColor: '#ff2d78',          // subtitle glow color
  bgColor:       '#060810',          // background
  glowCenter:    '#00e5ff0a',        // center radial glow
  glowCorner1:   '#ff2d780a',        // bottom-left glow
  glowCorner2:   '#b06aff0a',        // top-right glow
  gridLineColor: '#00e5ff',          // subtle grid line color (opacity 0.06)
};

// Tile blocks: [borderColor, labelText, glowColor]
// 12 entries used for landscape (4×3), first 12 used for portrait/square (3×4)
const BLOCKS = [
  ['#ff2d78', '2',   '#ff2d78'],
  ['#39ff14', '4',   '#39ff14'],
  ['#00e5ff', '8',   '#00e5ff'],
  ['#ffd23f', '16',  '#ffd23f'],
  ['#b06aff', '32',  '#b06aff'],
  ['#ff2d78', '64',  '#ff2d78'],
  ['#39ff14', '128', '#39ff14'],
  ['#00e5ff', '256', '#00e5ff'],
  ['#ffd23f', '512', '#ffd23f'],
  ['#b06aff', '2',   '#b06aff'],
  ['#ff2d78', '4',   '#ff2d78'],
  ['#39ff14', '8',   '#39ff14'],
];
// ── END CUSTOMIZE ────────────────────────────────────────────────────────

function makeCoverHtml(w, h) {
  const isLandscape = w > h;

  const titleSize    = Math.round(w * (isLandscape ? 0.062 : 0.085));
  const subtitleSize = Math.round(titleSize * 0.38);
  const sloganSize   = Math.round(titleSize * 0.28);
  const gridCell     = Math.round(w * (isLandscape ? 0.072 : 0.10));
  const gridGap      = Math.round(gridCell * 0.12);
  const borderR      = Math.round(gridCell * 0.18);

  const cols = isLandscape ? 4 : 3;
  const rows = isLandscape ? 3 : 4;
  const usedBlocks = BLOCKS.slice(0, cols * rows);

  const blockHtml = usedBlocks.map(([color, num, glow]) => `
    <div style="
      width:${gridCell}px; height:${gridCell}px;
      background: rgba(6,8,16,0.85);
      border: 1.5px solid ${color}44;
      border-radius: ${borderR}px;
      display:flex; align-items:center; justify-content:center;
      box-shadow: 0 0 ${Math.round(gridCell*0.18)}px ${color}66,
                  inset 0 0 ${Math.round(gridCell*0.1)}px ${color}22;
      position:relative; overflow:hidden;
    ">
      <div style="
        position:absolute; inset:0;
        background: radial-gradient(ellipse at 50% 30%, ${color}18 0%, transparent 70%);
      "></div>
      <span style="
        font-family:'Rajdhani','Share Tech Mono',monospace;
        font-size:${Math.round(gridCell * (num.length > 2 ? 0.34 : 0.42))}px;
        font-weight:700; color:${color};
        text-shadow: 0 0 ${Math.round(gridCell*0.12)}px ${glow},
                     0 0 ${Math.round(gridCell*0.24)}px ${glow}88;
        position:relative; z-index:1; letter-spacing:-1px;
      ">${num}</span>
    </div>`).join('');

  const textBlock = `
    <div style="
      display:flex; flex-direction:column;
      align-items:${isLandscape ? 'flex-start' : 'center'};
      ${isLandscape ? 'margin-right:' + Math.round(w*0.06) + 'px;' : 'margin-bottom:' + Math.round(h*0.045) + 'px;'}
    ">
      <div style="
        font-family:'Rajdhani','Share Tech Mono',monospace;
        font-size:${titleSize}px; font-weight:900; letter-spacing:${Math.round(titleSize*0.08)}px;
        color:${GAME_CONFIG.titleColor};
        text-shadow: 0 0 ${Math.round(titleSize*0.3)}px ${GAME_CONFIG.titleColor},
                     0 0 ${Math.round(titleSize*0.6)}px ${GAME_CONFIG.titleColor}88;
        line-height:1; white-space:nowrap;
      ">${GAME_CONFIG.title}</div>
      <div style="
        font-family:'Share Tech Mono',monospace;
        font-size:${subtitleSize}px; letter-spacing:${Math.round(subtitleSize*0.25)}px;
        color:${GAME_CONFIG.subtitleColor}; margin-top:${Math.round(titleSize*0.18)}px;
        text-shadow: 0 0 ${Math.round(subtitleSize*0.4)}px ${GAME_CONFIG.subtitleColor};
        white-space:nowrap;
      ">${GAME_CONFIG.subtitle}</div>
      <div style="
        font-family:'Share Tech Mono',monospace;
        font-size:${sloganSize}px; letter-spacing:${Math.round(sloganSize*0.2)}px;
        color:#ffffff55; margin-top:${Math.round(titleSize*0.22)}px;
        white-space:nowrap;
      ">${GAME_CONFIG.slogan}</div>
    </div>`;

  const gridBlock = `
    <div style="
      display:grid;
      grid-template-columns: repeat(${cols}, ${gridCell}px);
      grid-template-rows: repeat(${rows}, ${gridCell}px);
      gap:${gridGap}px;
      filter: drop-shadow(0 0 ${Math.round(gridCell*0.3)}px ${GAME_CONFIG.titleColor}22);
    ">${blockHtml}</div>`;

  const innerContent = isLandscape
    ? `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;">
         ${textBlock}${gridBlock}
       </div>`
    : `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;">
         ${textBlock}${gridBlock}
       </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{width:${w}px;height:${h}px;overflow:hidden;background:${GAME_CONFIG.bgColor};}
    .bg {
      position:absolute; inset:0;
      background:
        radial-gradient(ellipse 70% 60% at 50% 50%, ${GAME_CONFIG.glowCenter} 0%, transparent 65%),
        radial-gradient(ellipse 40% 30% at 20% 80%, ${GAME_CONFIG.glowCorner1} 0%, transparent 55%),
        radial-gradient(ellipse 40% 30% at 80% 20%, ${GAME_CONFIG.glowCorner2} 0%, transparent 55%);
    }
    .grid-bg {
      position:absolute; inset:0; opacity:0.06;
      background-image:
        linear-gradient(${GAME_CONFIG.gridLineColor} 1px, transparent 1px),
        linear-gradient(90deg, ${GAME_CONFIG.gridLineColor} 1px, transparent 1px);
      background-size: ${Math.round(w/24)}px ${Math.round(w/24)}px;
    }
    .content { position:relative; z-index:1; width:100%; height:100%; }
  </style>
  </head><body>
    <div class="bg"></div>
    <div class="grid-bg"></div>
    <div class="content">${innerContent}</div>
  </body></html>`;
}

const browser = await chromium.launch();

const SIZES = [
  { name: 'cover-square',    w: 800,  h: 800  },
  { name: 'cover-portrait',  w: 1080, h: 1920 },
  { name: 'cover-landscape', w: 1920, h: 1080 },
];

for (const { name, w, h } of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(makeCoverHtml(w, h), { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);  // wait for web font render
  const outPath = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: w, height: h } });
  await page.close();
  console.log(`✓ ${name}.png  (${w}×${h})`);
}

await browser.close();
console.log('\n✅ Cover images saved to:', outDir);
