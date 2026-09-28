# Security instructions

## Current trust boundaries

- **Browser input:** keyboard and pointer input drives local gameplay. The browser owns current game state; no game data is sent to a server.
- **Backend request boundary:** the only application route is `GET /api/health`, which accepts no body or user-supplied gameplay data. The server returns small JSON 404/405 errors for other paths/methods.
- **Environment configuration:** current server config reads `HOST` and `PORT`. No provider key, authentication secret, or other credential is used.
- **External provider output:** no provider is called today. If one is added by a future accepted feature spec, its output is untrusted and must be runtime-validated.
- **Logs/errors:** current server logs startup failures/listening address. Do not add secret-bearing configuration or raw sensitive payloads to logs or responses.

## Secrets and local environment

- Never put provider keys or server-only secrets in frontend code, browser-visible configuration, or the frontend bundle.
- The root `.gitignore` excludes `.env` and `.env.*`, except `.env.example`. No `.env.example` is currently present; if added, include placeholders only.
- Never commit, print, log, or place secrets in screenshots, prompts, fixtures, documentation, evidence, or error responses.
- Do not invent or require `GEMINI_API_KEY` or another provider variable before a feature actually uses it.

## Validation and safe failures

- Validate requests before handling them or calling an external service. Invalid local input must be rejected before any future provider invocation.
- Runtime-validate structured external/provider output; malformed output is a failure, not success.
- Keep user-facing errors generic enough not to expose stack traces, credentials, or internal configuration.
- Keep CORS changes scoped to the required browser origins; current backend allows the two local frontend origins in `server.ts`.

## Future AI boundary — not implemented

```text
Browser → SELFBOUND backend → Gemini (or another provider selected by a future spec)
```

- The browser must never call Gemini directly; provider credentials and SDK use remain backend-only.
- Gameplay code remains authoritative. Advice is read-only and advisory unless a future approved spec explicitly defines otherwise.
- Do not call a provider from the frame-by-frame game update/render loop.
- Define input/output contracts, limits, errors, and data handling in the active feature spec before integration.

## Logging

Log only the operational metadata needed for diagnosis. Do not log secret values or full secret-bearing environment configuration. Any future AI usage record should follow its approved contract and avoid raw sensitive payloads.
