# Codex Task — Migrate Production AI Coach to Gemini GenerateContent

## Objective

Migrate the production SELFBOUND AI Coach Gemini implementation from the current
Interactions API path to the live-validated configuration that successfully handled
the full structured Coach workload:

- Provider: Gemini
- SDK: `@google/genai`
- API path: `models.generateContent`
- Model: `gemini-3.1-flash-lite`
- Full structured Coach diagnostic latency: 6,420 ms
- JSON parsing: PASS
- authoritative `AiCoachResponse` runtime validation: PASS
- returned category: `threat_management`
- usage: 550 input tokens, 210 output tokens, 760 total

This is now an implementation task, not another diagnostic task.

Do not redesign telemetry, contracts, frontend UX, or the provider abstraction.

---

# Required Context

Before editing, read and follow:

- `.github/copilot-instructions.md`
- `.github/00-index.instructions.md`
- `.specify/memory/constitution.md`
- `specs/001-ai-coach/spec.md`
- `specs/001-ai-coach/plan.md`
- `specs/001-ai-coach/tasks.md`
- `GAME_SPEC.md`
- `CONTEXT_MANIFEST.md`

Use `.github/00-index.instructions.md` to load the relevant SELFBOUND modules for:

- architecture
- conventions
- testing
- workflow
- security
- build/commands
- code review
- external services

Do not use the old example-project instruction files.

---

# Secret Handling

Do not open, print, grep, copy, serialize, log, or otherwise inspect:

- `.env`
- `GEMINI_API_KEY`
- authorization headers
- secret-bearing environment values

The backend process may consume `GEMINI_API_KEY` from `process.env`.

Never expose the key in:

- source
- frontend bundle
- tests
- fixtures
- docs
- prompts
- Spec Kit artifacts
- evidence
- logs
- error responses

---

# Production Migration

Update the real `GeminiAiCoachProvider` so production uses:

```text
@google/genai
→ ai.models.generateContent(...)
→ gemini-3.1-flash-lite
```

Do not use `ai.interactions.create` in the production Coach provider after this migration.

Preserve the existing:

- `AiCoachProvider` interface
- `FakeAiCoachProvider`
- request contract
- response contract
- Coach prompt semantics
- telemetry/history behavior
- backend endpoint
- frontend behavior
- request runtime validation
- provider-output runtime validation
- safe 503 error envelope
- dependency injection used by tests

Do not change the public frontend/backend contract unless required by a concrete compatibility bug.

---

# Model Configuration

Set the default/configured production model to:

```text
gemini-3.1-flash-lite
```

Update:

- `.env.example`
- backend configuration defaults/validation
- README/setup docs
- provider contract docs
- Spec Kit plan/tasks/evidence where the old model is stated

Do not hard-code a secret.

If `GEMINI_MODEL` remains configurable, keep it backend-only.

---

# GenerateContent Request

Use the installed `@google/genai` SDK.

The production request must include:

- configured model
- production SELFBOUND Coach system instruction
- validated and bounded Coach request data
- structured JSON output configuration matching the approved Coach response schema
- no tools
- no conversation history
- no unsupported `store` option
- no unsupported Interactions-only fields
- SDK retries explicitly disabled if the SDK exposes automatic retries for this path

The returned value must still cross the provider boundary as `unknown`.

The backend's existing runtime validator remains authoritative.

A syntactically valid provider response that fails the runtime schema must not be treated as success.

---

# Timeout Policy

Replace the current per-attempt 7-second timeout policy with a **15-second total Coach deadline**.

Reason:

- the live full structured Coach diagnostic completed successfully in 6,420 ms;
- 15 seconds provides approximately 8.6 seconds of measured headroom;
- one measurement proves viability, not guaranteed latency;
- user-visible waits must remain bounded.

The 15 seconds is the total operation budget, not 15 seconds per retry.

Implement the deadline using monotonic elapsed-time accounting where practical.

Example concept:

```text
operation starts
deadline = now + 15s

attempt 1
→ success: return

→ transient retryable failure:
   calculate remaining deadline
   optional short retry delay
   only retry if meaningful time remains

attempt 2
→ must still finish inside the same total 15s budget
```

Do not allow:

```text
15s attempt
+ retry delay
+ another 15s attempt
```

---

# Retry Policy

Maximum provider attempts:

```text
2
```

Retry only transient failures where retry is useful.

Examples:

- connection/network failure
- HTTP 408
- HTTP 429
- HTTP 500
- HTTP 502
- HTTP 503
- HTTP 504

Do not retry:

- invalid local request
- request schema failure
- HTTP 400
- HTTP 401
- HTTP 403
- invalid API configuration
- malformed provider output
- runtime output validation failure
- programming errors
- full 15-second total deadline expiration

Important:

If the total local deadline expires, return the safe Coach error immediately.

Do **not** start another request after the deadline is consumed.

Any retry delay must share the same 15-second total budget.

Keep the existing 500 ms delay only if there is still sufficient deadline remaining and the plan/tests support it.

---

# SDK Retry Policy

Ensure there is no hidden multiplication of attempts.

SELFBOUND must be authoritative over retry count.

Expected maximum:

```text
SELFBOUND provider attempt 1
→ exactly one SDK/HTTP generation request

SELFBOUND provider attempt 2
→ exactly one SDK/HTTP generation request

STOP
```

No SDK-level automatic retry should cause additional requests beyond the documented SELFBOUND bound.

