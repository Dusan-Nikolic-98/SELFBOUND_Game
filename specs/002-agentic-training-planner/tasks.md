# W05 AI Training Planner implementation tasks

Implementation status: all 35 W05 tasks are complete against the approved feature spec and plan.md.

## Phase 1 — Contracts and validators

- [x] **W05-T001 — Define backend contracts.** Files: new backend/src/training-plan-contract.ts. Depends: none. Define W05 run entry, minimal prior-plan/baseline, TrainingPlan/Draft, evidence, metrics, tool/proposal union, success/error envelope and exact bounds from plan.md. Add strict exact-key runtime validators and independent W04 summary validation. Test valid min/max and malformed, unknown, missing, non-finite, unsafe, oversized and inconsistent values.
- [x] **W05-T002 — Define browser contracts.** Files: new frontend/src/training-plan-contract.ts. Depends: T001. Mirror wire types and validators without importing backend modules; reject unexpected keys and use same byte/text/count/sequence limits. Test parity on valid and invalid fixture set.
- [x] **W05-T003 — Lock response evidence semantics.** Files: both W05 contract files; tests/training-plan.test.ts. Depends: T001-T002. Add semantic validators for response baseline consistency, literal completed, ascending sequence sets and evidence count bounds. Backend must not accept model-provided completed as authority. Test unsupported sequence/reference/focus/assessment and valid fixtures.

## Phase 2 — Page-session run identity/order

- [x] **W05-T004 — Implement bounded session ledger.** Files: new frontend/src/training-plan-session.ts; tests/training-plan.test.ts. Depends: T002. Create monotonic positive safe-integer sequence per terminal completed run; store {sequence,summary}, cap at three, clone summaries, evict oldest. Test identical summaries receive distinct IDs, strict order and fourth-run eviction.
- [x] **W05-T005 — Observe terminal completion without changing W04 data.** Files: frontend/src/main.ts, frontend/src/training-plan-session.ts; tests/training-plan.test.ts. Depends: T004. Observe playing-to-won/gameover once, pair newest completed summary, ignore repeated terminal frames and reset transitions. No changes to Coach contract/history behavior. Test won, game-over, reset, and repeated-frame exactly-once behavior.
- [x] **W05-T006 — Implement baseline state and gating.** Files: frontend/src/training-plan-session.ts; tests/training-plan.test.ts. Depends: T004. Retain only valid plan + baseline sequence list/max/metric; clear naturally on reload; gate after success until a sequence exceeds baseline max; leave failure retryable. Test first-plan eligibility, unchanged-history rejection, new-run eligibility and eviction with retained baseline.

## Phase 3 — Deterministic tools and evaluator

- [x] **W05-T007 — Implement normalized evidence tool.** Files: new backend/src/training-plan-tools.ts; backend/src/training-plan-contract.ts; tests/training-plan.test.ts. Depends: T001. Implement get_recent_run_evidence with only {limit:1|2|3}, context-bound ordered summaries, five normalized integer metrics, max three outputs and strict result validation. No I/O or mutation. Test deterministic selection, all metric derivations, bounds and invalid result rejection.
- [x] **W05-T008 — Implement focus aggregation.** Files: new backend/src/training-plan-evaluator.ts; tests/training-plan.test.ts. Depends: T001,T007. Implement threat, blocked-direct proxy, rushed-bounce, repeated-position and range opportunity/undesirable counts exactly as plan.md. Bounce requires consistent targetStats denominators; missing/inconsistent evidence is unavailable. Test synthetic cases, integer sums and boundary minima.
- [x] **W05-T009 — Implement previous-plan deterministic evaluation.** Files: backend/src/training-plan-evaluator.ts, backend/src/training-plan-contract.ts; tests/training-plan.test.ts. Depends: T006-T008. Check prior-state validity and newer sequences; compare saved baseline with only newer runs; use exact rational/BigInt cross-products; enforce focus minimum samples; return only three assessment outcomes. Test improved, not_improved, insufficient, no opportunity, zero denominator, eviction and no-newer cases.

