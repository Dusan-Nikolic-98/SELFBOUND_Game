# W05 AI Training Planner implementation plan

Phase A artifact for specs/002-agentic-training-planner/spec.md. Planning only; no production behavior is authorized here.

## 1. Feature boundary and non-goals

One explicit player click starts one bounded logical Agent Run with the fixed goal in the approved spec. The model proposes a tool call or final structured plan; backend orchestration alone validates and executes. Core has exactly two deterministic, local, read-only tools. There is no prompt entry, gameplay action, active-run analysis, persistence, agent framework, generic tool, or AI Coach change. No chain-of-thought is accepted, stored, logged, returned or rendered.

## 2. Current repository architecture

- frontend/src/game.ts owns canonical gameplay and lifecycle. It uses CoachRunHistory in frontend/src/coach-telemetry.ts; terminal summaries are retained in a three-item page-memory history. Life loss before Game Over remains the same run; manual reset discards active telemetry.
- frontend/src/coach-telemetry.ts creates bounded W04 CompletedRunSummary. frontend/src/ai-coach-contract.ts, ai-coach-client.ts and main.ts validate/send/render the Coach interaction. frontend/index.html and styles.css hold its markup and styling.
- backend/src/server.ts provides /api/health and /api/ai/coach, bounded body parsing, CORS, validation and safe envelopes. backend/src/ai-coach-contract.ts independently validates API data. Backend is stateless.
- backend/src/ai-coach-provider.ts owns Coach provider/fake; ai-coach-runtime.ts and ai-coach-config.ts compose fake-default/optional Gemini; gemini-ai-coach-provider.ts imports @google/genai and owns GenerateContent, Coach output schema, retry/repair/deadline/cancellation and sanitized logging; ai-coach-prompt.ts owns Coach text/serialization.
- Frontend/backend are separate TypeScript targets, with no shared runtime package. Tests use node:test, tsconfig.test.json and explicit npm test paths: logic, gameplay, ai-coach, ai-coach-backend, ai-coach-gemini. There is no browser automation.
- Existing signals: shotsWhileThreatActive, offensiveShotsWhileThreatActive, blockedDirectAttempts, bouncedAttempts, successfulBounceCaptures, rushedBouncedFailures, repeatedSamePositionFailures, rangeExpiredShots, shotsFired, failedShots, and target-level attempts/blockedDirectAttempts. Events include ignored_threat, blocked_direct, rushed_bounce, same_position and range_expired. Aim, obstruction, and position are qualified heuristics. Crucially no telemetry links one blocked direct attempt to a later successful bounce capture.

## 3. W04/W05 separation

Do not change /api/ai/coach, its contracts, UI, provider behavior, prompt, fake or Gemini configuration. W05 has /api/training-plan and W05-prefixed modules. Wrap cloned summaries with W05 sequence metadata; do not add fields to W04 CompletedRunSummary. Avoid shared runtime imports across browser/server. Duplicate small validators where required to preserve the boundary. W04 Gemini classes are Coach-specific, not an agent model-step interface.

## 4. Proposed W05 data flow

Game finalizes a summary as today. main.ts observes the single transition from playing to won/gameover and adds the newest summary to the W05 page-session ledger. The button is enabled only for valid history, no pending request, and (after success) a newer sequence than the saved baseline. Click snapshots 1..3 entries and optional prior plan, validates and posts without pausing gameplay. Backend validates before provider work, starts a bounded run, and invokes a provider-neutral model step. Orchestrator validates proposal/state/budget/tool/args/repetition before dispatch; validates tool result before next model context. Final result must validate and cite normalized output from this run. Backend returns plan plus computed baseline. Frontend validates, stores in memory and renders. Failure preserves last valid plan and shows generic status.

## 5. Page-session run identity/order design

W05-specific sequence is a monotonic safe integer starting at 1 per page load. Entry shape is exactly { sequence, summary }. Add frontend/src/training-plan-session.ts. main.ts tracks prior Game.status and records the just-finalized newest CoachRunHistory summary on each playing-to-won/gameover transition. This avoids matching identical summaries and changes no W04 contract. Terminal status lasts until reset, so every later completed run has another transition. Ledger keeps at most three entries and evicts oldest in lockstep with W04.

