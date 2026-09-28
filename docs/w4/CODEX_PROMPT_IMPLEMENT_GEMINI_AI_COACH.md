# Codex Task — Integrate Gemini AI Coach Reliably

## Objective

Replace the pre-Gemini fake-only runtime path with a **real Gemini-backed AI Coach provider** while preserving the existing fake provider for tests and deterministic development.

This task includes:

1. backend-only Gemini integration;
2. explicit provider/model configuration;
3. production AI Coach prompt;
4. structured Gemini output;
5. runtime validation of provider output;
6. explicit timeout;
7. bounded retry for transient failures only;
8. safe failure behavior;
9. minimal usage logging;
10. limited opt-in live-provider validation;
11. secret-handling verification.

Do not redesign the existing AI Coach telemetry, request contract, response contract, or gameplay unless a change is strictly required for compatibility with the live provider.

---

# Required Context — Read Before Editing

Read these files first:

```text
.github/copilot-instructions.md
.github/00-index.instructions.md
.specify/memory/constitution.md

specs/001-ai-coach/spec.md
specs/001-ai-coach/plan.md
specs/001-ai-coach/tasks.md

GAME_SPEC.md
CONTEXT_MANIFEST.md
```

Then use `.github/00-index.instructions.md` to load the smallest relevant instruction set.

For this task, at minimum read the SELFBOUND modules covering:

```text
architecture
conventions
testing
workflow
security
build and commands
code review
external services
```

Also inspect the actual current implementation, especially the files that now own:

```text
AiCoachProvider
FakeAiCoachProvider
POST /api/ai/coach
AI Coach request validation
AI Coach response validation
backend startup/provider wiring
frontend AI Coach client
AI Coach tests
```

Do not guess file paths if the repository has already established them.

---

# Current Approved Contracts

Preserve the current request contract unless a concrete bug is discovered:

```ts
type AiCoachRequest = {
  runs: CompletedRunSummary[];
};
```

The request contains between 1 and 3 **completed** runs only.

The active current run remains excluded.

Preserve the current response contract:

```ts
type AiCoachResponse = {
  advice: {
    summary: string;
    primaryCategory:
      | "threat_management"
      | "bounce_strategy"
      | "aim_timing"
      | "positioning"
      | "range_management"
      | "general";
    primaryAdvice: string;
    secondaryAdvice?: string;
    practiceGoal: string;
  };
};
```

Preserve the existing runtime limits:

```text
summary           <= 240 characters
primaryAdvice     <= 500 characters
secondaryAdvice   <= 300 characters
practiceGoal      <= 180 characters
total visible text <= 1,200 characters
```

Preserve the existing public error behavior unless current project contracts require a tiny compatibility adjustment:

```text
invalid request
→ HTTP 400
→ { "ok": false, "error": "invalid_request" }

oversized request
→ HTTP 413
→ safe invalid-request envelope

provider failure / timeout / invalid provider output
→ HTTP 503
→ { "ok": false, "error": "coach_unavailable" }
```

Frontend must never receive raw Gemini errors, stack traces, provider payload internals, or secrets.

---

# Existing Provider Abstraction

Preserve the existing abstraction:

```ts
interface AiCoachProvider {
  getAdvice(request: AiCoachRequest): Promise<unknown>;
}
```

The provider returns `unknown` intentionally.

The backend remains responsible for runtime-validating provider output before returning success.

Do not weaken this boundary.

Do not change the provider interface to return a trusted `AiCoachResponse` solely to make the Gemini adapter easier.

---

# Provider Choice

Use the official current Google Gen AI JavaScript/TypeScript SDK:

```text
@google/genai
```

Do not use the legacy:

```text
@google/generative-ai
```

Use an SDK version compatible with the repository's current Node.js version.

At the time this task was prepared, the current official SDK line is 2.x and Node.js 20+ is supported; the upcoming 3.x line requires Node.js 22+.

Do not silently upgrade the project's Node runtime just for this feature.

If the current runtime is incompatible, use the smallest safe approach and document it rather than making a broad runtime migration.

---

# Model Choice

Use:

```text
Provider: Gemini Developer API
Model: gemini-3.5-flash-lite
```

Rationale:

