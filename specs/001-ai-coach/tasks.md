# AI Coach implementation tasks

Implementation work is intentionally not part of this specification task. Execute these tasks in order through separate, reviewable prompts. Preserve gameplay rules and add no provider calls until the fake-provider boundary is validated.

## Phase 1 — Contracts and deterministic telemetry design

- [ ] **T001 — Define boundary contracts and limits.** Affected: frontend/backend contract code under `frontend/src/` and `backend/src/`. Depends: none. Define summary, per-target, representative-event, request, category, and response shapes from `plan.md`; add hand-written runtime validators and limits (runs 1–3, max 16 targets/run, max 8 events/run, 32 KiB request, response field limits). Validation: unit cases for valid min/max and malformed/missing/unknown/non-finite/oversized values.
- [ ] **T002 — Implement deterministic heuristic helpers.** Affected: proposed `frontend/src/coach-telemetry.ts` or similarly focused module. Depends: T001. Implement angle classification (20°), segment/platform obstruction, aim settle (<250 ms after >5° change), same-position (≤40 units; three consecutive failures), and range-expiry/budget facts. Validation: boundary-focused pure tests; no frame or pointer history uploads.
- [ ] **T003 — Establish fake provider and injectable boundary.** Affected: backend provider module and tests. Depends: T001. Add deterministic fake advice and provider interface without Gemini configuration. Validation: valid one-run and three-run contract tests; malformed fake output rejection; no network dependency.

## Phase 2 — Passive game telemetry and run lifecycle

- [ ] **T004 — Emit authoritative gameplay events.** Affected: `frontend/src/game.ts` and telemetry collector. Depends: T001–T003. Capture fire-time target/player/threat facts and actual bounce, capture, projectile termination, threat destruction/hit, life loss, and terminal outcome. Keep provider/network code out of game loop. Validation: telemetry-specific unit tests and unchanged existing gameplay behavior.
- [ ] **T005 — Add bounded collector and run summaries.** Affected: telemetry module and `game.ts` event seam. Depends: T004. Aggregate requested counters, target summaries and at most 8 selected/coalesced events; no full trajectories or raw coordinates in outgoing summaries. Validation: counters, target transitions, event cap, rounding, and summary validation tests.
- [ ] **T006 — Implement completion, reset, and history rules.** Affected: `frontend/src/game.ts`, `frontend/src/main.ts`, telemetry owner. Depends: T004–T005. Finalize once on `won`/`gameover`, preserve collector through nonterminal life loss, discard active-run telemetry on manual reset, retain terminal summary when reset starts a new run, and evict oldest beyond three. Validation: A8–A10 and terminal finalization exactly-once tests.
- [ ] **T007 — Verify no accidental gameplay regression.** Affected: tests/docs if needed. Depends: T004–T006. Confirm reset, life, projectile, capture, win, and game-over rules are unchanged. Validation: `npm run typecheck`, `npm test`; inspect the diff and current `docs/GAME_SPEC.md` alignment.

## Phase 3 — Coach UI with local request orchestration

- [ ] **T008 — Add AI Coach controls and accessible panel.** Affected: `frontend/index.html`, `frontend/styles.css`, `frontend/src/main.ts`. Depends: T006. Place button beside Reset Level; zero-history disabled/helper state; compact loading, success, and generic error states; mobile wrapping and focus visibility. Validation: manual browser layout and keyboard/focus inspection.
- [ ] **T009 — Serialize only completed history and prevent duplicate requests.** Affected: frontend request orchestration. Depends: T001, T006, T008. Snapshot 1–3 completed summaries at click, exclude current record, disable during request, leave gameplay running, update eligibility after completion. Validation: A3 and A11; zero-history/provider-call count remains zero.

## Phase 4 — Backend contract and fake-provider route

- [ ] **T010 — Add bounded HTTP request parsing and Coach route.** Affected: `backend/src/server.ts` and backend contract modules. Depends: T001, T003. Add `POST /api/ai/coach`, 32 KiB streaming body limit, JSON parsing, allowlisted CORS method/header update, stable validation/error/success envelopes, and pre-provider validation. Preserve `/api/health`. Validation: route tests for method/path/body size/validity; invalid request provider call count is exactly zero.
- [ ] **T011 — Add fake-provider success and safe failure coverage.** Affected: backend route/provider tests. Depends: T010. Cover one/three runs, malformed provider output, failure/timeout behavior and generic response. Validation: A1, A2, A4, A5, A6; tests use no live external service.
- [ ] **T012 — Add bounded transient retry.** Affected: backend provider orchestration/tests. Depends: T011. Enforce 15-second total deadline, maximum two attempts, 250 ms retry delay, and transient network/429/5xx-only retry; no retry on invalid input, programming errors, malformed output, or schema failures. Validation: A7 verifies attempt cap and non-retry classes; test timeout/cancellation behavior.
- [ ] **T013 — Exercise frontend/backend integration with fake provider.** Affected: frontend request module, backend tests, browser manual flow. Depends: T008–T012. Verify structured success rendering, stable safe failure display, no loading freeze, reset usability, and local CORS behavior. Validation: automated integration coverage where practical and manual browser flow; report each separately.

## Phase 5 — Backend-only Gemini adapter

- [ ] **T014 — Add Gemini adapter and backend environment configuration.** Affected: `backend/src/`, package manifest/lock only if an SDK is justified, and `.env.example` only with placeholders if needed. Depends: T010–T013. Keep key and SDK backend-only; choose smallest/cheapest model that meets structured output and grounding tests. Validation: build/typecheck; inspect frontend output/source for absence of provider credential/config; no secret committed.
- [ ] **T015 — Validate live-provider output and operational metadata.** Affected: provider adapter and backend logs. Depends: T014. Apply the same runtime response validator, cancellation/deadline, retry policy, and minimal provider/model/time/latency/result/attempt/token metadata. Never log prompts, raw runs/responses/errors, or secrets. Validation: fake tests remain default; limited intentional live check only when backend key is configured, with no key or payload captured in evidence.

## Phase 6 — End-to-end evaluation and evidence

- [ ] **T016 — Complete the W04 evaluation matrix.** Affected: tests and feature evidence. Depends: T001–T015. Cover A1–A11 from `plan.md` plus heuristic boundaries. Validation: `npm run typecheck`, `npm test`, `npm run build`, then `node scripts/check-reachability.mjs` after frontend build; record actual output.
- [ ] **T017 — Play-test the browser experience.** Affected: manual verification record. Depends: T013–T016. Exercise zero/one/three runs, active-run request, loading while gameplay continues, failure, success, terminal reset, manual active reset, and narrow layout. Validation: record observed behavior and any limitation; no claim of automated browser coverage.
- [ ] **T018 — Document feature evidence and agent usage.** Affected: feature docs and repository documentation required by `AGENTS.md`. Depends: T016–T017. Record claims/signals/problems/hypotheses/minimum changes/checks/results/limitations in the owning evidence/eval docs as applicable, and significant agent calls in `docs/AI_USAGE_LOG.md`; never include secrets. Validation: docs agree with shipped behavior and preserve historical Week 3 records.

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
