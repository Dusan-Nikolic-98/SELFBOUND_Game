# W08 Secure Arcade Evidence

Verification date: 2026-10-27. This is a documentation-only evidence pass over the committed W08 implementation. No source code, gameplay logic, or tests were changed in this pass. All provider evidence below is fake, scripted, or an SDK transport double; no live provider was used.

## 1. Scope and checkpoint

### Scope

- Team/project: SELFBOUND team; repository `SELFBOUND_Game`.
- Game: SELFBOUND, a TypeScript Canvas browser game.
- Selected W05 flow: Training Planner. One explicit player action creates one bounded, read-only Agent Run. The backend validates proposals and executes exactly two possible deterministic tools.
- Repository model: local, single-user, unauthenticated. There are no accounts, cookies, bearer credentials, persistent sessions, database records, or private resources.
- Starting implementation checkpoint: `7758e644115ade37e68ea60e0b1a00731744b500` (`week8plan`, parent of the security implementation commit).
- Ending implementation checkpoint: `3c3b42c6457d09de94e3fcc43c704e0fbd490241` (`Implement security updates.`).
- Current branch: `main`. The evidence file itself is an uncommitted documentation change after the ending implementation checkpoint.
- Node: `v24.20.0`.
- Browser/test runner: Microsoft Edge `156.0.4314.42`, driven by the repository CDP browser harness; Node's built-in `node:test` runner for the automated suite.

### Planned, executed, observed, concluded

| Category | Evidence |
|---|---|
| Planned | Follow `specs/003-secure-arcade/spec.md` and the W08 template; verify the fake W05 path, W04 sibling path, HTTP/resource limits, browser policy, secret boundary, and T00-T17 status without expanding scope. |
| Executed | Read the required specifications/evidence/process documents and template; inspected Git state/diff, source, tests, package metadata/lockfile, frontend bundles/source maps, and security scripts; ran the commands listed in Section 8. `.env` was not opened or printed. |
| Observed | `npm run typecheck` passed; `npm test` passed 110/110; `npm run build` passed; reachability passed all four targets; the real Edge/CDP browser suite passed DOM/CSP checks; the recovered dependency audit returned `found 0 vulnerabilities` in both modes. |
| Concluded | The committed W08 implementation is supported by offline automated, real-browser, and current dependency-audit evidence for the controls exercised below. Several before/after comparisons still lack a preserved pre-hardening runtime result. |

The planned initial checkpoint commands were `git status --short`, `git log -1`, `node --version`, `npm run typecheck`, `npm test`, `npm run build`, `node scripts/check-reachability.mjs`, and a normal fake W05 round trip. The initial commit is identifiable, but the pre-hardening command output was not preserved in this evidence pass. It is therefore not rewritten as a W08 result.

### Final commands and actual results

| Command | Actual result |
|---|---|
| `node --version` | `v24.20.0` |
| `npm.cmd --version` | `11.19.0` |
| `npm.cmd run typecheck` | PASS, frontend and backend TypeScript checks exited 0. |
| `npm.cmd test` | PASS, 110 tests, 110 passed, 0 failed, 0 cancelled, 0 skipped. Includes W04, W05, gameplay, and logic suites. |
| `npm.cmd run build` | PASS, frontend and backend builds exited 0. |
| `node scripts/check-reachability.mjs` | PASS, all four targets capturable; `RESULT: PASS - every target is capturable`. Node emitted the existing module-type warning for `frontend/dist/game.js`. |
| `npm.cmd run test:security:browser` | PASS. The production frontend build ran; static headers and bundle/source-map sentinel scan passed; Edge verified page load, plain-text XSS rendering, Unicode text, and an enforced inline-script CSP block. |
| `npm.cmd audit --cache "$env:TEMP\\selfbound-npm-cache" --prefer-online --omit=dev` | PASS, exit 0; output: `found 0 vulnerabilities`. |
| `npm.cmd audit --cache "$env:TEMP\\selfbound-npm-cache" --prefer-online --include=dev` | PASS, exit 0; output: `found 0 vulnerabilities`. |
| `git status --short` before this documentation change | Clean. |

No live provider command was run. The fake-default W05 route and the offline Gemini transport-double tests were used.

## 2. Actual architecture and data flow

The actual order is shown below. Request validation occurs before a concurrency/rate permit is acquired so invalid requests do not consume accepted-start budget.

