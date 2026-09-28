# EVIDENCE 003

This evidence records the Week 3 level change before the later frontend/backend split. At the time of the change, the level file was `src/level.ts`; its current path is [`frontend/src/level.ts`](../frontend/src/level.ts). The baseline reference remains the immutable `baseline-v1` tag.

## 1. Baseline Summary

### Initial Claim

The Week 3 Core should provide a small, deterministic 2D side-scroller in which the player's movement, projectile, enemy capture, green threat, reset, camera, and win conditions are all implemented within the defined scope, and in which the required capture sequence can be completed and the exit reached.

### Baseline Commit / Version

Git tag `baseline-v1` -> commit `7d6dc17` ("initial game"). The baseline is preserved and is not overwritten by the controlled change.

### Run Command

```text
npm start
```

### Baseline Environment / Actual Output

Windows, PowerShell, Firefox on the desktop, game served at `http://127.0.0.1:4173`.

```text
PS C:\Users\Milena\Documents\GitHub\SELFBOUND_Game> npm start

> selfbound-game@1.0.0 start
> npm run build && npm run serve

> selfbound-game@1.0.0 build
> tsc -p tsconfig.json

> selfbound-game@1.0.0 serve
> node scripts/serve.mjs

SELFBOUND running at http://127.0.0.1:4173
```

### Baseline Screenshot / Evidence

![Baseline start state](image.png)

The initial state: blue player at spawn, HUD shows `Lives: 3`, `Captures: 0 / 4`, `Target: enemy_1`, target marker on `enemy_1`.

Baseline video: [fail_level.mp4](../fail_level.mp4) shows the baseline run in which the level cannot be completed.

## 2. Initial Test Status

| Check                 | Expected              | Actual                                                               | Status   |
| --------------------- | --------------------- | -------------------------------------------------------------------- | -------- |
| Application starts    | Browser app loads     | Loads at `127.0.0.1:4173`, canvas and HUD render                     | PASS     |
| Game loop runs        | Animation updates     | Player moves with A/D, aim line follows the mouse                    | PASS     |
| `npm test` (baseline) | Pure-logic tests pass | 5 pass, 0 fail                                                       | PASS     |
| Week 3 evals E1-E3    | See `EVALS.md`        | Work as expected                                                     | PASS     |
| Week 3 eval E4        | See `EVALS.md`        | `enemy_2` and `enemy_4` cannot be hit, the level cannot be completed | **FAIL** |

The failing E4 is the problem selected for the controlled change below. This table and `EVALS.md` state the same result.

## 3. Selected Problem

### 3.1 Claim

A player can capture every enemy of `requiredSequence` in order and then reach the exit. This is required by `GAME_SPEC.md` section 4 and by the Definition of Done ("the player can complete the required sequence and reach the exit").

### 3.2 Signal

1. Manual play in the browser: after capturing `enemy_1`, every shot aimed at `enemy_2` hits the left side of `middle-platform` and turns into a green threat. The HUD stays at `Captures: 1 / 4`. Recorded in [fail_level.mp4](../fail_level.mp4).
2. Headless check `node scripts/check-reachability.mjs`, which drives the real `Game` class and sweeps player positions and shot angles for every capture stage:

```text
PS C:\Users\Milena\Documents\GitHub\SELFBOUND_Game> node scripts/check-reachability.mjs
PASS  stage 0: enemy_1 from platform "start-ground" -> 7734 capturing shots { playerX: 18, angle: 1.5 }
FAIL  stage 1: enemy_2 from platform "start-ground" -> 0 capturing shots
PASS  stage 2: enemy_3 from platform "middle-platform" -> 17 capturing shots { playerX: 1818, angle: 18 }
FAIL  stage 3: enemy_4 from platform "lower-route" -> 0 capturing shots
RESULT: FAIL - requiredSequence cannot be completed
```

### 3.3 Problem

`enemy_2` and `enemy_4` stand on top of platforms that are higher than the platform the player stands on. The player cannot jump, so the only way up is a capture shot, but the edge of the target's own platform blocks every straight line of fire that is inside the 450-unit projectile range. The sequence stops at `1 / 4` and the win state is unreachable.