- this feature is a short structured analysis/classification/coaching task;
- input is small structured telemetry;
- output is short structured JSON;
- the model supports structured outputs;
- it is intended for cost-efficient, high-throughput/simple processing;
- it is available on the Gemini free tier;
- a larger model is not justified unless live evals show this model is insufficient.

Do not silently switch to a larger model.

If live evaluation reveals a concrete quality failure, report it as evidence before changing the model.

Do not use a `*-latest` alias for final documented evidence if a stable explicit model ID is available.

---

# Gemini API Style

Prefer the current **Interactions API** from `@google/genai` if it is supported by the installed SDK version.

The request should be stateless.

Set:

```text
store = false
```

because this AI Coach does not need provider-side conversation history and the application already sends all required context in each request.

Do not use:

- background execution;
- managed agents;
- tools;
- Google Search;
- code execution;
- function calling;
- previous interaction IDs;
- provider-side conversation state.

This is one simple model call.

---

# SECRET HANDLING — CRITICAL

## Real `.env`

A real local `.env` may exist in the repository working directory.

Treat it as sensitive.

### DO NOT:

- open/read the real `.env` file;
- print it;
- `cat` it;
- `type` it;
- `Get-Content` it;
- grep/ripgrep its values;
- echo secret environment variables;
- print `process.env`;
- log the Gemini API key;
- copy the API key into source;
- copy the API key into tests;
- copy the API key into docs;
- copy the API key into prompts/specs;
- copy the API key into evidence;
- copy the API key into screenshots;
- include it in the final report.

Do not inspect the secret value even for debugging.

The application process may use the environment variable.

The coding agent does not need to know the value.

If a live test fails due to authentication, report a sanitized authentication/configuration failure without printing the key.

## Environment variable

Use:

```text
GEMINI_API_KEY
```

backend-side only.

No frontend environment variable may contain this secret.

In particular, do not create:

```text
VITE_GEMINI_API_KEY
NEXT_PUBLIC_GEMINI_API_KEY
PUBLIC_GEMINI_API_KEY
```

or any other browser-exposed secret.

---

# `.gitignore` and `.env.example`

Before relying on `.env`, verify secret files are ignored without opening their contents.

The repository must ignore the real local secret file(s).

Use the repository's actual environment-file location.

Typical root setup:

```gitignore
.env
.env.local
.env.*.local
```

If environment files live under `backend/`, ignore the corresponding backend paths.

Do not ignore `.env.example`.

Create or update:

```text
.env.example
```

with placeholders only.

Recommended shape:

```text
AI_COACH_PROVIDER=fake
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
```

`AI_COACH_PROVIDER=fake` is the safe default example so installing the project does not accidentally make live API calls.

The developer's real local `.env` may set:

```text
AI_COACH_PROVIDER=gemini
GEMINI_API_KEY=<real local secret>
GEMINI_MODEL=gemini-3.5-flash-lite
```

Never write the real value into `.env.example`.

---

# Environment Loading

Inspect the repository's current environment-loading approach.

If environment loading already exists, reuse it.

If it does not exist, use the smallest server-side solution compatible with the current Node/tooling.

Possible approaches include:

- Node's supported `--env-file` mechanism;
- an existing configuration library;
- a minimal server-only env loader if genuinely needed.

Do not introduce frontend env loading for provider secrets.

Important:

`@google/genai` can use an environment variable only if that variable is actually present in the backend process environment.

A `.env` text file is not magical by itself; the backend process must load it through the chosen project mechanism.

Document the exact local command/workflow.

---

# Backend Configuration

Add/extend a small validated backend configuration boundary.

At minimum support:

```text
AI_COACH_PROVIDER = "fake" | "gemini"
GEMINI_API_KEY     required only when provider == "gemini"
GEMINI_MODEL       default/validated as "gemini-3.5-flash-lite"
```

Do not log the key during config parsing.

If:

```text
AI_COACH_PROVIDER=gemini
```

and `GEMINI_API_KEY` is missing/empty, fail safely with a clear developer-facing configuration error that names the missing variable but never its value.

Normal automated tests must not require a real key.

---

# Runtime Provider Wiring

Preserve dependency injection.

Tests should continue to inject `FakeAiCoachProvider` or specific test doubles.

Normal application startup should select the configured provider.

Conceptual flow:

```text
backend config
      ↓
AI_COACH_PROVIDER
      ↓
fake  ──────────────→ FakeAiCoachProvider
gemini ─────────────→ GeminiAiCoachProvider
      ↓
createServer({ aiCoachProvider })
```

