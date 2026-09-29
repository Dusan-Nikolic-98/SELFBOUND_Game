# W04 AI Coach evaluation matrix

The current offline run was `npm test`, executed through `cmd.exe /d /c "npm test"` because the PowerShell `npm.ps1` shim is blocked in this environment. It reported 66 tests, 66 passes, 0 failures, 0 cancelled, 0 skipped, and 0 todo.

| ID | Scenario | Expectation | Test that proves it | Result |
| --- | --- | --- | --- | --- |
| A1 | valid request | structured advice, exactly one provider call | `tests/ai-coach-backend.test.ts` — `valid one-run and three-run requests reach the fake provider and return structured advice`; `tests/ai-coach-gemini.test.ts` — `primary first-call success has no fallback or repair` | PASS — valid fake route succeeds; primary Gemini success makes one call with no repair/fallback. |
| A2 | invalid local input | `providerCallCount === 0` | `tests/ai-coach-gemini.test.ts` — `invalid local input is rejected before Gemini client invocation`; `tests/ai-coach-backend.test.ts` — `invalid, zero-run, and excess-run requests are rejected before provider invocation` | PASS — invalid requests are rejected before the injected provider/client is called. |
| A3 | provider failure | safe error, attempts within the bound | `tests/ai-coach-backend.test.ts` — `provider failure and malformed provider output map to safe unavailable responses`; `tests/ai-coach-gemini.test.ts` — `all configured models failing transiently stops after three calls with safe summary` | PASS — the route maps failure to safe 503; the provider stops at the three-call cap. |
| A4 | timeout | request aborted, safe error | `tests/ai-coach-gemini.test.ts` — `15-second total deadline aborts a hung call and produces safe 503` | PASS — the shared deadline aborts the hung operation and produces safe 503. |
| A5 | malformed provider output | not shown as success | `tests/ai-coach-gemini.test.ts` — `malformed and contract-invalid provider output gets one repair then safe 503` | PASS — one same-model repair is attempted, then invalid output becomes safe 503 rather than success. |
| A6 | retry scenario | attempts stay within the documented bound | `tests/ai-coach-gemini.test.ts` — `transient 503 retries once then succeeds with safe usage metadata`; `retryable statuses and network errors retry at most once; 400/401/403 do not`; `transient primary exhaustion uses allowlisted fallback as third and final call` | PASS — transient retry, bounded fallback, and three-call maximum are covered. |
| A7 | auth failure (401/403) | no retry | `tests/ai-coach-gemini.test.ts` — `retryable statuses and network errors retry at most once; 400/401/403 do not` | PASS — 401/403 are non-retryable. |
| A8 | oversized / wrong content type | rejected before the provider is called | `tests/ai-coach-backend.test.ts` — `oversized request body and wrong content type do not invoke provider` | PASS — oversized input returns 413, wrong content type returns 400, and provider calls remain zero. |

## Fake-only coverage

The deterministic route success, frontend-to-backend round trip, fake advice selection, and generic fake-provider failure tests use `FakeAiCoachProvider` or injected providers. Telemetry/lifecycle and frontend-client tests are offline. The GenerateContent tests use scripted clients and SDK transport doubles; they do not make live API calls.

## Live check and gaps

The current verification pass did not run `npm run test:ai:live`, as required by the prompt unless the pair explicitly authorizes it. The script adds a diagnostic-only production-path request when `AI_COACH_PROVIDER=gemini` and a backend key are available; it validates the HTTP response with `validateAiCoachResponse()` and prints only sanitized metadata. The repository usage log records an earlier GenerateContent viability call, but the current reliability-hardening path and fallback candidate have not been live-verified in this pass.

The manual Coach UI layout/focus play-test remains open under T008/T017. No eval row above is claimed as visual browser proof.