Ordering is strict ascending sequence, not timestamp. Request sends one to three W05 entries. Backend rejects non-positive/unsafe, duplicate, descending or excessive sequences. These are untrusted ordering claims, not authenticated IDs; there is no crypto identity or backend session. If a valid previousPlan is supplied and no current sequence exceeds its baseline maximum, the backend rejects with 409 regeneration_not_eligible before provider invocation. The compliant frontend always sends its previous state.

After success, frontend retains only { plan, baseline }, where baseline is { runSequences, maxSequence, primaryFocusMetric }. It stores no prior raw summaries, prompt, tool transcript or model output beyond the public plan. Metric is { opportunities, undesirable }, both safe integers, undesirable <= opportunities. Zero opportunities are valid recorded evidence (undesirable must also be zero) but are never sufficient for evaluation. Backend validates previous plan, focus, sequence order/list <=3, max equals last sequence, and metric bounds on every request. It cannot authenticate browser memory.

Evaluation is eligible only if previous state validates and current request contains a sequence > baseline.maxSequence. Newer runs are current request entries above that maximum. The saved baseline aggregate remains usable after W04 evicts one or more source summaries; compare it only with newer currently supplied runs. No old run is inferred or reconstructed. Baseline list and evidence remain bounded. Reload clears ledger and previous plan; no previous evaluation is eligible. After success with unchanged history, no sequence is newer, so regeneration is disabled/rejected. A newly completed run enables one success; next success advances baseline max.

## 6. Previous-plan session state

Exact minimal shape: PreviousTrainingPlanState = { plan: TrainingPlan, baseline: { runSequences: number[], maxSequence: number, primaryFocusMetric: FocusMetric } }. Focus is in plan.primaryFocus. Zero-opportunity baseline is valid but guarantees insufficient_evidence for that side. Backend recomputes the new baseline from current request summaries for the returned plan's focus. Frontend replaces saved state only on fully valid success; failure preserves it and leaves the current sequence version retryable.

## 7. Exact request/response contracts

Independent frontend/src/training-plan-contract.ts and backend/src/training-plan-contract.ts validators; no cross-target runtime import.

Request: { runs: W05RunEntry[1..3], previousPlan?: PreviousTrainingPlanState }. W05RunEntry contains only sequence and the existing exact W04 summary. Maximum UTF-8 body is 48 KiB; enforce while streaming before parse. Require JSON content type; reject unknown keys, malformed JSON, invalid W04 counters/events, wrong arrays, non-finite or unsafe values before provider invocation.

TrainingPlan exact fields: summary (1..240 chars), previousAssessment (not_applicable|improved|not_improved|insufficient_evidence), primaryFocus (threat_management|bounce_strategy|aim_timing|positioning|range_management), practiceGoal (1..240 chars), evidence (1..4), confidence (low|medium|high), completed (literal true set by backend only). Each evidence item is { source:"recent_run_evidence"|"previous_plan_evaluation", metric:FocusMetricId, runSequences:number[], opportunities:safe integer, undesirable:safe integer }. Counts obey 0 <= undesirable <= opportunities. Sequences are ascending nonempty subsets of current or saved baseline IDs as applicable. Each claim must match validated tool output. If evaluator ran, previousAssessment must exactly match its result; if it did not, it must be not_applicable. Final output bytes <=8 KiB.

FocusMetricId: threat_offensive_rate, blocked_direct_rate, rushed_bounce_failure_rate, repeated_same_position_rate, range_expiry_rate. Do not round rates; compare integer fractions.

Success response: { plan: TrainingPlan, baseline: { runSequences, maxSequence, primaryFocusMetric } }, computed by backend for all current request runs. Errors: 400 {ok:false,error:"invalid_request"}, 413 same code for overflow, 409 {ok:false,error:"regeneration_not_eligible"} when a supplied valid prior baseline has no newer run, and 503 {ok:false,error:"training_plan_unavailable"}. Cancellation may be silent on disconnected socket; never reveal internal terminal reasons.

