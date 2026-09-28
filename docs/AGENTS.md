# AGENTS.md

Persistent instructions for any coding agent working in this repository. Read this file before making a change.

## Project

SELFBOUND is a small TypeScript browser game (HTML Canvas, no framework, no backend) built for the Retro AI Engineering Challenge, Sessions 003-004.

## Authority order

1. `docs/GAME_SPEC.md` decides gameplay rules and scope. Do not rewrite, weaken or silently extend it.
2. The repository and its scripts decide commands and structure.
3. The current task prompt may narrow or sequence work, but must not expand the game scope.

`docs/CONTEXT_MANIFEST.md` records which sources are intentionally included or excluded.

## Commands

```text
npm start                                # build + serve at http://127.0.0.1:4173
npm run build                            # tsc -p tsconfig.json  -> dist/
npm run typecheck                        # tsc --noEmit
npm test                                 # compiles tsconfig.test.json, runs node:test
node scripts/check-reachability.mjs      # after npm run build: is every target capturable?
```

## Boundaries

- TypeScript for logic, Canvas for rendering, HTML/CSS for UI. No game or physics engine, no framework, no backend, no database, no multiplayer, no procedural generation.
- Collision: axis-aligned rectangles for platforms, circles for player, enemies and projectiles.
- Level geometry is hand-authored structured data in `src/level.ts`. Never derive collision from an image.
- Runtime validation of `GameConfig` and `LevelData` must stay in place. TypeScript types alone are not enough.
- No live AI provider call, no tool calling, no autonomous agent loop in the Week 3 Core. Week 4 adds exactly one read-only `get_game_state` tool behind an allowlist.
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
- Add a regression test with any bug fix. Gameplay tests should not depend on Core Level 1 coordinates; level tuning is covered by `check-reachability.mjs`.

## Repository layout

```text
docs/     specification, prompts, context manifest, evals, evidence, AI usage log
scripts/  serve.mjs (local server), check-reachability.mjs (level check)
src/      main.ts (bootstrap/HUD), game.ts (state and rendering), logic.ts, collision.ts,
          camera.ts, level.ts, validation.ts, input.ts, types.ts
tests/    logic.test.ts, gameplay.test.ts
```