## 4. Hypothesis

The defect is in the Core Level 1 geometry, not in the collision, projectile or capture code. If `enemy_2`, `enemy_4` and the surrounding platforms are placed so that a line of fire from the player's platform clears the platform edge within the projectile range, every stage becomes capturable without changing any gameplay code.

## 5. Minimum Controlled Change

One change, level data only: [`frontend/src/level.ts`](../frontend/src/level.ts), which was `src/level.ts` when the change was made. No gameplay logic, collision, projectile, camera, validation, tests or `GAME_SPEC.md` changes were part of that controlled change.

Prompt used: [FIX_PROMPT_E4_1.md](FIX_PROMPT_E4_1.md).

Change applied to Core Level 1:

| Element             | Baseline                        | After change                    | Why                                                                                            |
| ------------------- | ------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `enemy_2`           | `x: 1000`                       | `x: 860`                        | moved next to the left edge of `middle-platform` so a shot from `start-ground` clears the edge |
| `middle-platform`   | `height: 40`                    | `height: 70`                    | thicker platform, so the shot at `enemy_2` must clear the edge instead of grazing it           |
| `lower-route`       | `x: 1700`                       | `x: 1940`                       | opens the line of fire from `middle-platform` down to `enemy_3`                                |
| `lower-route-block` | not present                     | `x: 1910, y: 950, 70 x 70`      | forces a deliberate shot toward `enemy_3` instead of a free straight line                      |
| `enemy_3`           | `radius: 18`                    | `radius: 23`                    | slightly larger target, since its shot is the narrowest one                                    |
| `enemy_4`           | `x: 2700`, patrol `2470 - 3130` | `x: 2303`, patrol `2303 - 2421` | patrols near the left edge of `upper-route`, inside projectile range from `lower-route`        |
| `bounce-cap`        | `x: 2300, y: 610`               | `x: 2250, y: 720`               | lowered and moved left so the bounce route toward `enemy_4` is usable                          |
| `bounce-wall`       | `x: 2550, y: 610, width: 40`    | `x: 2200, y: 610, width: 35`    | matches the new bounce-cap position                                                            |

`upper-route`, `start-ground`, `spawn`, `requiredSequence` and `exit` are unchanged.

Fix commit: `5109d5b` (`Fix level, improve readme file.`; includes the Core Level 1 geometry change).

## 6. Re-run the Same Evals

| ID                  | Baseline Result                                                             | After Change                                                                                                                                                                                              | Status |
| ------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| E1                  | Player spawns, HUD shows 3 lives, movement works                            | Unchanged: player spawns, `Lives: 3`, `Captures: 0 / 4`, movement works                                                                                                                                   | PASS   |
| E2                  | One life lost, state reset, remaining lives preserved                       | Unchanged: one life lost per fall, state reset, remaining lives preserved                                                                                                                                 | PASS   |
| E3                  | Projectile captures the target, player teleports, progress +1               | Unchanged: capture teleports the player and progress increases by one                                                                                                                                     | PASS   |
| E4                  | `enemy_2` and `enemy_4` unreachable, `RESULT: FAIL`, level stuck at `1 / 4` | `RESULT: PASS - every target is capturable` (1071, 12 and 7419 capturing shots for stages 1-3); manual run reaches `Captures: 4 / 4` and `Level Complete`, recorded in [Base_game_demo.mp4](../Base_game_demo.mp4) | PASS   |
| E5 (camera bounds)  | Camera stayed clamped at every edge                                         | Unchanged: camera stays clamped at every edge                                                                                                                                                             | PASS   |
| E6 (invalid config) | `validateGameConfig` rejects the input with 3 errors, safe fallback used    | Unchanged: rejected with 3 errors, safe fallback used (`npm test`)                                                                                                                                        | PASS   |

The full manual browser runs are recorded in [BROWSER_SMOKE_BASELINE.md](BROWSER_SMOKE_BASELINE.md) and [BROWSER_SMOKE_AFTER.md](BROWSER_SMOKE_AFTER.md).

