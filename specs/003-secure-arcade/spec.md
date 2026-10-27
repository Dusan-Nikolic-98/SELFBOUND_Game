# W08 Secure Arcade — Security Specification

Status: planning artifact. This phase does not change source code, tests, `package.json`, or application configuration. Every control marked as planned must receive an executable test before it is described as implemented.

## 1. Goal and strictly defined scope

The goal is to harden the existing W05 Training Plan flow from the browser click to the rendered result, together with the shared HTTP, CORS, security-header, concurrency, rate-limit, and secret-boundary controls used by W04 AI Coach and W05 Training Plan. W05 is the primary flow because it already has at least two model steps, real execution of an allowed tool, a backend orchestrator, a closed registry, a fake provider, explicit limits, and runtime validation.

The required result is evidence that:

- the normal W05 fake flow still completes with two model steps and at least one real read-only tool execution;
- an invalid initial request does not start the provider or a tool;
- a model proposal is not authorization and cannot extend the allowlist, data scope, or budget;
- tool results and the final plan are validated before continuation and before rendering;
- W04 `POST /api/ai/coach` remains functional as a sibling flow and receives the same shared HTTP/resource/secret protections;
- the server has explicit limits for size, time, call count, concurrency, and request frequency.

This feature does not introduce a new AI flow, tool, authentication system, database, persistent session, anti-cheat system, public deployment, or gameplay change. W08 hardening stays within the existing W04/W05 boundaries.

## 2. Actual architecture and data flow

```text
Browser: Game + W05 page-memory session + TrainingPlanClient
    -> POST /api/training-plan
       or POST /api/ai/coach
    -> CORS/origin + method/content-type + streaming body limit
    -> runtime request validation
    -> global accepted-request rate limit + global in-flight concurrency limit
    -> W05 TrainingPlanOrchestrator
       -> provider-neutral fake or optional Gemini adapter
       -> model proposal validation
       -> exact tool registry / allowlist
       -> deterministic read-only tool
       -> tool-result validation and recomputation
       -> final validation and evidence grounding
    -> safe JSON envelope
    -> frontend contract validation
    -> textContent-only structured browser UI

    every backend flow -> minimal security/operational event without request data,
                          prompts, raw output, secrets, or complete telemetry
```

### Component responsibilities

| Layer | Actual location | Responsibility | Must not be authoritative for |
|---|---|---|---|
| Browser/game | `frontend/src/main.ts`, `training-plan-session.ts`, `training-plan-client.ts` | Collects completed runs in memory, creates a snapshot, sends an explicit request, and renders an already validated response. | Identity, authorization, provider, limits, or confirmation of a result. |
| HTTP/API | `backend/src/server.ts` | Routing, CORS origin, method, JSON content type, body cap, request validation, safe status/envelope, and cancellation. | Client-supplied `provider`, `maxSteps`, role, or owner configuration. |
| Resource policy | Planned shared HTTP layer | Global active W04/W05 operation count and accepted starts in a time window. | The browser pending flag. |
| W05 orchestrator | `backend/src/training-plan-orchestrator.ts` | Step/tool/provider budgets, timeout/deadline, retry, cancellation, terminal reasons, and final validation. | Direct model execution or raw internal objects. |
| Provider | `fake-training-plan-provider.ts`, `gemini-training-plan-provider.ts` | Returns an unknown model-step result through a provider-neutral interface; keeps the Gemini key server-side. | Tool authorization. |
| Tool registry | `training-plan-tools.ts` | Exactly two names, exact arguments, availability, dispatch, and exact result recomputation. | Dynamic property calls or generic URL/shell/filesystem tools. |
| Browser output | `main.ts` + HTML elements | Renders plain text through `textContent`; does not add a rich-text/HTML renderer. | Model/provider output as HTML or executable content. |
| Logs/secrets | Backend runtime/config/logger | Allowlisted metadata; the environment secret is used only by the corresponding backend adapter. | Prompt, request, telemetry, token, key, stack, or raw output logging. |

