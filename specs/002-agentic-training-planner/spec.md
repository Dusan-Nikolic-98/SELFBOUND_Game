# Feature 002: AI Training Planner

## Overview

The AI Training Planner helps a player choose a focused practice goal for the next gameplay run. It uses only validated summaries of completed runs and, when available, a deterministic assessment of the previous Training Plan's primary focus. The player starts one bounded agent run by selecting **Training Plan**; the model does not act during gameplay or control the game.

The planner is a separate Week 05 feature from `001-ai-coach`. It has its own request flow, agent contract, and endpoint. W04 remains the stable behavioral baseline: its endpoint, request and response contracts, UI, and provider behavior are unchanged by this feature.

## User goal

As a SELFBOUND player, I want a concise, evidence-based practice focus and a concrete goal for my next run, so that I know what to try next without having to write an AI prompt.

## User scenarios

1. **No completed runs:** Training Plan is unavailable, the page gives brief guidance that a completed run is needed, and no request or provider call occurs.
2. **First completed run:** Training Plan becomes available. The player clicks it, the backend gathers validated recent-run evidence, and the player receives a structured plan. There is no previous-plan evaluation.
3. **Later completed run:** A prior successful plan and its baseline are available in the page session, and a newer run has completed. The planner may assess the prior focus deterministically, gather recent evidence, and return an updated plan.
4. **No new run after success:** The same unchanged completed-run history cannot be used to produce unlimited successful refreshes. A new successful generation becomes eligible after a newly completed run. A failed attempt may offer a safe, bounded retry.
5. **Active gameplay:** Starting a gameplay run does not invoke the planner. Gameplay continues independently while the player explicitly requests a plan; unfinished-run telemetry is not supplied.
6. **Reload or closed page:** Previous Training Plan state and completed-run history are cleared with the page session. The backend retains no session history.
7. **Controlled failure:** The player sees a generic safe stopped/unavailable message. The game remains usable, and no raw provider details, prompts, stack traces, or chain-of-thought are shown.

## Core behavior and functional requirements

- **FR-1 Explicit invocation:** A Training Plan control starts one logical Agent Run only when selected by the player. Do not call the AI automatically when a gameplay run starts, completes, or renders.
- **FR-2 Eligibility:** The control is unavailable until at least one valid completed-run summary exists. Zero-history rejection happens before any backend/provider call.
- **FR-3 Bounded generation:** Permit at most one successful plan for an unchanged completed-run history. A newly completed run makes one further successful plan eligible. A failed request may be retried through a safe path, subject to the same bounded run limits; retries must not become an unlimited successful refresh mechanism.
- **FR-4 Completed history:** The browser remains owner of canonical game state, current-run telemetry, and completed-run history. Supply only one to three validated completed summaries already available to the current request, up to the existing three-run history bound. Never include an unfinished run. Do not make the backend canonical owner of gameplay state.
- **FR-5 Session-only state:** Retain the latest successful Training Plan and its bounded baseline evidence in page memory only. Clear it on reload/close, consistent with completed-run history. The frontend may send that prior plan and baseline in a later request, but the backend must runtime-validate all such input. The backend is stateless between HTTP requests.
- **FR-6 Bounded goal:** The application supplies a fixed, bounded goal equivalent to: “Analyze my available completed runs, determine the most useful next practice focus, and produce a focused training plan for my next run.” The player does not enter a free-form AI question.
- **FR-7 Distinct W05 flow:** Use a separate UI/request flow and a new endpoint for Training Planner. Preserve the existing W04 Coach UI, behavior, `/api/ai/coach` endpoint, and request/response contract.
- **FR-8 Safe presentation:** Show a high-level running state, then a validated structured plan on success or a generic safe stopped/unavailable message on controlled failure. Keep gameplay and other controls usable. Exact visual styling is outside Core acceptance.

## Allowed context and tools