## 8. Agent proposal contracts

Treat provider output as unknown. Proposal union:
- { kind:"tool_call", tool:"get_recent_run_evidence"|"evaluate_previous_training_plan", arguments: exact tool-specific object }
- { kind:"final", result: TrainingPlanDraft } where Draft has the plan fields except completed.

No free text reasoning or extra keys. Reject malformed JSON, shape, bounds, enum, unknown tool or unsupported evidence before execution. Model cannot supply/replace summaries or baseline. Evidence references must identify exact normalized tool metric/counts/sequences. Invalid proposal never executes a tool. Provider output maximum 8 KiB.

## 9. Deterministic tool contracts

get_recent_run_evidence arguments are exactly {limit:1|2|3}; it selects latest N from backend-held validated request context. It accepts no summaries, IDs, offsets or source. Output is {kind:"recent_run_evidence",runs:[{sequence,outcome,metrics:[FocusMetric]}]}; max three runs/five metrics each. No events, geometry, free text or active state. Each metric contains id, opportunities, undesirable. Validate membership, exact keys and count bounds before forwarding.

evaluate_previous_training_plan arguments are exactly {}. Offer only when saved plan/baseline are valid and at least one current entry is newer. It reads backend-validated context, never model-supplied copies. Output is {kind:"previous_plan_evaluation",assessment,focus,metricId,baseline:{opportunities,undesirable},newer:{runSequences,opportunities,undesirable}}. Assessment is exactly improved|not_improved|insufficient_evidence. Validate before forwarding. Both tools are pure, deterministic, synchronous, bounded and have no I/O, persistence, mutation, random or clock access. Invalid output terminates invalid_tool_result and is not forwarded.

## 10. Tool registry and execution authority

backend/src/training-plan-tools.ts owns only the two allowlisted handlers and validates args/output. backend/src/training-plan-orchestrator.ts is the only dispatcher. It checks current state, availability, budgets and repetition before dispatch. Tool receives immutable validated request context, never Game or mutable global state. Unknown name and invalid args never dispatch.

Repeated identity is tool name + canonical JSON of validated args + relevant state version. Recent-evidence version is ordered sequence set; evaluator version is baseline max plus newer sequences/focus. Same tuple is rejected as repeated_action before dispatch. Different evidence limit is a distinct action but still uses a tool slot. Evaluator is offered at most once for a version.

## 11. Focus-to-metric mapping and evaluator formulas

Pool integer opportunities and undesirable counts. For baseline (bU,bO) and newer (nU,nO), use BigInt cross multiplication if needed: compare nU*bO to bU*nO without rounding. Strictly lower newer rate is improved; equal or higher is not_improved. If either side is zero or below its minimum sample, return insufficient_evidence. A zero undesirable count with valid opportunities is data, not missing opportunity. An absent opportunity is never improvement. Newer aggregation includes only sequences > baseline max.

| Focus | Existing opportunity / undesirable fields | Rate | Minimum per side | Rule and limitation |
|---|---|---|---|---|
| threat_management | shotsWhileThreatActive / offensiveShotsWhileThreatActive | undesirable / opportunity | 2 active-threat shots | Lower improves; equal/higher not_improved. Offensive means target-aligned while threat existed; no intent inference. |
| bounce_strategy | Sum targetStats.attempts / targetStats.blockedDirectAttempts | blocked / target attempts | 3 target attempts | Lower improves; equal/higher not_improved. Only blocked-direct-aim proxy; never claim a viable or successful bounce route. If target denominator absent/inconsistent, insufficient. |
| aim_timing | bouncedAttempts / rushedBouncedFailures | rushed / bounced | 2 bounced attempts | Lower improves; tie/higher not_improved. Rushed is W04 <250 ms heuristic, not intent. |
| positioning | failedShots / repeatedSamePositionFailures | repeated / failed | 3 failures | Lower improves; tie/higher not_improved. Same-position signal is <=40 units and streak-based; not proof movement caused success. |
| range_management | shotsFired / rangeExpiredShots | expired / fired | 3 shots | Lower improves; tie/higher not_improved. Expiry is actual budget exhaustion; all fired shots are conservative opportunities. |