W04 is a sibling route: `POST /api/ai/coach` does not pass through the W05 orchestrator or W05 tools, but shares the HTTP boundary, CORS policy, planned global resource limits, security-header profile, and secret-boundary checks.

## 3. Data inventory

Browser data is untrusted because a user can modify JavaScript state, the HTTP body, or DevTools values. The backend accepts it only through runtime validation and does not treat a sequence number as proof of identity or of a played run.

| Data | Controlled by | Checked/used at | Sent to the model? | Retention | Purpose and risk |
|---|---|---|---|---|---|
| `completed runs` | Browser snapshot; content can be changed by the user | Frontend W05 validator, then backend W04 summary validator; W05 tool context | Not as raw summaries; the tool normalizes required metrics | Page memory only; at most 3 entries; reload clears it | Functional plan input; not a verified game result. |
| Telemetry | Game/Coach collector in the browser | `isCompletedRunSummary`, nested bounds, and consistency checks | Indirectly through deterministic W05 tool output | In the summary for the page session | Can be false or inflated; grants no privilege. |
| Sequence numbers | Generated locally by `TrainingPlanSession`, but request is unauthenticated | Ascending positive safe integers; baseline consistency | Bounded workflow metadata (`currentSequences`) | Page memory and latest-plan baseline | Supports ordering; does not prove user, ownership, or gameplay. |
| Previous plan/baseline | Browser copy of the previous valid W05 response | Backend previous-plan, baseline, evidence, and newer-sequence validators | Only focus and baseline max sequence in model metadata; evaluation runs through a tool | Page memory until reload | Untrusted claim; backend recomputes evaluator output. |
| Tool arguments | Provider/model proposal | Orchestrator and registry exact-key/allowlist/domain validation | Proposed by the model | Bounded in-memory run; not logged | Can be malicious; never executes without all checks. |
| Tool results | Deterministic backend tool | Shape, bounds, and exact recomputation before the next model step | Yes, normalized results only | One Agent Run | Must not contain extra fields, secrets, raw objects, or external data. |
| Provider output/proposal | Fake or optional Gemini provider | Proposal size/shape, final/evidence validation | N/A; output is validated by the backend | Raw output is not returned or logged | Must not become a tool, HTML, or successful plan without validation. |
| Errors | Runtime/provider/HTTP | Internal classification; public stable envelope | No | Bounded internal metadata; generic response | Must not reveal stack, raw error, prompt, key, or provider response. |
| Security/operational logs | Backend/logger | Explicit allowlist fields and field sanitization | No | Local console/process lifetime; no persistent retention defined | Diagnostics without request contents or secrets; log injection must be tested. |
| Environment secrets | Backend process (`GEMINI_API_KEY`, `TRAINING_PLAN_GEMINI_API_KEY`) | Provider config/runtime; fake mode does not read the W05 key | No | Environment/secret manager outside the repository and browser | Never in frontend bundle, HTTP response, model context, or logs. |
| Cookies/Authorization | None in the actual implementation | No session/auth middleware | No | No cookie/localStorage session | CSRF for a credential-bearing action is currently inapplicable; see §11. |
| URL parameters/localStorage | Not used by the application for W05 | N/A; verify they are not introduced as hidden inputs | No | Not stored | Do not add an implicit state source for the W08 test. |

## 4. Trust boundaries

