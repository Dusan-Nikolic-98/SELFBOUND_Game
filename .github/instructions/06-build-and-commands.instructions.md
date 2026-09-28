# Build and commands

Run commands from the repository root. The repository uses npm (`package-lock.json`); Node.js 18+ is documented in `README.md`.

## Install

```sh
npm install
```

## Development

```sh
npm run dev:frontend   # build frontend and serve it
npm run dev:backend    # build backend and start it
npm run dev            # launch frontend and backend side by side
```

The frontend server defaults to `http://127.0.0.1:4173`; the backend defaults to `http://127.0.0.1:3001`. The frontend's HTML loads compiled code from `frontend/dist/`.

## Build and checks

```sh
npm run build            # frontend and backend
npm run build:frontend
npm run build:backend
npm run typecheck        # frontend and backend
npm run typecheck:frontend
npm run typecheck:backend
npm test
node scripts/check-reachability.mjs
```

The reachability script consumes compiled frontend files, so run `npm run build:frontend` before it. `npm test` compiles to ignored `dist-tests/` and runs the four Node test files. There is no lint script. `npm start` aliases `npm run dev`; `npm run serve` aliases `npm run serve:frontend`.

## Current API

```text
GET http://127.0.0.1:3001/api/health
```

Returns HTTP 200 with `{"ok":true,"service":"selfbound-backend"}`. This route remains independent of gameplay.

The game also calls `POST http://127.0.0.1:3001/api/ai/coach` after the player requests advice and completed-run history exists. It accepts one to three validated completed-run summaries and returns structured fake-provider advice. It makes no live provider call.

## Environment

- Backend reads `HOST` (default `127.0.0.1`) and `PORT` (default `3001`).
- `scripts/serve.mjs` reads `HOST` (default `127.0.0.1`) and `PORT` (default `4173`) for the frontend server.
- The combined launcher passes its environment to both processes. Setting a single `PORT` for `npm run dev` overrides both server ports and can cause a bind conflict; use separate processes if distinct overrides are needed.
- No environment file or AI/provider variable is required. `.env.example` does not exist.

Only document scripts and variables verified in the repository. Report a command that could not run instead of treating it as passed.
