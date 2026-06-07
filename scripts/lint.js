/**
 * Architecture & code quality lint for samegame.html
 * Run: node scripts/lint.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../src/samegame.html');

let errors = 0;

function pass(msg)  { console.log(`  ✅  ${msg}`); }
function fail(msg)  { console.error(`  ❌  ${msg}`); errors++; }
function section(s) { console.log(`\n${s}`); }

// ── Read file ─────────────────────────────────────────────────────
if (!fs.existsSync(SRC)) {
  console.error(`ERROR: ${SRC} not found`);
  process.exit(1);
}
const html = fs.readFileSync(SRC, 'utf8');

// ── 1. Syntax check ───────────────────────────────────────────────
section('Syntax');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  fail('<script> block not found');
} else {
  try {
    new Function(scriptMatch[1]);  // eslint-disable-line no-new-func
    pass('JavaScript parses without syntax errors');
  } catch (e) {
    fail(`Syntax error: ${e.message}`);
  }
}

// ── 2. Required classes ───────────────────────────────────────────
section('Architecture — required classes');
const REQUIRED_CLASSES = [
  'GameLogic',
  'TutorialManager',
  'ExponentialBackoff',
  'NetworkManager',
  'ParticleSystem',
  'Renderer',
];
for (const cls of REQUIRED_CLASSES) {
  if (html.includes(`class ${cls}`)) {
    pass(`class ${cls} found`);
  } else {
    fail(`class ${cls} MISSING`);
  }
}

// ── 3. Required functions ─────────────────────────────────────────
section('Architecture — required functions');
const REQUIRED_FUNCTIONS = [
  'scoreFormula',
  'startGame',
  'startLevel',
  'endGame',
  'handleClick',
  'updateUI',
  'showOverlay',
  'hideOverlay',
];
for (const fn of REQUIRED_FUNCTIONS) {
  if (html.includes(`function ${fn}`) || html.includes(`${fn} =`) || html.includes(`const ${fn}`)) {
    pass(`function ${fn} found`);
  } else {
    fail(`function ${fn} MISSING`);
  }
}

// ── 4. localStorage key naming convention ─────────────────────────
section('localStorage — key prefix convention (samegame_)');
const lsMatches = [...html.matchAll(/localStorage\.\w+\(['"]([\w_]+)['"]/g)];
let lsOk = true;
for (const m of lsMatches) {
  const key = m[1];
  if (!key.startsWith('samegame_')) {
    fail(`localStorage key "${key}" does not start with "samegame_"`);
    lsOk = false;
  }
}
if (lsOk && lsMatches.length > 0) {
  pass(`All ${lsMatches.length} localStorage key(s) follow "samegame_" prefix`);
} else if (lsMatches.length === 0) {
  pass('No localStorage usage found (skip)');
}

// ── 5. No console.log in production paths (warnings only) ─────────
section('Code quality');
const consoleCount = (html.match(/console\.log\(/g) || []).length;
if (consoleCount === 0) {
  pass('No console.log statements');
} else {
  console.log(`  ⚠️   ${consoleCount} console.log statement(s) found (warning only)`);
}

// ── Summary ───────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
if (errors === 0) {
  console.log('  All lint checks passed ✅');
} else {
  console.error(`  ${errors} error(s) found ❌`);
  process.exit(1);
}