```text
Browser/page memory
  -> POST /api/training-plan or POST /api/ai/coach
  -> HTTP method, origin/CORS, content-type, streaming body and idle-read checks
  -> JSON/runtime request validation
  -> global concurrency/rate-limit permit
  -> W05 TrainingPlanOrchestrator
  -> fake provider or optional provider adapter
  -> model proposal shape/size validation
  -> closed two-name tool registry
  -> tool argument/availability/budget validation
  -> deterministic read-only tool
  -> tool-result validation and exact recomputation
  -> final plan/evidence/baseline validation
  -> safe JSON response
  -> frontend contract validation
  -> textContent browser rendering
  -> sanitized security/operational event
```

Data crossing the boundaries:

- Browser to HTTP: one to three completed-run summaries, positive ordered sequence numbers, and optionally a previous validated plan/baseline. These are untrusted client claims.
- HTTP to W05: only a runtime-validated `TrainingPlanRequest`; client fields such as provider, model, role, owner, and limit overrides are not part of the contract.
- W05 to provider: bounded workflow metadata, allowed tool descriptions, current sequence metadata, and validated normalized tool results. Raw request summaries are not passed as model context.
- Provider to W05: an unknown proposal object. It can request a named tool or propose a final result, but it is not authorization.
- W05 to tools: only exact tool names and validated arguments. The two tools read cloned, validated request context and do not write gameplay state.
- Tool to provider: exact normalized evidence or evaluator results after validation and server-side recomputation.
- Backend to browser: either a validated success result or a generic `400`, `409`, `429`, `503`, or `413` envelope. Raw errors, prompts, provider output, keys, and stack traces are not returned.
- Runtime to logs: allowlisted event, outcome, reason, correlation ID, counts, duration, and status only. Request bodies, prompts, arguments, results, secrets, and raw errors are excluded.

W04 `POST /api/ai/coach` is a sibling route. It shares HTTP parsing, headers, CORS, global resource limits, safe error mapping, and backend-only provider credentials, but it does not enter the W05 orchestrator or W05 tool registry.

## 3. Data inventory

| Field/capability | Who controls it | Where checked and used | Sent to model? | Where stored/how long | Why needed |
|---|---|---|---|---|---|
| Completed-run telemetry | Browser game/session; user can modify it | Frontend W05 contract/session and backend request validator; normalized by `get_recent_run_evidence` | Not as raw summaries; only normalized tool output | Page memory, maximum three entries, cleared on reload | Supplies bounded recommendation evidence; it is not proof of a real run. |
| Target IDs and target metrics | Browser telemetry collector | W04 summary validator and fixed metric normalization | Only through normalized metric IDs and counts | Inside the current page-memory summary | Identifies bounded game telemetry; no arbitrary resource lookup is available. |
| Sequence numbers | `TrainingPlanSession` generates them, but the request is unauthenticated | Positive safe integers, ascending order, and previous-plan baseline consistency | Bounded `currentSequences` metadata and tool results | Page memory and validated baseline until reload | Orders runs and gates regeneration; it is not identity or ownership. |
| Previous plan and baseline | Browser copy of the last success | Backend previous-plan, evidence, baseline, and newer-sequence validators; evaluator recomputes comparisons | Focus/baseline metadata only; evaluator output enters context after validation | Page memory only | Enables later-plan comparison without backend persistence. |
| Tool arguments | Provider/model proposal | Orchestrator exact proposal shape, allowlist, availability, budget, repetition, and registry argument validator | The proposed arguments are model output, not trusted input | Current in-memory Agent Run; not logged | Selects only a bounded `limit` or an empty evaluator object. |
| Tool results | Backend deterministic handlers | Exact shape, enum/count bounds, scope checks, and exact recomputation | Yes, only after validation | Current Agent Run; not persisted | Gives the model bounded evidence without arbitrary data access. |
| Provider output/proposal | Fake provider or optional backend adapter | Proposal byte/shape checks; final, evidence, baseline, and response validators | No; it is the output being validated | Temporary in-memory call/run; not returned raw | Produces a candidate plan while remaining untrusted. |
| Errors | Runtime/provider/HTTP | Internal classification and generic route mapping | No | Temporary error path and safe metadata event | Gives stable client behavior without detail leakage. |
| Security logs | Backend logger | Explicit allowlist and correlation-ID sanitization in W04/W05 logging paths | No | Console/process lifetime; no persistent retention | Supports bounded operations evidence without payload logging. |
| Environment secrets | Backend process and provider adapter only | Runtime configuration; fake mode tests verify W05 does not read Gemini settings | No | Environment/secret manager outside the repository | Required only for an explicitly configured live adapter; never a browser or model datum. `.env` was not opened. |
| Cookies/bearer credentials | None in this application | No auth middleware, `credentials: "include"`, cookie, or bearer header | No | None | Confirms the local-only/CSRF decision. |
| Frontend bundle and source maps | Build output generated from frontend sources | Post-build sentinel and secret-pattern scan; browser script scans every frontend asset | No | `frontend/dist` build artifacts; not application state | Check that backend provider configuration and the synthetic secret cannot cross into browser artifacts. |

