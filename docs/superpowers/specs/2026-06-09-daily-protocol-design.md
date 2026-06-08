# Daily Protocol — Design Spec

- **Date:** 2026-06-09
- **Status:** Approved (design), pending implementation plan
- **Feature:** A Wordle-style daily puzzle mode for SameGame — Grid Protocol
- **Scope of this phase:** Client-only standalone (no backend). Competition layer is designed as an extensible seam for a later phase.

## 1. Goal & Constraints

Add a "Daily Protocol" mode: one byte-identical, deterministic board per UTC day (per difficulty), one ranked attempt, a personal streak/best, and a spoiler-free emoji share-string — turning the solitary puzzle into a daily ritual.

**Decisions locked during brainstorming:**

| Decision | Choice |
|----------|--------|
| Constraint envelope | No constraints in ideation; this feature stays STANDALONE (no build tool, no server). |
| Competition layer | **Client-only first.** No global leaderboard. Designed extensible for a later backend/ghost phase. |
| Goal / scoring basis | **Personal best + streak.** No solver / no PAR. Raw score + streak + personal best. |
| Separation level | **Separate file `daily.html`** sharing extracted core code with `samegame.html`. |
| Existing game | **Refactor (가)** — `samegame.html` is refactored to consume the shared core; behavior preserved (regression-guarded), not byte-frozen. |
| Module system | **Classic scripts only** (`<script src>` + `window.SameGameCore` namespace). ES modules are forbidden — they break under `file://` (CORS), violating the open-by-double-click requirement. |

