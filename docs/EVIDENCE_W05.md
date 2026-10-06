# W05 Training Planner Evidence

Implementation evidence is based on local commit `3dd91606eacd25e18c34f226e7c919fb7e0e4634` (`w5 task initial`), which contains the W05 source and tests. The documentation changes from this pass are working-tree changes; they have not been committed or pushed.

## 1. Feature summary

The Training Planner gives a player a focused practice goal for the next run using validated completed-run telemetry. Its fixed goal is:

> Analyze my available completed runs, determine the most useful next practice focus, and produce a focused training plan for my next run.

The workflow is agentic because a model makes multiple bounded proposals: it can request an application tool, observe the validated result, then propose a structured final plan. It is bounded rather than autonomous: one explicit click starts one Agent Run, the backend owns tool execution and validation, and the model cannot control gameplay, choose actions, or mutate canonical game state.

The authoritative feature definition and requirements are the approved [SpecKit specification](../specs/002-agentic-training-planner/spec.md), [plan](../specs/002-agentic-training-planner/plan.md), and [tasks](../specs/002-agentic-training-planner/tasks.md). No separate `AGENT_FEATURE_SPEC.md` was created because these three approved artifacts already define the feature, architecture decisions, and implementation/eval work.

## 2. Architecture

See the detailed [agent flow](AGENT_FLOW.md). Actual components include:

- Frontend UI and lifecycle integration: `frontend/index.html`, `frontend/styles.css`, `frontend/src/main.ts`.
- Frontend wire contract, client, and page-memory ledger: `frontend/src/training-plan-contract.ts`, `frontend/src/training-plan-client.ts`, `frontend/src/training-plan-session.ts`.
- Separate endpoint and streamed request validation: `POST /api/training-plan` in `backend/src/server.ts`.
- Backend contracts and bounded orchestrator: `backend/src/training-plan-contract.ts`, `backend/src/training-plan-orchestrator.ts`.
- Exact tool registry and deterministic functions: `backend/src/training-plan-tools.ts`, `backend/src/training-plan-evaluator.ts`.
- Provider-neutral interface and model-step input: `backend/src/training-plan-provider.ts`, `backend/src/training-plan-prompt.ts`.
- Offline default: `backend/src/fake-training-plan-provider.ts`.
- Optional W05 Gemini adapter: `backend/src/gemini-training-plan-provider.ts`, composed by `backend/src/training-plan-config.ts` and `backend/src/training-plan-runtime.ts`.

W04 AI Coach remains a separate sibling endpoint and provider path. The W05 orchestrator does not import the Gemini SDK; SDK access is isolated behind the W05 adapter.

## 3. Authority and safety boundary

**Model proposes; application validates and executes.** The request is validated at the route before provider access. The orchestrator then validates the proposal shape, tool name, arguments, current availability, budget, and repeated-action identity. The registry validates tool arguments before handler dispatch, and validates the returned structure and exact recomputed result before adding it to model context. Before success, the orchestrator validates final shape, evidence references/counts, previous-plan assessment consistency, and the complete response. Only after these checks does the backend set `completed: true` and compute the new baseline.

Key enforcement points are `validateTrainingPlanRequest` and tool/result validators in `backend/src/training-plan-contract.ts`, registry dispatch/output checks in `backend/src/training-plan-tools.ts`, state/budget/grounding checks in `backend/src/training-plan-orchestrator.ts`, and success-response validation in both frontend and backend contracts. The model step receives bounded metadata and normalized tool results, not raw completed summaries.

## 4. Tool registry

The Core allowlist contains exactly:

- `get_recent_run_evidence`
- `evaluate_previous_training_plan`

Full input/output, scope, failure, and metric contracts are in [`TOOL_CONTRACTS.md`](TOOL_CONTRACTS.md). No arbitrary shell, filesystem, browser, URL, or network tool exists.

## 5. Agent limits

| Limit | Implemented value |
| --- | ---: |
| Agent/model steps | 3 |
| Dispatched tool calls | 2 |
| Provider attempts across one logical run | 4 |
| Eligible transient retries | At most 1 per step; total attempts still capped at 4 |
| Timeout per provider call | At most 15 seconds, or less if the run has less time remaining |
| Total Agent Run deadline | 45 seconds, monotonic |
| Retry backoff | Cancellable, at most 500 ms; default 100 ms |
| Request body | 48 KiB streaming cap; model proposal/final output 8 KiB cap |

