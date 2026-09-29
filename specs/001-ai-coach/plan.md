# AI Coach technical plan

## Current architecture

- `frontend/src/game.ts` owns deterministic state and transitions. `Game.status` is `playing | won | gameover`; `update()` sets `won` only after sequence completion and entering the exit. `loseLife()` restores gameplay while preserving the current telemetry run, and sets `gameover` when lives reach zero. `Game` owns an in-memory `CoachRunHistory` from `frontend/src/coach-telemetry.ts`.
- `Game.resetLevel()` restores configured lives and gameplay state; an active run's telemetry is discarded, while terminal summaries remain archived. `frontend/src/main.ts` wires `R`, Reset Level, and the AI Coach UI/client, and updates the HUD each animation frame.
- `frontend/index.html` contains the canvas HUD, reset and Coach controls, status, and advice panel; `frontend/styles.css` styles the existing UI. There is no main menu or UI framework.
- The separate Node backend serves `GET /api/health` and `POST /api/ai/coach` from `backend/src/server.ts`. The Coach route validates bounded input, calls the startup-selected provider, then validates its output. Fake mode remains the default and live Gemini mode is backend-only.
- Runtime validation remains hand-written in each environment: `frontend/src/validation.ts` handles `GameConfig`/`LevelData`; AI Coach boundary validators are in `frontend/src/ai-coach-contract.ts` and `backend/src/ai-coach-contract.ts`. Tests use `node:test`/`node:assert/strict` and now cover client, telemetry, lifecycle, and backend route behavior.
- There is no persistence layer, shared package, or frontend browser automation. Completed-run history is session-only. The official `@google/genai` SDK is imported only by backend code.

## Proposed data flow

```text
authoritative Game events
  → bounded current-run collector (frontend)
  → terminal summary on won/gameover, or discard on active reset
  → in-memory completed history (newest 3)
  → explicit AI Coach click; serialize history only
  → POST /api/ai/coach
  → backend request validation (before provider)
  → provider interface (fake first, Gemini adapter second)
  → provider response validation
  → { advice } response → frontend advice panel
```

No provider work belongs in `Game.update()`, `Game.render()`, or the frame callback. `Game` should expose event facts or a narrow event callback; it should not import HTTP, DOM, or provider code. Keep history and request/UI orchestration in the browser entry or a small focused frontend module. Proposed future modules: `frontend/src/coach-telemetry.ts` (bounded collector, derivation, history and request serialization), `frontend/src/main.ts` (button/request states), plus focused additions to `game.ts` for authoritative event emission. Backend owns request/response contracts and runtime validators near the API/provider code under `backend/src/`; exact module split should follow the first implementation diff. No cross-layer import is introduced.

## Run lifecycle

1. Construct a fresh collector when the page starts. Its clock is monotonic elapsed gameplay time, not wall-clock/user data.
2. A life loss increments `livesLost` and emits a failure event. If lives remain, retain the collector while the game resets level objects; this matches `loseLife()` behavior.
3. When `Game.status` first transitions to `won`, finalize with `level_complete`. When the last life is lost and status transitions to `gameover`, finalize with `game_over`. Guard finalization so one terminal transition adds exactly one summary.
4. Append the summary immediately and trim from the oldest end until at most three remain. Do not include the current collector in request serialization.
5. `resetLevel()` while status is `playing` discards the collector and creates a new run after the gameplay reset. If status is terminal, keep archived history and create a new current collector. The implementation should centralize this around the existing `R` and button handlers so they cannot disagree.
6. History is memory-only and clears on page reload. No localStorage/backend persistence.
7. If the Coach is requested during gameplay, take a snapshot of completed history at click time. If a run completes while that HTTP request is pending, it is available on the next request, not retroactively added to the in-flight one.

## Telemetry ownership and event mapping

Game code provides facts at existing authoritative transitions: shot fired in `tryFire()`, projectile bounce in `updateBlueProjectile()`, capture in `captureEnemy()`, failure/range expiration in `failBlueShot()` and range branches, green-threat destruction in the threat collision branch, life loss in `loseLife()`, and terminal state after the exit/game-over transition. A fired-shot record keeps initial aim, target ID/position, player origin, threat facts, initial range, aim settle time, and run-relative time until the projectile ends; then it receives actual bounce/travel/result values. No browser event list or full coordinates are sent.

The collector owns counters, bounded per-target aggregates, the limited representative-event list, finalization, and last-three history. Keep at most 8 representative events per run, choosing high-signal events and coalescing duplicate same-target patterns. Never store an unbounded event log or transmit aim samples. Retain only a compact aim direction/time state locally.

## Contracts and validation

