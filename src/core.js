/* core.js — SameGame · Grid Protocol shared pure logic
   Attaches exports to window.SG (classic script, file:// safe).
   Load order: core.js → render.js → page inline script.         */
(function (global) {
  'use strict';

  // ── DIFFICULTIES ────────────────────────────────────────────────
  const DIFFICULTIES = {
    easy:   { cols: 10, rows: 10, colors: 3, minGroup: 2, bias: 0.60 },
    normal: { cols: 15, rows: 11, colors: 4, minGroup: 2, bias: 0.75 },
    hard:   { cols: 16, rows: 12, colors: 5, minGroup: 2, bias: 0.75 },
  };

  // ── scoreFormula ────────────────────────────────────────────────
  const scoreFormula = n => n * (n - 1) * 10;

  // ── seededRandom (mulberry32) ────────────────────────────────────
  function seededRandom(seed) {
    return function () {
      seed |= 0;
      seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ── dateSeed (FNV-style hash) ────────────────────────────────────
  function dateSeed(dateStr, diff) {
    const s = dateStr + '|' + diff;
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h;
  }

  // ── GameLogic ────────────────────────────────────────────────────
  /* ================================================================
     GameLogic — pure, framework-free, server-shareable
     Can be imported in Node.js Colyseus Room as-is
  ================================================================ */
  class GameLogic {
    constructor(cfg) {
      this.cfg = cfg;
      this.board = [];
      this.score = 0;
      this.moveCount = 0;
      this.history = []; // undo stack: [{board, score}]
      this._init();
    }

    _init() {
      const { cols, rows, colors, bias = 0.6 } = this.cfg;
      const rnd = this.cfg.rng || Math.random;
      // ── 클러스터 생성 (neighborBias 알고리즘) ──
      // 완전 랜덤 대비 인접 셀이 같은 색일 확률을 bias만큼 높임
      // → 자연스러운 그룹이 형성되어 제거 가능한 보드 생성
      const board = Array.from({ length: rows }, () => Array(cols).fill(-1));
      // 방문 순서를 셔플 → 방향성 편향 제거
      const order = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) order.push([r, c]);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      for (const [r, c] of order) {
        // 이미 채워진 경우 스킵 (없어야 하지만 방어적으로)
        if (board[r][c] !== -1) continue;
        const neighbors = [];
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc] !== -1)
            neighbors.push(board[nr][nc]);
        }
        // bias 확률로 인접 색상 선택, 아니면 완전 랜덤
        board[r][c] = (neighbors.length > 0 && rnd() < bias)
          ? neighbors[Math.floor(rnd() * neighbors.length)]
          : Math.floor(rnd() * colors);
      }
      this.board = board;
      this.score = 0;
      this.moveCount = 0;
      this.history = [];
    }

    // Returns group of connected cells of same color via flood-fill
    getGroup(r, c) {
      if (this.board[r][c] === -1) return [];
      const target = this.board[r][c];
      const visited = new Set();
      const stack = [[r, c]];
      const group = [];
      while (stack.length) {
        const [cr, cc] = stack.pop();
        const key = cr * 1000 + cc;
        if (visited.has(key)) continue;
        visited.add(key);
        if (cr < 0 || cr >= this.cfg.rows || cc < 0 || cc >= this.cfg.cols) continue;
        if (this.board[cr][cc] !== target) continue;
        group.push([cr, cc]);
        stack.push([cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]);
      }
      return group;
    }

    // Validate + apply input; returns {valid, events, score, group}
    applyInput(r, c) {
      const group = this.getGroup(r, c);
      if (group.length < this.cfg.minGroup) {
        return { valid: false, error: 'GROUP_TOO_SMALL', group };
      }
      // save undo state
      this.history.push({
        board: this.board.map(row => [...row]),
        score: this.score,
      });
      if (this.history.length > 10) this.history.shift();

      const gained = scoreFormula(group.length);
      this.score += gained;
      this.moveCount++;

      // remove tiles
      for (const [gr, gc] of group) this.board[gr][gc] = -1;

      // gravity: drop tiles down
      this._applyGravity();

      // remove empty columns
      this._removeEmptyColumns();

      const remaining = this.countTiles();
      const events = [{ type: 'TILES_REMOVED', group, gained }];
      if (remaining === 0) events.push({ type: 'BOARD_CLEAR' });
      else if (!this.hasValidMove()) events.push({ type: 'GAME_OVER' });

      return { valid: true, events, gained, group, score: this.score };
    }

    undo() {
      if (!this.history.length) return false;
      const prev = this.history.pop();
      this.board = prev.board;
      this.score = prev.score;
      this.moveCount--;
      return true;
    }

    _applyGravity() {
      for (let c = 0; c < this.cfg.cols; c++) {
        let writeRow = this.cfg.rows - 1;
        for (let r = this.cfg.rows - 1; r >= 0; r--) {
          if (this.board[r][c] !== -1) {
            this.board[writeRow][c] = this.board[r][c];
            if (writeRow !== r) this.board[r][c] = -1;
            writeRow--;
          }
        }
        while (writeRow >= 0) { this.board[writeRow--][c] = -1; }
      }
    }

    _removeEmptyColumns() {
      let writeCol = 0;
      for (let c = 0; c < this.cfg.cols; c++) {
        const isEmpty = this.board.every(row => row[c] === -1);
        if (!isEmpty) {
          if (writeCol !== c) {
            for (let r = 0; r < this.cfg.rows; r++) {
              this.board[r][writeCol] = this.board[r][c];
              this.board[r][c] = -1;
            }
          }
          writeCol++;
        }
      }
    }

    hasValidMove() {
      const { rows, cols, minGroup } = this.cfg;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          if (this.board[r][c] !== -1 && this.getGroup(r, c).length >= minGroup)
            return true;
      return false;
    }

    countTiles() {
      return this.board.flat().filter(v => v !== -1).length;
    }

    // Full state snapshot (for network sync / Colyseus)
    getSnapshot() {
      return {
        board: this.board.map(r => [...r]),
        score: this.score,
        moveCount: this.moveCount,
        cfg: this.cfg,
      };
    }

    // Apply a snapshot (for server reconciliation)
    applySnapshot(snap) {
      this.board = snap.board.map(r => [...r]);
      this.score = snap.score;
      this.moveCount = snap.moveCount;
    }

    // ── Clearability checker (static, pure — no side effects) ────────
    // Greedy simulation: 매 턴 가장 큰 유효 그룹을 제거.
    // 보드가 비워지면 true(클리어 가능 확인), 막히면 false.
    // 주의: 그리디 전략으로 풀리지 않는 보드도 이론상 클리어 가능할 수 있으나,
    //       데일리 보드는 그리디로 검증된 것만 제공 → 반드시 클리어 가능.
    static isGreedyClearable(board, cfg) {
      const { rows, cols, minGroup } = cfg;
      // 딥 카피 — 원본 보드 불변
      const b = board.map(r => [...r]);

      while (true) {
        // ─ 1. 전체 보드에서 가장 큰 유효 그룹 탐색 (flood-fill) ─
        const visited = new Set();
        let bestGroup = null;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (b[r][c] === -1) continue;
            const key = r * 1000 + c;
            if (visited.has(key)) continue;

            const color = b[r][c];
            const group = [];
            const stack = [[r, c]];
            while (stack.length) {
              const [cr, cc] = stack.pop();
              const k = cr * 1000 + cc;
              if (visited.has(k)) continue;
              if (cr < 0 || cr >= rows || cc < 0 || cc >= cols) continue;
              if (b[cr][cc] !== color) continue;
              visited.add(k);
              group.push([cr, cc]);
              stack.push([cr-1,cc],[cr+1,cc],[cr,cc-1],[cr,cc+1]);
            }

            if (group.length >= minGroup &&
                (!bestGroup || group.length > bestGroup.length)) {
              bestGroup = group;
            }
          }
        }

        // ─ 2. 유효 그룹 없으면 종료 ─
        if (!bestGroup) {
          return b.every(row => row.every(v => v === -1));
        }

        // ─ 3. 그룹 제거 ─
        for (const [r, c] of bestGroup) b[r][c] = -1;

        // ─ 4. 중력 ─
        for (let c = 0; c < cols; c++) {
          let wr = rows - 1;
          for (let r = rows - 1; r >= 0; r--) {
            if (b[r][c] !== -1) { b[wr][c] = b[r][c]; if (wr !== r) b[r][c] = -1; wr--; }
          }
          while (wr >= 0) b[wr--][c] = -1;
        }

        // ─ 5. 빈 컬럼 제거 ─
        let wc = 0;
        for (let c = 0; c < cols; c++) {
          const isEmpty = b.every(row => row[c] === -1);
          if (!isEmpty) {
            if (wc !== c) for (let r = 0; r < rows; r++) { b[r][wc] = b[r][c]; b[r][c] = -1; }
            wc++;
          }
        }
      }
    }
  }

  // ── HintSystem ───────────────────────────────────────────────────
  /* ================================================================
     HintSystem — finds the highest-scoring removable group.
     Reuses GameLogic.getGroup() (pure flood-fill, no mutation) and
     the global scoreFormula(). Result is cached per move; call
     invalidate() after the board changes to force recompute.
  ================================================================ */
  class HintSystem {
    constructor(gameLogic) {
      this.logic = gameLogic;
      this._cache = null;        // { cells, score }
      this._cacheMove = -1;      // moveCount the cache was built for
    }

    // Returns { cells: [[r,c],...], score } for the best group, or null
    // if no removable group exists. Cached until invalidate() or a new move.
    findOptimalGroup() {
      // _cacheMove starts at -1 (and resets to -1 on invalidate); moveCount is
      // never negative, so this correctly recomputes on first call / after a move
      // while still caching a "no group" (null) result.
      if (this._cacheMove === this.logic.moveCount) return this._cache;
      const { rows, cols, minGroup } = this.logic.cfg;
      const seen = new Set();
      let best = null;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (this.logic.board[r][c] === -1) continue;
          const key = r * 1000 + c;
          if (seen.has(key)) continue;
          const group = this.logic.getGroup(r, c);
          for (const [gr, gc] of group) seen.add(gr * 1000 + gc);
          if (group.length < minGroup) continue;
          const score = scoreFormula(group.length);
          if (!best || score > best.score) best = { cells: group, score };
        }
      }
      this._cache = best;
      this._cacheMove = this.logic.moveCount;
      return best;
    }

    // Optional (debug): enumerate every removable group, sorted by score desc.
    getAllGroups() {
      const { rows, cols, minGroup } = this.logic.cfg;
      const seen = new Set();
      const groups = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (this.logic.board[r][c] === -1) continue;
          const key = r * 1000 + c;
          if (seen.has(key)) continue;
          const group = this.logic.getGroup(r, c);
          for (const [gr, gc] of group) seen.add(gr * 1000 + gc);
          if (group.length < minGroup) continue;
          groups.push({ cells: group, score: scoreFormula(group.length) });
        }
      }
      return groups.sort((a, b) => b.score - a.score);
    }

    invalidate() {
      this._cache = null;
      this._cacheMove = -1;
    }
  }

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
      const baseSeed = dateSeed(this.todayKey(), diff);
      const cfg      = DIFFICULTIES[diff];
      // 그리디 시뮬레이션으로 클리어 가능 보드가 나올 때까지 시드 증가
      // 같은 날 같은 난이도라면 offset이 동일 → 전 세계 유저 동일 보드 보장
      for (let offset = 0; offset < 200; offset++) {
        const logic = new GameLogic({ ...cfg, rng: seededRandom(baseSeed + offset) });
        if (GameLogic.isGreedyClearable(logic.board, logic.cfg)) return logic;
      }
      // 200회 시도 후에도 없으면 base 시드 그대로 반환 (실질적으로 발생 안 함)
      return new GameLogic({ ...cfg, rng: seededRandom(baseSeed) });
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
      const today  = this.todayKey();
      const stats  = this.getStats(diff);
      const trail  = run.trail || [];
      const maxN   = trail.length ? trail.reduce((m, t) => Math.max(m, t.n), 0) : 0;
      const avgN   = trail.length ? trail.reduce((s, t) => s + t.n, 0) / trail.length : 0;
      const result = run.cleared ? '✓ 클리어' : '✗ 미클리어';
      const stats4 = '최대 ' + maxN + '개  평균 ' + avgN.toFixed(1) + '개/수  ' + result;
      return [
        'SameGame · Grid Protocol',
        'Daily ' + today + ' · ' + diff.toUpperCase(),
        'Score ' + run.score.toLocaleString() + ' · ' + run.moves + ' moves · 🔥' + stats.streak,
        stats4,
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

  // ── namespace export ────────────────────────────────────────────
  global.SG = global.SG || {};
  Object.assign(global.SG, {
    DIFFICULTIES, scoreFormula,
    seededRandom, dateSeed,
    GameLogic, HintSystem,
    DailyManager, LocalAdapter,
  });
})(typeof window !== 'undefined' ? window : global);