## 4. Threat model and priorities

Likelihood and impact are qualitative for one local Node process; they are not public-service risk ratings.

| ID | Scenario and prerequisite | Resource/user affected | Likelihood x impact | Existing control | Test/evidence | Priority |
|---|---|---|---|---|---|---|
| R1 | A caller sends three valid W04/W05 requests while two providers are delayed. | Local process, memory, provider slots | High x High: both routes can otherwise consume concurrent work. | Process-local two-active permit; third accepted request gets `429 server_busy` before provider work. | `tests/training-plan-backend.test.ts`, `two shared W04/W05 slots...`; 110-test suite PASS. | P1 |
| R2 | A caller sends six valid starts inside 60 seconds, resetting any browser pending flag. | Provider/CPU availability | High x Medium: there is no trusted identity, so the policy is global per process. | Five accepted starts per rolling 60 seconds; sixth gets `429 rate_limited`. | `global rolling rate accepts five starts...`; deterministic clock reset PASS. | P1 |
| R3 | A slow or oversized chunked body occupies a connection past the request cap. | HTTP connection and event loop | Medium x Medium | 32 KiB W04/48 KiB W05 byte caps, early 413 path, and 10-second idle-read timeout. | `oversized chunked upload...` and `idle request bodies...`; provider/tool counters remain zero. | P1 |
| R4 | A static asset regression or injected resource is loaded by the local frontend. | Browser execution surface | Medium x Medium | Enforcing CSP, same-origin script/style policy, `nosniff`, `Referrer-Policy`, and `X-Frame-Options`. | Real Edge/CDP header and CSP-block assertions PASS. | P2 |
| R5 | A provider result contains `<img ... onerror=...>`, script text, or link-like markup and the UI renders it as HTML. | Player browser DOM | Medium x High: an unsafe future sink could execute content. | Backend response validation plus `textContent` rendering and CSP defense in depth; no rich-text renderer. | Real Edge marker test observed a text node, no dangerous element/attribute, no execution. | P2 |
| R6 | A model proposes `constructor`, `toString`, `read_files`, or `open_url`. | Tool registry and local data | High x High | Exact two-name allowlist; unknown proposals stop before registry dispatch. | Prototype/forbidden-name tests observed zero dispatches. | P2 |
| R7 | A caller changes sequence numbers, telemetry, or a previous baseline to obtain a stronger plan. | Recommendation integrity and user trust | High x Medium: browser data is easy to edit, but no private resource or privilege is attached. | Strict validation, backend baseline recomputation, no persistence, no canonical game write. | Contract trust-boundary tests and read-only input snapshot assertions PASS. | P3 |
| R8 | A provider error, tool result, bundle, source map, model context, or log contains a key/sentinel. | Provider credential and telemetry privacy | Medium x High | Backend-only configuration, fake-first mode, safe envelopes, allowlisted logs, artifact scan. | Sentinel tests, browser asset scan, and safe-error assertions PASS; real key was never read. | P3 |
| R9 | W04 bypasses a W05-only limit or security header, or a new route skips the shared boundary. | Sibling AI surfaces and process resources | Medium x Medium | Shared server headers/body/resource controls while W04 provider/configuration remains separate. | W04 route regression and mixed W04/W05 limiter tests PASS. | P3 |

The three priorities are P1 resource exhaustion, P2 execution/capability boundaries, and P3 secret/trust isolation. These are the most consequential boundaries in a local unauthenticated process. Public deployment, multi-user authorization, anti-cheat, and live-provider quality are outside this evidence scope.

## 5. Invariants I1-I8