1. **Browser → HTTP:** everything from the browser is untrusted. The frontend validator is a usability control; the backend validator is the required boundary control. CORS is not authentication.
2. **HTTP → application policy:** after body/content/request validation, the server decides whether provider/orchestrator work may start. The browser does not choose provider, model, limits, or identity.
3. **Orchestrator → provider:** the provider receives only `TrainingPlanModelStepInput` with bounded workflow metadata and validated tool results. It does not receive SDK execution callbacks, raw request summaries, or secrets.
4. **Model proposal → tool registry:** a proposal is unknown data. Only exact allowlist, exact arguments, availability, repetition, state-version, and budget checks may lead to dispatch.
5. **Tool → model:** the tool result is validated and compared with server-side recomputation before it enters the next model context.
6. **Model final → response/UI:** final draft, evidence, baseline, and success envelope pass backend and frontend validation. The browser renders plain text, never provider output as HTML.
7. **Runtime → logs:** a security event is a separate bounded metadata channel. Do not copy untrusted tool names, error messages, or text into logs without allowlist/sanitization.
8. **Runtime → provider credential:** the API key exists only in the backend process and Gemini adapter. The fake provider and frontend do not read the credential.

## 5. Single-user/local-only model

Within this scope SELFBOUND has no accounts, login, session cookie, bearer token, private games, database, backend session store, or leaderboard. A W05 sequence/baseline is only a browser page-session mechanism for regeneration gating. A predictable or modified sequence number is not identity, ownership, or proof that a run was played.

Therefore W08 does not add login, a database, multi-user authorization, or an anti-cheat system merely to create a form. A direct API caller can submit fabricated telemetry, but cannot gain privilege, change canonical game state, or change server provider/limits. T15 must demonstrate this limited claim: modified browser summary/score can only affect an untrusted read-only recommendation or be rejected by validation; it does not become a verified server result.

This model does not justify omitting rate limiting, concurrency protection, input/output validation, or secret boundaries. Those controls protect local server and provider resources even without identity.

## 6. Threat model and priorities

The assessment is qualitative for one local process: likelihood (`L`) and impact (`I`) are low, medium, or high. Priorities are W08 hardening choices, not a claim that other risks are harmless.

| ID | Concrete scenario and precondition | Resource | L × I and rationale | Existing control | Planned evidence | Priority |
|---|---|---|---|---|---|---|
| R1 | An attacker sends multiple valid W04/W05 POST requests in parallel; there is no global in-flight limiter. | Node process, memory, provider slots | High × high: local routes accept concurrent work and W05 has multiple steps. | Per-request W05 budgets; frontend pending flag only. | T13 with delayed fake provider and active-run counter. | P1 |
| R2 | A fast sequence of valid requests exhausts fake/Gemini/provider and CPU; there is no global rate limit. | Provider quota, latency, local availability | High × medium/high: local-only mode has no trusted identity scope for rate limiting. | No server-side global limiter. | T13 rolling-window test: accepted limit, `429`, then success after the window. | P1 |
| R3 | An oversized body is not stored after the cap, but the stream is still read to completion; a slow sender can occupy a connection/CPU. | HTTP connection and event loop | Medium × medium: a body cap exists but there is no early termination. | W04 32 KiB/W05 48 KiB caps and 413; post-limit chunks are not stored. | T02/T17 check 413, zero provider calls, and early-abort/read behavior. | P1 |
| R4 | The local static frontend has no CSP, `nosniff`, or Referrer-Policy; a regression or injected asset receives a wider browser surface. | Browser DOM and resource execution | Medium × medium: the static server currently sends only cache/content-type headers. | Existing external module and plain-text UI paths. | T16 reads actual headers and checks a controlled blocked script/resource. | P2 |
| R5 | A provider/fake returns `<img ... onerror=...>` or markup text; a future UI change could turn it into HTML. | Browser DOM/XSS | Medium × high: model output is untrusted and XSS affects the player. | `main.ts` currently uses `textContent`; no rich-text renderer. | T04/T05 browser test checks text nodes and absence of dangerous DOM, not only absence of `alert`. | P2 |
| R6 | A fake/provider returns `constructor`, `toString`, `read_files`, or another forbidden tool proposal. | Tool registry and local data | High × high: model output is untrusted; dynamic dispatch could open capabilities. | Exactly two W05 tools; orchestrator/registry validation. | T07/T09 check zero dispatch and zero forbidden side effects. | P2 |
| R7 | The browser sends false sequence, summary, or baseline data to obtain an undeserved assessment or regeneration. | Plan/evidence integrity and user trust | High × medium: input is trivially changeable, but there is no private resource or privilege effect. | Strict W04/W05 validators, baseline recomputation, no backend persistence. | T01/T03/T15 check rejection or limited read-only consequences and unchanged canonical game state. | P3 |
| R8 | An API key or synthetic sentinel leaks through the bundle, model context, raw error, or log. | Provider credential and telemetry privacy | Medium × high: a key can enable unauthorized provider calls. | Backend-only config, fake mode does not read W05 key, sanitized logs/safe envelopes. | T14 and artifact/model/log sentinel searches. | P3 |
| R9 | W04 and W05 acquire different HTTP/security controls, or a new route bypasses the shared limits. | Sibling AI surfaces | Medium × medium: one unprotected route can exhaust the same process/provider. | Separate route/provider/config; W04 regression suite. | T11/T13/T16 explicitly cover both routes. | P3 |

