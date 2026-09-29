# AI provider contract

Provider: Google Gemini through the official `@google/genai` SDK `models.generateContent` API when `AI_COACH_PROVIDER=gemini`. Startup defaults to the deterministic `FakeAiCoachProvider` when the variable is absent or `fake`.

Model: `gemini-3.1-flash-lite` (`GEMINI_MODEL_ID`). The optional backend-only `GEMINI_MODEL_CHAIN` may add the allowlisted candidate `gemini-3.5-flash-lite` as one fallback. The primary model must remain first; duplicate or unallowlisted models fail configuration.

Why this model is sufficient: the implementation sends bounded completed-run summaries and requests a short structured coaching object with a 512-token generation cap. The current SpecKit plan and runtime configuration select `gemini-3.1-flash-lite` as the production primary. The fallback is optional and allowlisted; it is not used unless configured.

Input (what the backend sends, with a redacted example): the backend sends the already validated `AiCoachRequest` as the GenerateContent `contents` value. The request has one to three completed summaries, not the active run. A redacted shape is:

```json
{
  "runs": [
    {
      "outcome": "level_complete",
      "durationMs": "<bounded metric>",
      "livesLost": "<count>",
      "shotsFired": "<count>",
      "failedShots": "<count>",
      "captures": "<count>",
      "targetStats": "<at most 16 validated summaries>",
      "representativeEvents": "<at most 8 validated events>",
      "<other allowlisted summary fields>": "<validated values>"
    }
  ]
}
```

The request contains gameplay summaries only. It contains no secret, account identity, browser/device data, source code, environment variables, screenshots, frame history, raw trajectories, or free-form user prompt.

Output (expected schema, with an example): GenerateContent requests `responseMimeType: "application/json"` and `responseJsonSchema`. The schema requires `summary`, `primaryCategory`, `primaryAdvice`, and `practiceGoal`; `secondaryAdvice` is optional. The category must be one of `threat_management`, `bounce_strategy`, `aim_timing`, `positioning`, `range_management`, or `general`. The schema sets per-field string limits and `additionalProperties: false`.

```json
{
  "summary": "There is not enough repeated telemetry to identify a clear pattern yet.",
  "primaryCategory": "general",
  "primaryAdvice": "Keep playing and request another review after a few completed runs.",
  "practiceGoal": "Focus on one run at a time and build more completed-run history."
}
```

The provider treats returned text as untrusted: it rejects safety refusal, empty output, output over 8 KiB, invalid JSON, schema-invalid JSON, and semantically invalid advice before the HTTP route can return success.

Timeout (value and where it is enforced): one shared 15,000 ms monotonic operation deadline, defined by `GEMINI_TOTAL_DEADLINE_MS` in `backend/src/gemini-ai-coach-provider.ts`. `callWithinDeadline()` calculates remaining time, passes an `AbortSignal` to the SDK client, aborts at the deadline, and never starts another call or backoff without at least the configured 1,000 ms minimum attempt budget. The SDK HTTP option also has a 15,000 ms timeout, while SDK retries are disabled for each individual SDK call.

Retry policy (what is retried, what is not, maximum attempts, backoff): the Coach operation allows at most three provider calls (`GEMINI_MAX_PROVIDER_CALLS = 3`) within the shared deadline. A primary model may receive one same-model transient retry (`GEMINI_MAX_RETRIES_PER_MODEL = 1`). Retryable classes are `network_error`, `rate_limited`, `provider_unavailable`, `provider_server_error`, and an early timeout. Backoff starts at 300 ms, is capped at 1,500 ms, includes bounded jitter, and honors numeric/date `Retry-After` only within the remaining deadline. A configured fallback may be used for model-not-found or eligible model/availability failures. A timeout uses the remaining budget for fallback rather than automatically replaying the primary model.

Local/request validation, HTTP 400, 401, and 403, arbitrary 404, safety refusal, abort, configuration errors, and output repair failures are not retried through the normal retry/fallback path. In particular, 401 and 403 are classified as `unauthorized`/`forbidden` and are not retried because credentials or authorization cannot be repaired by repeating the same request. Empty, invalid-JSON, schema-invalid, and semantically invalid output permits at most one same-model `repair` generation with correction instructions; the invalid output is not included in the repair request, and repair never model-hops. If repair also fails, the route returns safe 503.

Fallback: fake mode is the startup default and needs no Gemini key. There is no automatic fallback to fake mode after a Gemini failure. The optional model fallback is only `gemini-3.5-flash-lite`, only when included in `GEMINI_MODEL_CHAIN`, and only for the allowlisted model/availability cases implemented by the provider. Exhausted provider, timeout, repair, safety, or validation failures map to HTTP 503 `{ "ok": false, "error": "coach_unavailable" }`.

Secrets (which variable, where it lives, who reads it): `GEMINI_API_KEY` is read from backend process environment by `parseAiCoachRuntimeConfig()` in `backend/src/ai-coach-config.ts`, only when `AI_COACH_PROVIDER=gemini`. `GEMINI_MODEL_CHAIN` and the diagnostic-only live model variable are backend configuration; the frontend does not read them. The key is passed to backend SDK construction and is never placed in frontend code, response objects, logs, or documents. The root `.env` is ignored by `.gitignore`; `.env.example` contains an empty key placeholder.

Validation (request validation, response validation, what is rejected): `validateAiCoachRequest()` in `backend/src/ai-coach-contract.ts` rejects unknown fields, missing fields, zero or more than three runs, non-terminal outcomes, invalid counts/metrics, non-finite values, duplicate target ids, oversized target/event arrays, invalid event shapes, and cross-field inconsistencies. `server.ts` also rejects non-JSON content types, malformed JSON, and bodies over 32 KiB before provider invocation. The provider validates the request again before GenerateContent. `validateAiCoachAdvice()` rejects unknown response fields, missing/empty/oversized strings, unsupported categories, invalid optional `secondaryAdvice`, and total visible advice over 1,200 characters. The provider additionally classifies safety refusal, empty output, output over 8 KiB, invalid JSON, schema-invalid shape, and semantic contract failure before success. The HTTP route validates provider output again.

User-facing failure (the exact message the player sees): `AI Coach is currently unavailable. Try again later.` The frontend sets this text in the catch path in `frontend/src/main.ts`; gameplay and reset controls remain usable.

## Data access boundary (no model-initiated tool calls)

The model has no tools and cannot request any data. The single data path is:

```text
frontend CoachRunHistory.createRequestSnapshot()
  -> POST /api/ai/coach { runs: CompletedRunSummary[] }
  -> validateAiCoachRequest() rejects unknown fields and out-of-range values
  -> ai-coach-prompt.ts serializes the validated summaries only
  -> Gemini GenerateContent returns JSON constrained by responseJsonSchema
  -> validateAiCoachAdvice() runs before anything reaches the UI
```

The boundary is read only. The model cannot change lives, score, or player position; spawn objects; reset the game; write files; run commands; or change configuration. It never receives the active unfinished run, source code, environment variables, or credentials. Model-initiated tool calls per request are zero by design: the GenerateContent request contains no `tools`, `functionDeclarations`, or `functionCall` handling, and it has no conversation-history field. The field allowlist is enforced by `hasOnlyKeys()` through `validateAiCoachRequest()` in `backend/src/ai-coach-contract.ts`; the test `invalid local input is rejected before Gemini client invocation` proves an invalid request leaves the injected Gemini client call count at zero.
