# Codex Task — Build a Project-Specific Spec Kit / Agent Instruction System for SELFBOUND

## Objective

Create a **project-specific Spec Kit and AI coding-agent instruction system** for the existing SELFBOUND repository.

The repository currently has project documentation such as:

- `GAME_SPEC.md`
- `CONTEXT_MANIFEST.md`

and may already have undergone (or be undergoing) a frontend/backend separation.

The goal of this task is to turn the repository's real architecture, conventions, testing approach, security boundaries, commands, and workflow into a structured, reusable instruction system similar in **shape and philosophy** to the provided example files.

This is a documentation/context-engineering task.

Do **not** redesign the game.
Do **not** implement the AI Coach feature.
Do **not** add Gemini integration.
Do **not** perform broad code refactors just to make the repository match the example project.

The instruction files must describe the **actual SELFBOUND repository**, not an imagined target architecture.

---

# Important: How to Use the Provided Example Files

You have been given example instruction files from another project.

Use them as references for:

- organization;
- level of specificity;
- routing between instruction files;
- separation of concerns;
- tone;
- maintenance rules;
- architecture/security/testing/workflow guidance;
- keeping always-on instructions concise;
- sending task-specific work to the smallest relevant context set.

Do **not** copy project-specific facts from the examples.

The example project includes things such as:

- React;
- Fastify;
- bot runners;
- persistence;
- JWT authentication;
- Docker deployment;
- cloud VM infrastructure;
- OpenAPI;
- deterministic multiplayer/domain-engine concerns;
- submission archives;
- sandboxing;
- replay/hash chains.

SELFBOUND may not use any of those.

Never introduce those concepts into SELFBOUND documentation unless they genuinely exist in the current repository.

The examples are a **template for context engineering**, not a target architecture.

---

# Primary Rule

## Instructions must match the shipped repository

Before writing any instruction file:

1. inspect the entire relevant repository structure;
2. read `GAME_SPEC.md`;
3. read `CONTEXT_MANIFEST.md`;
4. read the root `README.md` if one exists;
5. inspect `package.json` and lockfile;
6. inspect all TypeScript configuration;
7. inspect frontend and backend structure;
8. inspect actual development/build/test scripts;
9. inspect existing tests;
10. inspect `.gitignore` and environment examples;
11. inspect current API routes;
12. inspect current validation/error-handling patterns;
13. inspect recent architecture documentation if present.

Do not describe architecture that is merely planned.

Do not document commands that do not exist.

Do not claim tests exist when they do not.

Do not invent deployment, persistence, authentication, or infrastructure.

When something is not yet implemented, either omit it or clearly label it as future/out of scope.

---

# SELFBOUND Project Context

SELFBOUND is a small retro-inspired 2D browser game.

Core Week 3 characteristics include:

- TypeScript;
- HTML/CSS;
- HTML Canvas;
- direct browser gameplay;
- simple game state;
- hand-authored level data;
- no game engine;
- no physics engine;
- no multiplayer;
- no database;
- no procedural level generation.

Core gameplay includes:

- horizontal player movement;
- mouse aiming;
- a blue self-projectile;
- projectile wall bounces;
- ordered enemy capture;
- teleport-to-captured-target behavior;
- failed shots becoming a green homing threat;
- lives and reset behavior;
- level completion after the required target sequence and reaching the exit.

Week 4 will later add one small, reliable AI feature.

The intended future direction is an **AI Coach** that analyzes one or more completed runs and gives structured gameplay advice.

That AI feature is **not to be implemented in this task**.

If the repository already contains a frontend/backend split, document the actual split.

If the split is not complete, document the current state honestly; do not perform the split unless explicitly necessary for creating accurate documentation.

---

# Desired Outcome

Create a maintainable instruction/documentation hierarchy that lets a future coding agent quickly answer:

- What is this project?
- What are the architectural boundaries?
- Where does frontend code belong?
- Where does backend code belong?
- Which layer owns game rules?
- What must remain deterministic/local?
- What must never be changed casually?
- How are runtime inputs validated?
- What are the security boundaries?
- How should future AI integration be isolated?
- Which commands actually run the project?
- How are changes tested?
- What checks are required before handoff?
- Which instruction files should be read for a particular task?
- What project principles should remain true as Week 4 work continues?

