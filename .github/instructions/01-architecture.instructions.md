# Architecture instructions

## System shape

```text
SELFBOUND_Game/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── src/                 # browser entry, game, input, rendering, logic, data, validation
├── backend/
│   └── src/                 # independent Node HTTP health and fake AI Coach service
├── scripts/                 # development launchers, static server, reachability check
├── tests/                   # Node test files for game logic and gameplay
├── docs/                    # game spec, context manifest, evidence, evals, task records
├── .github/                 # this routed agent instruction set
├── .specify/memory/         # durable project constitution
└── specs/                   # active feature specs, including 001-ai-coach
```

The source has separate frontend and backend TypeScript configurations. There is no framework, shared package, persistence layer, or deployment setup.

## Runtime topology

Current local processes:

```text
Browser ──loads static HTML/CSS/compiled JS──> frontend server (:4173)
Backend process (:3001) ──GET /api/health, POST /api/ai/coach──> JSON responses
```

The game uses `POST /api/ai/coach` only after the player requests advice and at least one completed run exists. `backend/src/server.ts` uses Node's built-in `node:http`; it serves `GET /api/health`, validates bounded Coach requests, invokes a deterministic fake provider, validates its response, and handles OPTIONS preflight and JSON errors. No live provider is called.

Future live-provider flow, not implemented:

```text
Browser ──> SELFBOUND backend ──> AI provider
```

Any future provider call and provider secret must remain backend-only and be defined by an active feature spec. Do not infer an endpoint, model, request contract, or SDK from this diagram.

## Ownership

- **Rendering and HUD:** browser Canvas rendering in `frontend/src/game.ts`; HTML structure in `frontend/index.html`; visual page styling in `frontend/styles.css`.
- **Browser entry and input wiring:** `frontend/src/main.ts`; keyboard and pointer state helpers in `frontend/src/input.ts`.
- **Game loop/state and deterministic game rules:** `frontend/src/game.ts`, with focused calculations/helpers in `logic.ts`, `collision.ts`, and `camera.ts`.
- **Level data:** hand-authored `frontend/src/level.ts`; rendering and collision use the same platform data.
- **Game contracts and runtime validation:** `frontend/src/types.ts` defines TypeScript shapes; `frontend/src/validation.ts` validates runtime `GameConfig` and `LevelData` values. Keep both roles; types do not replace runtime checks.
- **Backend transport/server configuration:** `backend/src/server.ts` owns its Node HTTP listener, health and Coach routes, allowed local origins, and `HOST`/`PORT` reads.
- **Fake Coach provider and validation:** `backend/src/ai-coach-provider.ts` and `backend/src/ai-coach-contract.ts`; no live provider exists.
- **Build and local serving:** root npm scripts, `scripts/dev*.mjs`, and `scripts/serve.mjs`.

## Dependency direction

- Frontend game modules may import other frontend game modules. They must not import backend server modules or Node-only APIs.
- Backend modules must not import browser, Canvas, DOM, or gameplay implementation.
- There is no shared contract package today. If a cross-layer contract becomes necessary, keep it environment-neutral and create it only as part of a specified feature.
- A future provider SDK/client belongs only in backend code. Never expose provider credentials or make a browser-to-provider call.
- Keep game rules in game modules, not in Canvas drawing or HUD presentation code.

## Critical game flow

```text
move → aim → fire → hit current target OR create green threat
     → defend/capture → complete required sequence → reach exit
```

See [`docs/GAME_SPEC.md`](../../docs/GAME_SPEC.md) for complete gameplay semantics. `GAME_SPEC.md` describes the Week 3 game and its historical architecture; current code and README describe the later backend boundary.

## Change rules

- Gameplay behavior changes must agree with the active spec and include focused tests; update the game spec when an approved rule changes.
- Structured gameplay data changes must preserve runtime validation and the `LevelData` contract.
- Architecture changes require updating the relevant feature plan and project docs/instructions.
- Do not move deterministic gameplay authority into UI code or provider logic.
- AI Coach requests are explicit, read-only, and outside frame-by-frame render/update. Live-provider work requires a separate approved implementation task and must not mutate gameplay state.
