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
| E4  | Earlier defect | Capture every target of `requiredSequence` in order and reach the exit. Checked manually and with `node scripts/check-reachability.mjs` | Every target can be captured from where the player stands, and the level reaches `Level Complete`                                   | FAIL: `enemy_2` and `enemy_4` have 0 capturing shots, the level stops at `1 / 4` ([baseline video](../fail_level.mp4)) | `RESULT: PASS - every target is capturable` (stages 1-3: 1071, 12 and 7419 capturing shots); manual run reaches `Captures: 4 / 4` and `Level Complete` ([after video](../Base_game_demo.mp4)) | PASS   |
| E5  | Boundary       | Walk to the left, right, top and bottom limits of the level                                                                             | The camera stays clamped and never renders outside the level rectangle                                                              | Camera stayed clamped at every edge                                                                               | Camera stays clamped at every edge, unchanged                                                                                                                                               | PASS   |
| E6  | Invalid        | `validateGameConfig({ lives: -1, startingSpeed: NaN, difficulty: "expert" })`                                                           | `valid: false` with 3 errors, the game runs on the safe fallback config instead of the invalid one                                  | Rejected with 3 errors (covered by `npm test`)                                                                    | Rejected with 3 errors, unchanged (`npm test`: 15 pass, 0 fail)                                                                                                                             | PASS   |

The baseline result of E4 and the "Initial Test Status" table in `EVIDENCE_003.md` state the same outcome.

## Controlled Change

One change only, level data in `frontend/src/level.ts` (then `src/level.ts`): `enemy_2` moved to the edge of `middle-platform`, `middle-platform` made thicker, `lower-route` moved right with a new `lower-route-block`, `enemy_3` radius slightly increased, `enemy_4` and its patrol range moved near the left edge of `upper-route`, and `bounce-cap` / `bounce-wall` repositioned. No gameplay code, test or specification was changed. Details in [EVIDENCE_003.md](EVIDENCE_003.md), section 5.

## Boundary Cases

Additional manual checks, recorded step by step in [BROWSER_SMOKE_BASELINE.md](BROWSER_SMOKE_BASELINE.md) and [BROWSER_SMOKE_AFTER.md](BROWSER_SMOKE_AFTER.md).

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

## Week 4 AI Coach integration addendum

| Eval | Check | Before fix | After fix |
| --- | --- | --- | --- |
| W4-C1 | `npm run dev`; lose all three lives; click AI Coach | Safe unavailable UI; browser `fetch` Illegal invocation and no network request | Game Over enabled Coach; CORS preflight 204, `POST /api/ai/coach` 200, deterministic advice rendered |
| W4-C2 | Load with no completed runs | Not applicable | Button disabled and zero Coach POSTs observed |
| W4-C3 | Reset after terminal; fire during the new active run; request advice | Not applicable | Active shot created a green threat; request still contained only the one archived run |
| W4-C4 | Send malformed/zero/excess run requests | Not applicable | Backend tests rejected invalid input with exactly zero provider calls |
| W4-C5 | Provider failure | Not applicable | Backend returned stable 503; browser rendered the generic safe unavailable message |

The browser checks used headless Edge with the repository's combined development launcher. The 200 response was produced by the default fake provider. Automated checks: `npm test` (39/39), `npm run typecheck`, `npm run build`, and `node scripts/check-reachability.mjs` all passed. This addendum does not change the historical Week 3 E1-E4 results above.

### W04 Gemini provider implementation addendum

Historical implementation state before the API migration below: the offline Gemini adapter used an injected Interactions client and did not make provider calls. Its recorded model and timeout policy are superseded by the GenerateContent production migration below; the backend route's completed-run request and advice response contracts remain unchanged.

| Check | Evidence | Result |
|---|---|---|
| G1 request construction | Configured stable model, serialized bounded runs, `store:false`, required JSON fields/category enum, conservative generation limits, and no tools/background/previous interaction | PASS |
| G2 valid structured output | Parsed advice passes the backend runtime validator and the route returns HTTP 200 | PASS |
| G3 malformed output | Malformed JSON maps to HTTP 503 and is not retried | PASS |
| G4 contract-invalid output | Valid JSON with an invalid category maps to HTTP 503 and is not retried | PASS |
| G5 timeout | The test double observes cancellation; at most two attempts are made | PASS |
| G6 transient 503 | One retry succeeds; total attempts are two | PASS |
| G7 rate limit | 429 retries once; exhausted failure remains generic | PASS |
| G8 non-retryable failures | 400, 401, and 403 do not retry; recognized connection failures may retry once | PASS |
| G9 invalid local input | Route returns 400 and asserts `providerCallCount === 0` | PASS |
| G10 missing Gemini key | Gemini config fails with a safe missing-variable message; no key value is logged | PASS |
| G11 fake mode | Default fake config and provider work without a Gemini key | PASS |

