# Codex Task — Separate Frontend and Backend Without Changing Gameplay

## Objective

Refactor the existing **SELFBOUND** Week 3 browser game so that the repository has a clear **frontend / backend architectural boundary**, while preserving the existing game behavior.

This task is **architecture-only**.

Do **not** implement Gemini, any AI provider integration, AI prompts, AI gameplay features, telemetry analysis, databases, authentication, deployment, or other Week 4 functionality yet.

The goal is to prepare the project for the Week 4 architecture:

```text
Frontend
   ↓
Our Backend API
   ↓
AI Provider   ← not implemented in this task
```

At the end of this task:

- the existing browser game must still work as before;
- browser-facing code must live in a clear frontend area;
- a minimal TypeScript backend must exist and run independently;
- the backend must expose at least one simple non-AI health/status endpoint;
- the frontend must not contain backend-only secrets or provider logic;
- the repository must be ready for a later AI feature without prematurely implementing it.

---

# Project Context

The project is **SELFBOUND**, a small retro-inspired 2D side-scrolling browser game.

The existing game is implemented with:

- TypeScript;
- HTML;
- CSS;
- HTML Canvas API;
- plain TypeScript objects and arrays for gameplay state;
- no game engine;
- no physics engine.

The player:

- moves horizontally;
- aims with the mouse;
- fires a blue self-projectile;
- teleports to the current target enemy when the shot succeeds;
- creates a green homing threat after a failed shot;
- must capture enemies in a predefined order;
- completes the level by finishing the capture sequence and reaching the exit.

The current Week 3 game was intentionally designed with:

- no backend;
- no database;
- no external AI service;
- no multiplayer;
- no procedural generation.

This task changes only the **application architecture**, not the game design.

---

# Why This Refactor Exists

Week 4 requires a reliable AI integration later.

The required security boundary is:

```text
Browser
   ↓
Backend API
   ↓
Gemini / other AI provider
```

The provider API key must never be exposed to the browser.

Therefore, before any AI integration is added, this project needs a clean frontend/backend split.

This task must establish that boundary now, while keeping the actual AI functionality out of scope.

---

# Source of Truth

Before changing code:

1. Read the existing repository.
2. Read `GAME_SPEC.md`.
3. Read `CONTEXT_MANIFEST.md`.
4. Inspect the current `package.json`, TypeScript config, build tooling, folder structure, scripts, and test setup.
5. Determine how the current game is started and built.
6. Preserve existing behavior unless a change is strictly necessary for the architectural split.

Do not assume that the current structure matches any particular framework layout.

Adapt the implementation to the repository that actually exists.

---

# Non-Negotiable Behavioral Constraint

## The Week 3 game must remain functionally unchanged

This refactor must **not intentionally change gameplay**.

Do not change:

- player controls;
- player movement;
- gravity;
- collision behavior;
- camera behavior;
- projectile speed;
- projectile range;
- bounce behavior;
- firing cooldown;
- target sequence behavior;
- capture/teleport behavior;
- green homing threat behavior;
- lives;
- reset behavior;
- enemy patrol logic;
- level geometry;
- enemy positions;
- exit behavior;
- win/lose rules;
- HUD behavior;
- game difficulty;
- visual design, except for changes strictly required by file relocation/build wiring.

If a tiny incidental code change is required because of moved imports or paths, keep it behaviorally equivalent.

Do not use this task as an opportunity for cleanup that changes game behavior.

---

# Target Architecture

Prefer a simple structure similar to the following, but adapt it to the existing repository if another minimal structure fits better:

```text
repo/
├── frontend/
│   ├── src/
│   │   └── ...
│   ├── index.html
│   └── ...
│
├── backend/
│   ├── src/
│   │   ├── server.ts
│   │   └── ...
│   └── ...
│
├── GAME_SPEC.md
├── CONTEXT_MANIFEST.md
├── package.json
├── tsconfig...
└── ...
```

A structure such as this is also acceptable:

```text
src/
├── frontend/
└── backend/
```

Use whichever option causes the smallest, clearest, safest refactor.

Do not introduce unnecessary monorepo tooling.

Do not add Nx, Turborepo, Docker, Kubernetes, a database, or another large infrastructure dependency just to create the split.

---

# Backend Requirements

Create a **minimal TypeScript backend**.

Use the simplest server approach compatible with the existing project/tooling.

If a lightweight backend library is already present, reuse it.

If no backend framework exists, use a small conventional solution rather than adding a large framework.

The backend must:

1. be implemented in TypeScript;
2. run as a separate server process;
3. not contain any AI integration yet;
4. expose a simple endpoint such as:

```http
GET /api/health
```

A successful response may look like:

```json
{
  "ok": true
}
```

or an equivalent small stable contract.

The purpose of this endpoint is only to prove that:

- the backend runs;
- the browser can eventually communicate with it;
- the API boundary exists.

Do not add fake Gemini endpoints in this task.

---

# Frontend Requirements

The existing browser game becomes the **frontend**.

Move or reorganize files only as much as necessary to create a clear boundary.

Frontend code may contain:

- rendering;
- game loop;
- input handling;
- game state;
- collision logic;
- game configuration that is safe for the browser;
- level data;
- UI;
- API client code for our own backend when needed.

Frontend code must not contain:

- Gemini SDK initialization;
- provider API keys;
- provider secrets;
- backend environment variables;
- direct AI provider calls;
- server-only code.

For this task, the game does not need to call `/api/health` during normal gameplay unless that is useful for a minimal integration check.

Do not make gameplay depend on backend availability.

The game must remain playable even if the backend health endpoint is not used by the runtime game flow.

---

# Security Boundary

Prepare the project so future secrets can remain backend-only.

Add or verify appropriate environment handling.

At minimum:

- `.env` must not be committed;
- `.env.local` must not be committed if that naming pattern is used;
- `.gitignore` must exclude local secret files;
- an `.env.example` may exist;
- `.env.example` must contain no real secrets.

It is acceptable to prepare an empty placeholder such as:

```text
GEMINI_API_KEY=
```

only if doing so is useful for documenting the future backend boundary.

However:

- do not require a Gemini key for this task;
- do not call Gemini;
- do not install or initialize Gemini SDK code unless there is a strong repository-specific reason;
- do not put any key in frontend code.

If no environment variable is currently necessary for this architecture-only change, keep environment handling minimal.

---

# Dependency Rules

Minimize new dependencies.

Before adding any package:

1. inspect existing dependencies;
2. determine whether the task can be completed with what already exists;
3. add only what is necessary.

Do not change libraries merely because another option is more fashionable.

Do not migrate the frontend to React, Vue, Svelte, Next.js, or another framework unless the project already uses that framework.

The original game is intentionally simple.

Preserve that simplicity.

---

# TypeScript Configuration

Establish a clean TypeScript boundary.

Frontend and backend may require different TypeScript settings because they target different environments.

If necessary, introduce separate configs, for example:

```text
tsconfig.json
tsconfig.frontend.json
tsconfig.backend.json
```

or equivalent.

The important requirement is that:

- browser code is compiled with browser-compatible types;
- backend code is compiled with server-compatible types;
- imports do not accidentally cross the frontend/backend boundary.

Avoid broad configuration changes that hide type errors.

Do not weaken strictness just to make the refactor pass.

---

# Shared Code

Do not introduce a `shared/` package unless there is already a concrete need.

At this point there is very little that genuinely needs to be shared.

If a tiny shared contract is useful, keep it limited to pure TypeScript data types/schemas with no environment-specific dependencies.

Do not move gameplay code into shared modules merely because both layers exist.

The game remains frontend-owned.

---

# Development Scripts

Make the repository easy to run.

Inspect the current package manager and preserve it.

Do not replace npm with pnpm/yarn or vice versa without a strong reason.

Provide clear scripts for the equivalent of:

```text
frontend dev
backend dev
full development mode
build
test
typecheck
```

The exact script names may differ.

Good examples could be:

```json
{
  "scripts": {
    "dev:frontend": "...",
    "dev:backend": "...",
    "dev": "...",
    "build": "...",
    "test": "...",
    "typecheck": "..."
  }
}
```

Do not add process-management complexity unless necessary.

If a small development dependency is used to run frontend and backend together, justify it through simplicity.

A developer must also be able to start the two sides separately.

---

# Local Development Networking

Make frontend/backend local development predictable.

If the frontend and backend run on different ports, configure the development environment cleanly.

Prefer one of:

- a dev proxy;
- a configurable backend base URL;
- a simple same-origin-compatible setup.

Avoid hardcoding production assumptions.

If you introduce a frontend environment variable for the URL of **our own backend**, that is allowed because this URL is not a secret.

Example:

```text
VITE_API_BASE_URL=http://localhost:3001
```

Only do this if it matches the frontend tooling already present.

Do not expose provider secrets through frontend environment variables.

---

# CORS

