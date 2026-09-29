# W04 evidence — AI Coach

## Architecture and boundary

```text
Browser frontend
  frontend/src/coach-telemetry.ts
    -> CoachRunHistory.createRequestSnapshot()
  frontend/src/ai-coach-client.ts
    -> POST /api/ai/coach

SELFBOUND backend
  backend/src/server.ts
    -> validateAiCoachRequest()
    -> selected AiCoachProvider

Provider
  FakeAiCoachProvider by default
  or GeminiAiCoachProvider when AI_COACH_PROVIDER=gemini
    -> @google/genai models.generateContent
    -> JSON/schema/semantic validation
    -> { advice } or safe 503
```

The frontend/backend boundary is a browser HTTP boundary. Browser-owned telemetry and client code are under `frontend/src/`; backend contracts, route handling, provider selection, configuration, and the Gemini adapter are under `backend/src/`. The browser calls the SELFBOUND endpoint, not Gemini directly. The model cannot initiate tools or request another data source.

## Provider, model, and secret boundary

`AI_COACH_PROVIDER` selects `fake` or `gemini`; absent configuration defaults to fake mode. Gemini mode uses `@google/genai` 2.24.0 `models.generateContent` with primary model `gemini-3.1-flash-lite`. Optional `GEMINI_MODEL_CHAIN` may add the allowlisted `gemini-3.5-flash-lite` fallback. The active provider uses a shared 15,000 ms deadline, a maximum of three provider calls, one primary transient retry, bounded backoff, optional fallback, and one same-model output repair.

`GEMINI_API_KEY` is read from backend process environment by `parseAiCoachRuntimeConfig()` and passed only to backend SDK construction. The frontend does not read it, and the key is not returned, logged, or written to evidence. The repository-root `.env` is ignored; `.env.example` has an empty key placeholder. The current security check did not open or print `.env`.

## Request and response contracts

The endpoint is `POST /api/ai/coach` with `Content-Type: application/json`. The request is `{ runs: CompletedRunSummary[] }`, containing one to three completed summaries in oldest-to-newest order. Each summary has the allowlisted counters, bounded target summaries, and bounded representative events defined by `backend/src/ai-coach-contract.ts`. The active run is excluded by `CoachRunHistory.createRequestSnapshot()`.

The success response is `{ advice: AiCoachAdvice }`. Required advice fields are `summary`, `primaryCategory`, `primaryAdvice`, and `practiceGoal`; `secondaryAdvice` is optional. `validateAiCoachAdvice()` enforces supported categories, non-empty strings, per-field limits, and the 1,200-character total. Invalid request data maps to HTTP 400 `{ "ok": false, "error": "invalid_request" }`; an oversized body maps to HTTP 413 with the same error; provider failure or invalid output maps to HTTP 503 `{ "ok": false, "error": "coach_unavailable" }`.

## Success and failure examples

The test `valid one-run and three-run requests reach the fake provider and return structured advice` sends a valid fixture through the actual HTTP server. A redacted structural example is:

```json
POST /api/ai/coach
{ "runs": ["<validated test CompletedRunSummary>"] }

200
{
  "advice": {
    "summary": "<validated fake-provider summary>",
    "primaryCategory": "bounce_strategy",
    "primaryAdvice": "<validated advice>",
    "practiceGoal": "<validated practice goal>"
  }
}
```

For an exception or malformed provider result, `server.ts` returns:

```json
HTTP 503
{ "ok": false, "error": "coach_unavailable" }
```

The frontend shows exactly: `AI Coach is currently unavailable. Try again later.` It does not show a stack trace, raw provider error, prompt, payload, or secret.

## Required command results

The commands were run through `cmd.exe` so the literal npm scripts could execute despite the PowerShell `npm.ps1` execution-policy error.

`npm run typecheck`:

```text
> selfbound-game@1.0.0 typecheck
> npm run typecheck:frontend && npm run typecheck:backend
> tsc -p tsconfig.frontend.json --noEmit
> tsc -p tsconfig.backend.json --noEmit
exit code: 0
```

