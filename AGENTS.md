# AGENTS.md

Persistent instructions for any coding agent working in this repository. Read this file before making a change.

## Project

SELFBOUND is a small TypeScript browser game (HTML Canvas, no framework) with an independent TypeScript backend. The backend exposes a health endpoint and the scoped AI Coach endpoint, which defaults to a deterministic fake provider and can use Gemini when explicitly configured. The project was built for the Retro AI Engineering Challenge, Sessions 003-004.

## Authority order

1. `docs/GAME_SPEC.md` decides gameplay rules and scope. Do not rewrite, weaken or silently extend it.
2. The repository and its scripts decide commands and structure.
3. The current task prompt may narrow or sequence work, but must not expand the game scope.

`docs/CONTEXT_MANIFEST.md` records which sources are intentionally included or excluded.

## Commands

```text
npm run dev                              # start frontend and backend together
npm run dev:frontend                     # build and serve browser game at :4173
npm run dev:backend                      # build and start backend at :3001
npm run build                            # build frontend and backend
npm run typecheck                        # type-check both applications
npm test                                 # compile and run node:test suite
node scripts/check-reachability.mjs      # after npm run build:frontend
```

## Boundaries

- TypeScript for logic and the minimal HTTP backend, Canvas for rendering, HTML/CSS for UI. No game or physics engine, no framework, no database, no multiplayer, no procedural generation.
- Browser gameplay belongs to `frontend/src/`; server code belongs to `backend/src/`. Do not import modules across this boundary.
- Backend provides `GET /api/health` and `POST /api/ai/coach`; fake mode is the default, and optional Gemini calls use backend-only configuration and credentials.
- Collision: axis-aligned rectangles for platforms, circles for player, enemies and projectiles.
- Level geometry is hand-authored structured data in `frontend/src/level.ts`. Never derive collision from an image.
- Runtime validation of `GameConfig` and `LevelData` must stay in place. TypeScript types alone are not enough.
- Gemini calls are available only through explicit backend configuration. There is no tool calling or autonomous agent loop; AI Coach remains user-triggered and read-only.
- Do not add audio, save systems, upgrades, inventory, extra abilities, procedural levels or extra levels beyond Core.
- Never commit API keys, credentials or secrets.

## Working rules

1. Before implementing: summarise the task, give a short plan, list assumptions. Do not expand scope without an explicit reason.
2. Work in small, reviewable steps. After each step say what changed, which files changed, which checks were run and what risk remains.
3. One controlled change at a time. Do not mix a level change, an architecture change and a test change under one hypothesis.
4. Run the checks above and report the real output. Never claim a check passed if it was not run.
5. A gameplay change is not done until `npm run typecheck`, `npm test` and `node scripts/check-reachability.mjs` all pass.
6. Never rewrite history at or before the tag `baseline-v1` (commit `7d6dc17`). The baseline must stay reproducible.
7. Record significant agent calls in `docs/AI_USAGE_LOG.md`: phase, why, expected result, actual result, next decision. No chain-of-thought, no secrets.
8. When a defect is found, document it in `docs/EVIDENCE_003.md` as claim, signal, problem, hypothesis, minimum change, check, result, limitation, and keep `docs/EVALS.md` consistent with it.

## Tests

- `tests/logic.test.ts`: pure logic (validation, camera clamp, projectile range and bounce, collision helpers).
- `tests/gameplay.test.ts`: game loop rules on a small synthetic level (capture teleport, non-target shot, green threat, life loss and reset, patrol bounds, blocked shot, exit condition, full reset).
- `tests/ai-coach.test.ts`, `tests/ai-coach-backend.test.ts`, and `tests/ai-coach-gemini.test.ts`: bounded telemetry/lifecycle, frontend contract/client, fake-provider route coverage, and offline Gemini adapter/reliability coverage.
- Add a regression test with any bug fix. Gameplay tests should not depend on Core Level 1 coordinates; level tuning is covered by `check-reachability.mjs`.

## Repository layout

```text
docs/        specification, prompts, context manifest, evals, evidence, AI usage log
frontend/    index.html, styles.css and src/ browser game modules
backend/     src/ health and fake AI Coach APIs
scripts/     serve.mjs (frontend server), dev.mjs (combined launcher), level check
tests/       Node suite for logic, gameplay, AI Coach telemetry and backend route
```