If CORS is needed in local development:

- allow only the frontend origin(s) needed for the project;
- do not casually use unrestricted production CORS as a permanent solution;
- keep configuration simple and documented.

If a dev proxy makes CORS unnecessary, prefer the simpler architecture.

---

# API Design for This Task

Keep the API intentionally tiny.

Required:

```http
GET /api/health
```

Expected characteristics:

- no request body;
- no authentication;
- no provider call;
- no database;
- no side effects;
- small JSON response;
- stable HTTP success status.

Optional, only if genuinely useful:

```json
{
  "ok": true,
  "service": "selfbound-backend"
}
```

Do not add speculative endpoints such as:

```text
/api/ai/hint
/api/ai/coach
/api/game/analyze
/api/telemetry
```

Those belong to later tasks after the feature is specified.

---

# Error Handling

The backend must have basic safe behavior.

At minimum:

- unknown routes should not expose stack traces;
- server startup failures should be understandable to a developer;
- malformed requests, if any route accepts input in the future, should not leak internals.

Do not build a large error framework for a single health endpoint.

Keep it proportionate.

---

# Tests / Validation

The main goal is to prove that the refactor did not break the existing game and that the new backend boundary works.

Perform all validation that the current repository reasonably supports.

At minimum verify:

## Frontend

- frontend builds;
- TypeScript passes;
- the game starts;
- existing game tests still pass, if they exist;
- existing gameplay remains operational.

Where automated gameplay validation already exists, run it.

Do not invent brittle browser automation unless the project already has a suitable setup.

## Backend

Verify:

- backend TypeScript compiles;
- backend starts;
- `GET /api/health` returns a successful response;
- invalid/unknown route behavior is safe enough for this small service.

## Whole repository

Verify:

- root development workflow works;
- build command works;
- test command works, where tests exist;
- no frontend import depends on backend server code;
- no backend secret can enter the frontend bundle.

---

# Regression Checklist

Before finishing, explicitly verify that the following Week 3 behaviors were not intentionally changed:

- left/right movement;
- mouse aiming;
- projectile firing;
- projectile travel limit;
- projectile bounce;
- target capture;
- teleport-on-capture;
- required capture order;
- failed shot creating the green threat;
- defensive shot destroying the green threat;
- player losing a life when hit;
- falling failure;
- level reset;
- manual reset;
- lives reaching Game Over;
- sequence completion;
- exit completion;
- HUD;
- camera;
- patrol enemy behavior.

If any cannot be automatically verified, state that they require manual regression testing.

Do not falsely claim they were tested if they were not.

---

# Documentation Changes

Update only documentation necessary to explain the architectural refactor.

At minimum, make it clear how to:

1. install dependencies;
2. start the frontend;
3. start the backend;
4. start the complete local development environment;
5. run build/typecheck/tests;
6. verify `/api/health`.

If there is an existing README, update it instead of creating redundant documentation.

Do not write the final Week 4 AI evidence document yet.

Do not pretend that AI integration has been completed.

---

# Existing Specification Handling

`GAME_SPEC.md` documents the Week 3 game.

Do not rewrite the historical Week 3 specification as if it always had a backend.

If documentation needs a note explaining the Week 4 architecture transition, add the smallest appropriate note without destroying the historical record.

Do not change gameplay requirements in `GAME_SPEC.md`.

`CONTEXT_MANIFEST.md` should only be updated if its purpose requires reflecting the new repository layout/context.

Keep historical facts accurate.

---

# Explicit Out of Scope

Do not implement any of the following in this task:

- Gemini API integration;
- OpenAI API integration;
- any AI provider SDK usage;
- AI Coach;
- game log analysis;
- gameplay telemetry for AI;
- AI prompt design;
- AI response schemas;
- AI retry logic;
- AI timeout logic;
- AI fallback models;
- AI usage logging;
- AI dashboard;
- database;
- persistent player history;
- authentication;
- user accounts;
- deployment;
- cloud infrastructure;
- multiplayer;
- gameplay redesign;
- new levels;
- boss fights;
- procedural generation;
- visual polish unrelated to the architecture;
- large-scale code cleanup unrelated to the split.

---

# Implementation Strategy

Use a conservative sequence.

## Step 1 — Inspect

Read:

- package metadata;
- current source layout;
- build configuration;
- TypeScript configuration;
- entry points;
- existing tests;
- `GAME_SPEC.md`;
- `CONTEXT_MANIFEST.md`.

Summarize the current architecture internally before editing.