## Phase 4 — Tool registry

- [x] **W05-T010 — Add exact tool registry and dispatch validation.** Files: backend/src/training-plan-tools.ts; tests/training-plan.test.ts. Depends: T007-T009. Register exactly the two approved names, exact argument validators, conditional evaluator availability and output validators. Unknown/invalid args never invoke a handler. Test call counts remain zero for unknown/invalid input.
- [x] **W05-T011 — Add repeated-action guard.** Files: backend/src/training-plan-tools.ts or new orchestrator helper in backend/src/training-plan-orchestrator.ts; tests/training-plan.test.ts. Depends: T010. Canonicalize validated args plus evidence state version; reject identical action before execution; permit distinct evidence limits within global tool budget. Test repeated evaluator/evidence and changed version.

## Phase 5 — Fake/scripted model-step scenarios

- [x] **W05-T012 — Define neutral provider and scripted fake.** Files: new backend/src/training-plan-provider.ts, backend/src/fake-training-plan-provider.ts; tests/training-plan.test.ts. Depends: T001. Define generateStep(input, signal, timeoutMs): Promise<unknown>, no SDK types/execution callback. Add deterministic first/later successful proposal sequences and test injection of malformed/unknown/transient/timeout/delayed results. Assert zero network use.
- [x] **W05-T013 — Build proposal fixtures.** Files: backend/src/fake-training-plan-provider.ts; tests/training-plan.test.ts. Depends: T007-T012. Ensure fake first plan calls recent evidence then final; later evaluated plan may call evaluator, evidence, final; all citations derive from tools. Add scripts for every required invalid proposal/tool/final case, without chain-of-thought fields.

## Phase 6 — Orchestrator/state machine

- [x] **W05-T014 — Implement legal state transitions.** Files: new backend/src/training-plan-orchestrator.ts; tests/training-plan.test.ts. Depends: T010-T013. Implement preflight, proposal validation, tool argument/execution/result validation, final validation and terminal reasons. Invalid proposal/args/results never flow onward. Test transitions and terminal stickiness.
- [x] **W05-T015 — Enforce step/tool/provider budgets.** Files: backend/src/training-plan-orchestrator.ts; tests/training-plan.test.ts. Depends: T014. Enforce 3 steps, 2 dispatched tool calls, 4 global provider attempts. Retry does not increment step; every provider generation counts; no action starts at exhausted budget. Test exact limit and over-limit refusal.
- [x] **W05-T016 — Enforce evidence grounding and final result.** Files: backend/src/training-plan-orchestrator.ts, backend/src/training-plan-contract.ts; tests/training-plan.test.ts. Depends: T014. Require recent evidence before success; deterministic assessment must match evaluator or be not_applicable; final evidence must exactly trace to validated tool outputs; backend sets completed only after validation and computes new baseline. Test invalid final never succeeds.
- [x] **W05-T017 — Enforce repeated-action terminal behavior.** Files: backend/src/training-plan-orchestrator.ts; tests/training-plan.test.ts. Depends: T011,T014. Integrate guard into legal transition path and classify as repeated_action without exceeding counters. Test same-action loop stops and no handler re-executes.

## Phase 7 — Reliability/deadline handling

- [x] **W05-T018 — Add monotonic deadline and per-call timeout.** Files: backend/src/training-plan-orchestrator.ts; tests/training-plan.test.ts. Depends: T015. Start 45 s run deadline; provider timeout min(15 s, remaining); cancellation signal; no new call after deadline; discard late results; clear timers/listeners. Use injected clock/timers and test boundary behavior.
- [x] **W05-T019 — Add transient retry policy.** Files: backend/src/training-plan-orchestrator.ts, backend/src/training-plan-provider.ts; tests/training-plan.test.ts. Depends: T018. At most one retry per step and four total attempts, only for approved transient classes. No timeout/invalid/auth/refusal/cancel retry; bounded cancellable backoff. Test policy matrix and global attempt exhaustion.
- [x] **W05-T020 — Add cancellation propagation.** Files: backend/src/training-plan-orchestrator.ts; tests/training-plan-backend.test.ts. Depends: T018-T019. Abort in-flight call and waits on request disconnect; terminal cancelled where observable; no later tool/provider call. Test disconnect and timer cleanup.