---

# Target File Structure

Create a structure inspired by the provided examples.

Prefer the following unless the existing repository already has an established equivalent:

```text
.github/
├── copilot-instructions.md
├── 00-index.instructions.md
└── instructions/
    ├── 01-architecture.instructions.md
    ├── 02-conventions.instructions.md
    ├── 03-testing.instructions.md
    ├── 04-workflow.instructions.md
    ├── 05-security.instructions.md
    ├── 06-build-and-commands.instructions.md
    ├── 07-common-tasks.instructions.md
    ├── 08-code-review.instructions.md
    └── 09-external-services.instructions.md
```

Also create or establish the minimum real Spec Kit foundation if it does not already exist:

```text
.specify/
└── memory/
    └── constitution.md
```

and a suitable place for feature specifications, such as:

```text
specs/
```

Do **not** invent a completed Week 4 AI feature spec in this task.

It is acceptable to leave `specs/` empty or include only a small explanatory README if that is useful.

If the repository already uses another valid Spec Kit path/structure, preserve it rather than duplicating it.

---

# 1. `.github/copilot-instructions.md`

Create a short **always-on entry point**.

It should be concise.

It should include:

## Purpose

Explain that this is the always-on baseline for AI coding agents working on SELFBOUND.

## Priority order

Use a priority order similar to:

1. current user task and acceptance criteria;
2. project constitution;
3. active feature `spec.md`, `plan.md`, and `tasks.md` when present;
4. relevant numbered instruction module;
5. `GAME_SPEC.md` / current source-of-truth project docs;
6. concise always-on summary.

Adapt ordering if the repository structure makes another ordering clearer.

## Always-on guardrails

Include only genuinely important invariants, for example:

- preserve existing gameplay unless the task explicitly changes it;
- frontend game code remains authoritative for deterministic gameplay mechanics unless architecture explicitly changes later;
- browser code must never contain AI provider secrets;
- future AI calls must go through the backend;
- validate data at trust boundaries;
- do not add large frameworks/infrastructure without need;
- do not perform unrelated refactors;
- keep AI features narrow, structured, and testable;
- never commit secrets;
- run relevant verification before handoff.

Do not make this file a huge duplicate of all numbered modules.

## Instruction modules

Link to the index and numbered modules.

## Minimum done criteria

Define concise minimum expectations:

- relevant code typechecks/builds;
- relevant tests/checks pass;
- docs/contracts are updated when behavior changes;
- final handoff reports checks actually run and known limitations.

---

# 2. `.github/00-index.instructions.md`

Create the routing/index document.

It should include:

## Purpose

Explain that agents should read this first and then load only the smallest relevant module set.

## Instruction set

List and describe all numbered modules.

## Routing matrix

Create a SELFBOUND-specific routing table.

Include tasks such as:

| Change | Read first | Usually also read |
|---|---|---|
| Change gameplay mechanic | Architecture | Conventions, testing, review |
| Change level/game config | Architecture | Testing, conventions |
| Change Canvas/UI behavior | Architecture | Conventions, testing |
| Add/change backend route | Architecture | Security, testing, review |
| Add AI provider integration | Security | Architecture, testing, external services |
| Change AI request/response contract | Architecture | Security, testing, conventions |
| Change build/dev command | Build and commands | Workflow |
| Update Spec Kit docs | Workflow | Architecture, review |
| Prepare handoff/commit | Workflow | Code review |

Adapt these rows to the actual repository.

## Repository baseline

Document current facts only:

- Node/TypeScript versions if discoverable;
- package manager;
- frontend technology;
- backend technology;
- actual folder layout;
- test tooling;
- current source-of-truth docs.

Do not paste aspirational Week 4 architecture as if shipped.

## Maintenance rules

State that:

- instructions must match current repository reality;
- update the smallest relevant file;
- avoid duplicating the same rule across all modules;
- active feature specs override stale summaries;
- architecture changes require corresponding Spec Kit/doc updates.

---

# 3. `01-architecture.instructions.md`

This should be one of the most detailed files.

Document the actual SELFBOUND system shape.

Include:

## System shape

Show the relevant repository tree.

Use the real structure.

## Runtime topology

Describe actual runtime flow.

If the backend currently has only a health endpoint, say exactly that.

