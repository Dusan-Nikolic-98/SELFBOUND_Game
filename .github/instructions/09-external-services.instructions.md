# External services and operations

## Default posture

Normal gameplay and default fake-provider development run locally; no external service is required. Gemini calls occur only when explicitly configured in the backend. There is no current deployment setup documented in this repository.

## AI provider boundary

- The AI Coach defaults to a deterministic fake provider behind the backend and can select Gemini Developer API through backend configuration. Browser code must not call Gemini.
- Read the active feature spec/plan before changing the provider, model, contract, or operational policy. The selected model is `gemini-3.5-flash-lite`.
- Read credentials from backend environment configuration only. Do not document credential values or require a key for default development.
- Keep automated tests offline with fake providers/test doubles. Live validation is an explicit opt-in command, not part of `npm test`.
- Timeout, retry, and fallback behavior must follow the feature/provider contract; do not invent retry loops or fallback models.

## Git and remote operations

Local work does not imply push, PR, or publication. Do not invent remote names or credentials. Perform remote operations only when explicitly requested.

## Deployment

Deployment is currently out of scope and undocumented. Do not infer a host, container setup, release process, or production endpoint.