| ID | Rule | Spec acceptance criterion | Enforcement location | Test and actual result | Evidence limitation |
|---|---|---|---|---|---|
| I1 | Invalid initial input does not start provider or business tool work. | A8 | `server.ts` validates content type/body/JSON/request before permit; unchanged history is rejected before provider. | W05 backend invalid-input test: 400/413 and provider/tool counters 0; PASS. | Does not prove behavior for an unimplemented future route. |
| I2 | Browser/model cannot select identity, authorization, provider configuration, or limits. | A9 | Exact request contracts; server runtime configuration; fixed orchestrator/global constants. | Client policy-field test rejects provider/model/role/owner/limit fields; PASS. | Local-only app has no identity system to test. |
| I3 | Only allowlisted tools with valid arguments and allowed scope execute. | A10/A11 | `TrainingPlanOrchestrator`, `TrainingPlanToolRegistry`, exact argument/result validators and recomputation. | Unknown, inherited, invalid-argument, repeated, and invalid-result tests PASS. | Tests use fake/scripted providers, not a live model. |
| I4 | Read-only W05 does not mutate canonical game state. | W08 read-only requirement | No Game import, persistence, or write tool; cloned/frozen request context and deterministic tools. | Tool test keeps serialized request unchanged; no network scenario PASS. | No persistent server canonical state exists in this local model. |
| I5 | Untrusted content is not executable browser content. | A14 | Backend final validation; `setPlainText`/`textContent`; CSP. | Edge/CDP marker test PASS: text visible, no dangerous DOM/handler, no execution. | The browser probe directly exercises the renderer and not a live provider response. |
| I6 | Calls, duration, data size, and concurrency have server limits. | A12/A13 | Body parser, W04 provider policy, W05 orchestrator, global limiter, cancellation. | 110-test suite PASS for caps, timeout/deadline, attempts, concurrency/rate, and cleanup. | Limits are process-local and not distributed quotas. |
| I7 | Secrets and private data stay within the permitted server scope; logs are minimal. | A15 | Runtime config/provider adapters, prompt builder, safe envelopes, log projections, artifact scan. | Sentinel/log/provider-context tests, bundle/source-map scan, and recovered dependency audit PASS. | No real key was inspected, so no claim is made about an unknown external secret store. |
| I8 | Normal W05 succeeds after hardening. | A1/A3 | Fake default, route, orchestrator, tool registry, final validator. | First-plan test/route: `goal_completed`, 2 model steps, 1 tool call, 2 provider attempts, HTTP 200; W04 route also 200. PASS. | Offline fake evidence is not live-model quality evidence. |

## 6. Server limits

These values are the local single-process profile, not industry standards.

| Boundary | Concrete value | Enforcement | Why it fits this project | Test executed |
|---|---:|---|---|---|
| HTTP body | W04 32 KiB; W05 48 KiB; UTF-8 byte counting | `server.ts` streaming parser and route caps | Completed-run telemetry is intentionally small and bounded; rejects oversized input before provider work. | Body-cap, exact UTF-8 boundary, chunked oversize, and malformed-input tests PASS. |
| Body idle read | 10,000 ms default; test seam used 20 ms | `BODY_IDLE_TIMEOUT_MS`, socket timeout in `readJsonBody` | Prevents an incomplete slow body from holding a local connection indefinitely. | `idle request bodies are closed...` PASS. |
| Model/provider output | W05 serialized proposal/plan 8 KiB; W04 provider output 8 KiB and visible advice 1,200 characters | W05 contract/orchestrator and W04 Gemini/provider validators | Prevents unbounded model text while preserving the concise UI contract. | W05 malformed/oversized and W04 output validation tests PASS. |
| W05 steps | Maximum 3 model steps | `MAX_AGENT_STEPS` | Supports first plan (2) and later plan (3) without an open loop. | Step-limit test: 3 steps and no fourth provider call, PASS. |
| W05 tool calls | Maximum 2 dispatched calls | `MAX_TOOL_CALLS` before registry dispatch | Covers evaluator plus evidence for later plans; first plan needs one. | Tool-limit test: 2 calls, third dispatch refused, PASS. |
| W05 provider attempts | Maximum 4 per Agent Run; at most one eligible retry per step | `MAX_PROVIDER_ATTEMPTS` and orchestrator retry logic | Separates attempts from steps and bounds transient failures. | Attempt exhaustion test: exactly 4; transient test remains in step, PASS. |
| W04 provider calls | Maximum 3 under the existing shared 15-second policy; output 8 KiB | W04 Gemini adapter | Preserves W04 sibling semantics without routing it through W05. | W04 Gemini offline retry/fallback/repair tests PASS. |
| Per-call timeout | W05 `min(15,000 ms, remaining run time)` with `AbortSignal`; W04 shared 15,000 ms operation policy | W05 orchestrator/W04 provider | Bounds one provider wait while respecting the total run deadline. | Provider timeout tests PASS; no live provider. |
| Total deadline | W05 45,000 ms monotonic; W04 15,000 ms total policy | W05 orchestrator/W04 provider | Prevents late model output from extending a local request indefinitely. | Injected-clock/deadline and W04 deadline tests PASS. |
| Global concurrency | 2 active accepted W04/W05 executions per `createServer` process | `AiRequestLimits` | Limits the two sibling routes together in a local process. | Mixed-route delayed-provider test: third gets 429 and makes no provider call, PASS. |
| Rate limit | 5 accepted starts per rolling 60 seconds per process | `AiRequestLimits` with injected clock | Makes browser retries non-infinite without pretending to provide identity-based quotas. | Five accepted, sixth 429, clock expiry allows next request, PASS. |
| Cancellation cleanup | Permit released exactly once in `finally`; disconnect aborts provider and no late response is written | `server.ts` abort listeners and `release()` guard | Prevents cancelled/failed work from permanently occupying local capacity. | Disconnect/recovery tests PASS; late result cannot succeed. |