Add or preserve tests that assert actual transport/provider attempt counts.

---

# Prompt and Input

Do not expand the prompt.

Preserve the production Coach prompt that was already validated.

Continue to provide only the bounded completed-run summaries.

Do not:

- send current active run
- add full application state
- add screenshots
- add raw mouse history
- add arbitrary user text
- add unnecessary telemetry

The model should remain grounded only in supplied telemetry.

---

# Structured Output

Preserve the existing response shape:

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

Preserve all existing runtime string-length and total-visible-character limits.

The backend runtime validator remains the final acceptance gate.

---

# Logging

Preserve safe usage logging.

For successful live Gemini calls, log only safe metadata such as:

- operation
- provider
- model
- timestamp
- latencyMs
- success/failure
- attempts
- safe failure category
- token usage when available

Do not log:

- API key
- auth headers
- `.env`
- system prompt
- telemetry payload
- raw provider response
- raw provider error
- full environment

---

# Tests

Update/add tests for the GenerateContent production path.

At minimum verify:

## Success

- valid request reaches Gemini provider abstraction
- structured GenerateContent response parses
- runtime response validation passes
- expected response returned

## Invalid local input

- rejected before provider invocation
- `providerCallCount === 0`

## Malformed provider output

- rejected by runtime validator
- safe failure returned
- no retry for deterministic invalid output

## Retry

- retryable transient failure can cause a second attempt
- maximum provider/HTTP attempts remains 2
- SDK does not add hidden retries

## Non-retryable errors

- 400/401/403 do not retry
- invalid configuration does not retry

## Total deadline

- total Coach operation cannot exceed the configured 15-second deadline in the test model
- deadline is shared across attempts
- no second request starts after the deadline is exhausted

## Timeout

- deadline exhaustion produces the existing safe user-facing failure
- no raw timeout/provider details leak to frontend

## Fake provider

- fake provider tests remain intact and offline

Do not make ordinary automated tests depend on the real Gemini API.

---

# Live Validation After Migration

After all offline tests/typecheck/build pass, perform a **limited live production-path validation** using the environment-loaded key.

Do not inspect the key.

Use at most:

```text
2 live Coach calls
```

Preferred cases:

1. one valid completed-run summary
2. up to three completed-run summaries if practical

For each, capture only safe metadata:

- model
- latency
- success/failure
- attempts
- runtime validation result
- primary category
- token counts if available

Do not log raw advice if existing project evidence policy avoids raw provider content.

If the first production-path live call fails because of a transient provider/network issue, do not perform repeated manual experiments beyond the agreed small live-call budget.

---

# Environment / Dev UX

Inspect current scripts:

```text
"start": "npm run dev"
"dev": "node scripts/dev.mjs"
"dev:backend": "npm run build:backend && node backend/dist/server.js"
```

Do not silently expose `.env`.

If helpful, add an explicit local Gemini development script such as:

```text
dev:gemini
```

that loads `.env` without printing it.

Do not change the default `npm start` / `npm run dev` behavior to require a real Gemini key if fake mode is the existing safe default.

Preferred principle:

```text
default dev
→ fake provider works without secrets

explicit env-loaded Gemini dev
→ real provider
```

Only add this script if it simplifies local use without creating confusion.

Document the exact command.

---

# Documentation

Update the active project documentation so it matches shipped production behavior.

At minimum synchronize:

- `.env.example`
- README/provider setup
- Spec Kit `001-ai-coach` plan/tasks status
- provider contract documentation
- AI evals
- AI usage/evidence records where appropriate
- agent instruction files only if their current statements become stale

Remove or clearly mark obsolete statements that production uses:

- `gemini-3.5-flash-lite`
- production Interactions API
- 7-second per-attempt timeout

Do not erase prior diagnostic evidence; distinguish historical diagnostic results from final production configuration.

---

# Final Security Verification

Explicitly verify:

- API key absent from frontend source/bundle
- `.env` ignored and untracked
- `.env.example` contains no secret
- backend responses do not expose secret/provider internals
- logs do not contain key/auth headers
- errors do not expose stack traces/secrets
- input validates before provider call
- provider output validates before frontend success
- SDK/provider retry count is bounded
- no real key appears in changed files

Do not search for or print the secret value itself.

---

# Required Checks

Run all relevant offline checks, including:

```text
npm test
npm run typecheck
npm run build
git diff --check
```

Also run the existing reachability/game regression check if it remains part of the repository's standard verification.

Report exact results.

---

# Required Final Report

Return:

## 1. Production Provider

- provider
- model
- SDK/API method
- why migrated

## 2. Timeout

- exact total deadline
- implementation approach
- why it is justified by the 6,420 ms live result

## 3. Retry

- retryable categories
- non-retryable categories
- maximum HTTP/provider attempts
- confirmation SDK hidden retries are disabled/bounded

## 4. Contracts

Confirm public request/response contracts remained unchanged, or explain any necessary change.

## 5. Tests

Exact automated checks and results.

## 6. Live Validation

For each live call:

- latency
- attempts
- validation result
- primary category
- token usage if available

No secrets/raw sensitive data.

## 7. Security Checklist

Report PASS / FAIL / NOT VERIFIED for all Week 4 secret-handling requirements.

## 8. Files Changed

List material files.

## 9. Remaining Work

Expected remaining work should be limited to:

- manual browser/UI play-test if not already done
- final W04 evidence/documentation/demo preparation

Do not add new AI features or stretch scope.