The agent receives only bounded, runtime-validated input needed for this run: up to three completed-run summaries, any valid page-session previous plan and its baseline evidence, and deterministic tool results produced during this Agent Run. Input from the browser is untrusted until validated. Do not supply raw frame histories, screenshots, arbitrary browser data, account identity, or unnecessary private/internal gameplay state.

Core W05 defines exactly two possible tools. Both are read-only with respect to canonical gameplay state, local and deterministic, and have no network, filesystem, or write access.

### `get_recent_run_evidence`

Produce a bounded, normalized evidence set from validated completed-run summaries supplied with the current request. The model may request this operation to gather evidence for its final plan. It may accept a small bounded request such as the number of recent runs, if strictly validated. It operates only on the current request's validated summaries, never exceeds the existing maximum of three runs, returns normalized evidence rather than unrestricted raw gameplay state, and performs no network or filesystem access, writes, or gameplay mutation.

### `evaluate_previous_training_plan`

When eligible, deterministically evaluate whether validated telemetry supports improvement in the previous plan's single primary practice focus. This is a local evaluator, not an AI judgment, and its validated result may be used as evidence in the final plan. Offer it only when the bounded context contains a valid previous Training Plan, the run IDs or equivalent validated baseline identity/order evidence used by that plan, and at least one newer completed run that can be evaluated. If any prerequisite is absent or invalid, do not offer the tool.

The evaluator reports only `improved`, `not_improved`, or `insufficient_evidence`. It does not infer intent, motivation, skill, or other unobserved qualities. Before implementation, planning must specify an explicit mapping from each supported focus to existing telemetry metrics and document the deterministic comparison formula. Compare only focus-relevant evidence from the plan's baseline against completed runs after that plan. If either side lacks a meaningful relevant opportunity/sample, return `insufficient_evidence`; absence of opportunity is never improvement. `not_improved` may mean unchanged or worse relevant telemetry. Every conclusion must be supported by validated telemetry; model-generated claims cannot replace evaluator evidence.

Candidate primary focus categories must be grounded in telemetry already collected by the game: threat management; obstructed/direct-shot or bank-shot-related behavior; aim timing/rushed bounced attempts; repositioning after repeated failures; and range management. W04 describes relevant bounded signals and their heuristic limits. Do not invent uncollected telemetry or treat geometric heuristics as proof of player intent.

## Agent boundaries and execution authority

- The workflow is bounded and application-controlled. The model may propose a next operation or a structured final result; the backend alone decides whether a proposal is well-formed, allowed, available, within budget, and executable.
- Treat every model-produced proposal as untrusted input. Validate model-step shape and kind, tool name, tool arguments, current run state, remaining budget, repeated actions, tool result, and final structured result before use.
- Only the two tools specified above can be offered. No generic shell, filesystem, arbitrary network/URL/browser, arbitrary code execution, score mutation, gameplay mutation, or general-purpose tool is available.
- Core W05 is read-only with respect to canonical game state. The model cannot fire projectiles, select shots, alter score/lives/level state, change rules, or otherwise control gameplay.
- A tool proposal is not itself permission to execute. Unknown or invalid proposals never execute. Invalid tool results are not forwarded as trusted evidence.
- No chain-of-thought is stored, returned, displayed, or logged.

## Successful agent flows

### First Training Plan

With at least one completed run and no evaluable previous plan, the normal successful flow is: player click; preflight validation; Agent Run creation; first model step proposes `get_recent_run_evidence`; backend validates and executes the tool; backend validates/normalizes its result; a later model step returns a structured final Training Plan; backend validates the final result; frontend displays it; run terminates with `goal_completed`.

Normal happy path: two model steps and one tool call. No previous-plan assessment is claimed; its state is `not_applicable`.

### Later Training Plan

When a valid previous plan, its baseline, and at least one newer completed run exist, the model may request `evaluate_previous_training_plan`, then `get_recent_run_evidence`, and then return a final structured plan containing both the previous-focus assessment and next primary focus. The backend determines availability and validates every action and result.

