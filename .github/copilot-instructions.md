# SELFBOUND agent baseline

This is the always-on entry point for AI coding agents working in SELFBOUND. Use it with the repository's detailed sources; it is not a replacement for them.

## Priority

1. The current user task and its acceptance criteria.
2. The durable principles in [the project constitution](../.specify/memory/constitution.md).
3. An active feature's `spec.md`, `plan.md`, and `tasks.md`, when present.
4. The relevant numbered instruction module listed in [the instruction index](00-index.instructions.md).
5. [GAME_SPEC.md](../docs/GAME_SPEC.md) for gameplay behavior and the current README/source/config for shipped architecture and commands.
6. This concise baseline.

`AGENTS.md` also contains repository-specific working and evidence requirements. When sources describe different kinds of facts, use the source that owns that fact: the game spec owns gameplay rules; the code and package scripts own current implementation and commands. Do not treat historical Week 3 statements about architecture as current when the repository has since changed.

## Always-on guardrails

- Preserve existing gameplay unless the task explicitly changes a rule in an approved spec.
- Browser gameplay code owns deterministic game state and rules; the independent backend exposes health and the AI Coach endpoint, defaulting to fake mode with optional backend-only Gemini configuration.
- Never put provider credentials or server-only configuration in browser code. Any live provider call belongs on the backend and requires an accepted feature contract.
- Runtime-validate structured data at trust boundaries; TypeScript types alone do not validate runtime values.
- Keep changes small and within scope. Do not add frameworks, infrastructure, or unrelated refactors without a concrete requirement.
- Keep any future AI feature read-only and outside the frame-by-frame game loop unless an approved spec changes that boundary.
- Never commit secrets. Run and report the relevant checks before handoff; state clearly which checks were actually run.

## Read only the relevant context

Start at [00-index.instructions.md](00-index.instructions.md), then read the smallest applicable module set. Follow the module links for architecture, conventions, testing, workflow, security, commands, common tasks, review, and external services.

## Minimum done criteria

- Relevant TypeScript build/typecheck and tests pass, or any skipped check is explained.
- Behavior or contract changes update their owning spec/docs and tests.
- The final handoff reports changed files, checks actually run, manual checks if relevant, and known limitations.