For future AI work, it is okay to document a boundary like:

```text
Frontend
   ↓
SELFBOUND backend
   ↓
AI provider (future Week 4 integration)
```

but clearly mark the AI provider portion as future/not yet implemented.

## Ownership / layer responsibilities

Clearly state who owns:

- rendering;
- input;
- game loop;
- deterministic game rules;
- level data;
- runtime validation;
- backend transport;
- server configuration;
- future AI provider calls;
- future AI request/response validation.

## Dependency direction

State explicit allowed and forbidden dependencies.

For example:

- frontend game code must not import backend server modules;
- backend code must not depend on browser/Canvas code;
- provider SDK code must remain backend-only when added;
- shared contracts, if any, must be environment-neutral.

## Critical game flow

Summarize the important gameplay flow:

```text
move
→ aim
→ fire
→ hit target OR create green threat
→ defend/capture
→ complete sequence
→ reach exit
```

Do not duplicate the full `GAME_SPEC.md`; link/reference it as the detailed gameplay source.

## Change rules

Include rules such as:

- gameplay changes require spec/test updates;
- architectural changes require plan/constitution review;
- avoid moving gameplay authority into UI presentation code;
- avoid mixing provider logic into gameplay loop;
- AI must not become part of frame-by-frame rendering/game update.

---

# 4. `02-conventions.instructions.md`

Document actual implementation conventions.

Include only conventions supported by the repository.

Possible sections:

## TypeScript / language

- strictness;
- ESM/CommonJS;
- explicit types at boundaries;
- runtime narrowing/validation;
- local naming style.

## Naming and placement

Based on actual code:

- filenames;
- exported symbols;
- tests;
- frontend/backend placement;
- API contracts;
- config;
- game data.

## Validation

Make boundary validation explicit.

For current/future Week 4 work:

- frontend input sent to backend must be validated;
- backend must validate provider output;
- TypeScript types alone are not runtime validation;
- malformed external/provider data must never be treated as successful.

Do not mandate Zod unless the repository actually uses it or adopting it has already been decided.

## Dependencies

- reuse existing dependencies;
- no opportunistic upgrades;
- justify new packages;
- avoid framework migrations.

## Comments/docs

Prefer comments for invariants, tricky math/collision logic, security boundaries, and non-obvious decisions.

---

# 5. `03-testing.instructions.md`

Base this entirely on actual test infrastructure.

Do not write fake commands.

Include:

## Required confidence

For behavior changes:

- at least one success path;
- meaningful edge/failure coverage where practical;
- public contract changes need boundary tests.

For future AI work, explicitly anticipate:

- valid request;
- invalid local input;
- provider failure/timeout;
- malformed provider output;
- bounded retry behavior if retry exists;
- invalid local input causing zero provider calls.

Do not claim those tests already exist unless they do.

## Test locations

Document actual locations.

If tests are minimal or absent, say so and define the expected placement convention going forward.

## Game testing principles

For deterministic game logic:

- prefer deterministic tests;
- avoid wall-clock/network dependence;
- verify observable behavior rather than private implementation details.

## UI/manual testing

Document which game interactions still require manual browser testing, if any.

## Commands

Use only actual commands discovered in `package.json`.

---

# 6. `04-workflow.instructions.md`

Create a safe development workflow.

Include:

## Before editing

1. read the relevant task/spec;
2. inspect git status;
3. preserve unrelated user work;
4. locate owning layer;
5. identify affected tests/contracts/docs;
6. determine whether the task changes gameplay, architecture, security, or AI boundary.

## Spec-first rule

For changes that alter behavior or architecture:

- update/create the relevant Spec Kit artifacts before implementation;
- do not silently diverge from the active plan.

For future Week 4 features, use:

```text
idea
→ clarify
→ spec
→ plan
→ tasks
→ implementation
→ validation
→ evidence
```

## While editing

- smallest coherent change;
- no unrelated cleanup;
- update implementation/tests/contracts/docs together;
- preserve user changes.

## Verification and handoff

- run proportionate checks;
- inspect diff/status;
- verify no secrets;
- report tests actually run;
- report skipped/manual checks;
- report known limitations.

## Git operations

Unless repository/user policy says otherwise:

- local edits/commits do not imply push;
- never push or open PR without explicit user request.

Do not invent remote names or credentials.

---

# 7. `05-security.instructions.md`

This file is especially important for Week 4 preparation.

Document actual and future-relevant trust boundaries.

Include:

## Trust boundaries

At minimum distinguish:

- browser/frontend input;
- backend request boundary;
- environment configuration;
- external AI provider output (future);
- logs/errors.

## Secrets

Explicit rules:

- provider API keys are backend-only;
- never place API keys in frontend code;
- never commit `.env`;
- never log secrets;
- never put keys in screenshots, prompts, fixtures, docs, evidence, or error responses;
- `.env.example` contains placeholders only.

## Validation

- validate request input before provider calls;
- invalid local input must fail before provider invocation;
- validate structured provider output at runtime;
- provider output is untrusted;
- safe user-facing errors must not expose internals.

## AI-specific boundary

Document as future architecture if not implemented yet:

```text
Browser
  ↓
SELFBOUND backend
  ↓
Gemini
```

State clearly:

- browser must never call Gemini directly;
- gameplay engine remains authoritative;
- AI advice should be read-only/advisory unless a future spec explicitly says otherwise;
- AI must not arbitrarily mutate gameplay state;
- no frame-by-frame provider calls.

## Logging

- log metadata/summary, not secrets/raw sensitive payloads;
- future AI usage logs may include provider/model/latency/success/attempts/token usage if available;
- do not log full secret-bearing environment configuration.

---

# 8. `06-build-and-commands.instructions.md`

Inspect and document only real commands.

Include:

## Install

Actual package-manager command(s).

## Frontend

Exact commands and working directory.

## Backend

Exact commands and working directory.

## Combined development

Only if it exists.

## Build/typecheck/test/lint

Only actual scripts.

## Ports/endpoints

Document actual development ports if stable and discoverable.

Document the current health endpoint if one exists.

## Environment

List names of safe configuration variables, never values.

If `GEMINI_API_KEY` is not used yet, do not describe it as required.

## Command discipline

- targeted checks first;
- full relevant suite before handoff;
- report checks that could not run;
- do not claim success without execution.

---

# 9. `07-common-tasks.instructions.md`

Create SELFBOUND-specific playbooks.

Include several concise workflows:

## Add or change a gameplay mechanic

1. confirm rule/spec;
2. identify game-state/config impact;
3. modify owning gameplay module;
4. update runtime validation if structured data changes;
5. add/update tests;
6. manually verify browser behavior if necessary;
7. update docs/spec.

## Change level data

1. preserve `LevelData` contract;
2. validate data;
3. update tests/evidence;
4. verify sequence/collision/exit behavior.

## Add/change backend endpoint

1. define request/response contract;
2. validate request;
3. implement transport;
4. keep provider/business logic outside route if appropriate;
5. test happy/failure cases;
6. update client/docs.

## Add future AI Coach feature

This should be a **playbook, not implementation**:

1. confirm active AI feature spec;
2. define minimal game summary/log input;
3. define structured output contract;
4. validate local input;
5. implement fake provider first;
6. test success/failure/malformed/timeout paths;
7. connect live Gemini on backend only;
8. add bounded timeout/retry policy;
9. validate provider output;
10. add safe frontend presentation;
11. capture evidence/usage.

## Update docs / Spec Kit

- update most specific source first;
- avoid duplicate/conflicting rules.

## Prepare handoff

- inspect diff/status;
- run checks;
- summarize changes/limitations;
- no remote operation unless requested.

---

# 10. `08-code-review.instructions.md`

Create a SELFBOUND risk-based review checklist.

## Review order

1. task scope / acceptance criteria;
2. active spec/plan;
3. gameplay correctness;
4. architecture boundary;
5. security;
6. tests;
7. docs;
8. diff hygiene.

## Mandatory gates

Likely gates include:

- no accidental gameplay change;
- frontend/backend boundary preserved;
- no server/provider secrets in browser bundle;
- external input/provider output validated;
- game config/level contracts stay valid;
- new behavior has meaningful tests;
- AI not introduced into frame-by-frame game loop;
- errors do not leak secrets/internal stack details;
- no unrelated dependency upgrades/refactors.

## Risk levels

Define useful SELFBOUND categories:

- low: docs/small presentation changes;
- medium: gameplay logic, level contracts, API contracts;
- high: secrets/security/provider integration, cross-layer architecture changes.

## Handoff evidence

Require:

- checks run;
- manual browser verification;
- known limitations;
- docs/spec changed;
- commit hash only if a commit was requested.

---

# 11. `09-external-services.instructions.md`

Keep this minimal because SELFBOUND currently has little external infrastructure.

Do not copy cloud/remote procedures from the example project.

Include:

## Default posture

- normal game development should work locally;
- no external service should be required for basic gameplay;
- do not call external services unless the task needs them.

## AI provider — future Week 4

Document the intended safe posture:

- Gemini is called only by backend;
- API key comes from environment;
- provider/model must be explicit;
- use the cheapest/smallest model that reliably solves the scenario;
- fake/mock provider is the default for most tests;
- live calls are limited and intentional;
- timeout/retry/fallback behavior follows the feature/provider contract.

Do not invent a specific Gemini model name unless one has actually been chosen.

## Git/remote operations

State generic safety rules only:

- local work does not imply push;
- no push/PR/deploy unless explicitly requested;
- do not invent tokens/remotes.

## Deployment

If deployment is not part of the repository, explicitly state that deployment is currently out of scope / undocumented.

---

# 12. `.specify/memory/constitution.md`

Create a concise SELFBOUND project constitution.

This should contain durable project principles, not task-specific instructions.

Suggested principles:

## I. Preserve Core Gameplay Semantics

Existing game mechanics are stable unless a feature spec explicitly changes them.

## II. Minimal, Understandable Architecture

Prefer simple TypeScript/browser/server solutions over framework or infrastructure expansion.

## III. Explicit Frontend / Backend Security Boundary

Secrets and provider calls remain backend-only.

## IV. Deterministic Game Authority

Core game behavior is implemented deterministically by game code, not delegated to an LLM.

## V. Runtime Validation at External Boundaries

Structured configuration, backend inputs, and future AI outputs are runtime-validated.

## VI. Reliable AI Over Impressive AI

Future AI functionality must be small, useful, structured, bounded, testable, and fail safely.

## VII. Spec Before Behavior Change

Meaningful architecture/gameplay/AI changes require a feature spec/plan/tasks before implementation.

## VIII. Evidence-Based Completion

A change is complete only when the relevant checks were actually run and limitations are reported honestly.

Adapt these principles to the repository.

Do not put temporary Week 4 task details into the constitution unless they express a durable engineering rule.

---

# Spec Kit Feature Folder Policy

Establish a convention for future feature folders.

A future feature may look like:

```text
specs/
└── 001-ai-coach/
    ├── spec.md
    ├── plan.md
    ├── tasks.md
    └── ...
```

Do not create a fake completed AI Coach spec yet unless the repository already has one.

Document that future feature specs should contain:

## `spec.md`

- problem/user value;
- user scenarios;
- functional requirements;
- input/output expectations;
- acceptance criteria;
- out of scope;
- error/failure behavior;
- security boundary.

## `plan.md`

- current architecture impact;
- chosen technical approach;
- contracts;
- validation;
- testing strategy;
- dependencies;
- risks;
- migration/compatibility notes.

## `tasks.md`

- ordered implementation tasks;
- tests alongside implementation;
- validation/evidence tasks;
- clear dependencies between tasks.

---

# Relationship to Existing `GAME_SPEC.md`

Do not replace `GAME_SPEC.md`.

It remains the detailed source of truth for the original game rules unless/until a later approved spec supersedes a specific section.

The new instruction pack should reference it instead of copying the whole document.

Do not rewrite historical Week 3 facts to pretend Week 4 architecture always existed.

---

# Relationship to `CONTEXT_MANIFEST.md`

Inspect its actual purpose.

Update it only if needed so it correctly points to the new context/instruction hierarchy.

Do not duplicate all instruction text inside it.

---

# Critical Anti-Copy Rules

Do not copy any of these from the example project unless SELFBOUND really uses them:

- React;
- Fastify;
- Tailwind;
- JWT;
- OpenAPI;
- bot runner;
- bot SDK;
- persistence repositories;
- JSON database;
- sandbox;
- Docker;
- cloud VM;
- authentication;
- multiplayer;
- tournament;
- replay hash chains;
- remote names;
- private credential names.