**Three priorities:** P1 is resource exhaustion because global server-side limits are currently absent; P2 is the browser/tool execution boundary because it affects code execution or capability; P3 is trust/secret isolation because the local-only model is inherently untrusted and must remain non-privileged and credential-free. R7 is not a reason to build anti-cheat: the test only verifies that false browser input has no stronger server role.

## 7. Required W08 invariants I1–I8

| ID | Rule | Planned enforcement location | Acceptance test |
|---|---|---|---|
| I1 | An initial HTTP request that fails input/access checks does not start a provider or business tool. | `server.ts`: method/content/body/request validation before limiter acquire/provider; W05 unchanged-history preflight. | T01/T02/T03/T08; provider/tool counters remain 0. |
| I2 | Browser and model do not determine identity, authorization, provider configuration, or limits. | Server-side fixed config, no client overrides, global limiter, and orchestrator constants. | T02/T03/T15 with `role`, `ownerId`, `provider`, `model`, `maxSteps`, and limit drift. |
| I3 | Only an allowlisted tool with valid arguments and an allowed data scope executes. | `TrainingPlanOrchestrator` + `TrainingPlanToolRegistry`, exact recomputation, bounded request context. | T07/T08/T09/T10; forbidden dispatch count 0. |
| I4 | The read-only agent flow does not change canonical game state. | Cloned/frozen W05 tool context; no Game import, persistence, or write tool. | T03/T15 before/after game-state snapshot and tool side-effect counter. |
| I5 | Untrusted content does not become executable browser content. | Backend final validator, `main.ts` `textContent`, CSP defense-in-depth, no `innerHTML`/rich text. | T04/T05/T16 browser DOM/CSP evidence. |
| I6 | Calls, duration, data size, and concurrent executions have server-side limits. | Route body parser, W05 orchestrator, W04 provider, global concurrency/rate limiter. | T02/T11/T12/T13/T17. |
| I7 | Server secrets stay in the permitted server scope; browser, model context, and operational logs receive only needed data. | Runtime config/provider adapters, prompt builder, sanitized logger, safe envelopes. | T14/T16 plus W04/W05 secret searches and captured model/log inputs. |
| I8 | The normal W05 flow succeeds after hardening. | Do not change the W05 happy path except shared pre-provider controls; fake default remains. | T00/T11/T13; `goal_completed`, 2 steps, 1 tool, 2 attempts. |

## 8. Concrete server limits

These are the W08 local profile, not industry standards. Global limits cover W04 and W05 within one Node process; they are not distributed or multi-user quotas.