## Step 2 — Plan the smallest viable split

Identify:

- which files are browser-only;
- where the frontend entry point should live;
- what backend entry point is required;
- what package/build scripts must change;
- whether separate TS configs are needed;
- whether a proxy/base URL is needed.

Do not make speculative abstractions.

## Step 3 — Move/refactor frontend conservatively

Relocate files as needed.

Repair:

- import paths;
- static asset paths;
- HTML script paths;
- CSS paths;
- build input paths.

Preserve behavior.

## Step 4 — Add the minimal backend

Create:

- TypeScript server entry point;
- health endpoint;
- safe basic error behavior;
- minimal config.

## Step 5 — Wire development scripts

Ensure both halves can:

- start independently;
- start together;
- build/typecheck reliably.

## Step 6 — Validate

Run the available checks.

Fix regressions caused by the refactor.

Do not broaden the scope while fixing them.

## Step 7 — Review the diff

Before declaring completion, inspect the full diff and confirm:

- no accidental gameplay changes;
- no AI feature was added;
- no secret was introduced;
- dependencies are minimal;
- architecture is easy to explain.

---

# Acceptance Criteria

This task is complete only when all applicable criteria below are true.

## Architecture

- [ ] There is a clear frontend/backend code boundary.
- [ ] The frontend contains the existing browser game.
- [ ] The backend is implemented in TypeScript.
- [ ] Backend runs as an independent process.
- [ ] Frontend runs as an independent process.
- [ ] Both can be run together for local development.
- [ ] No direct browser → AI provider path exists.
- [ ] No provider API key is present in browser code.

## Backend

- [ ] `GET /api/health` works.
- [ ] Health endpoint has no side effects.
- [ ] Unknown routes do not expose sensitive internals.
- [ ] No AI provider call exists yet.

## Frontend

- [ ] Existing game still starts in the browser.
- [ ] Existing gameplay behavior is preserved.
- [ ] Frontend build succeeds.
- [ ] Browser code does not import server-only modules.

## Security

- [ ] No real secret is added to the repository.
- [ ] Local `.env` files are gitignored where relevant.
- [ ] `.env.example`, if present, contains placeholders only.
- [ ] No backend-only environment variable is bundled into frontend code.

## Engineering

- [ ] TypeScript/typecheck passes.
- [ ] Existing tests still pass, if present.
- [ ] New backend has an appropriate minimal test or verification.
- [ ] Dependencies added by this task are minimal and justified.
- [ ] Developer startup/build commands are documented.

---

# Required Final Report From Codex

When implementation is complete, return a concise but concrete report with these sections:

## 1. Architecture Before

Describe the repository architecture before the change.

## 2. Architecture After

Show the final relevant folder structure and explain the frontend/backend boundary.

## 3. Files Changed

List important files added, moved, deleted, or substantially modified.

## 4. Dependencies Added

For every newly added dependency:

- package name;
- why it was necessary.

If none were added, explicitly say so.

## 5. Development Commands

Provide exact commands for:

- installing dependencies;
- frontend dev;
- backend dev;
- combined dev;
- build;
- typecheck;
- tests.

Only list commands that actually exist after the change.

## 6. Backend Contract

Document the exact health endpoint:

```text
method:
path:
response:
status:
```

## 7. Validation Performed

List the exact commands/checks actually run and whether each passed.

Separate:

- automated validation;
- manual validation.

Do not claim manual gameplay testing if it was not performed.

## 8. Gameplay Regression Assessment

State whether any gameplay-related source code had to change.

If yes:

- explain exactly why;
- identify the files;
- explain why behavior should remain equivalent.

## 9. Security Check

Confirm:

- no real API key was introduced;
- no provider call exists;
- no secret is exposed to the frontend.

## 10. Known Limitations / Next Step

The expected next step should be roughly:

> Define the Week 4 AI Coach feature and its request/response contracts before implementing Gemini integration.

Do not implement that next step as part of this task.

---

# Decision-Making Rules

When something is ambiguous:

1. prefer the smallest change;
2. preserve the existing build system;
3. preserve gameplay;
4. preserve historical Week 3 documentation;
5. avoid speculative abstractions;
6. do not add AI yet;
7. document any unavoidable assumption in the final report.

If the repository contains unexpected architecture or tooling, adapt to it instead of forcing this proposed folder structure literally.

The desired outcome is not a particular directory naming convention.

The desired outcome is a **clean, minimal, explainable, secure frontend/backend boundary with zero intentional gameplay change**.
