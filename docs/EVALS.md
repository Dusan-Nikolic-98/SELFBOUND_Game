# WEEK 3 EVALS

## Purpose

These evals are defined before the controlled change. The same scenarios must be run against the preserved baseline (`baseline-v1`, commit `7d6dc17`) and again after the controlled change.

Do not change the expected result after seeing the implementation result.

## Eval Set

| ID  | Type           | Scenario                                                                                                                                | Expected Result                                                                                                                     | Baseline                                                                                                          | After Controlled Change                                                                                                                                                                     | Status |
| --- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| E1  | Typical        | Start a new game from the initial state                                                                                                 | Player appears at the configured spawn, HUD shows 3 lives, and the game accepts movement input                                      | Works                                                                                                             | Works, unchanged                                                                                                                                                                            | PASS   |
| E2  | Typical        | Walk off a platform and fall below the level bounds                                                                                     | Exactly one life is lost, gameplay state is reset to its initial state, and the remaining life count is preserved                   | Works                                                                                                             | Works, unchanged                                                                                                                                                                            | PASS   |
| E3  | Typical        | Fire at the current target from a valid position                                                                                        | The projectile reaches the target, the player teleports to the target, the enemy is removed, and sequence progress increases by one | Works                                                                                                             | Works, unchanged                                                                                                                                                                            | PASS   |
| E4  | Earlier defect | Capture every target of `requiredSequence` in order and reach the exit. Checked manually and with `node scripts/check-reachability.mjs` | Every target can be captured from where the player stands, and the level reaches `Level Complete`                                   | FAIL: `enemy_2` and `enemy_4` have 0 capturing shots, the level stops at `1 / 4` (`docs/evidence/fail_level.mp4`) | `RESULT: PASS - every target is capturable` (stages 1-3: 1071, 12 and 7419 capturing shots); manual run reaches `Captures: 4 / 4` and `Level Complete` (`docs/evidence/Base_game_demo.mp4`) | PASS   |
| E5  | Boundary       | Walk to the left, right, top and bottom limits of the level                                                                             | The camera stays clamped and never renders outside the level rectangle                                                              | Camera stayed clamped at every edge                                                                               | Camera stays clamped at every edge, unchanged                                                                                                                                               | PASS   |
| E6  | Invalid        | `validateGameConfig({ lives: -1, startingSpeed: NaN, difficulty: "expert" })`                                                           | `valid: false` with 3 errors, the game runs on the safe fallback config instead of the invalid one                                  | Rejected with 3 errors (covered by `npm test`)                                                                    | Rejected with 3 errors, unchanged (`npm test`: 15 pass, 0 fail)                                                                                                                             | PASS   |

The baseline result of E4 and the "Initial Test Status" table in `EVIDENCE_003.md` state the same outcome.

## Controlled Change

One change only, level data in `src/level.ts`: `enemy_2` moved to the edge of `middle-platform`, `middle-platform` made thicker, `lower-route` moved right with a new `lower-route-block`, `enemy_3` radius slightly increased, `enemy_4` and its patrol range moved near the left edge of `upper-route`, and `bounce-cap` / `bounce-wall` repositioned. No gameplay code, test or specification was changed. Details in `EVIDENCE_003.md`, section 5.

## Boundary Cases

Additional manual checks, recorded step by step in `docs/BROWSER_SMOKE_BASELINE.md` and `docs/BROWSER_SMOKE_AFTER.md`.

### Camera bounds

Move the player near each edge of the level.

Expected:

- camera never shows space outside the level bounds;
- camera remains clamped at the left, right, top, and bottom limits.

Result: PASS in both runs.

### Projectile range

Fire into empty space.

Expected:

- blue projectile stops after the configured travel budget;
- failed shot becomes a green threat;
- the projectile does not continue indefinitely.

Result: PASS in both runs.

### Bounce

Fire directly into a wall or platform where the impact surface is unambiguous.

Expected:

- horizontal surface reverses vertical travel direction;
- vertical surface reverses horizontal travel direction;
- remaining range increases by the configured bounce bonus;
- no more than three bounces occur in one shot.

Result: PASS in both runs.

### Green threat

Create a missed shot and then successfully fire into the green projectile.

Expected:

- green threat disappears;
- no second green threat is created;
- player loses no life and the existing level state is otherwise unchanged.

Result: PASS in both runs; also covered by `tests/gameplay.test.ts`.

### Reset

Press `R` and the `Reset Level` button at different points in the level.

Expected:

- both reset mechanisms restore the same initial game state.

Result: PASS in both runs; also covered by `tests/gameplay.test.ts`.

### Win

Capture the complete required sequence and reach the exit.

Expected:

- game enters the level-complete state;
- gameplay input is paused;
- reset remains available.

Result: FAIL in the baseline (the sequence cannot be completed), PASS after the controlled change.

## Automated Coverage

| Check              | Command                                                | Covers                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure logic         | `npm test` (`tests/logic.test.ts`)                     | config and level validation, camera clamping, projectile range and bounce limits, collision helpers                                                                                                           |
| Game loop          | `npm test` (`tests/gameplay.test.ts`)                  | capture teleport, non-target shot, single green threat, green threat destroyed by a blue shot, life loss and state reset, game over at zero lives, patrol endpoints, blocked shot, exit condition, full reset |
| Level reachability | `npm run build && node scripts/check-reachability.mjs` | every target of `requiredSequence` is capturable (E4)                                                                                                                                                         |

Result of the full suite before and after the controlled change: 15 tests, 15 pass, 0 fail.

## Important Baseline Rule

E4 uses a real observed problem from the baseline run. It was found by playing the baseline in the browser and confirmed by `scripts/check-reachability.mjs`, which reported 0 capturing shots for `enemy_2` and `enemy_4`. No defect was invented to complete the evidence.
