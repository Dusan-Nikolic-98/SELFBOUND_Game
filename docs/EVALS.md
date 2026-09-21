# WEEK 3 EVALS

## Purpose

These evals are defined before the controlled change. The same scenarios must be run against the preserved baseline and again after the controlled change.

Do not change the expected result after seeing the implementation result.

## Eval Set

| ID | Scenario | Expected Result | Baseline | After Controlled Change | Status |
|---|---|---|---|---|---|
| E1 | Start a new game from the initial state | Player appears at the configured spawn, HUD shows 3 lives, and the game accepts movement input | TBD | TBD | TBD |
| E2 | Walk off a platform and fall below the level bounds | Exactly one life is lost, gameplay state is reset to its initial state, and the remaining life count is preserved | TBD | TBD | TBD |
| E3 | Fire at the current target from a valid position | The projectile reaches the target, the player teleports to the target, the enemy is removed, and sequence progress increases by one | TBD | TBD | TBD |
| E4 | Trigger a real baseline failure discovered during manual testing | The documented defect is reproduced in the baseline and no longer reproduces after the controlled change | TBD | TBD | TBD |

## Boundary Cases

The following additional checks are recommended even if they are not part of the four required eval rows:

### Camera bounds

Move the player near each edge of the level.

Expected:

- camera never shows space outside the level bounds;
- camera remains clamped at the left, right, top, and bottom limits.

### Projectile range

Fire into empty space.

Expected:

- blue projectile stops after the configured travel budget;
- failed shot becomes a green threat;
- the projectile does not continue indefinitely.

### Bounce

Fire directly into a wall or platform where the impact surface is unambiguous.

Expected:

- horizontal surface reverses vertical travel direction;
- vertical surface reverses horizontal travel direction;
- remaining range increases by the configured bounce bonus;
- no more than three bounces occur in one shot.

### Green threat

Create a missed shot and then successfully fire into the green projectile.

Expected:

- green threat disappears;
- no second green threat is created;
- player loses no life and the existing level state is otherwise unchanged.

### Reset

Press `R` and the `Reset Level` button at different points in the level.

Expected:

- both reset mechanisms restore the same initial game state.

### Win

Capture the complete required sequence and reach the exit.

Expected:

- game enters the level-complete state;
- gameplay input is paused;
- reset remains available.

## Invalid Configuration Eval

This is the minimum runtime-validation demonstration required for the structured data portion.

Example invalid input:

```ts
{
  lives: -1,
  startingSpeed: Number.NaN,
  difficulty: "expert"
}
```

Expected:

- runtime validation rejects the input;
- the game does not continue with the invalid configuration;
- a safe fallback or clear configuration error is produced.

Record the real result in `EVIDENCE_003.md`.

## Important Baseline Rule

E4 must use a real observed problem from the baseline run. Do not invent a bug solely to make the evidence look complete.

Possible examples include:

- projectile collision failing at a platform corner;
- camera briefly moving outside the level clamp;
- reset leaving one piece of state uncleared;
- patrol enemy overshooting its endpoint;
- player falling through a platform under a specific frame timing.

Use only the issue that is actually observed.
