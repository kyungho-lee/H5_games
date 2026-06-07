/**
 * Production build: src/samegame.html → dist/index.html
 * - Strips banner comments and section dividers
 * - ~6% size reduction
 * Run: node scripts/build.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const SRC  = path.join(__dirname, '../src/samegame.html');
const DIST = path.join(__dirname, '../dist');
const OUT  = path.join(DIST, 'index.html');

if (!fs.existsSync(SRC)) {
  console.error(`ERROR: ${SRC} not found`);
  process.exit(1);
}

// Ensure dist/ exists
if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

let content = fs.readFileSync(SRC, 'utf8');

const before = Buffer.byteLength(content, 'utf8');

// ── Strip ASCII banner comments (/* === ... === */) ───────────────
content = content.replace(/\/\*\s*[=█▀▄\s\w─]+?\*\//gm, '');

// ── Strip single-line section dividers (// ── ... ──) ─────────────
content = content.replace(/\/\/ ──+[^\n]*\n/g, '');

// ── Collapse 3+ consecutive blank lines to 1 ─────────────────────
content = content.replace(/\n{3,}/g, '\n\n');

// ── Trim trailing whitespace per line ────────────────────────────
content = content.split('\n').map(l => l.trimEnd()).join('\n');

const after = Buffer.byteLength(content, 'utf8');
const saved = ((1 - after / before) * 100).toFixed(1);

fs.writeFileSync(OUT, content, 'utf8');

console.log(`Build complete:`);
console.log(`  src:  ${SRC}`);
console.log(`  dist: ${OUT}`);
console.log(`  ${before.toLocaleString()} B → ${after.toLocaleString()} B  (${saved}% reduction)`);