Do not put provider-selection branching inside the HTTP route if a cleaner startup/configuration boundary already exists.

Do not remove the fake provider.

---

# Gemini Provider

Implement:

```text
GeminiAiCoachProvider
```

or the closest name consistent with the repository.

It implements:

```ts
AiCoachProvider
```

Responsibilities:

1. receive already locally validated `AiCoachRequest`;
2. serialize only the required telemetry;
3. build the production AI Coach instruction/input;
4. call Gemini;
5. request structured JSON output;
6. parse the returned JSON to `unknown`;
7. return `unknown` to the existing backend validation layer;
8. classify provider/network/timeout failures for safe server handling;
9. never expose secrets.

It must not:

- mutate game state;
- access frontend state directly;
- read arbitrary files;
- call tools;
- make multiple model calls for one normal Coach request except the bounded transient retry policy;
- trust provider output without the existing runtime validator.

---

# Production AI Coach Prompt

Create the production prompt/instruction in a dedicated backend-owned module rather than embedding a large opaque string inside the HTTP route.

The model role is:

```text
SELFBOUND AI Coach
```

The instruction must state that it receives structured summaries of 1–3 completed SELFBOUND runs.

The model must:

1. use only supplied telemetry;
2. not invent events, counts, geometry, player actions, or statistics;
3. distinguish observed facts from heuristics;
4. prioritize the most important recurring/high-impact mistake;
5. give concise actionable advice;
6. optionally give one secondary observation when evidence exists;
7. give one concrete practice goal for the next run;
8. avoid personality/psychological judgments;
9. avoid exact shot angles/coordinates unless supplied evidence genuinely supports them;
10. avoid claiming a bounce path is guaranteed merely because a direct path was blocked;
11. account for the fact that bounces extend projectile range;
12. use `general` when there is not enough evidence for another category;
13. return only the required structured output.

The prompt should understand these telemetry semantics:

```text
offensiveShotsWhileThreatActive
→ player attempted offense while hostile green threat existed

blockedDirectAttempts
→ direct line was obstructed and player still aimed approximately at target
→ does NOT prove a bounce path exists

rushedBouncedFailures
→ heuristic: bounced failed shot fired shortly after material aim change

repeatedSamePositionFailures
→ repeated failed attempts from approximately the same position

rangeExpiredShots
→ projectile actually exhausted its travel budget without capture
```

The model should consider patterns across all supplied completed runs rather than blindly summing every number.

When only one run exists, phrase advice as based on that run, not as a long-term trend.

---

# Gemini Input

Send the smallest sufficient context.

Do not send:

- full application state;
- frame-by-frame logs;
- mouse history;
- source code;
- secrets;
- environment config;
- unrelated browser data.

Send the already bounded validated `AiCoachRequest`.

A suitable input is:

```text
short instruction/context
+
JSON.stringify(validatedRequest)
```

Do not allow arbitrary user-entered prompt text in this feature.

---

# Structured Output

Use Gemini structured output / JSON schema functionality supported by the current SDK/API.

The provider-level schema should correspond to the approved AI Coach response.

Conceptually:

```json
{
  "advice": {
    "summary": "...",
    "primaryCategory": "threat_management | bounce_strategy | aim_timing | positioning | range_management | general",
    "primaryAdvice": "...",
    "secondaryAdvice": "... optional ...",
    "practiceGoal": "..."
  }
}
```

Use required fields and enum constraints.

Keep `secondaryAdvice` optional.

The structured-output schema is an extra guardrail.

It does **not** replace the existing backend runtime validator.

The sequence remains:

```text
Gemini structured output
→ JSON parse
→ value is still untrusted/unknown
→ existing runtime validation
→ success only if validation passes
```

If Gemini returns malformed/unparseable/contract-invalid output:

```text
do not retry solely because schema output was invalid
→ map to coach_unavailable
```

unless the approved existing feature plan explicitly documents a different bounded policy.

---

# Output Length / Generation Controls

Keep output small.

Use the existing UI limits as the authority.

Configure generation conservatively.

Use a low temperature suitable for grounded deterministic coaching.

A reasonable starting value is approximately:

```text
temperature: 0.2
```

