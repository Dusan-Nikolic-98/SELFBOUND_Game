# Common task playbooks

## Add or change a gameplay mechanic

1. Confirm the rule in `docs/GAME_SPEC.md` or an active feature spec; clarify any intentional rule change before implementation.
2. Identify affected game state, config, and owning module under `frontend/src/`.
3. Update runtime validation if structured config or level data changes.
4. Add/update deterministic tests in `tests/` for normal behavior and meaningful failure/edge behavior.
5. Manually verify the browser interaction if input, rendering, or timing is affected.
6. Update the relevant spec/docs and required evidence records.

## Change level data

1. Preserve the `LevelData` contract and edit hand-authored data in `frontend/src/level.ts`.
2. Keep runtime validation in place and ensure sequence IDs refer to declared enemies.
3. Update focused tests/evidence if the change affects a rule or recorded result.
4. Run `npm run build:frontend` followed by `node scripts/check-reachability.mjs`; verify sequence and exit behavior in browser when needed.

## Add or change a backend endpoint

1. Define the smallest request/response contract and error behavior in the active spec.
2. Validate any request input before application behavior; the current health endpoint has no request body.
3. Implement transport in `backend/src/` without importing frontend/game code.
4. Keep business/provider logic separate from transport when the feature warrants a module; avoid layering for the health-only server.
5. Test success and failure/boundary cases. There are currently no backend route tests, so add suitable coverage for new behavior.
6. Update the client/docs only if a client or public contract is actually added.

## AI Coach feature

The AI Coach contract and fake-provider slice exist. For future implementation work:

1. Create and approve the dedicated feature `spec.md`, `plan.md`, and `tasks.md`.
2. Define the minimal game summary/run input and structured response contract.
3. Keep the fake provider as the default in tests and runtime-validate request and provider response.
4. Cover success, invalid input with zero provider calls, provider failure/timeout, malformed output, and bounded retries only if the contract includes retries.
5. Add live Gemini access only in a separately authorized task, on the backend with a backend-only environment key and explicit provider/model choice in the plan.
6. Validate provider output, define safe errors/timeouts, and present advice without mutating the game.
7. Capture required validation/evidence and update docs and usage records.

## Update docs or Spec Kit

Update the narrowest source that owns the fact, then its links/index summaries. Keep `GAME_SPEC.md` as gameplay authority; keep current architecture claims grounded in source and scripts. Use [`specs/README.md`](../../specs/README.md) for future feature folder contents.

## Prepare a handoff

Inspect `git diff` and `git status --short`, run relevant checks, confirm no secret/generated files were added, and report changes, checks actually run, manual verification, and limitations. Do not push, open a PR, or deploy unless requested.