Bounce denominator uses summed targetStats.attempts; numerator targetStats.blockedDirectAttempts. If target summaries are absent, denominator is unavailable (do not guess); if present, cross-check blocked sum against run-level counter and make metric unavailable on mismatch. Do not infer attempts from representative events. Baseline for a new plan aggregates every request entry. Prior comparison uses saved prior-focus baseline versus only newer entries. Evaluator supports only the prior primary focus; other metrics are not compared. These are proxy changes, not evidence of skill, intent or causation.

## 12. Orchestrator/state machine

States: preflight -> running(step 1..3) -> proposal_validating -> tool_validating -> tool_executing -> tool_result_validating -> running, or final_validating -> succeeded(goal_completed). Any state can end in one terminal classification: invalid_input, invalid_model_proposal, unknown_tool, invalid_tool_arguments, invalid_tool_result, provider_failed, provider_timeout, tool_failed, step_limit, tool_call_limit, provider_attempt_limit, deadline, repeated_action, invalid_final_result, or cancelled when supported. No transitions leave terminal state.

Successful first flow: recent evidence then final (2 steps/1 tool). Later evaluated flow: evaluator, recent evidence, final (3/2). Require recent evidence before success so every final claim has a traceable tool result. Evaluator can be skipped; then assessment is not_applicable and no previous comparison claim is accepted. Backend alone sets completed=true after semantic validation.

## 13. Step/tool/provider counters

Per logical run: maxAgentSteps=3, maxToolCalls=2, maxProviderAttempts=4. Increment step once before each new proposal. Retries stay within that step. Increment provider attempt before every generation including retries. Count tool calls only when valid allowlisted proposals are dispatched; invalid/unknown proposals never execute. Stop before starting any operation if its budget is exhausted. No fallback in Core; any future fallback consumes global provider attempt budget and requires spec decision. Counters never appear in player result.

## 14. 45-second deadline and 15-second provider timeout

Start monotonic clock at Agent Run creation; deadline=start+45,000 ms. Before each call set timeout to min(15,000, remaining). Never start if no positive time. Pass AbortSignal, abort at per-call timeout and classify provider_timeout. Overall deadline aborts in-flight work and backoff at 45 s; check before/after synchronous tool calls and reject late output. Clean timers/listeners in finally; measure with performance.now(). Request body parsing precedes Agent Run and uses its own 48 KiB cap. A provider ignoring abort may continue remotely, but local run terminates and discards late output.

## 15. Retry/failure policy

One retry maximum for an individual step, max four total provider attempts. Retry only normalized transient network, rate-limit or service/server failures when connected, budget remains and enough deadline remains. Timeout is terminal; invalid output/proposal, refusal, auth/config, bad request, cancellation and unknown error are not retried. Retry remains same agent step and consumes a global attempt. Optional backoff is bounded to 0..500 ms and checks cancellation/deadline/budget. No fallback in Core. Safe 503 on provider failure.

## 16. Repeated-action protection

Canonicalize exact validated argument keys and JSON. Identity = tool + canonical args + state version. Recent evidence version is current ordered sequences; evaluation version is baseline max + newer sequences + focus. Reject same identity before handler as repeated_action. Output does not alter version. Different limit can be a new action, still bounded by two tool calls.

## 17. Provider-neutral model-step boundary

backend/src/training-plan-provider.ts defines TrainingPlanModelStepProvider.generateStep(input, signal, timeoutMs): Promise<unknown>. Input is fixed instruction, bounded request context, prior normalized tool results and step number. No SDK/provider types or execution callback. backend/src/training-plan-orchestrator.ts depends on this interface only. Compose via backend/src/training-plan-runtime.ts independently of AI Coach.

## 18. Fake/scripted provider