Normal bounded happy path: at most three model steps and two tool calls. The assessment may be `improved`, `not_improved`, or `insufficient_evidence` based on the deterministic evaluator.

## Agent Run limits and stop conditions

One player click equals one logical Agent Run. Apply these Core limits across the whole run:

- Maximum three model/agent steps (`maxAgentSteps: 3`).
- Maximum two tool calls (`maxToolCalls: 2`).
- Maximum four provider attempts (`maxProviderAttempts: 4`).
- At most one retry for an eligible transient provider failure at an individual step, subject to the global provider-attempt limit.
- Each provider call times out within 15 seconds; the whole Agent Run has a maximum 45-second deadline.
- A provider retry is not a new agent step. Steps, retries, tool executions, and any fallback attempts count against the same run budget/deadline.
- Never start another provider call after the deadline or provider-attempt budget is exhausted. No infinite or open-ended loops are allowed.
- Detect repeated equivalent tool proposals that make no progress. A conceptual identity may include tool name, normalized arguments, and relevant state version. Reject the repeat or stop the run with `repeated_action`.
- Do not require automatic cross-provider fallback in Core. Keep the future provider boundary neutral so fallback could be considered separately.
- Support `cancelled` as a terminal reason only if the request lifecycle supports cancellation.

Controlled terminal reasons include, where applicable: `goal_completed`, `invalid_input`, `invalid_model_proposal`, `unknown_tool`, `invalid_tool_arguments`, `invalid_tool_result`, `provider_failed`, `provider_timeout`, `tool_failed`, `step_limit`, `tool_call_limit`, `provider_attempt_limit`, `deadline`, `repeated_action`, `invalid_final_result`, and `cancelled` when supported. Internal details remain private; the player receives safe generic wording.

## Final Training Plan

Return a structured result, not unrestricted free text. Exact field names and TypeScript contracts may be finalized during planning. The result contains information equivalent to:

- concise summary;
- previous-plan assessment (`not_applicable`, `improved`, `not_improved`, or `insufficient_evidence`);
- one next primary practice focus;
- a concrete practice goal for the next gameplay run;
- evidence supporting the recommendation;
- confidence;
- a completed flag.

Each evidence item must trace to validated tool output or other approved bounded request input. Runtime validation rejects malformed, ungrounded, or unsupported evidence and invalid field values. Accept `completed: true` only when the backend determines the complete output satisfies the final contract. Invalid final output is never displayed as success.

## Provider boundary and fake-first behavior

The W05 orchestrator must depend on a provider-neutral model-step abstraction, not directly on `@google/genai`. W04's Gemini SDK boundary is Coach-specific. Planning decides whether the cleanest reuse is extraction or adaptation; this specification task does not change W04 provider code.

Before any live Gemini smoke/demo, deterministic fake/model-step scenarios must exercise first-plan success, later-plan success and assessment, unknown tool, invalid tool arguments, malformed model proposal, invalid tool result, repeated action, provider failure/timeout, maximum-step or deadline stop, and malformed/invalid final result. Normal automated tests remain offline. Live Gemini is a limited smoke/demo after fake-first behavior is green.

## Observability and privacy

The implementation must be capable of safely recording bounded metadata equivalent to: run ID, status, step count, tool call count, provider attempt count, provider/model category where appropriate, tools attempted/executed, validation outcomes, elapsed time, stop reason, and bounded token-use metadata when available.

Do not log API keys, environment values, raw chain-of-thought, unbounded prompts/responses, or unnecessary private/internal gameplay state. Do not expose raw provider errors, prompts, stack traces, or chain-of-thought to the player. Minimize retained and transmitted data to validated completed-run summaries and bounded plan/evidence context.

## Acceptance scenarios

