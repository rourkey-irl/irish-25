---
name: verify
description: How to run and visually verify Irish 25 (Express + browser game) without touching the repo DB
---

# Verifying Irish 25

## Launch (isolated — never against the committed irish25.db)

```bash
cp irish25.db /tmp/test.db          # or a scratchpad dir
DB_PATH=/tmp/test.db PORT=3123 node server.js &
```

`DB_PATH` and `PORT` are read in `db.js` / `server.js`. Kill with `lsof -ti:3123 | xargs kill`.

## Drive it (Playwright)

Playwright 1.61 + Chromium are cached at `~/.npm/_npx/e41f203b7505f1fb/node_modules` (not installed in the repo). Run scripts with:

```bash
NODE_PATH=~/.npm/_npx/e41f203b7505f1fb/node_modules node script.js
```

Auth flow in a script: POST `/api/register` then `/api/login` with `{username, password}` (password ≥ 6 chars) via `context.request` — the session cookie lands in the browser context. Then `goto /game.html`.

Game flow: click `#btn-start` to deal (always 1 human + 5 AI). If `#btn-skip-rob` becomes visible within ~1.5s, click it or play stalls. AI plays every 900ms (`AI_DELAY` in ui.js). Wait for `#player-area.your-turn` before tapping a `.card.legal-card` in `#player-hand`. Trick cards appear as `#trick-area .card-in-trick`.

## Worth checking on layout changes

- Horizontal overflow: `document.documentElement.scrollWidth <= innerWidth` at 360, 390, 430 (phone breakpoint is `max-width: 640px`), 768, 1280.
- 5-card hand stays on one row; full 6-card trick fits at 360px.
- Mobile score panel is a chip strip at the bottom; desktop is a 200px right sidebar.
