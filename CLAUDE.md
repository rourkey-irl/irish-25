# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Irish 25 — a browser-based implementation of Ireland's traditional trick-taking card game. Players (1 human + up to 5 AI opponents) compete to reach 25 points. The server handles auth and persistent scores; all game logic runs client-side.

## Running the app

```bash
npm start          # starts Express on http://localhost:3000
```

No build step. No tests. No linter configured.

## Architecture

### Server (`server.js` + `db.js`)

Express 5 app with session-based auth (bcrypt passwords, `express-session`). SQLite via `better-sqlite3` (synchronous API — no `await` on DB calls). The DB file `irish25.db` is committed to the repo.

API routes: `/api/register`, `/api/login`, `/api/logout`, `/api/me`, `/api/leaderboard`, `/api/result`.

### Client (`public/`)

Three plain JS files loaded in order via `game.html`:

- **`game.js`** — pure game engine, no DOM. Exports `window.Game`. Contains all card ranking logic, trick resolution, legal-move calculation, and the reneging rule. This is the most rule-sensitive file.
- **`ai.js`** — exports `window.AI`. Calls `Game.*` to pick a card. Strategy: lead highest trump; otherwise win cheaply if possible, else dump lowest.
- **`ui.js`** — DOM orchestration. Calls `Game.*` and `AI.*`. Manages game flow phases (`dealing → robbing → playing → scoring → gameover`) and posts round results to the server.

Auth (`index.html`) and the game board (`game.html`) are separate pages; `ui.js` redirects to `/` if the session has expired.

## Key game rules encoded in `game.js`

- **Trump order** (high→low): 5 of trumps → J of trumps → A♥ → A of trumps → colour-order remainder. A♥ is *always* a trump regardless of the trump suit.
- **Reneging**: a player holding the 5, J of trumps, or A♥ may refuse to follow a trump lead *only if* their card outranks the card led. Implemented in `canRenege()` and enforced in `legalCards()`.
- **Scoring**: 5 pts per trick won; winner of ≥3 tricks takes the pool. Pool carries forward on a spoil (no one wins 3). First to 25 pts wins the game.
- **Robbing**: holder of the A of trumps may swap it for the turned-up trump card before play begins; `whoCanRob()` identifies who, `robPack()` executes it.