Tool results have no separate byte counter. Their fixed exact schemas, five fixed metrics, maximum three runs, integer bounds, and exact server-side recomputation are the implemented size/scope control.

## 7. T00-T17 scenario matrix

Provider attempts and tool calls below refer to the relevant fixture, not an invented aggregate across unrelated cases. `Provider not called` and `tool not executed` are intentionally distinguished.

| ID | Fixture / expected result before test | Command or test location | Observed result; attempts; tool calls; state | Status; conclusion; limitation |
|---|---|---|---|---|
| T00 | Valid synthetic first-plan request and normal Core test fixtures; expect W05 success and unchanged game rules. | `npm.cmd test`; W05 first-plan test and gameplay tests. | `goal_completed`; 2 model steps, 2 provider attempts, 1 executed tool; gameplay tests pass. No canonical game mutation. | **PASS**. Normal fake path remains available. No interactive game/browser playthrough was part of this row. |
| T01 | Valid JSON succeeds; malformed, wrong-type, unknown-key, and domain-invalid requests fail before provider/tool work. | `tests/training-plan-backend.test.ts`, `tests/ai-coach-backend.test.ts`. | Valid W05/W04 cases call their providers; invalid W05 cases return 400 with provider 0 and tool-registry 0. | **PASS**. Initial HTTP validation boundary is demonstrated. |
| T02 | Oversized W04/W05 bodies and privilege/config fields must stop before work. | Backend body-cap, chunked-stream, and shared-header tests. | W04 32 KiB+1 and W05 48 KiB+1 return 413; chunked oversize returns 413; policy-field request returns 400; provider/tool calls 0. | **PASS**. Slow-body test uses an injected short timeout; production value is 10 seconds. |
| T03 | Unknown/fake resource or altered summary must not access private data or mutate state. | Contract trust-boundary tests; W05 read-only tool tests. | No resource lookup exists; invalid shape is rejected; normalized tools use current validated context only; request snapshot remains unchanged; provider is not reached for invalid shape and tool is not dispatched for forbidden scope. | **PASS, limited**. This proves local-only bounded scope, not an authorization system or a private-resource deployment. |
| T04 | XSS marker through a final-like text value must remain visible text with no element or event handler. | `npm.cmd run test:security:browser`; Edge/CDP renderer probe. | Browser checked `<img>`, `<script>`, event-handler text, Unicode, apostrophe, and `a < b`; textContent matched; dangerous DOM count 0; execution flag false. Provider/tool calls 0 in this isolated renderer probe. | **PASS**. Probe uses the real built renderer; it does not make a live provider call. |
| T05 | HTML/Markdown/link-like content must not become rich text or navigation. | Same browser harness plus static sink inspection of `frontend/src` and `frontend/dist`. | Real browser confirmed markup is text and no dangerous DOM/handler is created; source search found no `innerHTML`/rich-text/URL rendering sink. No provider/tool calls. | **PASS, limited**. The browser fixture did not separately navigate a `javascript:` link; the plain-text contract and absence of a link sink are the evidence. |
| T06 | Malformed, extra-key, forged, or oversized provider final must fail safely. | `tests/training-plan.test.ts` malformed/oversized/forged final cases; backend safe-envelope test. | Fixture-specific: malformed/oversized proposal cases stop after 1 provider attempt and 0 tool calls; the fake invalid-final case reaches its scripted final after 2 attempts; no successful response; safe HTTP response is generic 503. | **PASS**. Fake/scripted provider only; no live model claim. |
| T07 | `read_files`, `open_url`, `constructor`, `toString`, and unknown names must not dispatch. | `prototype tool names...` and registry negative tests. | Each scripted proposal makes 1 provider attempt and 0 tool calls; injected handler dispatch count remains 0; request unchanged. | **PASS**. Closed registry blocks inherited and arbitrary names. |
| T08 | Invalid `limit`/extra args must reject; valid boundary limit must execute exact allowed tool. | Contract, registry, evidence-tool, and normal first-plan tests. | Invalid arguments: provider attempt 1, tool calls 0. Valid first-plan fixture: provider attempts 2, tool calls 1, exact result accepted. | **PASS**. Positive and negative cases both exercised. |
| T09 | Injection-like/forbidden fake proposal must be rejected independently of prompt wording. | `prototype tool names...`; fake provider scenarios. | Forbidden proposal: provider attempt 1, tool calls 0, no handler side effect. W05 model context contains no free user text in this fixture. | **PASS, limited**. This is execution-control evidence, not proof of immunity to a live model seeing arbitrary user text. |
| T10 | Extra-field, forged, oversized, or sentinel-bearing tool result must not reach the next model or response. | `invalid tool output...`, sentinel-bearing tool test, backend safe-error test. | Invalid result: provider attempts 1, tool calls 1, handler called once, terminal `invalid_tool_result`, no next provider input. Sentinel absent from model-input capture, logs, and HTTP response. | **PASS**. Dispatched-but-rejected result is distinguished from zero-dispatch rejection. |
| T11 | Repeated action and exact step/tool/attempt budgets must stop further work. | W05 orchestrator tests for repeated action, step limit, tool limit, attempt exhaustion. | Repeated action: 1 tool call, no second dispatch. Tool limit: 3 provider attempts, 2 calls, third refused. Step limit: 3 steps, 2 calls, no fourth provider call. Attempt exhaustion: 4 attempts. | **PASS**. Test seam isolates step-limit classification while production tool budget remains 2. |
| T12 | Timeout, total deadline, cancellation, and late output must not become success. | Deadline/timeout/cancellation tests in W05 core/backend and W04 suites. | W05 timeout: 1 provider attempt, 0 tool calls; late tool proposal: 1 attempt, 0 tool calls; expired run: 0 attempts; disconnect prevents later steps; permits recover. | **PASS**. Timers are injected and deterministic; no 45-second wait is required. |
| T13 | Three parallel valid requests and six starts in 60 seconds must enforce shared limits, then recover. | W05 backend mixed-route limiter tests. | Two W04 jobs start; third W05 returns 429 `server_busy` with W05 provider 0. Five rate-limited-window starts succeed; sixth returns 429 `rate_limited`; after clock reaches 60,000 ms a valid W05 request succeeds. | **PASS**. Process-local limiter only; not a distributed quota. |
| T14 | Sentinel in provider error/tool/log text must produce safe output and no forged event. | W05 sentinel/log tests; browser asset scan in security script. | Provider failure called once and returns generic 503; tool sentinel does not reach next input/log; log keys are allowlisted and newline/sentinel correlation text is removed; all built frontend assets/maps have no sentinel. | **PASS**. The value was synthetic and is not reproduced here. |
| T15 | Modified browser/local-memory summary or score must not gain privilege or mutate canonical state. | Frontend/backend contract and session tests; read-only tool snapshot assertion. | Trust-boundary drift is rejected; valid fabricated telemetry remains only recommendation input; tool serialization before/after is identical; no persistence/write tool exists. Provider is not called for invalid request; no tool for invalid scope. | **PASS, limited**. No authenticated/private resource exists, so this cannot prove account authorization. |
| T16 | Production frontend build must serve headers, enforce CSP, preserve text rendering, and keep sentinel out of artifacts. | `npm.cmd run test:security:browser` (includes `npm run build:frontend`). | Edge loaded the page; CSP contains `script-src 'self'`, no `unsafe-inline`/`unsafe-eval`; `nosniff` and `no-referrer` present; inline script was blocked with a `script-src` violation; DOM probe passed; 18 source maps and JS assets were scanned with no sentinel. Provider/tool calls 0 in this static/browser run. | **PASS, limited**. The harness did not start the backend, so an API round trip under CSP was not observed in this exact run. |
| T17 | Slow oversized stream and the HTTP-to-provider boundary must remain bounded and safe. | W05 backend oversized chunked and idle-body tests; full `npm test`. | Chunked oversize returns 413 before provider/tool; idle body closes at injected timeout with provider 0; no uncaught test failure. | **PASS, limited**. This proves the HTTP boundary and no-work property, not a full browser-to-live-provider chain. |