## 7. Commands Actually Run

Before the controlled change (baseline behaviour, gameplay code untouched):

```text
npm install
npm run typecheck          -> no errors
npm test                   -> tests 15, pass 15, fail 0
npm run build              -> no errors
node scripts/check-reachability.mjs
PASS  stage 0: enemy_1 from platform "start-ground" -> 7734 capturing shots { playerX: 18, angle: 1.5 }
FAIL  stage 1: enemy_2 from platform "start-ground" -> 0 capturing shots
PASS  stage 2: enemy_3 from platform "middle-platform" -> 17 capturing shots { playerX: 1818, angle: 18 }
FAIL  stage 3: enemy_4 from platform "lower-route" -> 0 capturing shots
RESULT: FAIL - requiredSequence cannot be completed
npm start                  -> SELFBOUND running at http://127.0.0.1:4173
```

After the controlled change (then `src/level.ts`, now [`frontend/src/level.ts`](../frontend/src/level.ts)):

```text
npm run typecheck          -> no errors
npm test                   -> tests 15, pass 15, fail 0
npm run build              -> no errors
node scripts/check-reachability.mjs
PASS  stage 0: enemy_1 from platform "start-ground" -> 7734 capturing shots { playerX: 18, angle: 1.5 }
PASS  stage 1: enemy_2 from platform "start-ground" -> 1071 capturing shots { playerX: 278, angle: 18 }
PASS  stage 2: enemy_3 from platform "middle-platform" -> 12 capturing shots { playerX: 1828, angle: 20 }
PASS  stage 3: enemy_4 from platform "lower-route" -> 7419 capturing shots { playerX: 1958, angle: 44 }
RESULT: PASS - every target is capturable
git diff --stat            -> .gitignore, docs/EVALS.md, docs/EVIDENCE_003.md, package.json,
                              src/level.ts, tsconfig.test.json
npm start                  -> SELFBOUND running at http://127.0.0.1:4173
```

The full test output of both runs is the 15-test list from `npm test` (10 gameplay tests plus 5 pure-logic tests), 15 pass and 0 fail in both cases.

## 8. Known Limitation

- `check-reachability.mjs` places the player on the platform under the previous capture point and samples a patrol enemy at 30 fixed positions. It proves that a capturing shot exists, not that it is comfortable for a human player.
- `enemy_3` remains the narrowest shot in the level: only 12 capturing shots in the whole sweep, from the right part of `middle-platform`. It is reachable, but a player has to aim carefully.
- The gameplay tests in `tests/gameplay.test.ts` run on a small synthetic level, so they verify the game rules, not the tuning of Core Level 1. Level tuning is covered by the reachability check and the manual browser runs.
- Running `node scripts/check-reachability.mjs` prints a Node `MODULE_TYPELESS_PACKAGE_JSON` warning because `package.json` has no `"type": "module"`. It is only a performance notice and does not affect the result; it was left unchanged so this commit stays limited to level data.
- Only Core Level 1 exists, so completing the sequence and the exit is verified on one level only.

## 9. Evidence Files

- baseline screenshot: [image.png](image.png)
- baseline video (level cannot be completed): [fail_level.mp4](../fail_level.mp4)
- after-change video (full run to `Level Complete`): [Base_game_demo.mp4](../Base_game_demo.mp4)
- browser smoke runs: [BROWSER_SMOKE_BASELINE.md](BROWSER_SMOKE_BASELINE.md), [BROWSER_SMOKE_AFTER.md](BROWSER_SMOKE_AFTER.md)
- reachability check: [`scripts/check-reachability.mjs`](../scripts/check-reachability.mjs) (output in sections 3, 6 and 7)
- automated tests: [`tests/logic.test.ts`](../tests/logic.test.ts), [`tests/gameplay.test.ts`](../tests/gameplay.test.ts)
- baseline reference: tag `baseline-v1`, commit `7d6dc17`
- fix commit: `5109d5b`