| Limit | W08 local value | Existing state / plan |
|---|---:|---|
| HTTP body | W05 `48 KiB`; W04 `32 KiB`; count UTF-8 bytes during streaming | Caps and 413 exist; plan early-aborts/stops reading after the limit. |
| Model proposal/final output | W05 `8 KiB` UTF-8; W04 provider output `8 KiB` and visible advice `1,200` chars | Runtime caps already exist and remain server-side. |
| Tool result | W05 fixed shape: at most 3 runs × 5 metrics or one fixed evaluator object; serialized hard cap `8 KiB` if needed | Exact validator/recomputation; no arbitrary fields/free text. |
| W05 model steps | Maximum `3` | Already enforced by the orchestrator. |
| W05 tool calls | Maximum `2` | Already enforced at dispatch. |
| W05 provider attempts | Maximum `4` per Agent Run; retries use the same counter | Already enforced; W05 Gemini SDK retries are disabled. |
| W05 provider-call timeout | At most `15 s`, or less than remaining time | Already enforced with AbortSignal/call timeout. |
| W05 total deadline | `45 s`, monotonic | Already enforced; late output is discarded. |
| W04 provider budget | Maximum `3` provider calls in its existing `15 s` total profile | Do not change W04 semantics; include it in global resource tests. |
| Local evaluator | At most 3 validated runs and exactly 5 metrics per run; no unbounded loop | Existing fixed data shape; test no input-driven expansion. |
| Global concurrency | Maximum `2` active accepted W04/W05 AI executions per local server process | New planned control; excess gets stable `429 server_busy` and no provider call. |
| Global rate limit | Maximum `5` new accepted W04/W05 executions in rolling `60 s` per process | New planned control; without trusted identity, use a documented global demo limit; excess gets `429 rate_limited`. |
| Body/read timeout | Choose and test a concrete idle-read value during implementation | Current parser has no early abort/read timeout; implementation decision remains open. |

Rate/concurrency checks apply after method/content/body/request validation so I1 remains true and invalid requests do not consume provider/tool work. A rate slot is reserved only for an accepted start; a concurrency slot is released in `finally`, including failure, timeout, and disconnect. The implementation must not release a slot merely because a `Promise.race` settled while uncontrolled provider work continues.

## 9. Acceptance criteria

### Positive cases

- **A1 W05 first plan:** a valid synthetic request passes; the fake provider executes `get_recent_run_evidence`, then final; response has `completed: true`, `goal_completed`, 2 steps, 1 tool call, and 2 provider attempts.
- **A2 W05 later plan:** valid prior state with a newer sequence passes evaluator → evidence → final, within 3 steps/2 tools, and the baseline is computed by the backend.
- **A3 W04 sibling:** a valid Coach request remains `200` with valid fake advice and no W05 configuration change.
- **A4 boundary values:** maximum valid run count, valid `limit` values, valid body boundaries, and valid output caps pass using UTF-8 byte counting.
- **A5 concurrency recovery:** a legitimate request passes after earlier slots finish or are cancelled.
- **A6 safe text:** normal text, Unicode, apostrophe, and `a < b` remain visible as text, not HTML.
- **A7 headers/CSP:** the production build loads, module script and API connection work under enforcing CSP, and a controlled forbidden script/resource is blocked by the stated directive.

### Negative cases

- **A8 invalid input:** malformed JSON, wrong content type, unknown keys, invalid nested summary, zero/too many runs, or oversized body produce stable `400/413`; provider/tool count is 0.
- **A9 privilege/config injection:** `role`, `ownerId`, `provider`, `model`, `maxSteps`, `maxToolCalls`, or environment-like fields are rejected or safely ignored according to the contract and cannot change server policy.
- **A10 tool abuse:** `read_files`, `open_url`, `constructor`, `toString`, invalid `limit`, unavailable evaluator, and repeated action do not execute a handler and do not change state.
- **A11 provider abuse:** malformed/oversized final output, invalid tool result, extra fields, or synthetic secret produce safe failure; raw output/detail is absent from response, logs, and next model input.
- **A12 resource abuse:** a third active job and the sixth accepted start in 60 seconds receive stable `429`; rejected requests make zero provider calls, and a legitimate request later succeeds.
- **A13 timeout/deadline:** delayed provider output cannot become success after timeout/deadline; no new step/tool starts and the slot is released correctly.
- **A14 browser injection:** an XSS marker in a valid fake final remains a text node; no script, image handler, event attribute, or rich-text interpretation appears.
- **A15 secret boundary:** the sentinel is absent from frontend bundle/source maps, HTTP response, model context, and sanitized logs; only a synthetic value is used.