## 8. CSRF decision

The frontend uses `fetch` with `method: "POST"` and `Content-Type: "application/json"`; it does not use `credentials: "include"`. The frontend and backend are separate local origins (`:4173` and `:3001`), and the application has no session cookie, bearer header, account, private resource, or persistent write-capable server state. The browser therefore does not automatically attach an authentication cookie or bearer credential to this action.

CSRF for a credential-bearing state-changing action is **not applicable in the current implementation**. This is not because CORS is authentication: CORS only controls which browser origins may read a response, while a direct caller can still send requests and consume local resources. The actual protections are strict request/body validation, local CORS allowlisting, shared concurrency/rate limits, bounded provider/orchestrator work, cancellation cleanup, read-only tools, generic errors, and text-only rendering.

If cookies, bearer credentials, accounts, private resources, or write-capable endpoints are introduced, this decision expires and same-site/origin/CSRF-token tests are required.

## 9. Dependency audit

Commands actually run successfully after moving npm to a clean user-owned temporary cache:

```text
npm.cmd config set cache "$env:TEMP\selfbound-npm-cache" --location=user
npm.cmd cache verify
npm.cmd ping --registry=https://registry.npmjs.org/
npm.cmd audit --cache "$env:TEMP\selfbound-npm-cache" --prefer-online --omit=dev
npm.cmd audit --cache "$env:TEMP\selfbound-npm-cache" --prefer-online --include=dev
```