Validation actually run for the current reliability-hardening implementation: `npm run typecheck` passed; `npm run build` passed; `npm test` passed (66 tests, 66 passed, 0 failed); `node scripts/check-reachability.mjs` is the separate post-build gameplay check. `npm run test:ai:live` was not run in this verification pass because the pair did not authorize a live call. The current provider policy and fallback/repair behavior are covered by offline scripted-provider tests.

Security checks confirmed the root `.env` path is ignored; its contents were not opened or printed. No tracked `.env` path or `.env` history exists, `.env.example` contains placeholders only, and the built frontend source/output contains no Gemini key/config, SDK, provider URL, or provider auth-header wiring. The existing backend request validator still runs before provider access and provider advice is validated before route success. Manual Gemini quality evaluation, fallback live validation, and the existing Coach UI visual/focus play-test remain outstanding.

### W04 API-path diagnosis follow-up (2026-09-28)

The preceding implementation evidence is historical. The current environment-loaded credential was consumed only inside the diagnostic process; neither the real `.env` contents nor credential value was inspected or printed.

| Check | Actual result |
|---|---|
| A: direct REST Interactions, minimal stateless request | HTTP 200, completed, 8,153 ms, one HTTP attempt |
| B: SDK `models.generateContent`, minimal request | HTTP 200, generated text, 18,361 ms, one HTTP attempt |
| Live generation count | Exactly two; no live Coach request or additional SDK Interactions call |
| Installed SDK transport-double regressions | PASS: wire fields/output usage, cancellation, no SDK retries on 429/503/network errors, at most two HTTP attempts through the Coach wrapper |
| Offline suite | PASS: `npm test`, 55 tests, 0 failures |
| Static/build checks | PASS: `npm run typecheck`; `npm run build` |
| Reachability and diff | PASS: `node scripts/check-reachability.mjs`, all four targets capturable; `git diff --check`, no whitespace errors. Existing Node module-type and Git line-ending warnings remain. |
| Secret boundary | PASS: `.env` ignored/untracked with no path history; example has empty key; no provider key/SDK/auth wiring found in frontend source/output; diagnostic output contains metadata only |
| Secret value anywhere in historical content | NOT VERIFIED: the credential value was deliberately never inspected or searched |
| Live structured Coach validation | NOT VERIFIED by these minimal calls |