An agent step and a provider attempt are different counters. A retry increments provider attempts but remains in the same agent step. Tool-call count increments at validated dispatch, before handler invocation.

## 6. Successful first-plan evidence

**Evidence type:** offline fake/scripted-provider evidence. **Test:** `tests/training-plan.test.ts` — “fake provider completes first and later plans and model inputs contain only bounded workflow plus tool results”.

```text
Step 1 — fake provider proposal: get_recent_run_evidence
Proposal/arguments validation: passed
Tool dispatch: allowed; one tool call
Tool result validation: passed

Step 2 — fake provider proposal: final Training Plan
Evidence grounding and final runtime validation: passed
Backend terminal: goal_completed
Backend completed flag/baseline: also verified by the route success test

Agent steps: 2
Tool calls: 1
Provider attempts: 2
```

The test asserts `goal_completed`, counters `2/1/2`, and that the second fake-provider input contains validated recent-run tool results but no raw run telemetry fields. The backend route test **“POST /api/training-plan succeeds with backend-owned completed and baseline while Coach route stays available”** separately asserts `completed: true` and the sequence baseline. This is an offline deterministic trace, not a live model trace.

## 7. Later-plan evidence

**Evidence type:** offline fake/scripted-provider evidence. The same core test supplies a valid previous state and a newer run; the backend route test **“newer sequence unlocks later deterministic assessment and advances baseline”** checks the HTTP path.

```text
Step 1 — evaluate_previous_training_plan
Step 2 — get_recent_run_evidence
Step 3 — final Training Plan
Terminal: goal_completed
Previous-focus assessment: improved (deterministic evaluator result)
Agent steps: 3
Tool calls: 2
Provider attempts: 3
```

The core test asserts those counters and `improved`; the route test asserts HTTP 200, assessment, and baseline advancement to the newer sequence.

## 8. Rejected-tool evidence

**Evidence type:** offline fake/scripted-provider evidence. In `tests/training-plan.test.ts`, test **“unknown tools, invalid arguments, malformed proposals, and malformed final evidence never succeed”** sends unknown-tool, invalid-argument, and malformed-proposal cases. It asserts the corresponding terminal category and `toolCalls === 0`. The counter increments only on registry dispatch, so these proposals did not reach a handler. The separate registry test injects handlers and verifies invalid, unknown, unavailable, and repeated actions do not invoke them.

## 9. Other controlled failure evidence

- **Invalid tool result:** “invalid tool output never reaches the next model step and dispatched calls are counted” asserts terminal `invalid_tool_result`, one counted dispatch, one handler call, and only one provider step.
- **Repeated action:** “repeated equivalent action executes at most once; changed evidence limits are distinct” asserts `repeated_action` after exactly one handler/tool call.
- **Provider timeout and attempt limit:** “transient retry stays in its step; timeout, provider-attempt exhaustion, and permanent failures are bounded” asserts timeout after one attempt and provider-attempt exhaustion at four attempts.
- **Deadline:** “deadline and provider timeout policies are injected, bounded, and discard late output” uses an injected clock to show a late tool proposal is discarded with zero tool calls, and an already-expired run starts zero provider attempts.
- **Invalid final output:** the malformed/forged final cases in “unknown tools, invalid arguments, malformed proposals, and malformed final evidence never succeed” terminate as `invalid_final_result` and never return success.
- **Safe HTTP failure:** `tests/training-plan-backend.test.ts` — “provider and invalid-proposal failures expose only the safe 503 envelope” checks the exact generic response and absence of raw private/provider content.

## 10. Validation chain

```text
HTTP content type, streaming byte cap, JSON and request validation
  -> provider-neutral model step
  -> proposal shape validation
  -> tool allowlist + argument + context/availability + budget + repetition checks
  -> deterministic tool dispatch
  -> tool-result shape and exact-context recomputation validation
  -> next model step
  -> final proposal/structured draft validation
  -> evidence-grounding and evaluator-result consistency validation
  -> backend sets completed=true and computes baseline
  -> frontend validates success envelope and records page-session state
```

## 11. Provider boundary and live status

Automated tests use the fake/scripted provider and local backend route tests. The optional Gemini adapter uses `@google/genai` GenerateContent JSON behind `GeminiTrainingPlanProvider`; SDK retries are disabled and the orchestrator supplies the per-call timeout and cancellation signal. Gemini tests use SDK transport doubles and make no external provider request.

**W05 live Gemini smoke test: RECORDED — PASS (2026-10-06)**

