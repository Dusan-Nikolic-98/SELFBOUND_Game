# Testing instructions

## Existing automated coverage

The repository uses TypeScript compilation plus Node's built-in `node:test` harness; it does not use Jest, Vitest, or a separate assertion framework.

- `tests/logic.test.ts`: runtime config/level validation, camera clamping, projectile travel/bounce, and collision helpers.
- `tests/gameplay.test.ts`: ordered capture/teleport, non-target failure, green threat defense/life loss, falling/reset/game over, patrol limits, blocked shots, exit gating, and full reset. Tests use a small synthetic level rather than Core Level 1 coordinates.
- There are no backend route tests currently. Do not imply the health route has automated integration coverage.

## Required confidence for changes

- Behavior changes should cover a success path and meaningful failure or edge behavior where practical.
- Contract changes need tests at the boundary, including invalid input where relevant.
- Keep game-rule tests deterministic: avoid network calls and wall-clock dependence; assert observable state/behavior rather than private implementation details.
- For level geometry or reachability changes, use the existing reachability check after compiling the frontend.
- Future AI/backend tests should cover valid requests, invalid local input, provider errors/timeouts, malformed provider output, and bounded retry behavior only if retry is specified. Invalid input must result in zero provider calls. These are future expectations, not current coverage.

## Browser verification

Canvas rendering, pointer/keyboard behavior, and visual layout do not have browser automation in the current repo. Manually verify affected browser behavior when a change alters interaction or appearance and report that check separately from automated tests.

## Commands

- `npm test` compiles configured sources/tests into ignored `dist-tests/` and runs both test files with `node --test`.
- `npm run typecheck` checks frontend and backend TypeScript without emitting output.
- `npm run build` builds frontend and backend.
- `node scripts/check-reachability.mjs` is the level reachability check; run `npm run build:frontend` first so its compiled inputs exist.

These commands are defined in the root `package.json`. There is no lint script.