Set a small maximum output-token budget appropriate for the <=1,200 visible-character response.

Do not ask for chain-of-thought.

Do not request hidden reasoning.

Do not use tools.

---

# Privacy / Provider Storage

When using the Interactions API, explicitly request:

```text
store: false
```

This feature is stateless and does not need provider-side interaction history.

Do not send any personally identifying information.

The payload should contain gameplay telemetry only.

---

# Timeout Policy

Implement an explicit timeout and test it.

Target user-visible total budget:

```text
approximately 15 seconds maximum
```

Use a bounded per-attempt design.

Recommended Core policy:

```text
max attempts: 2 total
per-attempt timeout: 7,000 ms
retry delay: 500 ms
```

This keeps the normal worst-case retry path near the assignment's 15-second example.

If the installed SDK has its own default retry behavior, override/disable it as necessary so the **effective total attempts remain explicitly bounded at 2**.

Do not accidentally combine:

```text
SDK default retries
+
custom retries
```

into a larger hidden retry count.

Document the actual effective behavior.

---

# Retry Policy

Retry at most once, only for transient failures.

Retryable examples:

```text
network/connection failure
HTTP 408
HTTP 429
HTTP 500
HTTP 502
HTTP 503
HTTP 504
per-attempt timeout
```

Use the SDK's typed error/status information when available.

Do not retry:

```text
invalid local request
request schema failure
HTTP 400 caused by our provider request
HTTP 401/403 authentication/configuration failure
unsupported model/configuration
provider output that parsed but failed our response contract
programming errors
```

Keep the policy easy to explain and test.

Do not add fallback model/provider in this task.

---

# Safe Failure Mapping

Preserve the public failure contract.

After bounded attempts are exhausted:

```text
POST /api/ai/coach
→ HTTP 503
→ { "ok": false, "error": "coach_unavailable" }
```

Frontend displays the existing safe message.

No raw Gemini error reaches the browser.

Internal logging may classify a failure as:

```text
timeout
rate_limited
provider_unavailable
authentication
invalid_provider_output
unknown
```

but it must not contain the secret.

---

# Usage Logging

Implement minimal provider-call usage logging/evidence support.

For each **live Gemini** Coach operation, record only safe metadata such as:

```text
operation: ai.coach
provider: gemini
model: gemini-3.5-flash-lite
timestamp
latencyMs
success/failure
attempts
failureCategory if any
input/output token usage if exposed by the SDK
```

Do not log:

```text
GEMINI_API_KEY
full process.env
Authorization headers
raw provider request headers
full telemetry payload unless existing docs explicitly require it
raw provider internals containing sensitive configuration
```

The fake provider may record equivalent test metadata without pretending token usage exists.

No database is required.

Use the smallest logging approach consistent with the existing project and W04 evidence needs.

---

# Tests — Keep Fake First

Most tests remain fake/mock based.

Do not turn the normal test suite into live API tests.

Preserve all existing fake-provider tests.

Add focused tests for Gemini adapter/config/reliability using injected SDK/client test doubles where possible.

At minimum cover:

## G1 — Gemini provider request construction

Given a valid `AiCoachRequest`:

- correct configured model is used;
- only bounded gameplay telemetry is included;
- `store: false`;
- structured output schema is requested;
- no tool/agent/background behavior is used.

## G2 — Gemini valid structured output

Valid JSON response:

```text
→ provider returns parsed unknown
→ existing backend runtime validator accepts
→ HTTP 200
```

## G3 — malformed JSON/provider output

```text
→ rejected
→ no success response
→ HTTP 503 through route behavior
```

## G4 — schema-invalid output

```text
valid JSON but wrong enum/field/length
→ existing runtime validator rejects
→ safe 503
```

## G5 — timeout

Use a fake/test client:

```text
attempt times out
→ bounded retry according to policy
→ after max attempts, safe failure
```

## G6 — transient 503 then success

```text
attempt 1 transient failure
→ retry once
→ attempt 2 success
→ total attempts = 2
```

## G7 — 429 then success/failure

Prove retry remains within bound.

## G8 — non-retryable authentication/config failure

```text
401/403-like provider failure
→ no retry
```

## G9 — invalid local input

Preserve existing mandatory proof:

```text
providerCallCount === 0
```

## G10 — missing Gemini key in gemini mode

```text
safe configuration failure
→ key value never logged
```

