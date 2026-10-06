# W05 Core Tool Contracts

The approved feature contract is in [`spec.md`](../specs/002-agentic-training-planner/spec.md); exact formulas and planning decisions are in [`plan.md`](../specs/002-agentic-training-planner/plan.md). This file records the two tools implemented by the Core registry, `backend/src/training-plan-tools.ts`.

## Explicit allowlist and execution authority

The only Core application tool names are:

```text
get_recent_run_evidence
evaluate_previous_training_plan
```

The model cannot add or execute a tool. It returns a proposal; the backend orchestrator validates the proposal, allowlist membership, arguments, current context/availability, repeated-action identity, and remaining budget before dispatch. Unknown tools and invalid arguments are rejected before handler execution. The frontend is not the authorization boundary; `TrainingPlanOrchestrator` and `TrainingPlanToolRegistry` own execution permission. There is no generic filesystem, shell, browser, URL, or network tool.

Evidence: `tests/training-plan.test.ts` test **“unknown tools, invalid arguments, malformed proposals, and malformed final evidence never succeed”** asserts `toolCalls === 0` for unknown names, invalid arguments, and malformed proposals. The test **“tool registry rejects unknown, invalid, unavailable, and repeated actions before execution”** verifies invalid/unknown/unavailable registry requests do not invoke its injected handlers. The dispatch counter is incremented only in the registry's dispatch callback.

## `get_recent_run_evidence`

| Field | Implemented contract |
| --- | --- |
| **Name** | `get_recent_run_evidence` |
| **Purpose** | Convert only the current request's already validated completed-run summaries into bounded normalized telemetry evidence. |
| **Mode** | Read only; deterministic; local. |
| **Input schema** | Exact object `{ limit: 1 | 2 | 3 }`. No extra keys. |
| **Input validation/bounds** | `limit` must be an integer literal 1, 2, or 3 and cannot exceed the count of validated runs in the current request. The request itself contains 1–3 strictly ascending positive safe-integer sequences and validated W04 summaries. The tool selects the latest N entries. |
| **Output schema** | Exact object `{ kind: "recent_run_evidence", runs: [{ sequence, outcome, metrics: [{ id, opportunities, undesirable }] }] }`. `outcome` is `level_complete` or `game_over`. Every run has exactly one item for each of the five metric IDs below. Counts are non-negative safe integers and `undesirable <= opportunities`. |
| **Output validation/bounds** | Exact keys, valid outcomes, unique complete metric-ID set, ascending sequences belonging to current request, and count constraints are checked. The registry also recomputes the expected result from the validated request and requires exact equality. |
| **Allowed caller** | A proposal may name it only through the W05 provider step. Only `TrainingPlanOrchestrator` may dispatch it through `TrainingPlanToolRegistry`. |
| **Authorization / execution scope** | Reads a cloned/frozen, backend-held context for the current logical Agent Run. The model supplies only `limit`; it does not supply summaries, arbitrary IDs, offsets, paths, URLs, or external resources. |
| **Availability / preconditions** | The HTTP request must pass strict validation and contain 1–3 completed summaries. The tool is in the allowlist for every valid run request. An empty-history request is rejected before provider/tool execution. |
| **Timeout / execution-time policy** | Synchronous and deterministic; no independent asynchronous tool timeout is implemented. The orchestrator checks the remaining Agent Run deadline before and after the call. Synchronous code cannot be interrupted mid-call. |
| **Maximum result size / structural bound** | At most 3 runs × 5 fixed metrics per run, with fixed enum/string fields and integer counts; no event arrays or free-text payload. There is no separate tool-result byte limit. The W05 model proposal/final output is capped at 8 KiB. |
| **Failure behavior** | Invalid arguments fail before dispatch and do not increment `toolCallCount`. Missing request context cannot reach a valid Agent Run; invalid/unknown proposals terminate before the handler. A result that fails validation terminates as `invalid_tool_result` and is not passed to another model step; the dispatched call remains counted. A repeated equivalent call terminates as `repeated_action` before dispatch and does not add a tool call. A handler exception after dispatch is counted and becomes `tool_failed`. |
| **Forbidden behavior / Must NOT** | No network, filesystem, persistence, secrets, arbitrary raw state, active/unfinished run, gameplay mutation, model-supplied run body, or write side effect. |
| **Evidence role** | Provides the bounded telemetry facts from which the final plan's evidence must be copied and grounded. It is required before any successful final result. |
| **Relevant implementation file** | `backend/src/training-plan-tools.ts`; metric derivation/normalization is in `backend/src/training-plan-evaluator.ts`; runtime schema is in `backend/src/training-plan-contract.ts`. |
| **Relevant tests** | `tests/training-plan.test.ts`: **“evidence tool is deterministic, selects latest runs, validates limit against available context, and rejects bad output”**; **“tool registry rejects unknown, invalid, unavailable, and repeated actions before execution”**; **“invalid tool output never reaches the next model step and dispatched calls are counted”**. |

### Normalized metric meanings

| Metric ID | Opportunities | Undesirable count | Meaning and limit |
| --- | --- | --- | --- |
| `threat_offensive_rate` | `shotsWhileThreatActive` | `offensiveShotsWhileThreatActive` | Target-aligned offensive shots while a green threat existed; does not establish intent. |
| `blocked_direct_rate` | Sum of `targetStats[].attempts` | Sum of `targetStats[].blockedDirectAttempts` | Blocked direct-aim proxy. Target stats must exist; blocked sum must equal the run-level `blockedDirectAttempts` and not exceed attempts. This does not prove a viable bounce path. If denominator evidence is absent/inconsistent, the normalized tool result carries `0/0`; it has no separate availability flag. The evaluator retains availability internally and will not treat unavailable evidence as improvement. |
| `rushed_bounce_failure_rate` | `bouncedAttempts` | `rushedBouncedFailures` | Rushed bounced-failure proxy using W04's settle-time heuristic; it does not establish player intent. |
| `repeated_same_position_rate` | `failedShots` | `repeatedSamePositionFailures` | Repeated failure from a similar position; not proof that repositioning caused a later success. |
| `range_expiry_rate` | `shotsFired` | `rangeExpiredShots` | Fraction of fired shots that expired at their range budget. |

