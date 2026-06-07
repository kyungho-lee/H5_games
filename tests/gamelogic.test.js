'use strict';
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const html = fs.readFileSync(path.join(__dirname, '../src/samegame.html'), 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) { console.error('ERROR: no <script> block'); process.exit(1); }

// DOM stubs
const ctxStub = new Proxy({}, { get: () => () => {} });
function makeDomEl() {
  return {
    style: new Proxy({}, { get: () => undefined, set: () => true }),
    classList: { add(){}, remove(){}, toggle(){} },
    textContent: '', innerHTML: '',
    addEventListener: () => {},
    getContext: () => ctxStub,
    width: 0, height: 0, offsetWidth: 800, offsetHeight: 600,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
}

// Append export shim so class/const declarations become reachable
const exportShim = `
__exports__.GameLogic    = GameLogic;
__exports__.scoreFormula = scoreFormula;
`;

const sandbox = {
  console,
  Math, Date, Array, Object, Map, Set, Promise,
  setTimeout: () => {}, clearTimeout: () => {},
  requestAnimationFrame: () => {},
  localStorage: { getItem: () => null, setItem: () => {} },
  window: { addEventListener: () => {} },
  document: { getElementById: () => makeDomEl(), addEventListener: () => {} },
  __exports__: {},
};

vm.runInNewContext(scriptMatch[1] + exportShim, sandbox);

const { GameLogic, scoreFormula } = sandbox.__exports__;

// Harness
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  OK  ' + name); passed++; }
  catch(e) { console.error('  FAIL ' + name + '\n      ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg) { if (a !== b) throw new Error(msg || 'expected ' + b + ' got ' + a); }

var CFG = { cols: 4, rows: 4, colors: 2, minGroup: 2, bias: 0 };

console.log('\nscoreFormula');
test('n=2  -> 20',   function(){ eq(scoreFormula(2),  20); });
test('n=5  -> 200',  function(){ eq(scoreFormula(5),  200); });
test('n=10 -> 900',  function(){ eq(scoreFormula(10), 900); });
test('n=25 -> 6000', function(){ eq(scoreFormula(25), 6000); });

console.log('\ngetGroup');
test('flood-fill 3 connected', function(){
  var l = new GameLogic(CFG);
  l.board = [[0,0,-1,-1],[0,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1]];
  eq(l.getGroup(0,0).length, 3);
});
test('empty cell returns []', function(){
  var l = new GameLogic(CFG);
  l.board = [[-1,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1]];
  eq(l.getGroup(0,0).length, 0);
});

console.log('\napplyInput');
test('rejects GROUP_TOO_SMALL', function(){
  var l = new GameLogic(CFG);
  l.board = [[0,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1]];
  var r = l.applyInput(0,0);
  assert(!r.valid); eq(r.error,'GROUP_TOO_SMALL');
});
test('emits BOARD_CLEAR', function(){
  var l = new GameLogic(CFG);
  l.board = [[-1,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1],[0,0,-1,-1]];
  var r = l.applyInput(3,0);
  assert(r.valid);
  assert(r.events.some(function(e){ return e.type==='BOARD_CLEAR'; }));
});
test('score += scoreFormula(n)', function(){
  var l = new GameLogic(CFG);
  l.board = [[-1,-1,-1,-1],[-1,-1,-1,-1],[0,0,-1,-1],[0,-1,-1,-1]];
  var before = l.score;
  var r = l.applyInput(2,0);
  assert(r.valid);
  eq(l.score - before, scoreFormula(3));
});

console.log('\n_applyGravity');
test('tile falls to bottom', function(){
  var l = new GameLogic(CFG);
  l.board = [[0,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1]];
  l._applyGravity();
  eq(l.board[3][0], 0);
  eq(l.board[0][0], -1);
});

console.log('\n_removeEmptyColumns');
test('empty col compressed left', function(){
  var l = new GameLogic(CFG);
  l.board = [[-1,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1],[-1,0,-1,-1]];
  l._removeEmptyColumns();
  eq(l.board[3][0], 0);
  eq(l.board[3][1], -1);
});

console.log('\nundo');
test('undo restores score and board', function(){
  var l = new GameLogic(CFG);
  l.board = [[-1,-1,-1,-1],[-1,-1,-1,-1],[0,0,-1,-1],[0,-1,-1,-1]];
  var sb = l.score;
  var bb = l.board[2][0];
  l.applyInput(2,0);
  assert(l.undo());
  eq(l.score, sb);
  eq(l.board[2][0], bb);
});
test('undo empty history -> false', function(){
  var l = new GameLogic(CFG);
  l.history = [];
  assert(!l.undo());
});

console.log('\ngetSnapshot');
test('snapshot has board/score/moveCount/cfg', function(){
  var l = new GameLogic(CFG);
  var s = l.getSnapshot();
  assert(Array.isArray(s.board));
  assert(typeof s.score === 'number');
  assert(typeof s.moveCount === 'number');
  assert(s.cfg);
});

console.log('\nbalance');
test('isolated tile ratio < 15% (100 sims)', function(){
  var cfg = { cols:15, rows:11, colors:4, minGroup:2, bias:0.75 };
  var iso = 0, total = 0;
  for (var i = 0; i < 100; i++) {
    var l = new GameLogic(cfg);
    for (var r = 0; r < cfg.rows; r++) {
      for (var c = 0; c < cfg.cols; c++) {
        if (l.board[r][c] === -1) continue;
        total++;
        if (l.getGroup(r,c).length < cfg.minGroup) iso++;
      }
    }
  }
  var ratio = iso / total;
  assert(ratio < 0.15, 'ratio ' + (ratio*100).toFixed(1) + '% >= 15%');
});

console.log('\n' + '-'.repeat(40));
console.log('  ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