Use hand-written TypeScript validators consistent with current code; do not add a schema package absent a demonstrated need. Types aid implementation but are not trusted validation.

```ts
type Outcome = "level_complete" | "game_over";
type Category = "threat_management" | "bounce_strategy" | "aim_timing" |
  "positioning" | "range_management" | "general";

type TargetSummary = {
  targetId: string; attempts: number; captures: number; failedShots: number;
  blockedDirectAttempts: number; bouncedAttempts: number;
  rushedBouncedFailures: number; samePositionFailures: number; rangeExpirations: number;
};

type RepresentativeEvent =
  | { type: "ignored_threat"; targetId: string; aimedAtTarget: boolean }
  | { type: "blocked_direct"; targetId: string; attemptCount: number }
  | { type: "rushed_bounce"; targetId: string; aimSettleMs: number }
  | { type: "same_position"; targetId: string; attemptCount: number; movementDistance: number }
  | { type: "range_expired"; targetId: string; targetDistance: number;
      travelBudget: number; bounceCount: number };

type CompletedRunSummary = {
  outcome: Outcome; durationMs: number; livesLost: number;
  shotsFired: number; failedShots: number; captures: number;
  greenThreatsCreated: number; greenThreatHits: number;
  shotsWhileThreatActive: number; defensiveShots: number;
  successfulDefensiveShots: number; shotsAimedAtThreat: number;
  shotsAimedAtCurrentTargetWhileThreatActive: number; offensiveShotsWhileThreatActive: number;
  blockedDirectAttempts: number; bouncedAttempts: number;
  successfulBounceCaptures: number; rushedBouncedFailures: number;
  repeatedSamePositionFailures: number; rangeExpiredShots: number;
  targetStats: TargetSummary[]; representativeEvents: RepresentativeEvent[];
};

type CoachRequest = { runs: CompletedRunSummary[] }; // 1..3
type CoachAdvice = {
  summary: string; primaryCategory: Category; primaryAdvice: string;
  secondaryAdvice?: string; practiceGoal: string;
};
type CoachResponse = { advice: CoachAdvice };
```

Validation bounds: 1–3 runs; 0–16 target summaries per run; 0–8 representative events per run; all numeric values finite, non-negative integers except distances/duration which are finite and non-negative; all IDs 1–64 characters; counts internally consistent where relevant (for example captures ≤ attempts, and total captures ≤ sequence length for the current level); outcome/category/event names are allowlisted. Request body maximum is 32 KiB, enforced while reading the HTTP body before JSON parsing. Response text caps: summary 240 chars, primary advice 500, secondary advice 300, practice goal 180; total visible advice ≤ 1,200 chars. Reject unknown enum values, missing required fields, malformed JSON, excess limits, and unexpected structures before provider use/return. The frontend performs the same relevant bounds before send.

No raw player/target coordinates are in the API contract. `targetDistance`, `travelBudget`, and `movementDistance` are rounded to integer world units before summarization. Run identifiers are omitted because ordering and outcome are sufficient and no correlation identity is needed.

## Deterministic heuristic definitions

Put thresholds in named exported constants in the telemetry module and cover boundary values with deterministic unit tests:

- **Approximate aim:** normalize shot vector and entity vector from player center at fire. Aligned when angular separation is ≤20° (dot product ≥ `cos(20°)`). Evaluate threat and current target separately, so both flags may be true. A zero-length vector is unclassified.
- **Blocked direct attempt:** segment from player center to target center intersects any solid platform rectangle using a deterministic segment/rectangle test, and approximate aim points at target. It records an obstructed direct attempt, not proof that a bounce route is feasible. Test tangency consistently as blocked; avoid relying on projectile-radius collision for line classification.
- **Rushed bounced failure:** record elapsed milliseconds since the most recent aim-direction change greater than 5° from pointer events; classify only if the completed failed shot had at least one actual bounce and settle time was <250 ms. Store only latest direction/change time, not raw pointer events. It is explicitly a proxy and cannot establish player intent.
- **Same-position retry:** for consecutive failed shots against the same current target, shot-origin displacement ≤40 world units is same-position. A repeated pattern is recorded at three consecutive failed attempts in that zone. A successful capture or target change resets the chain. Count and coalesce; do not call the position inherently bad without blocked/failed-shot evidence.
- **Range expiration:** true only when the game ends the projectile because its remaining travel budget reached zero without a capture. Record actual direct target distance, bounce count, and budget granted (`450 + 150 × actual bounces`, matching `PROJECTILE_RANGE` and `BOUNCE_BONUS`). Do not infer a miss is range-caused when it ended by collision with non-target/green threat or exhausted bounce allowance. The model should use this fact conservatively.
- **Threat response:** on each fire snapshot whether threat exists. `defensiveShots` counts shots fired while active; `shotsAimedAtThreat` and `shotsAimedAtCurrentTargetWhileThreatActive` preserve the two independent angular classifications (a shot can match both); `successfulDefensiveShots` counts shots that collide with/destroy the threat; `offensiveShotsWhileThreatActive` counts target-aligned shots that are not threat-aligned. A threat hit increments `greenThreatHits` and `livesLost` via the existing life-loss event.