The temporary cache verified successfully with zero entries, `npm ping` returned `PONG 288ms`, and both audit commands exited 0 with `found 0 vulnerabilities`. The earlier failure was a local npm-cache/registry-access problem, not an observed package advisory.

The installed top-level dependency inventory was checked with `npm.cmd ls --depth=0`:

- Runtime: `@google/genai@2.24.0`.
- Development: `@types/node@26.6.2`, `ts-node@10.9.2`, `typescript@7.0.2`.
- `package-lock.json` is lockfile version 3 and contains the same root dependency declarations.

Decision: no dependency or lockfile change was needed. The current runtime and development dependency tree produced a clean audit result. This is a point-in-time registry result for the checked lockfile, not a permanent guarantee for future dependency changes.

## 10. Before/after comparison

The implementation checkpoint pair is `7758e64` -> `3c3b42c`. The initial runtime command output was not preserved, so the comparisons below are deliberately incomplete. Parent-commit source inspection is identified as static evidence, not a runtime result.

| Scenario and same fixture | Starting checkpoint and result | Change | Ending checkpoint and result | What it proves / does not prove |
|---|---|---|---|---|
| Shared concurrency/rate: two delayed valid W04 requests plus a third valid W05; five accepted starts plus sixth in the same window | `7758e64`: no saved runtime result. Static inspection found no `AiRequestLimits` implementation; this is not a before-test PASS/FAIL. | Added process-local `2` active / `5 per 60s` limiter shared by both routes, with release cleanup. | `3c3b42c`: backend test PASS; third request `429 server_busy`, sixth `429 rate_limited`, later request succeeds. | Demonstrates the final limiter behavior. It does not quantify the old runtime behavior because that run was not saved. |
| Frontend CSP/security headers: production static `GET /` and a controlled inline script | `7758e64`: no saved header/browser result. Static parent source had no security-header profile; not a browser result. | Added CSP, `nosniff`, `no-referrer`, and `X-Frame-Options` in `scripts/serve.mjs`, plus the browser harness. | `3c3b42c`: Edge/CDP PASS; headers present and inline script blocked with `script-src` violation. | Demonstrates actual final browser behavior, not a controlled before/after measurement. |
| XSS/text fixture: `<img src=x onerror=...><script>...</script>` plus Unicode/apostrophe/`a < b` | `7758e64`: no saved browser DOM result. Existing source inspection does not establish that a browser test was run. | Added `plain-text.ts`, routed W04/W05 display through text-only rendering, and added browser assertions. | `3c3b42c`: Edge/CDP PASS; exact text preserved, dangerous nodes/handlers 0, execution flag false. | Demonstrates final renderer behavior. It does not prove the old renderer was exploitable without a preserved old browser run. |
| Oversized/slow W05 body: 48 KiB+1 chunked request and idle incomplete body | `7758e64`: no saved runtime result. Parent plan/source described an earlier body boundary, but no initial stream run is claimed here. | Added immediate cap response and idle-read timeout/cleanup while preserving 48 KiB W05 and 32 KiB W04 caps. | `3c3b42c`: backend tests PASS; 413/closed request and provider/tool calls 0. | Demonstrates final bounded behavior; it is not a measured before/after latency or connection-consumption comparison. |

## 11. Security events and secrets

The runtime log projection allows only event, outcome, reason code, sanitized correlation ID, provider-attempt count, tool-call count, duration, and status. The following are synthetic redacted examples, not copied production logs:

Allowed completed event:

