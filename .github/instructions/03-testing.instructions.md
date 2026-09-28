# Testing instructions

## Existing automated coverage

The repository uses TypeScript compilation plus Node's built-in `node:test` harness; it does not use Jest, Vitest, or a separate assertion framework.

- `tests/logic.test.ts`: runtime config/level validation, camera clamping, projectile travel/bounce, and collision helpers.
- `tests/gameplay.test.ts`: ordered capture/teleport, non-target failure, green threat defense/life loss, falling/reset/game over, patrol limits, blocked shots, exit gating, and full reset. Tests use a small synthetic level rather than Core Level 1 coordinates.
- `tests/ai-coach-backend.test.ts` exercises the Coach route with injected fake providers and includes a small health endpoint regression check.
- `tests/ai-coach-gemini.test.ts` exercises Gemini request construction, config selection, output validation, timeouts, retry bounds, and safe usage metadata with offline doubles.

## Required confidence for changes

- Behavior changes should cover a success path and meaningful failure or edge behavior where practical.
- Contract changes need tests at the boundary, including invalid input where relevant.
- Keep game-rule tests deterministic: avoid network calls and wall-clock dependence; assert observable state/behavior rather than private implementation details.
- For level geometry or reachability changes, use the existing reachability check after compiling the frontend.
- AI/backend tests cover valid one/three-run requests, invalid input with zero provider calls, fake-provider failure, malformed output, request size limits, safe errors, and Gemini reliability through test doubles. `npm test` never calls Gemini.

## Browser verification

Canvas rendering, pointer/keyboard behavior, and visual layout do not have browser automation in the current repo. Manually verify affected browser behavior when a change alters interaction or appearance and report that check separately from automated tests.

## Commands

- `npm test` compiles configured sources/tests into ignored `dist-tests/` and runs four test files with `node --test`.
- `npm run typecheck` checks frontend and backend TypeScript without emitting output.
- `npm run build` builds frontend and backend.
- `node scripts/check-reachability.mjs` is the level reachability check; run `npm run build:frontend` first so its compiled inputs exist.

These commands are defined in the root `package.json`. There is no lint script.