All aim, timing and position classifications are heuristics. Include underlying aggregate counts and keep language in the model prompt qualified; do not imply certainty about intent or availability of a valid bounce route.

## HTTP and provider design

- Add `POST /api/ai/coach` in the existing `backend/src/server.ts` routing style. Keep current health semantics and allowed local frontend origins; allow `POST, OPTIONS` for this route and `Content-Type` only. Reject wrong methods/routes and oversized/malformed request bodies with stable JSON envelopes.
- Request envelope: `{ "runs": [...] }`; success envelope: `{ "advice": {...} }`. Validation failure uses HTTP 400 `{ "ok": false, "error": "invalid_request" }`. Provider unavailable/timeout/invalid provider output uses generic 503 `{ "ok": false, "error": "coach_unavailable" }`. Do not return stack/provider detail.
- Backend provider interface accepts validated runs and returns unknown/untrusted output for subsequent validation. Keep the deterministic fake provider and inject providers in route tests. Normal startup selects one provider from validated backend configuration. No generic agent framework or frontend/backend shared runtime module is necessary; duplicate the small boundary contract/validator only if needed to keep each target environment independent, documenting drift risk.
- Provider prompt: concise SELFBOUND coach; use supplied summaries only; distinguish measured facts from heuristic signals; do not invent counts, infer personality, or prescribe exact angles; choose the strongest recurring/high-impact pattern; provide one concrete action, optional secondary point, and one practice goal; return the required JSON structure only. Insufficient evidence should yield general/qualified advice.
- Provider: Gemini Developer API through the official `@google/genai` SDK. Use `models.generateContent`, no tools, and no conversation history or state. Request JSON structured output using the Coach response schema, then continue to treat parsed output as `unknown` until the existing backend validator accepts it.
- Model: explicitly use `gemini-3.1-flash-lite`, the model that passed the full structured Coach viability call in 6,420 ms with runtime response validation. Reject a different `GEMINI_MODEL` value instead of silently switching models.
- Generation limits: at most `512` output tokens and no request for hidden reasoning. Keep the established production Coach system instruction and bounded completed-run summaries unchanged.

### Backend configuration and local environment

- `AI_COACH_PROVIDER` accepts `fake` or `gemini` and defaults to `fake`. `GEMINI_API_KEY` is required only for Gemini mode. `GEMINI_MODEL` defaults to and is validated as `gemini-3.1-flash-lite`.
- Keep configuration parsing separate from route code. Missing/invalid configuration fails startup with a developer-facing message that names the missing/invalid variable but never prints its value. The API key is passed directly to the backend SDK client and is never logged.
- Use the repository-root `.env` only. `.gitignore` already excludes `.env` and `.env.*` while allowing `.env.example`; the example file contains placeholders only.
- Normal fake development requires no environment file. To run the backend with root `.env`, build it and use Node's native environment-file option: `npm run build:backend`, then `node --env-file=.env backend/dist/server.js`. The live validation runner may use the same Node loading mechanism, but it must not print the loaded values. The process environment can also provide the same backend variables.
- `@google/genai` 2.x requires Node.js 20+. The repository runtime floor is set to Node.js 20.6 because the documented native `--env-file` workflow uses that Node option. Do not move the application to Node 22 solely for the SDK.

## Timeout, retry, safe failures, and operations

- Apply one 15,000 ms total operation deadline, at most two provider attempts, and the existing 500 ms delay before the single possible retry. The deadline includes both requests and retry delay and uses monotonic elapsed-time accounting. Retry only connection/network failures and HTTP 408/429/500/502/503/504. Do not retry local/request/schema/configuration errors, HTTP 400/401/403, programming errors, malformed output, runtime validation failure, or total deadline expiration. Start a retry only when the 500 ms delay plus at least 1,000 ms of attempt budget remains.
- Set the SDK HTTP retry configuration to one attempt with no retryable statuses; SELFBOUND owns the maximum-two request policy. Pass each operation attempt's AbortSignal into GenerateContent and verify the real SDK with offline HTTP doubles for exact request counts, cancellation, wire fields, and response extraction.
- The frontend has one in-flight request at a time. On HTTP/network failure, timeout, or invalid response envelope, show “AI Coach is currently unavailable. Try again later.” Keep gameplay responsive and controls usable.
- Log one compact record per live Gemini Coach operation: operation name, provider, configured model identifier, timestamp, total latency, success/failure, attempt count, a fixed safe failure category, and token usage only when the SDK exposes it. Do not log API keys, full requests/runs, prompts, full responses, headers, or raw errors. Use a fixed safe failure code for client response; internal diagnostics must be scrubbed and minimal.
- Read Gemini credentials from backend environment configuration only. Add placeholder-only `.env.example` only if implementation establishes the actual variable name; do not put provider configuration in frontend build variables.