```json
{
  "event": "agent.run.completed",
  "outcome": "success",
  "reasonCode": "GOAL_COMPLETED",
  "correlationId": "synthetic-w08-000",
  "providerAttempts": 2,
  "toolCalls": 1,
  "durationMs": 12,
  "status": 200
}
```

Denied tool event:

```json
{
  "event": "agent.tool.rejected",
  "outcome": "denied",
  "reasonCode": "TOOL_NOT_ALLOWED",
  "correlationId": "synthetic-w08-001",
  "providerAttempts": 1,
  "toolCalls": 0,
  "durationMs": 0,
  "status": 400
}
```

These examples contain no session/bearer identifier, prompt, telemetry, tool arguments, tool result, raw provider output, secret, stack trace, or hidden reasoning. The W05 logger test verified the allowlisted key set and rejected newline/sentinel correlation content. Security events are written to the process logger; no persistent retention, reader ACL, or deletion service exists in this local application. Process restart clears in-memory limiter/session state; console retention is delegated to the local runtime environment.

The synthetic sentinel was used only in tests. It was absent from captured model inputs, HTTP safe responses, sanitized logs, frontend JavaScript, and all 18 frontend source maps. The real `.env` file was not opened, printed, or searched for values.

## 12. Reproducibility, conclusions, and remaining risk

| Check | Exact command/location | Actual checkpoint result | Limitation |
|---|---|---|---|
| Typecheck | `npm.cmd run typecheck` | PASS | Type checking is not runtime/browser evidence. |
| Offline unit/integration/security suite | `npm.cmd test` | PASS, 110/110 | Fake/scripted providers and SDK doubles; no live model. |
| Production build | `npm.cmd run build` | PASS | Build success is not a deployment audit. |
| Reachability | `node scripts/check-reachability.mjs` after build | PASS, all four targets | It is gameplay reachability, not a security proof. |
| Browser smoke/T04/T05/T16 | `npm.cmd run test:security:browser` | PASS for the real Edge DOM/CSP assertions | The exact harness did not start the backend/API. T05 did not separately navigate a `javascript:` link. |
| Sentinel artifact scan | Browser script plus `rg` over `frontend/dist` JS/maps | PASS, no matches | It cannot detect a secret never supplied to the process, and no real key was read. |
| Dependency audit | `npm.cmd audit --cache "$env:TEMP\\selfbound-npm-cache" --prefer-online --omit=dev`; same with `--include=dev` | PASS, both exit 0 with `found 0 vulnerabilities`; registry ping returned `PONG 288ms`. | Point-in-time result; rerun after dependency changes. |

### What is proven at `3c3b42c`

- The fake W05 first-plan route succeeds with `goal_completed`, two model steps, one real allowed deterministic tool call, and two provider attempts.
- Invalid HTTP/body/request fixtures do not start provider or tool work.
- W05 proposals, tool arguments/results, final evidence, budgets, cancellation, and safe response boundaries are runtime-tested offline.
- W04 remains available as a separate sibling route and shares the outer HTTP/resource/header protections.
- Real local Edge evidence confirms text-only rendering and enforced CSP behavior.
- The synthetic secret does not appear in captured model/log/HTTP/artifact channels tested here.

### Reviewed but not proven by this pass

- No live W04/W05 provider behavior or live-model prompt-injection resistance.
- No public deployment, multi-process, distributed rate limit, authenticated user, or private-resource authorization.
- No saved pre-hardening runtime results for a complete quantitative before/after comparison.
- The audit is clean for the current lockfile and registry response; future dependency changes require a new audit.
- No full browser/API round trip under the production CSP in the current browser harness.

The next concrete test is to run a browser session with the fake backend attached so the W05 API round trip is observed under the same CSP. This does not require a live provider.

## 13. Contribution and AI responsibility record

| Contributor/actor | Concrete contribution or verification | Test/evidence that can be explained | Limitation |
|---|---|---|---|
| Prior W08 implementation team | Added the committed HTTP/resource/browser/tool/log hardening in `3c3b42c`. | `npm test` security cases, build, reachability, and browser harness. | This evidence pass does not reattribute individual source changes beyond existing repository records. |
| Documentation maintainer | Inspected required artifacts, ran the current fake-first checks, and created this evidence record. | Command table, T00-T17 matrix, audit result, and artifact scan above. | No source or test change was made. |
| Codex | Assisted with repository inspection and evidence drafting under the repository instructions. | Only claims backed by the recorded commands or source/test inspection were included. | AI assistance is not a substitute for live-provider or deployment verification. |

No chain-of-thought, credentials, raw provider output, or private environment values are included.