## 10. T00–T17 test matrix

This is the W08 test plan. In this documentation-only phase every status is `NOT RUN`; implementation and execution belong to later tasks. `NOT RUN` is not evidence of success.

| ID | Fixture/input | Expected result | Test location and observation |
|---|---|---|---|
| T00 | Valid W05 first-plan fake request and normal game startup | Game and W05 work; `goal_completed`, 2 steps, 1 tool, 2 attempts | Offline integration/gameplay smoke; provider/tool/state counters. **NOT RUN.** |
| T01 | Direct HTTP valid, malformed, unknown-key, and domain-invalid JSON | Valid passes; each invalid request is 400 with zero provider/tool calls | `tests/training-plan-backend.test.ts`; **NOT RUN.** |
| T02 | Oversized W04/W05 body plus `role`, `ownerId`, `maxSteps`, `provider`, and model fields | 413/400 before provider; body is not unnecessarily stored; privilege/config drift cannot change policy | HTTP stream test and counters; **NOT RUN.** |
| T03 | Unknown/fake resource or modified browser summary in local-only mode | No private-resource lookup; read-only result does not change canonical game state | Contract/session/tool test with before/after snapshot; **NOT RUN.** |
| T04 | Valid provider final with `<img src=x onerror=...>` and normal text | Text node, no element/handler; normal text remains visible | Real browser DOM test; **NOT RUN.** |
| T05 | HTML/Markdown/link text, including `javascript:` and `<b>` | No rich-text or link navigation; UI contract remains plain text | Browser policy test; **NOT RUN.** |
| T06 | Malformed, extra-key, and oversized provider final | Safe failure; no success or raw-output UI rendering | Fake scripted provider and backend envelope; **NOT RUN.** |
| T07 | Tool names `read_files`, `open_url`, `constructor`, `toString`, and unknown names | No handler dispatch or side effect; safe terminal/503 | Registry handler counters; **NOT RUN.** |
| T08 | Allowed tool with invalid `limit`/empty args and valid boundary `limit` | Invalid zero dispatch; valid limit works and result is exact recomputation | Tool/orchestrator tests; **NOT RUN.** |
| T09 | Prompt-injection attempt and fake provider intentionally returning a forbidden proposal | Proposal rejected independently of prompt; forbidden operation count 0 | Fake provider scenario. W05 has no free user text in model context, so this is execution-control evidence, not proof of live-model immunity. **NOT RUN.** |
| T10 | Tool result with extra field, excessive content, and synthetic secret | Result is not passed to the model; no success or secret leak | Custom tool handler plus captured model inputs/logs; **NOT RUN.** |
| T11 | Repeated action and exact budgets: 3 steps, 2 tools, 4 attempts | Repeated/over-budget terminal; no fifth attempt or third dispatch | Existing W05 tests plus adversarial fake scenarios; **NOT RUN.** |
| T12 | Provider timeout, total deadline, and late result | Abort/terminal; no late success or new work; bounded counters | Injected clock/timer and delayed provider; **NOT RUN.** |
| T13 | 3+ parallel valid W04/W05 requests; 6 starts within 60 seconds; then release/window | Maximum 2 active; excess 429; sixth rate-limited; later valid request succeeds | HTTP server with delayed fake provider and deterministic limiter clock; **NOT RUN.** |
| T14 | Sentinel in provider error/tool field/log-injection text with newline | Generic response; sentinel absent from bundle/context/log; no forged log event | Captured logger, response, model input, and artifact search; **NOT RUN.** |
| T15 | Browser/local-memory summary or score modified before click | No privilege, server canonical mutation, or private-data access; invalid shape rejected | Session/client/backend test and before/after game-state snapshot; **NOT RUN.** |
| T16 | Production frontend build served by static server | CSP, `nosniff`, Referrer-Policy present; game/UI/API work; controlled resource is blocked | Real browser plus header inspection; **NOT RUN.** |
| T17 | Slow oversized stream or chain across HTTP → limiter → provider → UI | Bounded connection/resource behavior, no provider/tool execution, safe response, no raw data crossing boundary | HTTP stream and end-to-end adversarial fixture; **NOT RUN.** |