One bounded live smoke used the documented backend environment-loading path and the actual `POST /api/training-plan` endpoint with one synthetic, runtime-valid completed-run summary. The configured provider was Gemini and the model was `gemini-3.1-flash-lite`. The logical Agent Run ended `goal_completed`; backend proposal, tool-result, and final response validation passed. The safe trace is:

```text
2026-10-06 17:01:31 +02:00 — 1 logical Agent Run; POST /api/training-plan; HTTP 200
Step 1 / provider attempt 1 — proposed and validated get_recent_run_evidence; dispatched once
Step 2 / provider attempt 2 — structured Training Plan validated; completed=true
Terminal: goal_completed | agent/model steps: 2 | tool calls: 1
Provider attempts: 2 | retries: 0 | orchestrator elapsed: 13,444 ms
HTTP round trip: 13,624 ms | primary focus: range_management
Token counts: unavailable from the W05 adapter
```

This is distinct from both offline fake/scripted-provider coverage and offline Gemini SDK-double tests. Exactly one live logical run was performed; no retry or second run was needed. The real `.env` was loaded by Node through `--env-file=.env`; no secret or environment value was printed, manually inspected, or included in evidence. The smoke verifies one real application workflow, not Gemini quality or general service reliability.

## 12. Test results

The requested verification commands were run for this documentation pass:

| Command | Observed result |
| --- | --- |
| `npm run typecheck` | PASS — frontend and backend TypeScript checks completed with exit code 0. |
| `npm test` | PASS — 98 tests, 98 passed, 0 failed; includes gameplay, W04 Coach, W05 Core, backend, and offline Gemini adapter suites. |
| `npm run build` | PASS — frontend and backend builds completed with exit code 0. |
| `node scripts/check-reachability.mjs` | PASS — all four Core targets capturable; `RESULT: PASS - every target is capturable`. Node printed the existing module-type warning for `frontend/dist/game.js`. |
| `git diff --check` | PASS — exit code 0; Git reported only LF-to-CRLF working-copy notices for edited Markdown files. |

The detailed scenario matrix is in [`AGENT_EVALS.md`](AGENT_EVALS.md). Its offline fake/scripted-provider and SDK-double evidence is separate from the one live Gemini Agent Run above; neither establishes general recommendation quality.

### Final submission-preparation verification (2026-10-06)

| Command or evidence | Observed result |
| --- | --- |
| `npm run typecheck` | PASS — frontend and backend TypeScript checks exited 0. |
| `npm test` | PASS — 99 tests, 99 passed, 0 failed; includes the new offline `step_limit` case and preserves W04 suites. |
| `npm run build` | PASS — frontend and backend builds exited 0. |
| `node scripts/check-reachability.mjs` | PASS — all four Core targets capturable; `RESULT: PASS - every target is capturable`. Existing Node module-type warning appeared for `frontend/dist/game.js`. |
| `git diff --check` | PASS — exit code 0; Git emitted working-copy LF-to-CRLF notices. |
| Live W05 Gemini run | PASS — one logical Agent Run; details and safe counters are recorded in Section 11. |

## 13. Security checklist

- **PASS** — W05 provider key remains a backend-only configuration value; fake mode does not read it. `.env.example` contains an empty placeholder. The real `.env` was not inspected.
- **PASS** — exact tool allowlist; model cannot introduce a tool, and rejected tool proposals dispatch zero handlers.
- **PASS** — strict tool argument validation before dispatch.
- **PASS** — tool-result structure and exact expected values are validated before reuse.
- **PASS** — no arbitrary filesystem/network tool; optional Gemini provider networking is behind explicit backend configuration.
- **PASS** — tools receive bounded completed-run context and do not mutate gameplay state.
- **PASS** — the focused offline test reaches `step_limit` at three agent steps, verifies two tool dispatches and three provider attempts, and confirms no fourth provider call. It raises only the test tool-call seam to isolate the step classification; runtime retains the two-tool default, which can classify the same third proposal as `tool_call_limit`.
- **PASS** — 2-call tool budget is tested; 4-attempt provider budget is tested.
- **PASS** — 45-second total deadline and 15-second per-call timeout are source- and test-verified.
- **PASS** — retry is at most once per eligible step and remains within a global attempt cap; tested offline.
- **PASS** — public provider failure maps to a generic safe envelope; tests check raw provider content is absent.
- **PASS** — structured final output, evidence grounding, and backend-owned `completed` are runtime-validated.
- **PASS** — sanitized logs omit run summaries and proposal data in the cancellation/logging test; proposal schema rejects extra fields, and no chain-of-thought field is accepted or logged.

