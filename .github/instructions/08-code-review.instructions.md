# Code review instructions

## Review order

1. Task scope and acceptance criteria.
2. Active feature spec/plan and relevant project rules.
3. Gameplay correctness and preservation of existing semantics.
4. Frontend/backend dependency boundary.
5. Runtime validation and security/trust boundaries.
6. Tests and manual browser evidence.
7. Docs and command accuracy.
8. Diff hygiene and unrelated changes.

## Mandatory gates

- No accidental gameplay changes or unapproved level geometry changes.
- Frontend and backend remain independent; no browser bundle contains server/provider secrets.
- `GameConfig` and `LevelData` runtime validation remain effective.
- New external/request inputs and future provider outputs are validated at runtime.
- New behavior has meaningful success and failure/edge coverage; do not claim backend route coverage where none exists.
- AI work, if later approved, remains outside frame-by-frame game update/render and cannot arbitrarily mutate game state.
- Errors/logs do not expose secrets or unnecessary internals.
- No unrelated dependency upgrades, infrastructure additions, or generated outputs.
- Historical records and baseline are preserved.

## Risk levels

- **Low:** documentation, small presentation-only changes.
- **Medium:** gameplay logic, level/config contracts, backend routes, or cross-layer contracts.
- **High:** secrets/security, provider integration, or cross-layer architecture changes.

Medium/high risk work needs relevant test evidence; high risk also needs explicit contract and limitation notes.

## Handoff evidence

Report checks run, relevant test scope, any manual browser verification, known limitations, docs/spec changes, and a commit hash only if a commit was requested. Clearly identify checks that were skipped.
