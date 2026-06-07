# SameGame — Grid Protocol

> HTML5 Canvas puzzle game · Single-player · Multiplayer-ready architecture

![CI](https://github.com/YOUR_USERNAME/samegame-grid-protocol/actions/workflows/ci.yml/badge.svg)

## Play

Open `src/samegame.html` directly in a browser, or run a local dev server:

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Rules

Click a group of 2+ connected same-colored tiles to remove them.  
Score formula: `n × (n-1) × 10` where `n` = group size.  
Larger groups earn exponentially more points.

| Difficulty | Grid   | Colors | Clear rate |
|------------|--------|--------|-----------|
| EASY       | 10×10  | 3      | ~27%      |
| NORMAL     | 15×11  | 4      | ~7%       |
| HARD       | 16×12  | 5      | ~0.6%     |

## Architecture

```
src/samegame.html         ← single-file game (HTML + CSS + JS)
├── GameLogic             pure state machine — zero DOM deps, server-shareable
├── TutorialManager       4-step interactive tutorial
├── ExponentialBackoff    reconnect backoff
├── NetworkManager        WebSocket stub (Colyseus-ready)
├── ParticleSystem        object-pooled particles (800 pool)
├── FloatText             score popups
└── Renderer              Canvas 2D — particles, animations, spotlight
```

`GameLogic` has no browser dependencies and can be imported directly into a Node.js Colyseus server room.

## Scripts

```bash
npm run dev    # local dev server at localhost:3000
npm test       # run unit tests (15 cases)
npm run lint   # architecture & code quality checks
npm run build  # src/samegame.html → dist/index.html (~6% smaller)
```

## Roadmap

- [ ] `feature/hint-system` — highlight best available group
- [x] `feature/sound-effects` — Web Audio API 8-bit synthesized sounds (SoundManager)
- [ ] `feature/animation-gravity` — smooth tile-drop animation
- [ ] `feature/multiplayer-colyseus` — real-time multiplayer via Colyseus
- [ ] `chore/gh-pages-deploy` — auto-deploy to GitHub Pages

## License

MIT
