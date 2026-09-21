# AI USAGE LOG

Record significant coding-agent calls only. Do not store private chain-of-thought.

| # | Phase | Why AI was called | Expected result | Actual result | Next decision |
|---:|---|---|---|---|---|
| 1 | Build V1 | Implement the Week 3 Core from the locked game specification | Working minimal browser game with tests/checks | Implemented the TypeScript Canvas game, runtime validation, Core Level 1, HUD/reset flow, and five pure-logic tests. Typecheck, test, build, and a headless Edge smoke check passed. | Interactive evals and baseline evidence still require a human desktop-browser run. |

## Logging Guidance

For each significant call, record:

- the phase or purpose;
- what you expected to change;
- the actual outcome;
- the next engineering decision.

Do not record:

- API keys;
- credentials;
- environment secrets;
- private payloads that are not needed for the demonstration;
- raw sensitive stack traces.

The goal is to make major AI-assisted engineering decisions auditable and reproducible without storing private chain-of-thought.