backend/src/fake-training-plan-provider.ts provides deterministic valid first/later step sequences and supports injected test scripts returning arbitrary unknown proposals, transient/timeout errors or delays. It is offline and deterministic. Tests can inspect bounded context and exact call counts. It must not access network.

## 19. Gemini adapter and reuse decision

Do not reuse/refactor backend/src/gemini-ai-coach-provider.ts; it couples Coach schema, prompt, errors and reliability. Direct reuse risks W04 behavior and binds W05 to a Coach-specific interface. Preserve W04 modules unchanged. After fake-first is green, add backend/src/gemini-training-plan-provider.ts implementing the neutral interface and importing @google/genai only there. Use GenerateContent JSON output, W05 schema, no SDK tools/history, no chain-of-thought request, 8 KiB cap and one SDK request per call (SDK retries disabled). Orchestrator owns W05 per-call 15 s, total 45 s, cancellation, one eligible retry/step and four attempts. Reuse general reliability principles only, with W05-specific policy and sanitizer. Test using SDK HTTP doubles, never live in npm test.

## 20. Backend route integration

Add separate /api/training-plan handler in backend/src/server.ts. Leave existing Coach branch, body parser limits, envelopes and provider untouched. W05 has own 48 KiB streaming cap, JSON content type, validation before provider, disconnect/close cancellation and stable safe errors. Inject W04 and W05 providers independently. No backend session state.

## 21. Frontend UI/client/session

Add frontend/src/training-plan-client.ts and training-plan-contract.ts. Add frontend/src/training-plan-session.ts for sequence ledger, completion observation support, previous state, snapshot and gating. Modify frontend/src/main.ts to observe terminal transition, maintain W05 click flow, validate both directions, prevent duplicate calls and update state only on valid success. Update frontend/index.html and styles.css with separate button, help, status and structured result. Keep gameplay responsive and Coach independent. All state is memory-only.

## 22. Runtime validation

Independent hand-written W05 browser/backend validators: exact keys, 1..3 runs, body/output bytes, sequence order/safety, nested W04 target/event bounds and count consistency, previous state/list/metric consistency, allowlisted tool/focus/assessment names, exact tool args/output, legal state/budget, final evidence grounding and evaluator match. Validate frontend success response. Provider schema is not runtime validation; no type-only trust.

## 23. Error envelopes and safe failures

400 invalid_request for invalid content/type/JSON/shape, 413 invalid_request for over-limit. 503 training_plan_unavailable for provider, tool, proposal, final, deadline, budget or repetition failure. On disconnected request, stop and classify cancellation internally without writing. Frontend displays generic stopped/unavailable status and retains prior plan. Never expose raw provider text, prompts, tool state, stack or internal stop reason.

## 24. Logging, privacy and reasoning

Sanitized W05 start/step/end records: server run ID, status, step number, provider attempt number, provider/model category where safe, dispatched tool count, safe tool name, success/failure class, elapsed/remaining time, timeout/deadline status, terminal classification and bounded integer input/output token counts when supplied by the provider. Do not log run summaries/sequences, tool args/results, plan/evidence text, prompt/context, raw output, chain-of-thought, headers, secrets, raw errors or stack. Bound record count; one terminal summary and safe attempt records. No model/player internals to browser.

## 25. Test/eval strategy

Use node:test, synthetic W04 summaries, deterministic clocks/timers, fake/scripted providers and local HTTP server. Tests remain offline. Add frontend session/client and backend contracts/tools/evaluator/orchestrator/route cases. W05 Gemini tests use injected SDK doubles after adapter. Explicitly preserve/run all W04 suites and inspect W04 route/fake/Gemini behavior. This Phase A documentation does not test unimplemented production behavior.

## 26. Exact file map

### Reused unchanged
docs/GAME_SPEC.md; specs/001-ai-coach/spec.md, plan.md, tasks.md; frontend/src/ai-coach-contract.ts, ai-coach-client.ts, coach-telemetry.ts and gameplay/lifecycle in game.ts; backend/src/ai-coach-contract.ts, ai-coach-provider.ts, ai-coach-runtime.ts, ai-coach-config.ts, gemini-ai-coach-provider.ts, ai-coach-prompt.ts; current logic/gameplay/W04 tests.