Production cleanup removes unsupported Interactions temperature and disables retries at the actual request level. Interactions and the 7,000 ms / two-attempt / 500 ms policy remain. Both minimal calls exceeded seven seconds; no API switch or new production timeout is recommended from this limited sample. See the [diagnosis evidence](EVIDENCE_003.md#week-4-gemini-api-path-diagnosis-addendum-2026-09-28) for the findings and limits. Temporary diagnostics were removed.

### W04 full structured REST Coach diagnostic (2026-09-28)

| Check | Actual result |
|---|---|
| Real Coach request construction | Production system instruction/schema, `store:false`, configured model, and synthetic one-run telemetry passing the backend request validator |
| Direct REST transport | One Node built-in fetch request; SDK not used; no retries or redirects |
| Live result | TIMEOUT at 30,015 ms; no HTTP status received |
| JSON parsing / runtime advice validation | NOT VERIFIED: no response arrived to parse or validate |
| Response category / token usage | Unavailable; fixed diagnostic category `timeout` |
| Production migration | Not performed: successful full REST validation was the prerequisite |
| Production-path live check | Not performed; total live generation calls in this task: one |
| Production timeout / retries | Unchanged: 7,000 ms per attempt, maximum two attempts, 500 ms retry delay; no evidence for a suitable new full-workload deadline |
| Offline regression checks | PASS: `npm test`, all 55 tests; includes Gemini adapter, invalid-input zero calls, malformed output, exact HTTP retry counts, and timeout/cancellation |
| Build/static checks | PASS: `npm run build:backend` before diagnosis; `npm run typecheck`; `npm run build`; `git diff --check` |
| Environment path checks | PASS: root `.env` ignored/untracked, no Git history for that path; example key is empty. Credential value and other historical contents deliberately not searched |

The temporary script was removed. Prior production/test modifications were preserved. See the [full diagnostic evidence](EVIDENCE_003.md#week-4-full-structured-rest-coach-diagnostic-2026-09-28) for the uncertainty and unchanged-policy limitation.

### W04 Gemini 3.1 Flash-Lite GenerateContent viability (2026-09-28)

| Check | Actual result |
|---|---|
| Model/API | `gemini-3.1-flash-lite`, installed SDK 2.24.0 `models.generateContent` |
| Full Coach workload | Production system instruction, production Coach schema via `responseMimeType: "application/json"` and `responseJsonSchema`, 512-token cap, one synthetic run accepted by the request validator, no tools |
| Live result | PASS: HTTP 200, 6,420 ms, exactly one HTTP attempt, 30-second diagnostic deadline |
| Structured output | PASS: JSON parsed and `validateAiCoachResponse({ advice })` accepted the output |
| Returned category | `threat_management` |
| Token usage | Input 550; output 210; total 760; thought count not reported |
| Retry/storage options | Request-level SDK attempts set to one; transport call-count guard; redirects disabled. No supported GenerateContent `store` option, so it was omitted |
| Migration | Recommended, not implemented; production model/API/timeout remain unchanged |
| Proposed deadline | 15 seconds total, including any retry delay/second attempt; no retry after local deadline; at most two attempts for explicit transient network/provider failures inside the remaining budget |
| Offline checks | Not run: no production/source changes; temporary diagnostic removed |
| Secret handling | Environment-loaded credential consumed only by the diagnostic SDK; no real environment-file contents, key value, headers, prompt, telemetry, raw response, or raw errors emitted |

This is one successful full-workload sample, not a latency percentile or proof of the then-current production Interactions path. The result authorized the migration recorded below. The GenerateContent structured-output fields were verified against the installed SDK declarations and [official API reference](https://ai.google.dev/api/generate-content).

### W04 GenerateContent production migration (2026-09-29)

| Check | Actual result |
|---|---|
| Production provider/model | PASS: backend now uses `@google/genai` `models.generateContent` with `gemini-3.1-flash-lite` |
| Production request | PASS: unchanged Coach system instruction, bounded completed-run summary, JSON MIME/schema config, 512-token cap, no tools/history/store field |
| Runtime validation | PASS: local request validates before provider invocation; output parses as unknown and passes the authoritative advice validator before success |
| Retry behavior | PASS: only connection/network and HTTP 408/429/500/502/503/504 retry; HTTP 400/401/403, invalid input/output, and local deadline expiration do not. Two provider attempts maximum; SDK transport allows one HTTP request per provider attempt. |
| Deadline behavior | PASS: a single monotonic 15,000 ms budget includes retry delay and both attempts; no second attempt starts without at least 1,000 ms useful time after the retry delay |
| `npm test` | PASS: 55 tests, 0 failures |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `node scripts/check-reachability.mjs` | PASS: `RESULT: PASS - every target is capturable` (Node emitted the existing module-type warning) |
| `git diff --check` | PASS: no whitespace errors; Git emitted CRLF conversion notices for edited files |
| Limited live production-path validation | PASS: one actual Coach operation, 2,593 ms, one attempt, runtime validation passed, category `threat_management`, 531 input / 197 output / 728 total tokens |
| Initial live runner invocation | No provider call: stopped at local configuration validation with sanitized output. The single live operation was then run with the intended provider/model process settings. |
| Live call count | One successful live Coach operation; no manual repeat after success |
| Secret handling | PASS by source/diff review: no credential value was read or added; the runner emitted only model, latency, attempt count, validation result, category, and token counts. `.env` and credential values were not searched or printed. |

The 6,420 ms viability result provided 8,580 ms of observed headroom under the selected total deadline. One successful live migration call confirms the production path works; neither sample establishes a latency distribution. Historical Interactions and seven-second diagnosis records above describe earlier states and remain preserved.

### W04 Gemini reliability hardening (2026-09-29)

| Check | Actual result |
|---|---|
| Failure classification | PASS: distinct timeout, network, rate limit, provider unavailable/server, request/auth, model-not-found, empty, invalid JSON, schema, semantic, refusal, abort, configuration, and unknown classes |
| Retry policy | PASS: one bounded primary retry for transient network/429/5xx; 429 `Retry-After` capped by backoff and deadline; HTTP 408 timeout is not mechanically replayed |
| Fallback | PASS offline: allowlisted fallback only follows classified model-not-found or transient availability; auth, refusal, arbitrary 404, and invalid output do not model-hop |
| Output repair | PASS: a single same-model correction attempt can recover output; no raw output enters repair request; a second invalid result safely fails |
| Deadline/calls | PASS: one monotonic 15-second production budget; max three provider calls; tests use injected short budgets/clocks and do not wait 15 seconds |
| Cancellation | PASS: backoff cancellation stops later calls; HTTP client disconnect aborts the provider signal; SDK transport double observes AbortSignal |
| Telemetry | PASS: ordered attempt kind/model/status/classification/timing and final fallback/repair/token summary; private request and raw response sentinels absent |
| Safe failure/input bounds | PASS: stable HTTP 503 `{ "ok": false, "error": "coach_unavailable" }`; local-invalid and oversized requests remain zero-call cases |
| Offline checks | PASS: `npm test` 66/66; `npm run typecheck`; `npm run build`; `git diff --check` (with line-ending notices only) |
| Live provider calls | Not run in this task |
| Fallback capability | `gemini-3.5-flash-lite` is candidate-only; full Coach live validation has not been performed |

This addendum records deterministic fake-client policy tests, not live provider behavior. The opt-in real-contract diagnostic command is `npm run test:ai:live`; to test the fallback model explicitly set `GEMINI_DIAGNOSTIC_MODEL=gemini-3.5-flash-lite` for that invocation.

### W05 Training Planner implementation (2026-10-06)

| Check | Actual result |
|---|---|
| Contract and session matrix | PASS: independent frontend/backend validators, bounded three-run page-session ledger, exact-once terminal observation, validated prior-plan baseline, and unchanged-history gating are covered by offline tests. |
| Evaluator and tools | PASS: normalized evidence and deterministic comparisons cover all five focus metrics, opportunity minima, unavailable bounce denominators, no-opportunity handling, exact rational comparisons, tool allowlisting, argument/result validation, and repeated actions. |
| Orchestration | PASS: first and later plans, evidence grounding, malformed proposal/final refusal, 3-step and 2-tool bounds, four global provider attempts, transient retry, 15-second call cap, 45-second run deadline, cancellation, and late-result discard are covered by scripted offline providers. |
| Route and UI client | PASS: `/api/training-plan` validates bounded streamed input before provider access, returns safe envelopes, gates unchanged history with zero provider calls, and handles disconnects. Client/session integration and separate UI wiring are covered by tests and build. |
| W04 regression | PASS: the complete offline suite retains the existing logic, gameplay, AI Coach route/client, and Gemini adapter suites; W04 request/response contracts and Gemini modules were not changed. |
| `npm run typecheck` | PASS: frontend and backend TypeScript checks. |
| `npm test` | PASS: 98 tests, 98 passed, 0 failed; tests use fake providers and offline Gemini SDK transport doubles. |
| `npm run build` | PASS: frontend and backend builds. |
| `node scripts/check-reachability.mjs` | PASS after the build: all four Core targets capturable; `RESULT: PASS - every target is capturable`. Node emitted the existing module-type warning. |
| `git diff --check` | PASS after the documentation and task-status edits; only Git's existing LF-to-CRLF conversion notices appeared. |
| Live Gemini / environment | No W05 live Gemini request was made; the real `.env` file was not inspected. `.env.example` contains an empty W05 key placeholder. |
| Manual UI evaluation | Not performed in an interactive browser; accessible markup/states, frontend compilation, client/session tests, and local HTTP integration tests passed. |

### W05 final submission-preparation verification (2026-10-06)

| Check | Actual result |
|---|---|
| W05-E12 maximum-step scenario | PASS offline: scripted provider reached `step_limit` after 3 agent steps, 2 dispatched tools, and 3 provider attempts; no fourth provider call. The test-only tool limit isolates this terminal classification; the production 2-tool default remains unchanged. |
| `npm run typecheck` | PASS: frontend and backend TypeScript checks. |
| `npm test` | PASS: 99 tests, 99 passed, 0 failed. Fake/scripted-provider tests and Gemini SDK-double tests are offline; W04 suites remain included. |
| `npm run build` | PASS: frontend and backend builds. |
| `node scripts/check-reachability.mjs` | PASS: all four Core targets capturable; `RESULT: PASS - every target is capturable`. Existing Node module-type warning appeared for `frontend/dist/game.js`. |
| `git diff --check` | PASS: exit code 0; Git printed working-copy LF-to-CRLF notices. |
| Real W05 Gemini Agent Run | PASS: one logical run through `POST /api/training-plan`, model `gemini-3.1-flash-lite`, `goal_completed`, 2 model steps, 1 `get_recent_run_evidence` call, 2 provider attempts, 0 retries, 13,444 ms orchestrator elapsed, HTTP 200/13,624 ms round trip, validated focus `range_management`. The adapter returned no token counts. |
| Secret handling | The documented `node --env-file=.env` loader supplied backend configuration. No secret or environment value was printed, manually inspected, or included in the evidence. |

This feature adds no saved history or gameplay mutation. Its latest validated plan and sequence baseline live only in the current page session. No W03 gameplay defect was found or changed, so `EVIDENCE_003.md` remains unchanged.

The focused W05 scenario matrix, including exact test sources and any unverified paths, is in [`AGENT_EVALS.md`](AGENT_EVALS.md). W05 implementation and submission evidence is in [`EVIDENCE_W05.md`](EVIDENCE_W05.md).