1. With zero completed runs, Training Plan is unavailable and no HTTP/provider call occurs. A completed run enables the control; starting a new gameplay run alone never invokes AI.
2. A first successful plan follows the bounded happy path, has no previous-plan evaluation, passes final validation, displays structured output, and ends with `goal_completed`.
3. A later eligible plan can use the deterministic previous-plan evaluator and recent-run evidence within three steps and two tool calls. Missing/invalid baseline identity, prior plan, or newer run makes evaluation unavailable.
4. Repeating a successful request with unchanged run history does not produce another successful generation; a failed request may be retried safely within limits.
5. An unknown tool is never executed and ends in controlled failure (`unknown_tool` or `invalid_model_proposal`).
6. Invalid tool arguments are never executed and end in controlled failure (`invalid_tool_arguments` or `invalid_model_proposal`). A rejected proposal may produce `toolCallCount === 0`.
7. Malformed model output cannot execute a tool. Invalid tool output is not forwarded as trusted evidence.
8. Repeated equivalent tool actions without progress are rejected or stopped with `repeated_action`.
9. No further model call occurs after the step limit, deadline, or provider-attempt limit is reached.
10. An invalid final Training Plan is never displayed as success and terminates with `invalid_final_result`.
11. Provider failure or timeout results in bounded safe failure with no raw provider detail exposed.
12. Both tools are deterministic, local, read-only, and cannot change canonical gameplay state; only validated completed-run context is used.
13. Page reload clears completed-run and prior-plan session state; the backend does not persist sessions or canonical game state.
14. Fake/model-step scenarios cover the required successful and negative paths offline before any limited live Gemini smoke/demo.
15. The existing W04 AI Coach continues to behave according to `001-ai-coach`; its UI, contract, endpoint, and provider implementation are unchanged by W05.

## Success criteria

- A player can request a useful, structured practice plan only after completing a run, without entering a prompt.
- One click starts one bounded Agent Run with the specified limits, and unchanged history cannot yield unlimited successful plans.
- Every tool proposal, tool result, and final result is validated by the backend execution authority before use.
- The planner's recommendations and any previous-plan assessment are grounded only in approved, validated telemetry evidence.
- No model operation can mutate gameplay or access general-purpose tools.
- Player-visible failures are safe and generic; diagnostic metadata is bounded and excludes secrets and chain-of-thought.
- W04 remains behaviorally and contractually unchanged.
- Automated coverage is deterministic and offline; live Gemini is limited to a later smoke/demo after fake-first coverage is green.

## Non-goals / out of scope

Autonomous general-purpose agent; AI directly controlling the player or firing projectiles; modifying score, lives, level state, gameplay, or rules; write tools; human approval/write-action flow; arbitrary shell, filesystem, browser/web, URL, code-execution, or network access; database, backend session, localStorage, cookie, or persistent player-profile state; multi-agent systems; RAG/vector database; automatic invocation at gameplay-run start; unbounded refresh/regeneration; automatic modification of game rules; redesign or removal of W04 AI Coach.

## Assumptions and planning clarifications

- Existing completed-run history is page-session-only and bounded to at most three summaries; W04 telemetry categories and their documented heuristic limits are the source for candidate practice focuses.
- The current completed-run summary contract does not include a run ID. Planning must decide how W05 supplies a bounded, validated page-session run identity or equivalent proof of baseline ordering for prior-plan evaluation. This must not add persistent storage or invent gameplay telemetry.
- The exact focus-to-metric comparison formulas, final TypeScript fields/length bounds, endpoint path, and provider-neutral abstraction/reuse strategy are planning decisions. They must preserve this behavioral contract and W04 boundary.
- `invalid_tool_result` applies to a tool result rejected by runtime validation; the model must not receive it as trusted evidence.
- W04 `specs/001-ai-coach/tasks.md` may contain open manual inspection/evidence items. They are existing project state, not W05 prerequisites, and are not changed or completed by this feature specification.

## Open questions

None block planning. Planning must resolve the run identity/baseline ordering mechanism and document metric mappings/formulas before the evaluator is implemented.