## Phase 8 — Backend route

- [x] **W05-T021 — Add W05 config/runtime/fake composition.** Files: new backend/src/training-plan-config.ts, backend/src/training-plan-runtime.ts, backend/src/fake-training-plan-provider.ts; tests/training-plan-backend.test.ts. Depends: T012,T014. Default to deterministic fake; keep W05 environment/credentials separate from AI Coach; never read secrets in fake mode. Test config defaults/errors and fake startup without key.
- [x] **W05-T022 — Add separate route and safe envelopes.** Files: backend/src/server.ts, W05 route modules if needed; tests/training-plan-backend.test.ts. Depends: T016,T020,T021. Add POST /api/training-plan, dedicated streaming 48 KiB parser and validation before provider call. If supplied valid previous state has no newer run, return 409 regeneration_not_eligible without provider call. Inject W04/W05 separately. Preserve /api/ai/coach route behavior and test invalid/ineligible requests call provider zero times.
- [x] **W05-T023 — Verify HTTP edge cases.** Files: tests/training-plan-backend.test.ts; backend/src/server.ts only if needed. Depends: T022. Cover content type, malformed JSON, body cap, method/path, stable error/status, safe failure, cancellation and no raw provider detail. Run only fake/script providers, no network outside local test server.

## Phase 9 — Frontend

- [x] **W05-T024 — Add bounded client.** Files: new frontend/src/training-plan-client.ts; tests/training-plan.test.ts. Depends: T002,T003. Validate request/size, reject duplicates, POST separate endpoint, validate envelope/response, return generic failures. Test pending guard and malformed success.
- [x] **W05-T025 — Add markup and accessible states.** Files: frontend/index.html, frontend/styles.css. Depends: T006. Add independent Training Plan action, no-history help, status/live region and structured plan panel; responsive layout/focus state consistent with existing UI. Keep Coach markup.
- [x] **W05-T026 — Wire session/client/UI.** Files: frontend/src/main.ts, frontend/src/training-plan-session.ts; tests/training-plan.test.ts. Depends: T005,T006,T024,T025. Wire explicit click only, no automatic calls, keep gameplay responsive, block in-flight duplicate, update successful baseline only after validation, gate unchanged history and preserve prior plan on failure. Keep AI Coach behavior independent.

## Phase 10 — Offline evals/tests

- [x] **W05-T027 — Complete deterministic core matrix.** Files: tests/training-plan.test.ts; package.json, tsconfig.test.json if needed. Depends: T007-T019,T024,T026. Cover first/later success, no runs, unchanged/new-run gating, invalid previous state, both tools and evaluator outcomes, opportunity absence, limits, repeated action, malformed proposal/result/final and evidence traceability. Ensure tests use zero external network.
- [x] **W05-T028 — Complete route and privacy matrix.** Files: tests/training-plan-backend.test.ts; backend modules if defects found. Depends: T020-T023,T027. Cover provider attempts globally, per-step retry, deadlines/timeouts, cancellation, safe errors/log sanitizer, invalid requests no provider call and no secrets/reasoning leakage.
- [x] **W05-T029 — Preserve test command coverage.** Files: package.json, tsconfig.test.json. Depends: T027-T028. Add new test entrypoints while retaining all existing W04/logic/gameplay files. Validate command compilation/path enumeration without dropping prior suites.

## Phase 11 — Gemini/model-step adapter

