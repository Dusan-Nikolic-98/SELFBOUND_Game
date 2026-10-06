# SELFBOUND

SELFBOUND is a retro-inspired 2D side-scrolling browser game built with TypeScript, HTML Canvas and CSS. The browser game remains the owner of all gameplay state and rules. Its independent TypeScript backend provides a health endpoint, the W04 AI Coach endpoint, and the separate W05 Training Plan endpoint. Both features default to deterministic fake providers and can use Gemini Developer API only when independently configured.

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

For optional Gemini mode, copy the example environment file to a local `.env` file in the repository root and configure the backend variables for the feature you want to use:

```sh
cp .env.example .env
```

Then start the combined frontend/backend development environment with the `.env` file loaded:

```sh
node --env-file=.env scripts/dev.mjs
```

Use `npm run dev` or `npm start` when using the default deterministic fake provider. The local `.env` file is ignored by git and must never be committed.

Check the backend health endpoint:

```sh
curl http://127.0.0.1:3001/api/health
```

It returns HTTP 200 and `{"ok":true,"service":"selfbound-backend"}`. W04 AI Coach uses `POST http://127.0.0.1:3001/api/ai/coach` with completed-run summaries. W05 Training Plan uses `POST http://127.0.0.1:3001/api/training-plan` with one to three validated completed summaries wrapped in page-session sequence numbers and, after a prior success, its validated plan and aggregate baseline. Training Plan runs only after the player clicks its button. Both fake paths are deterministic and offline; each Gemini path requires its own explicit backend setting. Start both frontend and backend for either feature; gameplay remains playable if the backend is unavailable. Completed history and the latest valid Training Plan state remain in page memory only and clear on reload. The backend stores no player session or history.

The default provider is `fake`, so normal development and automated tests need no Gemini key. W04 AI Coach uses `AI_COACH_PROVIDER`, `GEMINI_API_KEY`, and `GEMINI_MODEL`. W05 Training Plan uses the independent `TRAINING_PLAN_PROVIDER`, `TRAINING_PLAN_GEMINI_API_KEY`, and `TRAINING_PLAN_GEMINI_MODEL` settings; configuring one feature does not select Gemini for the other. W05's default Gemini model is `gemini-3.1-flash-lite`. Its orchestrator allows at most three model steps, two tool calls, four provider attempts, one transient retry per step, a 15-second per-attempt timeout, and a 45-second run deadline. One live W05 Gemini Agent Run through `/api/training-plan` succeeded on 2026-10-06; see [`docs/EVIDENCE_W05.md`](docs/EVIDENCE_W05.md) for its bounded trace. Automated tests remain offline and use SDK transport doubles. Copy `.env.example` to the ignored root `.env` and configure the appropriate feature there only when you intentionally want a live request. To load that file for the backend, run `npm run build:backend` followed by `node --env-file=.env backend/dist/server.js`. Alternatively, set the variables in the backend process environment before `npm run dev:backend`. Do not use a frontend-prefixed environment variable for either key.

An explicit one-request live validation is available with `npm run test:ai:live` for W04 AI Coach. It loads the root `.env` when present, otherwise uses inherited backend environment variables; if Gemini mode and a non-empty key are unavailable it reports that validation was not performed. It prints only sanitized result/usage metadata and runs the real Coach contract against the primary model. To capability-test the candidate through the same full flow, set `GEMINI_DIAGNOSTIC_MODEL=gemini-3.5-flash-lite` for that command (PowerShell: `$env:GEMINI_DIAGNOSTIC_MODEL='gemini-3.5-flash-lite'; npm run test:ai:live`). Run it only when intentionally performing a live Coach check after offline checks. W05 is not covered by this live command. `npm test` runs offline W04/W05 suites and W05 Gemini SDK doubles; it never calls Gemini.

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
frontend/       Browser HTML, CSS and game, AI Coach, and Training Plan TypeScript
backend/src/    Standalone TypeScript health, AI Coach, and Training Plan HTTP service
scripts/        Static frontend server, combined dev launcher and level check
tests/          Gameplay, pure-logic, W04 AI Coach, and W05 Training Plan tests
docs/           Game specification, feature evaluations, and project evidence
```

The Week 3 gameplay specification remains in [`docs/GAME_SPEC.md`](docs/GAME_SPEC.md). It records the original no-backend scope of that milestone. W04 AI Coach artifacts are in [`specs/001-ai-coach/`](specs/001-ai-coach/); W05 Training Planner artifacts are in [`specs/002-agentic-training-planner/`](specs/002-agentic-training-planner/). Current local development commands and architecture are documented here and in [`docs/CONTEXT_MANIFEST.md`](docs/CONTEXT_MANIFEST.md).

W05 review artifacts: [agent flow](docs/AGENT_FLOW.md), [Core tool contracts](docs/TOOL_CONTRACTS.md), [focused eval matrix](docs/AGENT_EVALS.md), and [implementation evidence](docs/EVIDENCE_W05.md). The planner defaults to its offline fake provider; optional W05 Gemini variable names are listed in [`.env.example`](.env.example).

Local `.env` files are ignored by git. Do not put provider secrets in frontend code or frontend environment variables. Both fake providers need no key or external network access; Gemini use is opt-in through the separate W04 and W05 backend configuration.
