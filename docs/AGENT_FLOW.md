# W05 Agent Flow

## Purpose

The Training Planner's fixed player goal is:

> Analyze my available completed runs, determine the most useful next practice focus, and produce a focused training plan for my next run.

One explicit click on **Training Plan** starts one logical Agent Run. The workflow has fixed step, tool, provider-attempt, timeout, and deadline limits. The model proposes its next tool call or final plan; the backend validates the proposal and remains the only execution authority. Core tools read validated completed-run context and do not mutate canonical gameplay state.

## Architecture and boundaries

```text
W05 sibling flow
Player
  -> Training Plan UI (frontend/src/main.ts)
  -> TrainingPlanSession snapshot and eligibility gate
  -> TrainingPlanClient
  -> POST /api/training-plan (backend/src/server.ts)
  -> request/body validation
  -> TrainingPlanOrchestrator
  -> TrainingPlanModelStepProvider (provider-neutral interface)
  -> proposal validation
  -> TrainingPlanToolRegistry (exact two-name allowlist)
  -> deterministic local tool
  -> tool-result validation
  -> next provider-neutral model step
  -> final shape, grounding, and response validation
  -> response
  -> frontend response/session validation and structured UI

Provider implementations behind the W05 interface:
  FakeTrainingPlanProvider (default, deterministic and offline)
  GeminiTrainingPlanProvider -> @google/genai GenerateContent adapter (optional)

Separate W04 sibling flow:
Player -> AI Coach UI/client -> POST /api/ai/coach -> W04 provider/contract
```

W04 AI Coach is a sibling request path; it is not a stage or tool in the W05 Agent Run. Gemini SDK types and SDK calls are confined to `backend/src/gemini-training-plan-provider.ts`. The orchestrator consumes only `TrainingPlanModelStepProvider` from `backend/src/training-plan-provider.ts`.

The browser sends one to three completed summaries with page-session sequence numbers and, when present, the previous validated plan and baseline. Backend validators treat all browser data as untrusted. The model receives bounded workflow metadata and normalized results from executed tools, not raw run summaries. The tools read only the validated current-request context held by the backend.

## First-plan successful flow

```text
Player click
  -> frontend preflight and snapshot
  -> Model Step 1: propose get_recent_run_evidence
  -> validate proposal, allowlist, arguments, availability, budget, identity
  -> dispatch deterministic tool
  -> validate tool result
  -> Model Step 2: propose final Training Plan
  -> validate shape, evidence grounding, semantics, and response
  -> backend sets completed=true and computes baseline
  -> goal_completed
```

Normal successful counts: **2 agent/model steps**, **1 dispatched tool call**, and normally **2 provider attempts** when there is no retry. A transient retry adds a provider attempt without adding an agent step.

## Later-plan successful flow

When a valid prior plan/baseline and a newer completed run are present, the normal eligible path is:

```text
Player click
  -> Model Step 1: evaluate_previous_training_plan
  -> validate and execute evaluator; validate result
  -> Model Step 2: get_recent_run_evidence
  -> validate and execute evidence tool; validate result
  -> Model Step 3: propose final Training Plan
  -> validate assessment/evidence and final response
```

This path uses **up to 3 model steps** and **up to 2 tool calls**. The previous-focus assessment is a deterministic application result, not model judgment. If the evaluator is not run, the final plan must use `previousAssessment: "not_applicable"`.

## Run state and budgets

| Budget or guard | Implemented value/identity |
| --- | --- |
| Agent/model steps | Maximum 3; incremented before each new proposal step |
| Tool calls | Maximum 2; incremented only when a validated proposal is dispatched |
| Provider attempts | Maximum 4 per logical Agent Run; incremented for every generation attempt |
| Retry | At most 1 eligible transient retry per step, also subject to the global attempt cap |
| Provider-call timeout | `min(15,000 ms, remaining run time)`; the call receives an AbortSignal |
| Whole-run deadline | 45,000 ms from Agent Run creation, measured with a monotonic clock |
| Retry wait | Cancellable and bounded to at most 500 ms; default backoff is 100 ms |
| Repeated action identity | Tool name + JSON arguments + relevant state version. Evidence version is the ordered current sequence list; evaluation version is baseline max + newer sequences + focus. |
| Cancellation | Request abort/response disconnect propagates to in-flight generation and backoff; no later step starts. |

`agent step != provider attempt/retry`. A retry stays in the same step and increments only `providerAttempts`. Each separate model proposal step increments `agentSteps`. Tool calls count only at dispatch; invalid/unknown/repeated proposals do not consume a tool-call slot. If a synchronous tool throws after dispatch, its call remains counted.

Tools are synchronous and deterministic; they have no independent asynchronous timeout. Their bounded local work is checked against the remaining 45-second Agent Run deadline immediately before and after execution. A synchronous operation cannot be interrupted mid-call by the timer.

## Stop conditions

The orchestrator has terminal categories for `goal_completed`, `invalid_input`, `invalid_model_proposal`, `unknown_tool`, `invalid_tool_arguments`, `invalid_tool_result`, `provider_failed`, `provider_timeout`, `tool_failed`, `step_limit`, `tool_call_limit`, `provider_attempt_limit`, `deadline`, `repeated_action`, `invalid_final_result`, and `cancelled`. Cancellation is used when the request lifecycle exposes a disconnect/abort.

Request-shape/content/JSON errors are returned as a generic `invalid_request` envelope (400, or 413 for an oversized body); valid unchanged-history regeneration is rejected with `regeneration_not_eligible` (409). Controlled run failures map to a generic `training_plan_unavailable` envelope (503). A disconnected response is not written. Internal stop categories and raw provider details are not exposed to the player.

## Eligibility and page-session behavior

- A terminal completed run adds a new ordered sequence to the in-memory W05 ledger; no completed run means the control is disabled and no request is made.
- A successful plan stores the validated plan and computed baseline in page memory.
- The UI disables another request until a sequence newer than that baseline exists. The backend independently rejects an unchanged valid baseline before provider invocation.
- Completing a newer run re-enables one further successful plan; the next successful response advances the baseline.
- Reload creates a fresh session and clears both run history and W05 prior-plan state.
- The backend persists no player session or gameplay history. Sequence numbers and prior state are untrusted client claims that are validated but not authenticated.

## Authoritative detail

The feature contract and acceptance scenarios remain in [`spec.md`](../specs/002-agentic-training-planner/spec.md); implementation decisions, formulas, and file map are in [`plan.md`](../specs/002-agentic-training-planner/plan.md). This document summarizes the shipped runtime flow.
