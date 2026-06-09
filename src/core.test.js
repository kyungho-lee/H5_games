'use strict';
// Set up a fake browser environment so core.js can be require()'d in Node
global.window = global;
global.SG = {};

require('./core.js');

const {
  DIFFICULTIES, scoreFormula,
  seededRandom, dateSeed,
  GameLogic, HintSystem,
  DailyManager, LocalAdapter,
} = global.SG;

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

  // Endless mode (no rng) should still produce a valid board
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
      { r: 0, c: 0, t: 0,   n: 12 }, // max → avg = (12+5+2)/3 = 6.3
      { r: 1, c: 1, t: 100, n: 5  },
      { r: 2, c: 2, t: 200, n: 2  },
    ],
  };
  dm.recordResult('normal', run);
  const share = dm.buildShareString('normal', run);

  assert.ok(share.includes('Daily 2026-06-09'), 'Share: contains date');
  assert.ok(share.includes('NORMAL'),           'Share: contains difficulty');
  assert.ok(share.includes('12,340'),           'Share: contains formatted score');
  assert.ok(share.includes('🔥'),              'Share: contains streak emoji');
  assert.ok(share.includes('최대 12개'),        'Share: max group size');
  assert.ok(share.includes('평균 6.3개/수'),    'Share: average group size');
  assert.ok(share.includes('✓ 클리어'),         'Share: cleared flag');
  assert.ok(!share.includes('"r"'),            'Share: no raw r/c in output');
  assert.ok(!share.includes('board'),          'Share: no "board" in output');

  // 미클리어 케이스
  const run2 = { score: 500, moves: 5, cleared: false, trail: [{ r:0,c:0,t:0,n:3 }] };
  const share2 = dm.buildShareString('normal', run2);
  assert.ok(share2.includes('✗ 미클리어'),     'Share: not-cleared flag');

  console.log('✓ buildShareString');
}

console.log('\nAll tests passed.');
