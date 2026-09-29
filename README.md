# SELFBOUND

SELFBOUND is a retro-inspired 2D side-scrolling browser game built with TypeScript, HTML Canvas and CSS. The browser game remains the owner of all gameplay state and rules. Its independent TypeScript backend provides a health endpoint and a read-only AI Coach endpoint. AI Coach defaults to a deterministic fake provider; an explicitly configured backend can use Gemini Developer API.

## Requirements

- Node.js 20.6 or newer (required by the backend Gemini SDK and the documented `.env` command)
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

It returns HTTP 200 and `{"ok":true,"service":"selfbound-backend"}`. The AI Coach flow uses `POST http://127.0.0.1:3001/api/ai/coach` with completed-run summaries; fake mode returns deterministic advice and explicitly configured Gemini mode returns validated advice. Start both frontend and backend for Coach requests; gameplay remains playable if the backend is unavailable. Completed history lasts only for the current page session.

The default provider is `fake`, so normal development and automated tests need no Gemini key. Backend configuration uses `AI_COACH_PROVIDER`, `GEMINI_API_KEY`, and `GEMINI_MODEL`; the key is read only by the backend. Gemini mode keeps `gemini-3.1-flash-lite` as primary and uses one shared 15-second deadline with at most three generation calls. It can make one transient retry with bounded exponential backoff, optionally use an allowlisted fallback, or make one same-model output repair. `GEMINI_MODEL_CHAIN=gemini-3.1-flash-lite,gemini-3.5-flash-lite` opts in to the candidate fallback; the candidate has not been live-verified against the full Coach contract. Copy `.env.example` to the ignored root `.env` and configure Gemini there only when you want a live request. To load that file for the backend, run `npm run build:backend` followed by `node --env-file=.env backend/dist/server.js`. Alternatively, set the variables in the backend process environment before `npm run dev:backend`. Do not use a frontend-prefixed environment variable for the key.

An explicit one-request live validation is available with `npm run test:ai:live`. It loads the root `.env` when present, otherwise uses inherited backend environment variables; if Gemini mode and a non-empty key are unavailable it reports that validation was not performed. It prints only sanitized result/usage metadata and runs the real Coach contract against the primary model. To capability-test the candidate through the same full flow, set `GEMINI_DIAGNOSTIC_MODEL=gemini-3.5-flash-lite` for that command (PowerShell: `$env:GEMINI_DIAGNOSTIC_MODEL='gemini-3.5-flash-lite'; npm run test:ai:live`). Run it only when intentionally performing a live check after offline checks. `npm test` never calls Gemini.

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

Local `.env` files are ignored by git. Do not put provider secrets in frontend code or frontend environment variables. The fake provider needs no key or external network access; Gemini use is opt-in through backend configuration.