## UI plan

Add an `AI Coach` button and local helper/status/advice elements beside the existing `Reset Level` button in `frontend/index.html`; style compactly in `frontend/styles.css`, including mobile wrapping and visible focus states. With zero completed runs, disable the button and show the short completion hint. On click, snapshot completed summaries, disable the button, show “Analyzing completed runs…” in an accessible status region, send request without pausing gameplay, then render structured fields in a small panel. On success/error or a new completion, update state. Preserve reset availability and existing terminal messages.

## Test strategy and W04 evals

Add focused telemetry/contract tests using Node `node:test` and deterministic clock/input values. Extend existing gameplay tests only for run-event integration; retain synthetic levels rather than coupling to Core Level 1 coordinates. Keep the existing fake-provider route tests. Add Gemini adapter/config/reliability tests through an injected GenerateContent client/test doubles; do not call live Gemini from `npm test`. Verify malformed JSON and valid-but-contract-invalid output fail safely, and that output rejected by the backend validator does not cause another provider attempt. Automated live Gemini calls are not part of `npm test`.

| Eval | Expected result | Planned coverage |
|---|---|---|
| A1 one valid completed run | Structured advice success | Backend fake-provider route test |
| A2 three valid runs | Success; all provided runs available to provider | Route test / request serialization test |
| A3 zero completed runs | Disabled/local message; no provider call | Frontend selection/handler test; provider count 0 |
| A4 malformed request | Rejected before provider; call count 0 | Backend validator/route test |
| A5 provider timeout/failure | Bounded failure and safe client text | Provider/route plus UI state test |
| A6 malformed provider response | Rejected, generic unavailable result | Provider output validator/route test |
| A7 transient failure | At most two attempts | Retry policy test |
| A8 fourth terminal run | Oldest evicted | History unit test |
| A9 active manual reset | Discard old current record; no history change | Lifecycle test |
| A10 life loss before Game Over | Same run continues; life loss counted | Lifecycle/gameplay test |
| A11 Coach during active run | Only completed summaries serialized | Frontend history serialization test |

Gemini implementation checks: request construction uses the configured model, only validated bounded completed-run data, the approved schema, and no tools or history; valid JSON passes the existing validator and reaches HTTP 200; malformed or contract-invalid output maps to safe 503; total 15-second deadline covers at most two requests and any retry delay; 429 may retry once; 400/401/403 and local invalid input do not retry/call the provider; missing Gemini configuration fails without exposing key material; fake mode starts without a key.

Also cover angle boundary/zero vector; blocked-segment intersection and tangency; aim-settle cutoff and actual bounce requirement; movement threshold and three-failure chain/reset; range expiry reason and bounce-granted budget; terminal finalization exactly once; summary/event/body limits and finite number validation. Manual browser check should exercise zero/one/three history, loading while moving/playing, success, failure, terminal reset, and small-screen layout.

Implementation validation commands: `npm run typecheck`, `npm test`, `npm run build`, then `node scripts/check-reachability.mjs` after frontend build. Any live validation is a separate explicit opt-in path and is limited to at most three successful calls; it is not required for fake/test-double completion.

## Compatibility, risks, and limitations

Keep existing gameplay rules, reset semantics, projectile collisions, and terminal states authoritative. Telemetry observes existing events only. Risk: event plumbing can accidentally change transition ordering; use focused regression tests. Geometry/aim/timing thresholds can misclassify intent, so advice must remain qualified. Three runs are a small sample; avoid overstating recurrence. The coach cannot inspect the active run, screenshots, or player intent. Backend implementation introduces the first user-data POST and external provider dependency; body limits, validation, generic errors, and backend-only secrets are required before live calls. Session-only data disappears at reload by design.

## Implementation sequencing

The Gemini migration implementation task updates the earlier provider decision based on a passing full structured Coach viability result (6,420 ms, runtime schema valid). Earlier diagnosis records remain historical. Preserve gameplay, frontend telemetry/history, and HTTP contracts. Do not expand into additional AI behavior. Complete fake/test-double validation before the limited optional live production-path check.
