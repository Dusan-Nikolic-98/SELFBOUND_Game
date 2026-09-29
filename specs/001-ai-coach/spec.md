# Feature 001: AI Coach

## Overview

SELFBOUND players can request concise advice based on up to their three most recently completed runs. The Coach summarizes recurring, measurable play patterns so the player can choose what to practice next. Advice is optional and read-only; the game remains the authority over every gameplay decision.

## User value

The game has no main menu, player account, or run history today. A small session-only history lets a player see patterns across attempts without creating profiles or saving gameplay. Advice should connect observable events to a practical next-run focus.

## User scenarios

1. **No completed runs:** the AI Coach button is disabled and nearby helper text says, “Complete a run before requesting coaching.” No request is sent.
2. **One completed run:** the player can request advice based on that run.
3. **Three completed runs:** the request includes all three, in oldest-to-newest order.
4. **Coach during an active run:** the request contains completed history only. The unfinished run remains private to the browser and is not included.
5. **A run finishes:** Level Complete or Game Over finalizes and adds its summary to history immediately.
6. **A fourth run finishes:** the oldest summary is evicted; exactly the newest three remain.
7. **Manual reset during play:** the current run is abandoned and discarded, then a fresh run starts. It is not archived as completed.
8. **Provider unavailable or request fails:** the panel shows a short, safe retry-later message; gameplay and reset controls remain usable.
9. **Provider returns malformed advice:** the response is rejected and the player sees the same safe unavailable message.
10. **Player resets after a terminal screen:** the reset begins a fresh run; the terminal run remains in completed history.
11. **Player loses a life but has lives left:** the level state resets, while the same run telemetry continues.

## Functional requirements

- **FR-1 Run lifecycle:** Start one current telemetry record when the game first starts and whenever a fresh run begins. A run is complete only at Level Complete (`won`) or Game Over (`gameover`). A life loss before Game Over is an event in the current run, not a completed run.
- **FR-2 Terminal finalization:** At Level Complete or Game Over, finalize a bounded summary once, append it to completed history, and retain no more than the latest three summaries.
- **FR-3 Reset behavior:** `R` and Reset Level during an active run discard its telemetry without archiving it, restore the game to its configured initial lives/state, and begin a fresh current run. Reset from a terminal screen also starts a fresh run but leaves the already archived terminal summary intact.
- **FR-4 Session boundary:** Keep current telemetry and completed history in memory only. Reloading/closing the page clears both. Do not add localStorage, cookies, a database, or backend run persistence.
- **FR-5 Explicit request:** The player requests analysis with an AI Coach button in the existing game footer/control area beside Reset Level. Do not add a main menu. The request is not part of the frame update/render loop.
- **FR-6 History selection:** Include one to three completed summaries only, oldest-to-newest. Never include current-run telemetry. A zero-history request is rejected locally without contacting the backend/provider.
- **FR-7 Request states:** Disable the Coach button during an in-flight request to prevent duplicates. Show a compact loading status. Do not pause/freeze gameplay. On success show the structured advice in a small accessible panel within the existing page. On failure keep other controls usable and show a generic safe message.
- **FR-8 Grounded advice:** Return concise structured advice with one primary issue, one concrete improvement, optional secondary observation, and a next-run practice goal. The model may only use request telemetry, must acknowledge insufficient evidence, and must not make psychological/personality judgments or invent statistics.
- **FR-9 Read-only boundary:** The Coach must not change player/game state, choose shots, create enemies, alter physics/geometry/difficulty, pause gameplay as an effect of advice, or execute tools/actions.
- **FR-10 Runtime validation:** Validate browser-generated request data before sending, validate HTTP request data before provider invocation, and validate provider output before returning success. Invalid input must produce zero provider calls.
- **FR-11 Safe errors:** Do not show or log API keys, raw provider payloads, prompts, stack traces, or raw provider errors. Use a stable client error response and user-facing text such as “AI Coach is currently unavailable. Try again later.”
- **FR-12 Data minimization:** Send gameplay summaries only. Do not collect account identity, browser/device details, free-form user prompts, screenshots, or full frame/state histories.

## Telemetry requirements

Track only shot/capture/threat/life/terminal events and compact derived values. The authoritative facts are computed by the game locally; the model only interprets their bounded summaries.

