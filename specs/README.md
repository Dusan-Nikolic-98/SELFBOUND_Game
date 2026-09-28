# Feature specification folders

Create a folder in `specs/` for each accepted feature before implementation. Use a stable numeric prefix and short name when it helps ordering:

```text
specs/
└── 001-ai-coach/
    ├── spec.md
    ├── plan.md
    └── tasks.md
```

This is a convention, not a claim that an AI Coach feature has been specified or implemented. No feature folder currently exists.

## `spec.md`

Capture the problem and user value, scenarios, functional requirements, input/output expectations, acceptance criteria, out-of-scope behavior, failure behavior, and security boundary.

## `plan.md`

Describe current architecture impact, the chosen approach, contracts, runtime validation, testing strategy, dependencies, risks, and compatibility/migration notes. Distinguish existing components from planned ones.

## `tasks.md`

List ordered implementation tasks, tests alongside behavior, validation/evidence work, and dependencies between tasks. Keep tasks small enough to review.

Feature artifacts supplement rather than replace `docs/GAME_SPEC.md`, which remains the detailed gameplay source of truth unless an approved feature spec supersedes a specific rule.
