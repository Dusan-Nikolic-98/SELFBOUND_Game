# AI Coach implementation tasks

These tasks track the approved feature implementation. Completed tasks are checked; remaining tasks are future work. Preserve gameplay rules and the existing AI Coach contracts. The migration task updates the earlier Gemini provider/reliability choice; limited live validation follows offline checks.

The AI Coach markup and request flow are implemented. T013's browser/network integration check is complete; T008 remains open for visual layout and keyboard/focus inspection. Automated client-to-backend HTTP integration is also covered by tests.

## Phase 1 — Contracts and deterministic telemetry design

- [x] **T001 — Define boundary contracts and limits.** Affected: frontend/backend contract code under `frontend/src/` and `backend/src/`. Depends: none. Define summary, per-target, representative-event, request, category, and response shapes from `plan.md`; add hand-written runtime validators and limits (runs 1–3, max 16 targets/run, max 8 events/run, 32 KiB request, response field limits). Validation: unit cases for valid min/max and malformed/missing/unknown/non-finite/oversized values.
- [x] **T002 — Implement deterministic heuristic helpers.** Affected: proposed `frontend/src/coach-telemetry.ts` or similarly focused module. Depends: T001. Implement angle classification (20°), segment/platform obstruction, aim settle (<250 ms after >5° change), same-position (≤40 units; three consecutive failures), and range-expiry/budget facts. Validation: boundary-focused pure tests; no frame or pointer history uploads.
- [x] **T003 — Establish fake provider and injectable boundary.** Affected: backend provider module and tests. Depends: T001. Add deterministic fake advice and provider interface without Gemini configuration. Validation: valid one-run and three-run contract tests; malformed fake output rejection; no network dependency.

## Phase 2 — Passive game telemetry and run lifecycle

- [x] **T004 — Emit authoritative gameplay events.** Affected: `frontend/src/game.ts` and telemetry collector. Depends: T001–T003. Capture fire-time target/player/threat facts and actual bounce, capture, projectile termination, threat destruction/hit, life loss, and terminal outcome. Keep provider/network code out of game loop. Validation: telemetry-specific unit tests and unchanged existing gameplay behavior.
- [x] **T005 — Add bounded collector and run summaries.** Affected: telemetry module and `game.ts` event seam. Depends: T004. Aggregate requested counters, target summaries and at most 8 selected/coalesced events; no full trajectories or raw coordinates in outgoing summaries. Validation: counters, target transitions, event cap, rounding, and summary validation tests.
- [x] **T006 — Implement completion, reset, and history rules.** Affected: `frontend/src/game.ts`, `frontend/src/main.ts`, telemetry owner. Depends: T004–T005. Finalize once on `won`/`gameover`, preserve collector through nonterminal life loss, discard active-run telemetry on manual reset, retain terminal summary when reset starts a new run, and evict oldest beyond three. Validation: A8–A10 and terminal finalization exactly-once tests.
- [x] **T007 — Verify no accidental gameplay regression.** Affected: tests/docs if needed. Depends: T004–T006. Confirm reset, life, projectile, capture, win, and game-over rules are unchanged. Validation: `npm run typecheck`, `npm test`; inspect the diff and current `docs/GAME_SPEC.md` alignment.

## Phase 3 — Coach UI with local request orchestration

- [ ] **T008 — Add AI Coach controls and accessible panel.** Implementation added in `frontend/index.html`, `frontend/styles.css`, and `frontend/src/main.ts`. Depends: T006. Button beside Reset Level; zero-history disabled/helper state; compact loading, success, and generic error states; mobile wrapping and focus visibility. Validation still required: manual browser layout and keyboard/focus inspection.
- [x] **T009 — Serialize only completed history and prevent duplicate requests.** Affected: frontend request orchestration. Depends: T001, T006, T008. Snapshot 1–3 completed summaries at click, exclude current record, disable during request, leave gameplay running, update eligibility after completion. Validation: A3 and A11; zero-history/provider-call count remains zero.

## Phase 4 — Backend contract and fake-provider route

- [x] **T010 — Add bounded HTTP request parsing and Coach route.** Affected: `backend/src/server.ts` and backend contract modules. Depends: T001, T003. Add `POST /api/ai/coach`, 32 KiB streaming body limit, JSON parsing, allowlisted CORS method/header update, stable validation/error/success envelopes, and pre-provider validation. Preserve `/api/health`. Validation: route tests for method/path/body size/validity; invalid request provider call count is exactly zero.
- [x] **T011 — Add fake-provider success and safe failure coverage.** Affected: backend route/provider tests. Depends: T010. Cover one/three runs, malformed provider output, fake provider failure and generic response. Validation: A1, A2, A4, A6; tests use no live external service. Live-provider timeout/retry is deferred to the next phase.
- [x] **T012 — Add bounded transient retry (historical policy, superseded by the GenerateContent migration below).** Affected: backend provider orchestration/tests. Depends: T011. Original policy: 7,000 ms per-attempt timeout, maximum two total attempts, and 500 ms retry delay. Its timing is no longer production behavior.
- [x] **T013 — Exercise frontend/backend integration with fake provider.** Automated real-HTTP client-to-backend coverage is implemented. Depends: T008, T010, T011. Verified under the combined `npm run dev` workflow in headless Edge: Game Over success, local CORS preflight, advice rendering, reset usability, active-run exclusion, and generic display for a 503 response. Backend tests verify invalid input makes zero provider calls and provider exceptions map to stable 503 responses. Full visual layout/focus inspection remains in T008; T012's real-provider retry policy is not a prerequisite for the fake slice.

## Phase 5 — Backend Gemini integration and reliability