1. **Green threat prioritization:** Record whether a green threat existed at fire time; whether shot direction was approximately aligned with threat and/or current target; whether a defensive shot destroyed the threat; offensive attempts made while it remained active; and threat hits/lives lost. Classifications are geometric heuristics, not claims of intent.
2. **Blocked direct shot vs bounce:** At fire time retain current target identity/position, player origin, direct-segment obstruction by platform rectangles, and approximate direct aim. On shot termination retain bounce count, capture/failure outcome, and failure reason. A blocked segment plus direct aim is evidence of an obstructed attempt only; it does not prove a bounce route exists.
3. **Rushed bounce aiming:** Track pointer aim changes in a bounded rolling manner. Record time since the last material aim-direction change at fire. Classify a rushed attempt only when a failed shot actually bounced and the aim-settle time was below the configured threshold. This is a heuristic, not a measurement of player skill or intent.
4. **Repeated attempts from the same position:** For consecutive failed shots at the same target, compare shot origins. Count a same-position retry when movement is at most 40 world units; identify a repeated stationary pattern after at least three consecutive failed attempts in that position zone. The threshold is coarse and testable.
5. **Range management:** Record direct target distance, initial range, shot bounce count, travel budget granted by actual bounces, and whether the projectile expired from zero remaining travel budget without capturing the target. Do not classify distance beyond initial range as impossible when bounces may extend range.

Useful run aggregates are outcome, duration, lives lost, shots, failed shots, captures, threat creation/hits, defensive shots/successes, offensive shots during threats, blocked direct attempts, bounced attempts/captures, rushed bounced failures, stationary retry patterns, and range-expired shots. Per-target aggregates are keyed by level target ID and bounded. Do not send raw coordinates or trajectories; use derived distances/booleans and compact representative events.

## Request and response expectations

Request: `{ runs: CompletedRunSummary[] }`, with 1–3 terminal summaries, bounded per-target summaries and at most 8 representative events per run. Each summary outcome is `level_complete` or `game_over`.

Response: `{ advice: AiCoachAdvice }`, where `AiCoachAdvice` has `summary`, `primaryCategory`, `primaryAdvice`, optional `secondaryAdvice`, and `practiceGoal`. Categories are `threat_management`, `bounce_strategy`, `aim_timing`, `positioning`, `range_management`, and `general`. Validate required strings, enum, optional-field shape, and configured length limits at runtime.

## Acceptance criteria

- Only Level Complete and Game Over archive summaries; remaining-life resets continue the same run.
- Active manual reset discards telemetry. Reset from a terminal state starts a new run without deleting the completed record.
- History contains at most the latest three terminal summaries and is lost on reload.
- The Coach button is beside the existing reset control; no menu is added.
- Zero completed runs yields disabled/local guidance and zero network/provider calls. One, two, or three summaries are accepted.
- A request during play contains only completed history. A completion during play becomes eligible on the next request.
- Five coaching areas have deterministic, unit-testable signals and documented heuristic limits.
- The request is size/count bounded; malformed input is rejected before provider invocation.
- The backend alone calls Gemini; the key is backend environment configuration and never enters browser code or logs.
- The response is structured and runtime-validated. Failure and malformed output yield a safe UI message.
- Fake-provider tests cover normal flow; automated tests do not require live Gemini.
- Gameplay behavior remains unchanged apart from passive event capture and the Coach presentation.

## Error behavior

Local no-history and in-progress states are handled before HTTP. Backend validation errors return a stable 400 envelope without provider access. Provider timeout, unavailable provider, transient exhaustion, and malformed output map to generic stable server errors; raw details remain internal operational metadata only. The frontend renders generic wording and can issue a later request.

Gemini reliability uses one 15-second monotonic deadline across at most three generation calls. It permits one bounded retry for transient transport/provider availability failures, an optional allowlisted backend fallback only for model/availability failures, and at most one same-model repair for invalid provider output. Repair never includes the invalid output and never triggers model hopping. Output is classified as empty, invalid JSON, schema-invalid, semantically invalid, or safety refusal before it can be returned. Each attempt and final outcome may be logged using sanitized model/status/timing/classification metadata; requests, prompts, output, identifiers, credentials, and stack traces remain excluded. `gemini-3.5-flash-lite` is only a candidate until it passes the full live Coach contract.

## Security and privacy

Browser → SELFBOUND backend → Gemini. The browser never calls Gemini directly. Credentials are read only by backend code from environment configuration, never committed, returned, or logged. Request bodies contain gameplay-only bounded summaries. Do not log complete request/response bodies or prompts.

## Out of scope

Frame-by-frame or autonomous AI; current unfinished-run analysis; AI-controlled enemies; game-state mutation; AI-selected shots; tool execution; RAG/vector databases; accounts/profiles; persistent/server-side run history; leaderboards/multiplayer; dynamic difficulty; procedural generation; screenshots/video/voice; chat or user-entered prompts; a new main menu; psychological/player-skill profiling; unrelated gameplay features.

## Open questions

None for the Core contract. The authorized Gemini implementation task resolves the provider choices in `plan.md`: official `@google/genai` 2.x SDK, Gemini Developer API `models.generateContent`, and `gemini-3.1-flash-lite`. GenerateContent has no supported `store` option; the request remains stateless with no conversation history. These implementation choices do not change the request/response contract or feature scope.