## G11 — fake mode requires no Gemini key

Normal fake tests/dev path must still work without secret configuration.

---

# Live Validation

Add an **explicit opt-in** live validation path.

Do not make `npm test` call Gemini.

Examples:

```text
npm run test:ai:live
```

or another repository-consistent command.

The live validation should:

- require `AI_COACH_PROVIDER=gemini`;
- require `GEMINI_API_KEY` through environment configuration;
- send a small known valid 1-run or 3-run request;
- verify the returned response passes the same runtime validator;
- print only sanitized success metadata;
- never print the API key;
- never print auth headers.

If the repo does not justify a dedicated script, document a small manual live validation procedure instead.

Keep live calls limited.

A small number such as 1–3 successful live calls is enough for integration proof.

---

# Environment / Secret Verification

Before final handoff, verify without exposing the key:

## Git ignore

Use a safe command such as:

```text
git check-ignore <actual-env-path>
```

The real env file should be ignored.

## Tracked files

Verify the real env file is not tracked.

For a root `.env`, for example:

```text
git ls-files -- .env
```

should produce no tracked `.env`.

## Git history

Check whether the real env file path has ever been committed.

For a root `.env`:

```text
git log --all -- .env
```

should show no committed real `.env` history.

If a real key was ever committed, do not attempt to "fix" that merely by deleting the file from the current tree.

Report that the key must be revoked/rotated.

Do not ask for or display the key to search git history.

## Frontend

Verify:

- no `GEMINI_API_KEY` read exists in frontend code;
- no Google GenAI SDK import exists in frontend code;
- no provider authorization header is constructed in frontend code;
- frontend continues to call only SELFBOUND's `/api/ai/coach`.

If a frontend production bundle is generated, inspect it for provider-specific secret wiring/variable names without searching for the actual secret value.

---

# Documentation Updates

Update the relevant SELFBOUND documentation so it reflects the real integration.

At minimum update the feature/provider docs or Spec Kit artifacts with:

```text
Provider: Gemini
Model: gemini-3.5-flash-lite
Reason for model choice
Input contract
Output contract
store=false/stateless behavior
timeout policy
retry policy
safe failure
secret location = backend environment only
runtime validation
usage logging
live validation method
```

Create/update `.env.example` with no secret.

Do not put the real key in:

- README;
- Spec Kit;
- evidence;
- prompt docs;
- test fixtures.

If W04 documentation files already exist, update the most specific source rather than duplicating the same information unnecessarily.

Do not finalize `EVIDENCE_W04.md` with claims about live success unless a live call was actually performed.

---

# Security Gate

Before declaring the task complete, verify all of these:

```text
[ ] API key is not in frontend bundle/code.
[ ] API key is not in Git history.
[ ] real .env is not committed.
[ ] .env.example exists and contains no secret.
[ ] backend never returns provider secret to frontend.
[ ] logs do not contain key.
[ ] error responses contain no stack trace/secrets.
[ ] input validation occurs before provider invocation.
[ ] provider output is runtime-validated before display.
```

If any item is not proven, state it as unresolved instead of claiming completion.

---

# Implementation Sequence

Follow this order.

## Step 1 — Inspect current state

Read Spec Kit/instructions and current fake implementation.

Run current focused tests before changing provider behavior.

## Step 2 — Secure environment configuration

Add/verify `.gitignore`, `.env.example`, validated backend config, and provider selection.

Do not read the real `.env`.

## Step 3 — Add official backend SDK

Add `@google/genai` to the backend-owning package only.

Do not add it to a frontend-only package.

Do not use legacy SDK.

## Step 4 — Implement Gemini provider

Implement stateless structured Gemini request with `store:false`.

Keep output as `unknown` until existing validator accepts it.

## Step 5 — Add production Coach prompt

Ground strictly in validated completed-run telemetry.

## Step 6 — Reliability

Implement explicit timeout and max-2 transient retry policy.

Ensure SDK defaults do not create extra hidden retries.

## Step 7 — Safe logging

Record provider/model/latency/status/attempts/token usage if available.

No secret/payload leakage.

## Step 8 — Tests

Keep normal tests offline with doubles/fakes.

Run full relevant suite.

## Step 9 — Opt-in live validation

Only after fake/reliability tests are green.

Use environment-loaded secret without printing/reading it.