## 10. Contributions

### Pair Member A - Milena Paripović

Created the application with the coding agent from `BUILD_PROMPT_V1.md`; captured and preserved the baseline (`npm start` output, screenshot, tag `baseline-v1`); found and documented the editor-only TS2591 problem and its fix (Appendix A); added the reachability check `scripts/check-reachability.mjs` and the gameplay test suite `tests/gameplay.test.ts`; ran the baseline and after-change browser smoke runs and recorded the videos; wrote and aligned `EVIDENCE_003.md`, `EVALS.md`, `BROWSER_SMOKE_*.md`, `AI_USAGE_LOG.md` and `README.md`.

### Pair Member B - Dušan Nikolić

Proposed the game idea and did the initial project setup, consulting ChatGPT and Gemini during that phase; contributed to the specification documents; implemented the controlled change in the then-current `src/level.ts` (now [`frontend/src/level.ts`](../frontend/src/level.ts)) that made every target of `requiredSequence` reachable, and confirmed the reachability result.

---

## Appendix A - Secondary Fix (not the controlled change)

This editor-configuration fix was made before the controlled change. It is recorded here for completeness. It changes no gameplay behaviour and no eval result.

**Claim:** `tests/logic.test.ts` should compile cleanly both from the command line and in VS Code.

**Signal:** VS Code reported `TS2591: Cannot find name 'node:test'` on the imports, while `npm test` passed with 5/5.

**Hypothesis:** `npm test` compiles with `tsconfig.test.json` (which has `"types": ["node"]`), but VS Code falls back to `tsconfig.json`, which excludes `tests/` and has `"types": []`.

**Minimum change:** added `tests/tsconfig.json` with `{ "extends": "../tsconfig.test.json" }`. No dependency added.

**Check and result:** `npx tsc -p tests/tsconfig.json --noEmit` -> no errors; `npm test` -> 5 pass, 0 fail (unchanged); `npm run typecheck` -> no errors; the editor error is gone after reloading the window.

**Limitation:** tooling only. It does not affect any gameplay eval, which is why it is not used as the controlled change for E4.

## Week 4 AI Coach browser integration addendum

**Claim:** after a completed Game Over run, the enabled AI Coach control sends validated completed-run history to the local backend and displays the returned advice.

**Signal:** with the documented combined `npm run dev` workflow, a headless Edge browser reached Game Over after three lost lives and enabled AI Coach, but clicking it showed the safe unavailable message. Before the fix, the browser debugger reported `TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation`; the network trace contained no Coach request. The archived request snapshot itself passed the frontend runtime validator.

**Problem:** `AiCoachClient` invoked the native `fetch` function as `this.fetcher(...)`, binding `this` to the client instance. Browser `fetch` requires the global `Window` receiver, so it rejected before any network request. The backend, CORS policy, duplicated request contracts, fake provider, and response validator were not the failing boundary.

**Hypothesis:** calling the transport with `globalThis` as its receiver will allow the normal browser request while retaining all existing request and response validation.

**Minimum change:** `frontend/src/ai-coach-client.ts` now calls `this.fetcher.call(globalThis, ...)`. A regression test in `tests/ai-coach.test.ts` asserts the transport receiver.

**Check and result:** `npm test` passed 39/39; `npm run typecheck`, `npm run build`, and `node scripts/check-reachability.mjs` passed. Under `npm run dev`, headless Edge observed zero Coach POSTs with no history; after Game Over it sent `POST http://127.0.0.1:3001/api/ai/coach` from `http://127.0.0.1:4173`, received CORS preflight 204 and Coach response 200, and rendered deterministic advice. After terminal reset, an active run fired a shot and created a green threat, while the next request still contained exactly the one archived run. A 503 response rendered the generic unavailable message. Invalid-request/provider-zero-call behavior and provider-failure mapping also passed in the backend tests.

**Limitation:** the browser check was headless and verified behavior/network traffic, not visual layout or keyboard focus. No Gemini or live provider was used. The successful 200 response came from the default `FakeAiCoachProvider`.