T00–T03, T06–T15, and T17 should be automated; T04/T05/T16 require a real browser. T13 requires controlled time or isolated server state. T09 is limited by the actual model context: W05 has no free user text, but a malicious fake-provider proposal must still be rejected.

## 11. CSRF decision

`frontend/src/training-plan-client.ts` uses `fetch` with `method: "POST"`, `Content-Type: "application/json"`, and no `credentials: "include"`. The endpoint is on `127.0.0.1:3001`, while the frontend is on `127.0.0.1:4173`. By default, the browser does not send cross-origin cookies for this fetch (`credentials` is `same-origin`), and the application has no session cookie, bearer header, account, or server-side user state. W05 is read-only with respect to canonical game state, and the backend does not change a persistent resource.

Conclusion: CSRF for a credential-bearing state-changing action is currently **inapplicable**, because no authentication value is automatically sent and no private resource is changed. This is not a substitute for rate limiting, concurrency, CORS, or authorization analysis: a CORS allowlist is not authorization, and a direct caller can still exhaust local resources. T01/T02/T13 test those real boundaries.

If a cookie/session/authentication or write-capable endpoint is introduced later, this decision no longer applies; same-site/CSRF-token/origin-policy tests are required before expanding scope.

## 12. Browser/CSP test plan

The production build is served through `scripts/serve.mjs`, not through dev/HMR assumptions. The planned local demo header profile is:

