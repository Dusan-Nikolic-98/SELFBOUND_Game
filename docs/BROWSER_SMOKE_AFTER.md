# BROWSER SMOKE RUN - AFTER THE CONTROLLED CHANGE

The same manual run as [BROWSER_SMOKE_BASELINE.md](BROWSER_SMOKE_BASELINE.md), repeated after the single controlled change. At that time the level data was in `src/level.ts`; it now lives in [`frontend/src/level.ts`](../frontend/src/level.ts).

## How to run

```text
git checkout 5109d5b
npm install
npm start
```

Open `http://127.0.0.1:4173` in a desktop browser (1280 x 720 canvas). Click the canvas once so it has keyboard focus.

| Field                          | Value                                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Version under test             | Core Level 1 after the controlled change in [`frontend/src/level.ts`](../frontend/src/level.ts) (fix commit `5109d5b`) |
| Date                           | 2026-09-23                                                                                                  |
| Operating system / browser     | Windows, Firefox                                                                                            |
| Run by                         | Milena Paripović                                                                                            |
| Screen recording / screenshots | [Base_game_demo.mp4](../Base_game_demo.mp4)                                                                  |

## Steps and results

|   # | Step                                                  | Expected                                                                                            | Actual                                                                                       | Status |
| --: | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------ |
|   1 | Load the page                                         | Canvas renders, HUD shows `Lives: 3`, `Captures: 0 / 4`, `Target: enemy_1`                          | As expected                                                                                  | PASS   |
|   2 | Hold `A`, then `D`                                    | Player moves left and right, camera follows and never shows space outside the level                 | As expected                                                                                  | PASS   |
|   3 | Move the mouse                                        | Aim line follows the cursor from the player centre                                                  | As expected                                                                                  | PASS   |
|   4 | Fire into empty space                                 | Blue projectile stops after its range, then one green threat appears and homes toward the player    | As expected                                                                                  | PASS   |
|   5 | Fire again while the green threat lives, missing it   | No second green threat is created                                                                   | As expected, still one green threat                                                          | PASS   |
|   6 | Fire into the green threat                            | Green threat disappears, no life lost                                                               | As expected                                                                                  | PASS   |
|   7 | Let a green threat reach the player                   | `Lives: 2`, level state resets, captures back to `0 / 4`                                            | As expected                                                                                  | PASS   |
|   8 | Walk off the right edge of `start-ground` and fall    | One life lost, player back at spawn, remaining lives preserved                                      | As expected                                                                                  | PASS   |
|   9 | Fire at `enemy_1`                                     | Player teleports to `enemy_1`, enemy removed, HUD shows `Captures: 1 / 4`, target becomes `enemy_2` | As expected                                                                                  | PASS   |
|  10 | Fire at a non-target enemy                            | No capture, failed shot becomes a green threat                                                      | As expected                                                                                  | PASS   |
|  11 | Fire straight into a platform surface                 | Projectile bounces, at most 3 bounces per shot, it never passes through the platform                | As expected                                                                                  | PASS   |
|  12 | Capture `enemy_2`, `enemy_3`, `enemy_4` in order      | Each capture teleports the player and increases progress; `Captures: 4 / 4`                         | All three are capturable; the HUD reaches `Captures: 4 / 4`. `enemy_3` needs a precise shot. | PASS   |
|  13 | Walk into the exit with the sequence complete         | `Level Complete` is shown, input is paused, reset stays available                                   | As expected                                                                                  | PASS   |
|  14 | Press `R` and click `Reset Level` at different points | Both restore the same initial state and 3 lives                                                     | As expected                                                                                  | PASS   |
|  15 | Lose all three lives                                  | `Game Over` is shown, input paused, reset available                                                 | As expected                                                                                  | PASS   |
|  16 | Walk to each edge of the level                        | Camera stays clamped, no area outside the level is drawn                                            | As expected                                                                                  | PASS   |
|  17 | Open the browser console during the whole run         | No errors or warnings                                                                               | Console was clean                                                                            | PASS   |

## Summary

- Steps passed: 17 / 17
- Level completed in this run: yes, recorded in [Base_game_demo.mp4](../Base_game_demo.mp4)
- Problems observed: none that block the level. `enemy_3` remains the narrowest shot (12 capturing shots in the headless sweep), so it takes careful aiming; this is recorded as a known limitation in `EVIDENCE_003.md`.
