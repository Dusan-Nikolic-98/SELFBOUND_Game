# SELFBOUND

SELFBOUND is a retro-inspired 2D side-scrolling browser game built with TypeScript, HTML Canvas and CSS. The browser game remains the owner of all gameplay state and rules. Its independent TypeScript backend provides a health endpoint and a read-only AI Coach endpoint backed by a deterministic fake provider. No live AI service is configured.

## Requirements

- Node.js 18 or newer
- npm

## Install

```sh
npm install
```

## Run locally

Start either process separately:

```sh
npm run dev:frontend
npm run dev:backend
```

The frontend is served at `http://127.0.0.1:4173`; the backend listens at `http://127.0.0.1:3001`. Start both from one terminal with:

```sh
npm run dev
```

Check the backend health endpoint:

```sh
curl http://127.0.0.1:3001/api/health
```

It returns HTTP 200 and `{"ok":true,"service":"selfbound-backend"}`. The AI Coach flow uses `POST http://127.0.0.1:3001/api/ai/coach` with completed-run summaries; its fake provider returns deterministic structured advice. Start both frontend and backend for Coach requests; gameplay remains playable if the backend is unavailable. Completed history lasts only for the current page session.

## Build and checks

```sh
npm run build
npm run typecheck
npm test
node scripts/check-reachability.mjs
```

`npm start` is also an alias for the combined development environment. `npm run build` compiles the browser app to `frontend/dist/` and the backend to `backend/dist/`.

## Architecture

```text
frontend/       Browser HTML, CSS and all game-owned TypeScript
backend/src/    Standalone TypeScript HTTP service
scripts/        Static frontend server, combined dev launcher and level check
tests/          Existing gameplay and pure-logic tests
docs/           Week 3 specification and project evidence
```

The Week 3 gameplay specification remains in [`docs/GAME_SPEC.md`](docs/GAME_SPEC.md). It records the original no-backend scope of that milestone. The AI Coach contract and implementation plan are in [`specs/001-ai-coach/`](specs/001-ai-coach/). Current local development commands and architecture are documented here and in [`docs/CONTEXT_MANIFEST.md`](docs/CONTEXT_MANIFEST.md).

Local `.env` files are ignored by git. Do not put provider secrets in frontend code or frontend environment variables. The fake provider needs no key or external network access; live Gemini integration is not part of this implementation.