```text
Content-Security-Policy: default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src http://127.0.0.1:3001 http://localhost:3001; form-action 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

The policy must match actual assets: `index.html` uses a same-origin module `./dist/main.js` and stylesheet, and the frontend connects to backend port 3001. Do not add `unsafe-inline` or `unsafe-eval` without demonstrated need. Test plan:

1. Run `npm run build:frontend`, the local static server, and the fake backend.
2. Record exact response headers for `/`, `index.html`, `dist/main.js`, and the stylesheet.
3. In a real browser, verify game, controls, W04/W05 UI, and API round-trip under active CSP.
4. Add a controlled test asset/request that would be available without CSP but is blocked by a concrete directive; record browser CSP violation, not a 404 or wrong-path result.
5. Pass the XSS marker through the W05 fake final and inspect the DOM: it must be a text node with no dangerous element/attribute. CSP is not a substitute for text-only rendering.
6. Verify `nosniff` and `no-referrer` are actually present, without claiming they solve every browser attack.

## 13. Dependency audit plan

The audit is planned but not executed in this phase (`NOT RUN`). Later checks:

- `npm audit --omit=dev` for runtime dependencies;
- `npm audit --include=dev` for build/test tooling;
- review `package-lock.json` and direct versions, especially `@google/genai`, TypeScript, and Node type packages;
- for every advisory record package, version, severity, exposure in the local fake-default/optional-Gemini profile, decision, and residual risk;
- do not add a rate-limiter, sanitizer, or browser-runner dependency without a separate decision, lockfile review, and test.

`npm audit` does not prove application-code security or live-provider behavior. If the registry is unavailable, the result must be `NOT RUN` with the blocker, not PASS.

## 14. Secret sentinel test plan

Use only the synthetic value `W08_SERVER_SECRET_DO_NOT_EXPOSE_7F2A`; never use a real key or private data. A test fixture may place the sentinel in a fake-provider error, an intentionally extra tool-result field, and a test-only environment value, but the sentinel must not be part of the production contract.

Check all possible egress points:

- `frontend/dist/` and source maps after build;
- HTTP success/error bodies and relevant response headers;
- captured `TrainingPlanModelStepInput`/Gemini request — sentinel must not be in model context;
- captured logger output — no raw error, prompt, provider output, or sentinel;
- W04/W05 fake mode — the relevant API key is not read;
- tracked files and `.env.example` — placeholders only, no real value.

The test must also verify that untrusted newline/tool text cannot create a false security log entry. Searching for one marker is not general DLP; results must be limited to the concrete sentinel and artifacts tested.

## 15. Before/after scenarios

Before/after comparison uses the same synthetic fixture and initial checkpoint. In this planning phase, before and after output are `NOT RUN`; existing good behavior must not be intentionally broken for the demonstration.

| Scenario | Before hardening | Planned change | After hardening | Proves / does not prove |
|---|---|---|---|---|
| Concurrency + rate limit | Multiple valid delayed W04/W05 requests can enter the route because there is no global limiter; pending flag is UI-only. | Shared process-local maximum 2 active + 5 accepted starts/60 s, stable 429, release in `finally`. | T13 shows max active 2, excess rejection, zero provider calls for rejected requests, and a legitimate request after release/window. **NOT RUN.** | Local single-process budget; not distributed/multi-instance rate limiting or DDoS protection. |
| CSP/security headers | `scripts/serve.mjs` sends cache/content-type headers, but no CSP/nosniff/Referrer-Policy. | Header profile in static server and real browser test. | T16 sees headers and a concrete CSP block while game/API remain functional. **NOT RUN.** | Local production-like server; not HTTPS/proxy/CDN deployment. |
| XSS/browser DOM + oversized body | W05 UI already uses `textContent` (existing good control); oversized body gets 413 and does not store later chunks, but the stream is still read to completion. | Browser text-only regression plus early body termination/read-bound test; do not add rich text. | T04/T05 marker remains text; T02/T17 reject before provider and bound reading under the chosen policy. **NOT RUN.** | Concrete rendering/body boundary; not general XSS/DoS resistance or live-provider safety. |

## 16. Out of scope

- new login, accounts, or authentication;
- database, backend session store, or persistent history;
- anti-cheat or treating browser telemetry as a verified result;
- a new agent or general agent framework;
- new tools, write tools, shell/filesystem/browser/URL/network tools;
- RAG, vector database, or external-context import;
- rich-text/Markdown renderer or HTML output contract;
- new levels, gameplay rules, abilities, inventory, upgrades, or audio;
- public deployment, HTTPS infrastructure, CDN/WAF, or distributed rate limiting;
- live Gemini/provider calls in this planning phase and offline test suite;
- changing the W04 public contract or turning W05 into an autonomous agent.

## 17. Open assumptions and limitations

- Current checkpoint: `bd0f6d1fe695a813e73d869e9e0934ddf209fbe4` (`changes review`), branch `main`; this is the current repository state, not a pre-hardening W08 evidence result.
- `docs/EVIDENCE_W08.md` does not yet exist; this phase intentionally does not create it because scope is limited to the three `specs/003-secure-arcade/` documents.
- No browser automation infrastructure has been confirmed; T04/T05/T16 are planned real-browser tests and currently `NOT RUN`.
- The global limiter is in-memory and process-local; it does not protect multiple instances or a public deployment.
- W05 has no free user text in model context. Prompt-injection evidence must use a malicious fake-provider proposal; it must not be described as proof of real Gemini-model immunity.
- Browser-provided completed summaries remain falsifiable. Hardening limits consequences to a read-only, bounded, non-privileged plan; it does not prove that the player actually completed the run.
- Optional Gemini behavior, network, provider billing, and remote cancellation are not proven by offline fake tests.
- All W08 implementation tests, before/after results, dependency audit, and sentinel scan remain `NOT RUN` until implementation is performed; this plan is not an implementation result.