### Modified in Phase B
- frontend/src/main.ts: status observation, separate W05 UI/client flow.
- frontend/index.html and frontend/styles.css: W05 control and accessible panel.
- backend/src/server.ts: distinct W05 route, composition and cancellation; preserve Coach branch.
- package.json: add W05 test files to explicit npm test list.
- tsconfig.test.json: update only if current file list/include requires it.
- docs/CONTEXT_MANIFEST.md, docs/EVALS.md, docs/AI_USAGE_LOG.md: actual shipped feature context/evidence/usage.
- docs/EVIDENCE_003.md: only if a defect or controlled change is documented.
- README.md: only if actual setup/config instructions change.
- AGENTS.md: only if shipped commands/boundaries make guidance materially wrong.

### New in Phase B
- frontend/src/training-plan-contract.ts: browser types/validators.
- frontend/src/training-plan-client.ts: separate POST client.
- frontend/src/training-plan-session.ts: memory ledger, prior state, gating.
- backend/src/training-plan-contract.ts: independent backend types/validators.
- backend/src/training-plan-tools.ts: exactly two handlers/registry and output validation.
- backend/src/training-plan-evaluator.ts: metric aggregation/comparison.
- backend/src/training-plan-orchestrator.ts: state, authority, counters, repetition, terminal outcomes.
- backend/src/training-plan-provider.ts: provider-neutral step interface.
- backend/src/training-plan-prompt.ts: fixed instruction and bounded serialization.
- backend/src/fake-training-plan-provider.ts: deterministic default/script provider.
- backend/src/training-plan-config.ts: W05-only provider settings.
- backend/src/training-plan-runtime.ts: W05 composition independent of Coach.
- backend/src/gemini-training-plan-provider.ts: optional adapter, deferred until fake-first passes.
- tests/training-plan.test.ts: contracts/session/tools/evaluator/orchestrator.
- tests/training-plan-backend.test.ts: route and fake integration.
- tests/training-plan-gemini.test.ts: offline adapter/config/reliability.
- .env.example only if W05 credential setting is finalized; placeholder only.

## 27. Compatibility and W04 regression

Do not change W04 implementation or public behavior. New route dispatch is separate. Run current W04 tests and verify /api/ai/coach contracts, fake behavior and Gemini adapter boundaries. W05 orchestrator has no @google/genai import. Test script changes retain every existing suite.

## 28. Implementation sequencing

Follow tasks.md in order: contracts, identity, tools/evaluator, registry, scripts, orchestrator, reliability, route, UI, offline evals, W04 regressions, optional Gemini adapter only after fake-first, docs/evidence. A conflict with approved spec stops implementation for a planning decision; do not expand feature.

## 29. Risks, limitations and blockers

- Three-run history and heuristic telemetry are weak samples. Improvement means only change in a defined proxy rate, not skill, intent or causation.
- Bounce signals do not link blocked attempts to successful captures. blocked_direct_rate is only a proxy; no bounce-path claim is allowed. Missing/inconsistent target denominator yields insufficient_evidence.
- Browser sequence/prior state is untrusted and unauthenticated. Tight validation bounds it but cannot prove history; backend sessions are explicitly out of scope.
- W04 eviction removes old summaries; retained aggregate/list supports comparison but not reconstruction.
- A stateless backend cannot prove that a caller omitted previousPlan after an earlier success. The supported frontend always sends retained state and gates correctly; preventing a modified client from omitting it would require persistence/session identity forbidden by the spec. The UI flow is bounded but not tamper-proof against custom callers.
- Terminal status observation in main.ts must be exactly once around reset/game-over.
- Gemini output is probabilistic; offline tests establish policy rather than live recommendation quality.
- No planning blocker remains. Endpoint, contracts, run identity and formulas were explicit planning decisions left open by the approved spec and are resolved above.
