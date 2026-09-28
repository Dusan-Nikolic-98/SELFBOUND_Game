# SELFBOUND instruction index

Read this index first, then load only the smallest set of modules relevant to the task. The modules describe current repository facts and mark future Week 4 boundaries explicitly.

## Instruction set

1. [Architecture](instructions/01-architecture.instructions.md) — runtime shape, ownership, dependency direction, game flow, and architecture change rules.
2. [Conventions](instructions/02-conventions.instructions.md) — TypeScript, naming, placement, validation, dependencies, and comments.
3. [Testing](instructions/03-testing.instructions.md) — existing test coverage, deterministic game testing, future boundary expectations, and real test commands.
4. [Workflow](instructions/04-workflow.instructions.md) — before-edit checks, spec-first work, implementation discipline, verification, and handoff.
5. [Security](instructions/05-security.instructions.md) — current trust boundaries and future backend-only provider rules.
6. [Build and commands](instructions/06-build-and-commands.instructions.md) — verified npm scripts, ports, endpoint, and environment variables.
7. [Common tasks](instructions/07-common-tasks.instructions.md) — gameplay, level, endpoint, future AI, documentation, and handoff playbooks.
8. [Code review](instructions/08-code-review.instructions.md) — risk-based review order, gates, and required handoff evidence.
9. [External services](instructions/09-external-services.instructions.md) — local-first posture, future provider boundary, and remote/deployment limits.

## Routing matrix

| Change | Read first | Usually also read |
|---|---|---|
| Change a gameplay mechanic or game loop | Architecture | Conventions, testing, review |
| Change `LevelData`, config, or hand-authored level geometry | Architecture | Conventions, testing, common tasks |
| Change Canvas rendering, browser input, or HUD | Architecture | Conventions, testing |
| Add or change a backend route | Architecture | Security, testing, review |
| Add a future AI provider integration | Security | Architecture, testing, external services, review |
| Change a future AI request/response contract | Architecture | Security, conventions, testing |
| Change an npm script, TypeScript config, or dev server | Build and commands | Workflow, architecture |
| Update Spec Kit or agent instructions | Workflow | Architecture, review |
| Prepare a review or handoff | Workflow | Code review, testing |

## Repository baseline

- Node.js 18+ and npm are documented in the root README; `package-lock.json` is the npm lockfile. `package.json` declares TypeScript `^7.0.2`.
- The browser game uses strict TypeScript, HTML, CSS, and the Canvas 2D API. It has no frontend framework or game/physics engine.
- Browser source is in `frontend/src/`; HTML/CSS are in `frontend/`. Independent Node HTTP server source is in `backend/src/`.
- Root `scripts/` contains the development launchers, static frontend server, and level reachability check. `tests/` contains Node's built-in test suite.
- Frontend and backend have separate TypeScript configs; test compilation has its own config.
- The backend currently exposes only `GET /api/health`. The frontend does not call it; gameplay remains playable without the backend.
- Gameplay authority: [`docs/GAME_SPEC.md`](../docs/GAME_SPEC.md). Current architecture/setup: [`README.md`](../README.md), source, `package.json`, and [`docs/CONTEXT_MANIFEST.md`](../docs/CONTEXT_MANIFEST.md). Repository workflow: [`AGENTS.md`](../AGENTS.md).
- No AI provider, authentication, persistence, deployment configuration, or provider-specific environment variable is currently implemented.

## Maintenance rules

- Keep claims aligned with shipped code and scripts; label future work as future.
- Update the narrowest owning source and its cross-links. Avoid copying the same detailed rule into every module.
- Active feature specs govern the feature they define; stale summaries do not override them.
- Update relevant Spec Kit and project docs when an approved change alters behavior, contracts, or architecture.
- Do not rewrite historical Week 3 records to imply that the backend existed then.
