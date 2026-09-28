# FIX PROMPT - E4 (Controlled Change)

```text
You are the coding agent for SELFBOUND. This is a single controlled change for the Week 3 evidence process.

Before implementation:
1. Summarize your understanding of the task.
2. Give a concise plan.
3. List any ambiguities or assumptions.
4. Do not expand scope.

## Problem (observed in baseline tag `baseline-v1`, commit 7d6dc17)
`node scripts/check-reachability.mjs` reports that `enemy_2` (from start-ground) and `enemy_4`
(from lower-route) have 0 capturing shots. Manually, shots at these targets hit the side/underside
of the platform they stand on. The player cannot jump, so the required sequence cannot be completed
and the win state is unreachable.

## Hypothesis
The Core Level 1 geometry is the cause: each of these targets sits on top of a platform that is higher
than the player's platform, so the platform edge blocks every direct line of fire within the 450-unit range.

## Allowed change
- ONLY edit level data in `src/level.ts` (coordinates of platforms, enemies, patrol limits, exit).
- Do NOT change `game.ts`, collision, projectile constants, validation, tests, or `docs/GAME_SPEC.md`.
- Keep the layout intent from GAME_SPEC section 17 (enemy_4 still patrols on a higher platform,
  exit still on the final elevated section).
- Keep the change as small as possible.

## Checks to run and report exactly
1. npm run typecheck
2. npm test
3. npm run build && node scripts/check-reachability.mjs   (must print RESULT: PASS)
Report the actual output. Do not claim a check passed if it was not run.
```
