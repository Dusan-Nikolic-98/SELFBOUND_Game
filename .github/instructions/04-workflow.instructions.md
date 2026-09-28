# Workflow instructions

## Before editing

1. Read the current task and relevant feature spec; consult `docs/GAME_SPEC.md` for gameplay rules.
2. Inspect `git status --short` and preserve unrelated user work.
3. Locate the owning frontend, backend, script, or documentation layer and read nearby code.
4. Identify affected tests, contracts, docs, and security boundaries.
5. Decide whether the change affects gameplay, architecture, security, or a future AI boundary.

## Spec-first work

For meaningful behavior, contract, or architecture changes, update/create the relevant Spec Kit artifacts before implementation. Do not silently diverge from an active feature plan.

Feature work follows:

```text
idea → clarify → spec → plan → tasks → implementation → validation → evidence
```

Use `specs/<feature>/spec.md`, `plan.md`, and `tasks.md`; conventions are documented in [`specs/README.md`](../../specs/README.md). The active AI Coach feature is `specs/001-ai-coach/`.

## While editing

- Make the smallest coherent change that satisfies the task.
- Keep gameplay, architecture, and test changes under a clear shared reason; avoid unrelated cleanup.
- Update implementation, tests, contracts, and docs together when they own the changed behavior.
- Preserve user changes and historical evidence. Do not rewrite the `baseline-v1` history or imply Week 4 architecture existed in Week 3.
- Keep `docs/AI_USAGE_LOG.md`, `docs/EVIDENCE_003.md`, and `docs/EVALS.md` consistent when a task triggers the requirements in `AGENTS.md`.

## Verification and handoff

- Run checks appropriate to the change and report their exact outcomes. Never claim a check passed without running it.
- Inspect the complete diff and `git status --short`; ensure no secrets or generated output were added.
- Report changed docs/contracts, automated and manual checks, skipped checks, and known limitations.

## Git operations

Local edits or commits do not authorize a push, PR, deployment, or other remote operation. Do not invent remote names, credentials, or deployment targets. Perform only external operations explicitly requested by the user.