If the example says `npm run lint` but SELFBOUND has no lint script, do not document it as available.

If the example uses Zod but SELFBOUND uses another validator, document SELFBOUND's validator.

If SELFBOUND has no automated tests for a category, say so rather than fabricating them.

---

# Editing Scope

This task should primarily add/update documentation and instruction files.

Avoid product-code edits.

Do not:

- implement AI Coach;
- install Gemini SDK;
- add provider endpoints;
- add telemetry;
- change gameplay;
- change level geometry;
- migrate frameworks;
- add databases;
- add deployment infrastructure;
- redesign build tooling.

---

# Validation

Before completing:

1. verify every documented path actually exists or is intentionally being created;
2. verify every command against `package.json`;
3. verify architecture claims against source code;
4. verify frontend/backend claims against imports and entry points;
5. verify environment/security claims against `.gitignore` and env files;
6. verify test claims against actual tests;
7. search for copied example-project terminology that does not belong in SELFBOUND;
8. inspect the full diff;
9. ensure no secrets were added.

Perform a terminology sweep for accidental leftovers such as:

```text
Example Project
React
Fastify
JWT
runner
bot
tournament
upstream
PUBLISHING_PAT
```

A match is acceptable only if that concept genuinely exists in SELFBOUND or appears inside an explicit explanatory comparison.

---

# Acceptance Criteria

This task is complete when:

- [ ] `.github/copilot-instructions.md` exists and is concise.
- [ ] `.github/00-index.instructions.md` exists.
- [ ] numbered instruction modules exist under `.github/instructions/`.
- [ ] instructions describe SELFBOUND rather than the example project.
- [ ] routing matrix is SELFBOUND-specific.
- [ ] architecture file reflects the actual repository.
- [ ] build/commands file contains only real commands.
- [ ] testing file distinguishes existing tests from future expectations.
- [ ] security file establishes the backend-only secret/provider boundary.
- [ ] external-services file does not invent deployment infrastructure.
- [ ] `.specify/memory/constitution.md` exists or an existing constitution is updated appropriately.
- [ ] a convention for future `specs/<feature>/spec.md`, `plan.md`, `tasks.md` is established.
- [ ] `GAME_SPEC.md` remains preserved as the game-rule source of truth.
- [ ] `CONTEXT_MANIFEST.md` is aligned if necessary.
- [ ] no gameplay code was intentionally changed.
- [ ] no AI integration was implemented.
- [ ] no secret was introduced.
- [ ] all documented commands/paths were verified.

---

# Required Final Report

After completing the task, provide:

## 1. Repository Facts Discovered

Summarize the actual frontend stack, backend stack, folder structure, package manager, TypeScript setup, tests, current API surface, and relevant environment handling.

## 2. Files Created / Updated

List every instruction/Spec Kit file added or changed.

## 3. Instruction Routing Model

Explain how a future Codex task should decide which files to read.

## 4. Constitution Principles

List the final durable principles briefly.

## 5. Spec Kit Convention

Show the agreed future feature folder structure.

## 6. Example-Specific Content Rejected

List notable concepts from the provided examples that were intentionally **not** copied because they do not apply to SELFBOUND.

## 7. Validation Performed

List exact commands/searches/checks actually performed.

Do not claim checks that were not run.

## 8. Uncertainties / Gaps

State anything the repository does not currently define clearly.

Do not silently invent missing policy.

## 9. Recommended Next Step

The next task should be:

> Create the dedicated Week 4 AI Coach feature specification (`spec.md`, `plan.md`, `tasks.md`) using the new SELFBOUND instruction system, before implementing Gemini integration.

Do not execute that next step in this task.

---

# Decision Rules

When uncertain:

1. inspect the repository;
2. prefer current shipped reality over example text;
3. prefer existing project conventions over introducing new ones;
4. keep instructions small and routed;
5. avoid duplication;
6. distinguish current state from future Week 4 intent;
7. preserve gameplay;
8. never invent commands, tests, infrastructure, or security guarantees.

The goal is **not** to make SELFBOUND look like the example project.

The goal is to give SELFBOUND the same quality of structured, reusable, project-specific context engineering.