**Non-goals (this phase):** global leaderboard, backend, real-time multiplayer, ghost replay (#2), level editor (#8), any optimal-solver/PAR.

## 2. Architecture & File Layout

```
src/
├── core.js          [NEW] shared pure logic (classic script → window.SameGameCore)
│   ├── DIFFICULTIES
│   ├── scoreFormula
│   ├── seededRandom(seed)   mulberry32 PRNG factory
│   ├── dateSeed(dateStr, diff)  cyrb-style string hash → uint32
│   ├── GameLogic            (+ optional cfg.rng injection)
│   ├── HintSystem
│   └── DailyManager
├── render.js        [NEW] shared Canvas stack (classic script)
│   ├── COLOR_PALETTE
│   ├── Particle / ParticleSystem
│   ├── FloatText
│   └── Renderer
├── samegame.html    [REFACTORED] endless mode — thin controller; loads core.js + render.js
└── daily.html       [NEW] Daily Protocol — thin controller + daily summary overlay
```

**Why a namespace, not globals scattered:** `core.js`/`render.js` attach their exports to `window.SameGameCore` / `window.SameGameRender` (or a single `window.SG`) to avoid polluting global scope and to make the dependency explicit. Final naming decided in the plan; one namespace object is acceptable.

**Components NOT extracted this phase:** `SoundManager`, `TutorialManager`, and the `NetworkManager` stub stay inline in `samegame.html` — they are endless-mode-specific. `daily.html` ships **without sound and without tutorial** in this phase (the daily flow is self-explanatory). If Daily wants sound later, `SoundManager` becomes the next extraction into `core.js`; this is deliberately deferred to keep the refactor scope contained (effort S).

**Data flow (daily):**
`daily.html` → `dateSeed(todayUTC, diff)` → `seededRandom(seed)` → `new GameLogic({...DIFFICULTIES[diff], rng})` → deterministic board. Same day + same difficulty ⇒ identical board everywhere.

**Load order under `file://`:** `<script src="core.js">` then `<script src="render.js">` then the page's inline controller. Classic scripts execute in order and share globals; no fetch/CORS involved.

## 3. Seeded Core (`core.js`)

```js
function seededRandom(seed) {
  // mulberry32: returns () => float in [0,1)
}
function dateSeed(dateStr, diff) {
  // hash `${dateStr}|${diff}` (cyrb53/xfnv1a) → uint32 seed
}
```

**GameLogic change — the only modification to existing logic, non-breaking:**
In `_init()`, add `const rnd = this.cfg.rng || Math.random;` and replace the two `Math.random()` call sites (the order-shuffle and the color pick) with `rnd()`.
- Endless mode passes no `rng` → falls back to `Math.random` → **behavior identical to today**.
- Daily mode injects `rng` → deterministic board.

GameLogic stays DOM-free and dependency-free; `seededRandom` lives beside it in `core.js`.

## 4. DailyManager (`core.js`, DOM-free)

Encapsulates today's seed, the one-attempt lock, streak, best, and share-string. Reads/writes through an injected `storage` (defaults to `localStorage`) and an injectable `now()` (defaults to `Date`) so it is unit-testable.

```
makeGame(diff)        → new GameLogic({...DIFFICULTIES[diff], rng: seededRandom(dateSeed(today, diff))})
todayKey()            → UTC "YYYY-MM-DD"
isPlayedToday(diff)   → bool (lock check)
recordResult(diff, r) → updates streak + best, writes lock + RunRecord
getStats(diff)        → { streak, best, lastPlayed, todayResult }
buildShareString(r)   → spoiler-free text
```

**Streak rule:** stored as `{ count, lastDate }`. On `recordResult`: if `lastDate` is yesterday (UTC) → `count + 1`; if today (already counted) → unchanged; otherwise → reset to 1.

**Attempt rule:** one ranked attempt/day/difficulty. After completion the board is locked and the summary is shown. Replays are allowed as unranked "practice" that never call `recordResult`.

**Undo:** disabled in Daily mode (fair scoring).

### RunRecord & extensibility seam (§ emphasized requirement)

`recordResult` produces a structured, serializable record:

```js
RunRecord = {
  date,        // UTC YYYY-MM-DD
  diff,        // 'easy' | 'normal' | 'hard'
  seed,        // uint32 used
  score,
  moves,
  cleared,     // bool (board fully emptied)
  trail: [ { r, c, t } ]   // ordered clicks + ms timestamp
}
```

DailyManager depends on a `SubmitAdapter` interface, not a concrete implementation:

```
SubmitAdapter.submit(runRecord)  → Promise|void
```

- **This phase:** `LocalAdapter` — stores the record in `sg_daily_history` and does nothing else (no network).
- **Future phase (no DailyManager change):** `RemoteAdapter` (POST to a leaderboard) and/or `GhostStore` (persist `trail` for #2 Ghost Race replay) implement the same interface and are injected in.

Capturing `trail` now means Ghost Race (#2) becomes a thin add later: replay = feed `trail` coordinates back through `applyInput()` on a second GameLogic instance over the same seeded board.

## 5. Persistence Schema (`localStorage`, prefix `sg_daily_`)

| Key | Value |
|-----|-------|
| `sg_daily_streak` | `{ count, lastDate }` |
| `sg_daily_best_<diff>` | number (best score for that difficulty) |
| `sg_daily_result_<UTCdate>_<diff>` | `{ score, moves, cleared, ts }` (lock + summary) |
| `sg_daily_history` | array of last 30 `RunRecord` (future ghost/stats) |

No collision with existing keys (`samegame_best_*`, `samegame_tut_done`, `hint_enabled`).

## 6. daily.html Flow

1. Load → pick difficulty (remembers last choice).
2. Load today's board; if already played → show summary (locked) with a "practice" option.
3. Play (no undo).
4. BOARD_CLEAR or GAME_OVER → **summary overlay**: score · moves · streak (🔥) · best, plus a 📋 **Share** button.
5. Lock the day.

**Share string (spoiler-free):**
```
SameGame · Grid Protocol
Daily 2026-06-09 · NORMAL
Score 12,340 · 14 moves · 🔥5
🟩🟩🟨🟦⬛🟨🟩…
```
The emoji trail encodes each move's group-size *bucket* (big/medium/small), conveying rhythm — **not** the board layout or solution. Clipboard copy via `navigator.clipboard` with a `textarea`-select fallback for `file://`.

Visual language reuses `render.js` (same palette, particles, popups) so Daily feels like the same game.

## 7. Component Boundaries (isolation)

| Unit | Does | Depends on | Testable |
|------|------|-----------|----------|
| `seededRandom` | deterministic float stream | — | yes (pure) |
| `dateSeed` | stable string→seed | — | yes (pure) |
| `GameLogic` | game state machine | `cfg.rng` (optional) | yes (pure) |
| `DailyManager` | seed/lock/streak/best/share | GameLogic, seededRandom, storage, now, SubmitAdapter | yes (inject storage+now) |
| `Renderer` (render.js) | Canvas draw | COLOR_PALETTE, scoreFormula | manual/browser |
| daily controller | wire input/loop/overlay | core + render | manual/browser |

## 8. Testing & Verification

No test framework exists in the repo. Add a **framework-free** `src/core.test.js` runnable as `node core.test.js` (plain `assert`), covering the pure layer:

- `seededRandom` determinism (same seed → same sequence).
- `dateSeed` stability (same inputs → same seed; different diff → different seed).
- **Board determinism:** two `GameLogic` built from the same seed produce identical `board` (the core guarantee).
- Streak boundaries: consecutive day → +1; skipped day → reset; same day → unchanged.
- `buildShareString` format + spoiler-free property (no raw board in output).

Plus: `node --check` on extracted scripts, and manual browser verification of `daily.html` (play, lock, streak increments next day via injectable `now`, share copies).

**Regression guard for the refactor:** after moving GameLogic/Renderer into shared files, `samegame.html` must play identically — verified by `node --check` + manual play of the endless mode (start, clear groups, combos, undo, tutorial, hint, all 3 difficulties).

## 9. Risks & Open Questions

- **PAR approximation removed:** no solver this phase; competition is personal streak/best + manual share comparison. Accepted.
- **One attempt/day** caps session length; "practice" replays mitigate.
- **Refactor risk:** extracting Renderer is the largest mechanical change; mitigated by behavior-preserving moves + regression checks. The endless controller's coupling to module-local helpers (e.g. `COLOR_PALETTE`, `scoreFormula`) must be re-pointed at the shared namespace.
- **Namespace naming** (`SameGameCore`/`SameGameRender` vs single `SG`) finalized in the plan.

## 10. Implementation Order (for the plan)

1. Extract pure logic into `core.js` (+ namespace); add `seededRandom`/`dateSeed`; add `cfg.rng` to GameLogic.
2. Extract Canvas stack into `render.js`.
3. Refactor `samegame.html` to load both; verify endless behavior unchanged (regression).
4. Implement `DailyManager` + `LocalAdapter` + `SubmitAdapter` seam in `core.js`.
5. Build `daily.html` (controller, daily overlay, share).
6. Add `core.test.js`; run it.
7. Manual browser verification of both pages.