- [x] **T014 — Add Gemini adapter and backend environment configuration (historical implementation, superseded below).** Affected: `backend/src/`, root package manifest/lock, `.env.example`, and runtime docs. Original choice: SDK Interactions, `gemini-3.5-flash-lite`, and `store:false`; production now uses GenerateContent and `gemini-3.1-flash-lite`.
- [x] **T015 — Validate live-provider output and operational metadata (historical timing policy, superseded below).** Affected: provider adapter, startup wiring, tests, and backend logs. Original policy used 7,000 ms per attempt; the active policy uses one shared 15,000 ms deadline.

## Phase 6 — End-to-end evaluation and evidence

- [x] **T016 — Complete the W04 evaluation matrix.** Affected: tests and feature evidence. Depends: T001–T015. Cover A1–A11 and Gemini adapter/config/reliability checks from `plan.md` plus heuristic boundaries. Validation: `npm run typecheck`, `npm test`, `npm run build`, then `node scripts/check-reachability.mjs` after frontend build; record actual output.
- [ ] **T017 — Play-test the browser experience.** Affected: manual verification record. Depends: T013–T016. Exercise zero/one/three runs, active-run request, loading while gameplay continues, failure, success, terminal reset, manual active reset, and narrow layout. Validation: record observed behavior and any limitation; no claim of automated browser coverage.
- [ ] **T018 — Document feature evidence and agent usage.** Affected: feature docs and repository documentation required by `AGENTS.md`. Depends: T016–T017. Record claims/signals/problems/hypotheses/minimum changes/checks/results/limitations in the owning evidence/eval docs as applicable, and significant agent calls in `docs/AI_USAGE_LOG.md`; never include secrets. Live validation is optional and excluded from `npm test`. Validation: docs agree with shipped behavior and preserve historical Week 3 records.

## API-path diagnosis follow-up (2026-09-28)

- [x] Compare direct REST Interactions and SDK `models.generateContent` with at most two minimal live calls, no retries, and diagnostic-only 30-second deadlines. Both returned HTTP 200 (8,153 ms and 18,361 ms respectively); no API switch or production timeout increase is justified by this single comparison.
- [x] Remove `generation_config.temperature`, which is absent from the installed Interactions schema, and disable SDK retries using request-level `retries: { strategy: "none" }`.
- [x] Verify the installed SDK with offline HTTP doubles: wire fields/output extraction, AbortSignal, one HTTP attempt per SDK call, and two maximum attempts through the Coach wrapper. `npm test` passed 55/55; typecheck and build passed.

## GenerateContent production migration

- [x] Replace production Interactions with SDK `models.generateContent`, `gemini-3.1-flash-lite`, the established system instruction, bounded run serialization, JSON response schema, and 512-token cap. Keep fake mode and public contracts unchanged.
- [x] Replace the old 7,000 ms per-attempt limit with a shared 15,000 ms monotonic operation deadline. At the original migration stage the maximum was two provider attempts with a 500 ms delay; Phase 7 below supersedes that with a three-call cap and centralized retry/fallback/repair. SDK retry options permit one HTTP request per SDK call.
- [x] Cover GenerateContent wire fields, runtime validation, pre-provider request rejection, malformed output, retry classes/count, shared deadline, and no retry after budget exhaustion with offline tests.
- [x] Run required offline checks, then perform one limited live production-path call and record safe metadata in eval/evidence/usage docs. Result: PASS at 2,593 ms, one attempt, runtime validation passed, `threat_management`, 531 input / 197 output / 728 total tokens. An earlier runner invocation stopped at local configuration validation and made no provider call.

## Required eval mapping

| Eval | Task coverage |
|---|---|
| A1 valid one-run request | T003, T011 |
| A2 valid three-run request | T003, T009, T011 |
| A3 zero completed runs; no provider call | T009 |
| A4 malformed request; provider call count 0 | T001, T010, T011 |
| A5 provider timeout/failure; safe message | T011–T013 |
| A6 malformed provider output rejected | T001, T003, T011 |
| A7 retryable failure remains within configured bound | T012 |
| A8 fourth completion evicts oldest | T006 |
| A9 active manual reset discards telemetry | T006 |
| A10 nonterminal life loss continues same run | T004, T006 |
| A11 active run excluded from Coach request | T009, T013 |

Keep implementation split across phases/prompts. Each task depends on the feature spec and technical plan; any material change to the lifecycle, request limits, endpoint, provider, or heuristic thresholds must update those artifacts before implementation proceeds.

## Phase 7 — Gemini reliability hardening (2026-09-29)

- [x] Add normalized provider failure classes and distinguish empty output, invalid JSON, schema rejection, semantic rejection, refusal, cancellation, and transport/API errors.
- [x] Centralize deadline-aware retry/backoff/fallback/repair policy: 15-second shared deadline, at most three generation calls, one transient retry per primary model, optional allowlisted fallback, and at most one same-model output repair.
- [x] Align Gemini JSON schema field names, enums, required/optional fields, and per-field bounds with the authoritative backend advice validator; enforce an 8 KiB parsed-text input cap without weakening validation.
- [x] Add backend-only `GEMINI_MODEL_CHAIN`; keep `gemini-3.1-flash-lite` primary and mark `gemini-3.5-flash-lite` as candidate-only until the full live Coach contract passes.
- [x] Record sanitized ordered per-attempt telemetry and final summary; propagate HTTP request cancellation into provider calls/backoff.
- [x] Add deterministic scripted-provider tests for transient retry, `Retry-After`, fallback, arbitrary/model-specific 404, output repair/classification, refusal, no-retry cases, deadlines, cancellation, and telemetry sanitization. No automated live Gemini call.
- [x] Record final local build/typecheck/test output in `docs/EVALS.md` and `docs/EVIDENCE_003.md`: 66 tests passed; typecheck, build, and diff check passed. No live call was made.
