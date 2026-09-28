# Security instructions

## Current trust boundaries

- **Browser input:** keyboard and pointer input drives local gameplay. The browser owns current game state; only bounded completed-run summaries are sent when the player explicitly requests Coach advice.
- **Backend request boundary:** `GET /api/health` and `POST /api/ai/coach` are available. The Coach route limits and runtime-validates request bodies before invoking the configured provider.
- **Environment configuration:** backend configuration reads `HOST`, `PORT`, `AI_COACH_PROVIDER`, `GEMINI_API_KEY`, and `GEMINI_MODEL`. The provider defaults to fake; the Gemini key is required only in Gemini mode and is never logged.
- **Provider output:** fake and Gemini provider output is runtime-validated before advice is returned. Gemini output is parsed as untrusted JSON; provider failures map to a generic 503.
- **Logs/errors:** current server logs startup failures/listening address. Do not add secret-bearing configuration or raw sensitive payloads to logs or responses.

## Secrets and local environment

- Never put provider keys or server-only secrets in frontend code, browser-visible configuration, or the frontend bundle.
- The root `.gitignore` excludes `.env` and `.env.*`, except `.env.example`. The checked-in `.env.example` contains placeholders only.
- Never commit, print, log, or place secrets in screenshots, prompts, fixtures, documentation, evidence, or error responses.
- Do not invent or require `GEMINI_API_KEY` or another provider variable before a feature actually uses it.

## Validation and safe failures

- Validate requests before handling them or calling an external service. Invalid local input must be rejected before any provider invocation.
- Runtime-validate structured external/provider output; malformed output is a failure, not success.
- Keep user-facing errors generic enough not to expose stack traces, credentials, or internal configuration.
- Keep CORS changes scoped to the required browser origins; current backend allows the two local frontend origins in `server.ts`.

## Fake and live-provider boundaries

```text
Default: Browser → SELFBOUND backend → deterministic fake provider
Optional: Browser → SELFBOUND backend → Gemini Developer API
```

- The browser calls only the SELFBOUND Coach endpoint and must never call an AI provider directly. Gemini credentials and SDK use remain backend-only.
- Gameplay code remains authoritative. Advice is read-only and advisory unless a future approved spec explicitly defines otherwise.
- Do not call a provider from the frame-by-frame game update/render loop.
- Define input/output contracts, limits, errors, and data handling in the active feature spec before integration.

## Logging

Log only the operational metadata needed for diagnosis. Do not log secret values or full secret-bearing environment configuration. AI usage records contain only the approved safe metadata and exclude raw sensitive payloads.