Perform only a small number of live calls.

## Step 10 — Security review

Check ignore/tracked/history/frontend boundary/logs/errors.

Inspect full diff.

---

# Acceptance Criteria

The task is complete when:

## Provider

- [ ] `GeminiAiCoachProvider` implements the existing provider abstraction.
- [ ] Official `@google/genai` SDK is used backend-only.
- [ ] Explicit model is `gemini-3.5-flash-lite`.
- [ ] Fake provider remains available.
- [ ] Runtime startup/config selects fake vs Gemini explicitly.
- [ ] Tests can run without a real API key.

## Secret handling

- [ ] `GEMINI_API_KEY` is backend-only.
- [ ] Real `.env` is ignored and untracked.
- [ ] `.env.example` contains only an empty key placeholder.
- [ ] No frontend-exposed environment variable contains the key.
- [ ] No logs/errors/docs/tests contain the key.
- [ ] Agent did not print/read the real secret.

## Request/output

- [ ] Existing local request validator still runs before provider call.
- [ ] 1–3 completed runs remain the only provider input.
- [ ] Current active run is not added.
- [ ] Gemini structured output schema is used.
- [ ] Existing runtime response validator remains authoritative.
- [ ] Invalid provider output is never shown as success.

## Reliability

- [ ] Explicit timeout exists.
- [ ] Effective max attempts are explicitly bounded at 2.
- [ ] Retry occurs only for documented transient classes.
- [ ] Invalid local input is never retried/called.
- [ ] Auth/config errors are not retried.
- [ ] Invalid provider output is not blindly retried.
- [ ] Exhausted failures map to safe `coach_unavailable`.

## Privacy / scope

- [ ] Interactions request uses `store:false`.
- [ ] No tools/search/agent loop/background interaction is used.
- [ ] Only minimal telemetry is sent.

## Tests

- [ ] Existing fake tests pass.
- [ ] Gemini adapter request-construction test passes.
- [ ] Valid provider-output path passes.
- [ ] Malformed output test passes.
- [ ] Schema-invalid output test passes.
- [ ] Timeout test passes.
- [ ] Retry bound test passes.
- [ ] Non-retryable error test passes.
- [ ] `providerCallCount === 0` invalid-input test still passes.
- [ ] Build/typecheck/relevant full test suite passes.

## Live proof

- [ ] At least one limited live Gemini call is successfully validated, OR live validation is explicitly documented as not performed because no local key was available.
- [ ] Live calls are not part of the normal automated suite.
- [ ] Live output is validated by the same runtime validator.

---

# Required Final Report

Return these sections:

## 1. Gemini Integration

State:

- SDK package/version;
- provider;
- explicit model;
- API style used;
- whether `store:false` is set.

## 2. Environment Configuration

List variable **names only**, never values.

State the real env file path and whether it is ignored/tracked.

Do not print its contents.

## 3. Provider Wiring

Explain how startup chooses fake vs Gemini and how tests inject fakes.

## 4. Production Prompt

Summarize the rules/grounding strategy.

Do not paste telemetry from a real user run unless necessary.

## 5. Structured Output

Explain Gemini schema + existing runtime validation.

## 6. Timeout and Retry

State exact:

- timeout;
- max attempts;
- retry delay/backoff;
- retryable failures;
- non-retryable failures.

## 7. Usage Logging

State fields recorded and confirm key/raw auth are excluded.

## 8. Tests

List exact test commands and results.

Include explicit evidence that invalid local input still produces:

```text
providerCallCount === 0
```

## 9. Live Validation

State:

- whether it was run;
- number of live calls;
- model;
- success/failure;
- sanitized latency/token metadata if available.

Never show key.

## 10. Security Checklist

Report each security gate as:

```text
PASS
FAIL
NOT VERIFIED
```

Do not claim PASS without a real check.

## 11. Files Changed

List important files/dependencies.

## 12. Remaining Work

List only genuine remaining W04 work, likely:

```text
final AI eval/evidence docs
final play-test
final security review
presentation/demo preparation
```

Do not add new AI feature scope.

---

# Final Principle

The application, not the model, remains authoritative.

SELFBOUND sends a small validated summary of completed runs.

Gemini interprets that summary into concise coaching.

The backend validates Gemini again before the browser sees anything.

The secret never crosses the backend boundary.