- [x] **W05-T030 — Implement optional adapter after fake-first.** Files: new backend/src/gemini-training-plan-provider.ts, backend/src/training-plan-config.ts, backend/src/training-plan-runtime.ts, tests/training-plan-gemini.test.ts, .env.example if required. Depends: T027-T029. Import @google/genai only in adapter; use GenerateContent JSON, no SDK tools/history, disable SDK retries, backend-only key and provider-neutral interface. Do not modify W04 Gemini modules.
- [x] **W05-T031 — Validate offline SDK reliability.** Files: tests/training-plan-gemini.test.ts; backend/src/gemini-training-plan-provider.ts if needed. Depends: T030. Script SDK doubles for output, abort signal, per-call cap, one HTTP request per call, classification, and no key/raw output leakage. No live Gemini in automated tests.

## Phase 12 — W04 regressions

- [x] **W05-T032 — Run and document W04 regression verification.** Files: tests/W04 suites as needed; docs/EVALS.md. Depends: T022,T026,T029,T031. Explicitly verify AI Coach public request/response and /api/ai/coach fake/Gemini adapter boundaries. Run npm run typecheck, npm test and npm run build; report actual output. Do not change W04 behavior to accommodate W05.

## Phase 13 — Docs/evidence

- [x] **W05-T033 — Record feature evidence and usage.** Files: docs/CONTEXT_MANIFEST.md, docs/EVALS.md, docs/AI_USAGE_LOG.md, docs/EVIDENCE_003.md only for an actual defect/change. Depends: T027-T032. Add actual shipped architecture, eval observations, agent call phase/why/expected/actual/next decision; no secrets or chain-of-thought. Keep EVALS consistent with evidence.
- [x] **W05-T034 — Update user/setup docs only when needed.** Files: README.md, AGENTS.md, .env.example only if actual instructions/config need them. Depends: T030,T033. Document supported W05 setup/provider setting and repository boundaries without changing game spec or W04 guidance. Verify examples contain placeholders only.
- [x] **W05-T035 — Final implementation handoff checks.** Files: planned W05 artifacts/source/docs. Depends: T033-T034. Run typecheck, npm test, build, reachability after frontend build, git diff --check; verify scope, paths, no secrets, no persistence, no gameplay mutation, no W04 contract drift. Record actual results and limitations.

## Required eval mapping

| Required scenario | Task/test coverage |
|---|---|
| First plan success; later plan success | T012-T016, T027 |
| No completed runs; no request/provider call | T006,T026-T028 |
| Unchanged history cannot regenerate | T006,T022,T026-T028 |
| New run enables update; evaluator eligible | T006,T009,T026-T027 |
| Invalid previous-plan state rejected | T001-T003,T009,T027 |
| Unknown tool / invalid args never executed | T010,T014,T027 |
| Malformed model proposal rejected | T012-T014,T027 |
| Invalid deterministic tool output rejected | T007,T010,T014,T027 |
| Repeated action rejected | T011,T017,T027 |
| Agent-step limit enforced | T015,T027 |
| Tool-call limit enforced | T015,T027 |
| Provider-attempt limit enforced globally | T015,T019,T028 |
| At most one transient retry per step | T019,T028 |
| No call after deadline; per-call <=15 s; run <=45 s | T018,T028 |
| Invalid final cannot become success | T016,T027 |
| Evidence traceability | T003,T016,T027 |
| improved / not_improved / insufficient_evidence | T008-T009,T027 |
| No opportunity is not improvement | T009,T027 |
| Request disconnect/cancellation | T020,T023,T028 |
| Fake/offline tests have zero external network | T012-T013,T023,T027-T031 |
| W04 /api/ai/coach regression and fake provider | T022,T029,T032 |
| W04 Gemini boundary regression | T030-T032 |
| No SDK dependency from orchestrator | T014,T030,T031 |
| No secret/chain-of-thought leakage | T016,T028,T031,T033 |

Do not mark implementation tasks complete during Phase A. Production tests are not run as evidence for behavior that does not yet exist.