The result always contains the same five metric entries. Unavailable bounce denominator evidence is represented as zero counts rather than a separate availability property; consumers must not interpret that encoding as proof that the player had no blocked-direct attempts.

## `evaluate_previous_training_plan`

| Field | Implemented contract |
| --- | --- |
| **Name** | `evaluate_previous_training_plan` |
| **Purpose** | Deterministically assess the previous Training Plan's single primary focus using its saved validated baseline and newer completed runs. |
| **Mode** | Read only; deterministic; local evaluator. |
| **Input schema** | Exact empty object `{}`. No extra keys. The model cannot supply baseline counts, run sequences, or completed-run bodies. |
| **Input validation/bounds** | Exact empty-key validation. Availability and all evidence are resolved from the current request's backend-validated context, not model-provided copies. |
| **Output schema** | Exact object `{ kind: "previous_plan_evaluation", assessment, focus, metricId, baseline: { opportunities, undesirable }, newer: { runSequences, opportunities, undesirable } }`. `assessment` is exactly `improved`, `not_improved`, or `insufficient_evidence`. The focus/metric pair must match the saved plan's primary focus. |
| **Output validation/bounds** | Exact keys and enums, valid focus-to-metric mapping, safe non-negative counts with undesirable no greater than opportunities, and at most 3 ascending newer sequences are validated. The registry recomputes the evaluator output and requires exact equality. |
| **Allowed caller** | The model may propose it only when the orchestrator exposes it. Only the W05 orchestrator/registry dispatches it. |
| **Authorization / execution scope** | The evaluator reads the validated prior plan/baseline and current request context captured for this run. It can compare only the saved prior focus with entries whose sequence exceeds the saved `maxSequence`. |
| **Availability / preconditions** | The request includes a valid previous Training Plan; its baseline identity, sequence list and metric counts validate; its primary focus is supported; and at least one current completed run is newer than the baseline. Insufficient metric opportunities do not make the tool unavailable: it can return the valid assessment `insufficient_evidence`. |
| **Timeout / execution-time policy** | Synchronous and deterministic; no independent asynchronous timeout is implemented. The orchestrator checks the 45-second Agent Run deadline before and after execution; synchronous code is not preempted mid-call. |
| **Maximum result size / structural bound** | One fixed object, one assessment/focus/metric tuple, two count pairs and no more than 3 newer sequence numbers. No free text and no independent byte cap. |
| **Failure behavior** | Invalid prior state is rejected during request validation. With no prior state or no newer run the tool is unavailable; a proposal to call it is rejected before handler execution. Invalid output terminates `invalid_tool_result`. `insufficient_evidence` is a valid successful tool result, not a tool failure. Repeated equivalent invocation stops before dispatch and does not increment `toolCallCount`. |
| **Forbidden behavior / Must NOT** | No AI judgment inside the evaluator, intent/skill/motivation/causation inference, network/filesystem access, persistence, mutation, invented telemetry, or inference of a successful/viable bounce route. |
| **Evidence role** | Supplies a deterministic previous-focus assessment and exact newer aggregate counts. The final plan must copy the assessment and any evaluation evidence exactly when this tool ran. |
| **Relevant implementation file** | `backend/src/training-plan-tools.ts`; formulas are in `backend/src/training-plan-evaluator.ts`; input/output and prior-state validators are in `backend/src/training-plan-contract.ts`. |
| **Relevant tests** | `tests/training-plan.test.ts`: **“metric mappings pool exact integer counts and bounce denominator evidence is cross-checked”**; **“previous focus comparison returns improved, not_improved, and insufficient without treating no opportunity as improvement”**; **“fake provider completes first and later plans and model inputs contain only bounded workflow plus tool results”**. |

### Focus mapping and comparison rule

For each supported prior primary focus, the evaluator pools integer opportunities and undesirable counts. The baseline is the saved aggregate from the successful previous plan; the newer side includes only current entries whose sequence exceeds the saved `maxSequence`.

| Focus | Metric | Minimum opportunities on each side | Formula-specific limitation |
| --- | --- | ---: | --- |
| `threat_management` | `threat_offensive_rate` | 2 | Target-aligned shots while a threat existed; no intent inference. |
| `bounce_strategy` | `blocked_direct_rate` | 3 | Uses target attempt denominators and cross-checks blocked counts; a blocked direct shot does not prove a viable bank shot. Missing/inconsistent target denominator means unavailable. |
| `aim_timing` | `rushed_bounce_failure_rate` | 2 | W04 rushed threshold is a heuristic, not intent. |
| `positioning` | `repeated_same_position_rate` | 3 | Similar-position streak proxy; not causal evidence. |
| `range_management` | `range_expiry_rate` | 3 | Range expiry is measured; all fired shots are the conservative opportunity denominator. |

If either side is unavailable or below its focus minimum, the result is `insufficient_evidence`. Otherwise the evaluator uses exact integer/rational comparison (BigInt cross-products), without rounding: with baseline `(bU,bO)` and newer `(nU,nO)`, compare `nU × bO` with `bU × nO`. Strictly lower newer rate is `improved`; equal or higher is `not_improved`. Zero or absent opportunity is never improvement. The result measures only change in telemetry proxies, not player skill, intent, or causation.
