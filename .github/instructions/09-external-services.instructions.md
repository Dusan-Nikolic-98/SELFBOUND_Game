# External services and operations

## Default posture

Normal gameplay and development run locally; no external service is required. Do not call external services unless the task needs them. There is no current deployment setup documented in this repository.

## AI provider boundary

- The current AI Coach uses a deterministic fake provider behind the backend. A future Gemini call belongs in the backend; browser code must not call the provider.
- Read the active feature spec/plan before selecting a provider, model, contract, or operational policy. No Gemini model has been chosen in shipped code.
- Read credentials from backend environment configuration only. Do not document credential values or require a key for current development.
- Keep automated tests on the fake provider. No live call is part of the current feature slice.
- Timeout, retry, and fallback behavior must follow the feature/provider contract; do not invent retry loops or fallback models.

## Git and remote operations

Local work does not imply push, PR, or publication. Do not invent remote names or credentials. Perform remote operations only when explicitly requested.

## Deployment

Deployment is currently out of scope and undocumented. Do not infer a host, container setup, release process, or production endpoint.