## 14. Known limitations

- The current completed-run history is at most three runs, a small sample.
- Telemetry fields are heuristic proxies. The evaluator measures a change in a telemetry proxy, not skill, intent, motivation, or causation.
- `blocked_direct_rate` does not establish that a viable bounce path existed. Missing/inconsistent target denominator evidence becomes unavailable to the evaluator; the normalized tool output represents that case as `0/0` without a separate availability flag.
- The browser page-session baseline and sequence numbers are untrusted input. The backend validates them but is intentionally stateless and cannot authenticate a client's history.
- A custom/tampered client can omit the previous plan and bypass the supported UI's unchanged-history gate; fully enforcing session-history awareness would require persistence/session identity that the approved scope excludes.
- The history and prior plan clear on reload. A page reload therefore loses the ability to compare with the previous plan.
- The `step_limit` terminal guard is covered with an isolated test budget because the production two-tool cap can take precedence when the third model step proposes another tool.
- One live smoke succeeded, but one run does not establish Gemini latency, availability, or recommendation quality beyond that request. The SDK-double suite remains separate offline evidence.

## 15. Pair contribution

Contribution details were confirmed for this submission-preparation pass; Git author identity was not used to infer ownership.

- **Dušan Nikolić:** led W05 requirements and bounded-agent decisions, SpecKit work, implementation/review prompts, hands-on testing and debugging, and final verification/live smoke. Coding was AI-assisted; this wording does not claim he manually authored every source line.
- **Milena Paripović:** directed and reviewed the work for assignment alignment, checked requirements and submission completeness, reviewed and corrected documentation/evidence, and acted as pair reviewer. No production-module authorship is inferred for her.

## 16. Reproduction instructions

From the repository root:

```sh
npm install                 # if dependencies are not installed
npm run dev                 # frontend + backend, fake providers by default
npm run typecheck
npm test
npm run build
node scripts/check-reachability.mjs
```

Optional W05 Gemini configuration names are `TRAINING_PLAN_PROVIDER`, `TRAINING_PLAN_GEMINI_API_KEY`, and `TRAINING_PLAN_GEMINI_MODEL`; safe placeholders are in [`.env.example`](../.env.example). Keep any real key only in the backend environment. No live request is part of these reproduction steps.

## 17. W05 Core submission checklist

- [x] Stable W04 base retained — full existing W04 offline suites pass and the separate Coach route is exercised with W05.
- [x] Separate W05 SpecKit feature — `spec.md`, `plan.md`, and `tasks.md` define it.
- [x] Clear fixed player goal and explicit player invocation.
- [x] At least one Core tool; exactly two are implemented and allowlisted.
- [x] Core tools are read-only and deterministic.
- [x] Explicit backend tool allowlist; no model-created tools.
- [x] Strict tool input validation before execution.
- [x] Tool output validation before reuse.
- [x] Successful path has at least two model steps.
- [x] Successful path executes a real deterministic tool between model steps.
- [x] Maximum agent steps is 3 and the source guard is present.
- [x] Total Agent Run deadline is 45 seconds and deadline behavior is tested.
- [x] Per-provider-call timeout is capped at 15 seconds and tested offline.
- [x] Transient retry is bounded to one per step and tested.
- [x] Global provider-attempt budget is 4 and tested.
- [x] Tool-call budget is 2 and tested.
- [x] Repeated-action protection is tested.
- [x] Final result is structured, evidence-grounded, and runtime-validated.
- [x] Success flow evidence is recorded from offline fake-provider tests.
- [x] Rejected/invalid tool evidence records zero dispatches for rejected proposals.
- [x] Provider failure/timeout flow is tested with offline fakes/scripted providers.
- [x] Maximum-step terminal flow — focused offline test reaches `step_limit`, checks the 3-step/2-tool/3-attempt counters, and verifies there is no fourth provider call; see W05-E12.
- [x] Deadline terminal flow — injected-clock tests verify expiry and late-result discard.
- [x] Fake/mock path is default and automated tests make no external Gemini request.
- [x] Limited live W05 Gemini smoke — one successful logical Agent Run is recorded in Section 11; no second run was needed.
- [x] Evidence package includes flow, tool contracts, eval matrix, tests, limitations, and reproduction steps.
- [x] Secret handling — the documented Node environment loader supplied backend configuration; no secret/environment value was printed, manually inspected, or included.
- [x] No chain-of-thought is accepted, stored, returned, displayed, or logged by the W05 contract.