`npm test`:

```text
> selfbound-game@1.0.0 test
> tsc -p tsconfig.test.json && node --test ...
ℹ tests 66
ℹ pass 66
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
exit code: 0
```

`npm run build`:

```text
> selfbound-game@1.0.0 build
> npm run build:frontend && npm run build:backend
> tsc -p tsconfig.frontend.json
> tsc -p tsconfig.backend.json
exit code: 0
```

The current pass did not run `npm run test:ai:live`. The prompt explicitly limits that command to an authorized live check.

## Security checklist

All checks below were run after the build. Commands report counts or safe filenames, never key values.

| Check                                            | Verification command                                                                                                                           | Result                                                                                                                               |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| API key is not in frontend bundle                | `rg -l -F GEMINI_API_KEY frontend`; `rg -l -F AIza frontend`; `rg -l -F apiKey frontend`                                                       | PASS — each pattern reported 0 matching files.                                                                                       |
| API key is not in git history                    | `git -c safe.directory=... log --all --format='%H' -S AIza -- .`                                                                               | PASS — 0 matching history commits. Separate `.env`/`.env.local` history search returned 0 entries.                                   |
| `.env` is not committed                          | `git -c safe.directory=... ls-files                                                                                                            | Select-String -Pattern '(^                                                                                                           | /)\.env'`                                                                                                                                                             | PASS — one tracked entry, `.env.example`; no real `.env` or `.env.local`. |
| `.env.example` exists without a secret value     | `Test-Path .env.example` and field-presence check                                                                                              | PASS — exists; `GEMINI_API_KEY` has no value. Current model placeholder is `gemini-3.1-flash-lite`; the optional chain is commented. |
| Backend never returns provider secret            | inspect `server.ts` response construction and `gemini-ai-coach-provider.ts` SDK construction                                                   | PASS — success is built as `{ advice: providerOutput }`; the key is only passed to SDK construction and is not part of the output.   |
| Logs do not contain the key                      | `rg -n 'console\.(log\|info\|warn\|error)                                                                                                      | logger\s\*\(' backend/src` plus source inspection                                                                                    | PASS — logs contain startup text, sanitized live-validation metadata, or allowlisted attempt/summary metadata; no key, prompt, request, output, header, or raw error. |
| Error responses contain no stack trace or secret | inspect `server.ts` catch mapping and backend safe-error test                                                                                  | PASS — provider exceptions map to `{ "ok": false, "error": "coach_unavailable" }`.                                                   |
| Input is validated before provider call          | `validateAiCoachRequest()` and `tests/ai-coach-gemini.test.ts` — `invalid local input is rejected before Gemini client invocation`             | PASS — invalid input produces zero injected Gemini client calls.                                                                     |
| Output is validated before UI                    | `validateAiCoachAdvice()` and `tests/ai-coach-gemini.test.ts` — `malformed and contract-invalid provider output gets one repair then safe 503` | PASS — invalid output is never returned as success.                                                                                  |

The tool-call source search `rg -n 'tools|functionDeclarations|functionCall' backend/src frontend/src` returned 0 matching lines. The current frontend/bundle secret searches also returned 0 matching files.

The current ignored-environment check returned `root_env_exists=True` and `.gitignore:69:.env .env`; the `.env` contents were not opened or printed.

## Known limitations and open items

- The current reliability-hardening path and optional fallback model have no new live validation in this pass; live validation is intentionally opt-in.
- The manual Coach UI layout/focus play-test remains open under T008/T017. Automated tests do not prove visual layout or keyboard focus.
- The repository includes historical diagnostics and usage-log entries for earlier provider policies; the current contract is the GenerateContent/15-second/three-call policy documented above. Historical rows were not rewritten.
- Pair contributions are not independently inferable from Git metadata. Pair confirmation is required: Pair member A Dušan Nikolić; Pair member B Milena Paripović.

## Contribution record

- Pair member A: Dušan Nikolić — `[FILL: pair-confirmed contribution]`.
- Pair member B: Milena Paripović — `[FILL: pair-confirmed contribution]`.
