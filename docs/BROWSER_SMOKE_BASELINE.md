# BROWSER SMOKE RUN - BASELINE

A reproducible manual run of the game in a desktop browser, on the preserved baseline. The same steps were repeated after the controlled change in [BROWSER_SMOKE_AFTER.md](BROWSER_SMOKE_AFTER.md).

## How to run

```text
git checkout baseline-v1
npm install
npm start
```

Open `http://127.0.0.1:4173` in a desktop browser (1280 x 720 canvas). Click the canvas once so it has keyboard focus.

| Field                          | Value                                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Version under test             | tag `baseline-v1`, commit `7d6dc17` (gameplay code identical to the baseline; only docs, tests and tooling had been added) |
| Date                           | 2026-09-23                                                                                                                 |
| Operating system / browser     | Windows, Firefox                                                                                                           |
| Run by                         | Milena Paripović                                                                                                           |
| Screen recording / screenshots | [fail_level.mp4](../fail_level.mp4), [image.png](image.png)                                                                  |

## Steps and results

|   # | Step                                                  | Expected                                                                                            | Actual                                                                                                                                                              | Status   |
| --: | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
|   1 | Load the page                                         | Canvas renders, HUD shows `Lives: 3`, `Captures: 0 / 4`, `Target: enemy_1`                          | As expected                                                                                                                                                         | PASS     |
|   2 | Hold `A`, then `D`                                    | Player moves left and right, camera follows and never shows space outside the level                 | As expected                                                                                                                                                         | PASS     |
|   3 | Move the mouse                                        | Aim line follows the cursor from the player centre                                                  | As expected                                                                                                                                                         | PASS     |
|   4 | Fire into empty space                                 | Blue projectile stops after its range, then one green threat appears and homes toward the player    | As expected                                                                                                                                                         | PASS     |
|   5 | Fire again while the green threat lives, missing it   | No second green threat is created                                                                   | As expected, still one green threat                                                                                                                                 | PASS     |
|   6 | Fire into the green threat                            | Green threat disappears, no life lost                                                               | As expected                                                                                                                                                         | PASS     |
|   7 | Let a green threat reach the player                   | `Lives: 2`, level state resets, captures back to `0 / 4`                                            | As expected                                                                                                                                                         | PASS     |
|   8 | Walk off the right edge of `start-ground` and fall    | One life lost, player back at spawn, remaining lives preserved                                      | As expected                                                                                                                                                         | PASS     |
|   9 | Fire at `enemy_1`                                     | Player teleports to `enemy_1`, enemy removed, HUD shows `Captures: 1 / 4`, target becomes `enemy_2` | As expected                                                                                                                                                         | PASS     |
|  10 | Fire at a non-target enemy                            | No capture, failed shot becomes a green threat                                                      | As expected                                                                                                                                                         | PASS     |
|  11 | Fire straight into a platform surface                 | Projectile bounces, at most 3 bounces per shot, it never passes through the platform                | As expected                                                                                                                                                         | PASS     |
|  12 | Capture `enemy_2`, `enemy_3`, `enemy_4` in order      | Each capture teleports the player and increases progress; `Captures: 4 / 4`                         | **`enemy_2` cannot be hit from `start-ground`: every shot hits the left side of `middle-platform` and becomes a green threat. The HUD stays at `Captures: 1 / 4`.** | **FAIL** |
|  13 | Walk into the exit with the sequence complete         | `Level Complete` is shown, input is paused, reset stays available                                   | **Not reachable, because step 12 cannot be completed**                                                                                                              | **FAIL** |
|  14 | Press `R` and click `Reset Level` at different points | Both restore the same initial state and 3 lives                                                     | As expected                                                                                                                                                         | PASS     |
|  15 | Lose all three lives                                  | `Game Over` is shown, input paused, reset available                                                 | As expected                                                                                                                                                         | PASS     |
|  16 | Walk to each edge of the level                        | Camera stays clamped, no area outside the level is drawn                                            | As expected                                                                                                                                                         | PASS     |
|  17 | Open the browser console during the whole run         | No errors or warnings                                                                               | Console was clean                                                                                                                                                   | PASS     |

## Summary

- Steps passed: 15 / 17
- Level completed in this run: no
- Problems observed: the required sequence cannot be completed. `enemy_2` (and, in the headless check, `enemy_4`) cannot be hit from the platform the player stands on, so the win state is unreachable. This is eval E4 and the problem selected for the controlled change; see `EVIDENCE_003.md`.
