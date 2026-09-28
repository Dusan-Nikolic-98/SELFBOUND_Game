# Codex Task — Implement AI Coach Telemetry, Run History, UI, and Fake Backend Flow

## Objective

Implement the next scoped phase of SELFBOUND Week 4:

1. passive gameplay telemetry for the AI Coach;
2. current-run and completed-run lifecycle;
3. history of up to the three most recently completed runs;
4. AI Coach UI trigger and result presentation;
5. backend AI Coach endpoint using a **fake/mock provider only**;
6. request/response runtime validation;
7. tests for the fake end-to-end flow and critical lifecycle behavior.

Do **not** integrate Gemini yet.

Do **not** add any live AI provider call.

Do **not** install or initialize a Gemini SDK unless it is already required by the repository for another unrelated reason.

This task should leave the project in a state where the entire AI Coach product flow works locally with a deterministic fake provider.

---

# Required Context — Read Before Editing

Read and follow these files before making changes:

```text
.github/copilot-instructions.md
.github/00-index.instructions.md
.specify/memory/constitution.md

specs/001-ai-coach/spec.md
specs/001-ai-coach/plan.md
specs/001-ai-coach/tasks.md

GAME_SPEC.md
CONTEXT_MANIFEST.md
```

Then use `.github/00-index.instructions.md` to load the smallest relevant instruction set.

At minimum, this task is expected to require the modules for:

```text
architecture
conventions
testing
workflow
security
code review
build and commands
```

Read `external-services` only as needed to confirm that no live provider call belongs in this task.

Also inspect the actual implementation files referenced by `specs/001-ai-coach/plan.md`.

Do not rely on paths guessed from this prompt if the feature plan identifies different current repository paths.

---

# Source-of-Truth Priority

Use this order when resolving implementation details:

1. current user task and this scoped implementation prompt;
2. `.specify/memory/constitution.md`;
3. `specs/001-ai-coach/spec.md`;
4. `specs/001-ai-coach/plan.md`;
5. `specs/001-ai-coach/tasks.md`;
6. relevant `.github/instructions/*`;
7. `GAME_SPEC.md`;
8. current shipped code.

If the feature spec/plan conflicts with the actual repository in a way that prevents a safe implementation, do not invent a new architecture silently.

Make the smallest reasonable adaptation and report it clearly in the final handoff.

---

# Scope

This task implements the **pre-Gemini vertical slice**.

The expected flow is:

```text
player plays SELFBOUND
        ↓
game records passive telemetry
        ↓
run reaches Level Complete or Game Over
        ↓
run summary finalized
        ↓
last-three completed history updated
        ↓
player clicks AI Coach
        ↓
frontend validates/serializes completed history
        ↓
backend validates request
        ↓
fake AI Coach provider returns deterministic structured advice
        ↓
backend validates provider response
        ↓
frontend displays advice
```

The active unfinished run must never be included in the Coach request.

---

# Explicitly Out of Scope

Do not implement:

- Gemini;
- OpenAI;
- any live provider;
- provider API keys;
- real provider retries;
- live token usage;
- model fallback;
- provider fallback;
- production AI prompt tuning;
- AI usage dashboard;
- database;
- local player accounts;
- long-term player profiles;
- server-side run persistence;
- procedural generation;
- AI-controlled gameplay;
- frame-by-frame AI calls;
- boss AI;
- dynamic difficulty;
- unrelated game redesign;
- broad architecture refactors.

A minimal provider abstraction is allowed and encouraged so the fake provider can later be replaced by Gemini cleanly.

---

# Preserve Existing Gameplay

Telemetry must be passive.

The player should not experience changed mechanics because telemetry was added.

Do not intentionally change:

- movement;
- gravity;
- collision;
- camera;
- projectile speed;
- projectile range;
- bounce rules;
- firing cooldown;
- capture order;
- teleport behavior;
- enemy movement;
- green threat mechanics;
- lives;
- reset semantics;
- level geometry;
- target positions;
- win conditions;
- Game Over behavior.

The only user-visible additions in this task should be the AI Coach UI and any minimal status/result presentation required for the fake flow.

---

# Phase A — Confirm Contracts From the Feature Plan

Before implementing telemetry, inspect the contracts proposed in:

```text
specs/001-ai-coach/spec.md
specs/001-ai-coach/plan.md
```

Implement the feature using the project's actual runtime validation approach.

Do not maintain one hand-written TypeScript type and a separate inconsistent runtime schema if the current project has a standard pattern for deriving/reusing contracts.

At minimum, there must be validated equivalents of:

```text
CompletedRunSummary
AI Coach request
AI Coach response
coaching category enums
representative telemetry/coaching event structures
```

Use the exact naming and fields established by the approved feature spec/plan unless a small repository-specific correction is necessary.

---

# Phase B — Current Run Telemetry

Create a passive telemetry object for the current run.

A run starts when a fresh playable run begins.

It continues across ordinary life-loss resets.

It ends only when:

```text
Level Complete
```

or:

```text
Game Over
```

A manual Reset Level during an active run must follow the behavior defined in the feature spec.

Expected Core behavior:

```text
manual reset
→ discard current run telemetry
→ do not archive it
→ begin fresh current run telemetry
```

Do not count a single life loss as a completed run.

---

# Phase C — Track Only Useful Gameplay Facts

Implement the minimum telemetry required by `001-ai-coach`.

Do not record every frame.

Do not store unbounded mouse history.

Do not serialize the entire game state.

The telemetry must support the five defined coaching areas.

---

# 1. Green Threat Prioritization

At shot time, when a green threat is active, record enough deterministic facts to later know:

- a threat was active;
- the player fired;
- whether the shot was approximately directed toward the threat;
- whether it was approximately directed toward the current target;
- whether the shot destroyed the threat;
- whether the player continued offensive attempts while the threat remained active;
- whether the threat eventually hit the player.

Use the angular/directional heuristic defined in the feature plan.

Do not ask the fake provider or future LLM to infer these facts from raw coordinates.

If the plan defines threshold constants, put them in the appropriate configuration/constants location rather than scattering magic numbers.

---

# 2. Blocked Direct Attempts

At shot time, record whether:

```text
direct line from player to current target is blocked by solid level geometry
```

and whether the fired direction was approximately a direct shot toward the target.

Reuse existing collision/geometry helpers where possible.

Do not implement a general ricochet/path solver.

The signal should support:

```text
blockedDirectAttempt
```

or the equivalent contract defined in the feature plan.

Do not claim that a bounce is mathematically guaranteed unless the game has explicit reliable information for that claim.

---

# 3. Rushed Bounce Aiming

Implement the compact heuristic defined in the feature plan.

The implementation should avoid storing high-frequency mouse telemetry.

Preferred shape:

- maintain only a small rolling/local aim state;
- derive a metric such as aim-settle duration or angular instability near fire time;
- classify the attempt deterministically when the relevant conditions are met;
- store only the derived result and any small supporting numeric value required by the run summary.

Treat this as a heuristic.

Do not encode psychological judgments such as panic, impatience, or carelessness.

---

# 4. Same-Position Repeated Failures

Track enough information to identify repeated unsuccessful attempts:

- against the same target;
- from approximately the same player position;
- with movement below the configured threshold between attempts.

Use distance/zone tolerance from the plan.

Do not use exact coordinate equality.

Create a bounded derived signal such as:

```text
repeatedSamePositionFailure
```

or the plan's equivalent.

---

# 5. Range Exhaustion

Record relevant facts when a projectile fails because its travel-distance budget reaches zero.

Use authoritative projectile state.

Track enough to distinguish:

- target distance at fire time;
- available initial range;
- bounce count;
- effective granted travel budget where available;
- projectile expiration due to range;
- target capture success/failure.

Do not classify every target farther than initial range as impossible because bounce bonuses may extend range.

---

# Phase D — Run Summary

When a run ends at Level Complete or Game Over:

1. stop mutating that run's telemetry;
2. convert/finalize it into the validated completed-run summary contract;
3. archive it into local completed-run history;
4. keep only the most recent three completed runs;
5. initialize a new current run only when gameplay actually starts/restarts according to current game flow.

Use a bounded summary.

Likely data includes, subject to the approved spec:

```text
outcome
duration
lives lost
shots fired
failed shots
captures
green threats created
shots while threat active
defensive attempts
successful defensive attempts
offensive shots while threat active
blocked direct attempts
bounce attempts
successful bounce captures
rushed bounce attempts
same-position repeated failures
range-expired shots
per-target aggregates
small bounded representative event list
```

Do not add data that does not help coaching or required validation.

---

# Phase E — Completed Run History

Maintain up to three completed runs.

Expected behavior:

```text
after Run A:
[A]

after Run B:
[A, B]

after Run C:
[A, B, C]

after Run D:
[B, C, D]
```

The current active run is separate and never inserted until it reaches a terminal result.

Use the persistence policy defined in the feature plan.

If the approved Core plan says session-only/in-memory, do not add `localStorage` or backend persistence.

---

# Phase F — AI Coach UI

Add an AI Coach control to the existing game UI.

Do not create a main menu.

Use the location identified in the feature plan.

Likely:

```text
[Reset Level] [AI Coach]
```

or equivalent within the existing HUD/control layout.

Required UX states:

## Zero completed runs

Do not call the backend/provider.

Use the behavior defined in the feature spec, such as:

```text
Complete at least one run before requesting coaching.
```

or a disabled button with explanatory text.

There must be a testable path proving zero provider calls.

## One to three completed runs

Allow request.

Send only completed history.

## Active current run

Exclude it completely.

The player may request coaching during gameplay, but the analysis is based only on already completed runs.

## Loading

Prevent duplicate requests.

Disable/restrict repeated Coach clicks while a request is active.

Do not place the request in the game loop.

Do not freeze or break game state unnecessarily.

## Success

Display the validated structured advice.

Use a small panel, card, overlay, or existing UI pattern.

Keep the UI concise.

## Failure

Show the safe error behavior defined by the feature spec.

Gameplay/reset controls must remain usable.

---

# Phase G — Backend Endpoint

Implement the backend endpoint defined in the approved plan.

Expected concept:

```text
POST /api/ai/coach
```

but use the actual route naming convention from the repository/plan.

The route must:

1. parse request;
2. runtime-validate request;
3. reject invalid input before provider call;
4. call the AI Coach provider abstraction;
5. runtime-validate provider output;
6. map success to the stable frontend response;
7. map failures to a safe user-facing error contract.

Do not expose:

- stack traces;
- internal provider errors;
- environment data;
- secret configuration;
- raw internal payload dumps.

---

# Phase H — Fake Provider

Implement a deterministic fake/mock AI Coach provider.

The provider should implement the same interface that the future Gemini provider will implement.

Example conceptual interface:

```ts
interface AiCoachProvider {
  getAdvice(request: AiCoachRequest): Promise<AiCoachAdvice>;
}
```

Use the naming/abstraction defined in the plan.

Keep it minimal.

Do not build a generic agent framework.

The fake provider should return valid structured advice based on predictable request properties.

It does not need to be "intelligent".

Its job is to prove:

- endpoint wiring;
- frontend/backend contract;
- runtime validation;
- UI rendering;
- provider abstraction;
- tests.

Prefer deterministic output so tests remain stable.

For example, fake behavior may select the largest known mistake count and map it to a fixed piece of coaching text.

That is acceptable for the fake provider.

---

# Phase I — Fake Failure Modes

Provide a test-friendly way to simulate at least:

```text
valid provider response
provider failure
provider timeout-like behavior if the current architecture can simulate it cleanly
malformed provider output
```

Do not expose developer test controls to normal production UI unless the repository already has a development-only mechanism.

Prefer provider injection/test doubles over query-string hacks or UI debug switches.

---

# Runtime Validation

Runtime validation is mandatory at both trust boundaries.

## Backend request

Reject:

- zero runs if the endpoint contract requires at least one;
- more than three runs;
- unsupported enums;
- missing required values;
- non-finite numbers;
- invalid nested event structures;
- unbounded representative event arrays;
- malformed data.

Provider must not be called.

## Provider output

Reject:

- missing required fields;
- unsupported category;
- wrong types;
- empty/invalid structures where contract forbids them;
- malformed JSON/object shape.

A malformed provider output is not a successful Coach response.

---

# Required Tests

Use the repository's actual test framework and conventions.

Add focused tests for the implementation.

At minimum cover:

## Run lifecycle

### T1 — Life loss is same run

```text
start run
→ lose one life
→ level state resets
→ telemetry continues
→ no completed history entry
```

### T2 — Game Over archives

```text
remaining lives reaches 0
→ outcome = game_over
→ summary archived
```

### T3 — Level Complete archives

```text
finish required sequence + exit
→ outcome = level_complete
→ summary archived
```

### T4 — Manual reset

```text
active run
→ manual Reset Level
→ current telemetry discarded
→ not archived
→ new current run starts
```

### T5 — History cap

```text
complete 4 runs
→ only newest 3 retained
```

### T6 — Current run excluded

```text
3 completed + 1 active
→ Coach request contains exactly 3 completed
→ active telemetry absent
```

---

# Telemetry Heuristic Tests

At minimum test the selected deterministic rules for:

### T7 — Shot during green threat aimed at threat

classified correctly.

### T8 — Shot during green threat aimed offensively at target

classified correctly.

### T9 — Blocked direct attempt

direct path blocked + direct aim classified correctly.

### T10 — Same-position retries

repeated failures below movement threshold classified correctly.

### T11 — Reposition breaks same-position streak

movement above threshold prevents incorrect classification.

### T12 — Range exhaustion

authoritative projectile expiration updates the correct metric.

### T13 — Bounce-range nuance

do not incorrectly classify a bounce-extended attempt using only initial straight-line range.

### T14 — Rushed-aim heuristic

test below/above threshold behavior according to the approved plan.

---

# Backend / Fake Provider Tests

### T15 — Valid 1-run request

```text
request valid
→ fake provider called once
→ valid structured response
```

### T16 — Valid 3-run request

```text
3 validated runs
→ fake provider called once
→ response displayed/returned
```

### T17 — Invalid local/backend input

```text
invalid request
→ rejected
→ providerCallCount === 0
```

This test is mandatory.

### T18 — More than 3 runs

```text
request rejected
→ providerCallCount === 0
```

### T19 — Fake provider failure

```text
provider throws/fails
→ safe backend error
→ safe frontend state
```

### T20 — Malformed fake provider output

```text
provider returns invalid contract
→ runtime validation rejects output
→ not shown as successful advice
```

### T21 — Duplicate Coach click

```text
request already pending
→ no accidental duplicate request
```

where feasible at the UI/service level.

### T22 — Zero completed history

```text
Coach unavailable/local message
→ backend/provider not called
```

---

# UI Validation

Where current automated UI tooling exists, add relevant checks.

At minimum verify manually if automation is not present:

- Coach button is visible in intended location;
- zero-history state is understandable;
- request loading state appears;
- success response is readable;
- failure response is safe;
- Reset Level remains usable;
- gameplay still works;
- active run continues to be playable while Coach analysis UI exists, unless the approved design intentionally pauses it.

Report manual vs automated validation honestly.

---

# Development / Provider Configuration

The application should default to the fake provider for this phase.

Use the repository's existing configuration approach.

Do not introduce a real API key.

Do not require `GEMINI_API_KEY`.

If provider selection needs configuration now, keep it simple and explicit, for example conceptually:

```text
AI_COACH_PROVIDER=fake
```

Only add such configuration if it improves the current architecture and is consistent with the plan.

Do not over-engineer a provider registry for one fake and one future real adapter.

---

# Error Handling

Implement stable error behavior for this fake vertical slice.

Distinguish internally between:

- invalid request;
- provider failure;
- invalid provider output;
- unexpected server failure.

Frontend only needs safe messages.

Do not expose internal stack traces.

The exact envelope must match the feature plan/current API conventions.

---

# Logging

Do not build full AI usage logging yet unless the plan places a minimal provider-call record in this phase.

For the fake provider, avoid pretending token usage exists.

If minimal structured logging exists, it may record:

```text
operation
provider = fake
success/failure
latency
attempt count if meaningful
```

Do not log full gameplay payloads unnecessarily.

Do not log secrets.

---

# No Live Retry Logic Yet

Do not implement Gemini-specific retry/backoff in this task.

A generic provider-call boundary may be shaped so retry can be added later, but actual reliable Gemini timeout/retry policy belongs to the next phase.

Fake failure tests should prove the app handles provider failure safely.

---

# Documentation

Update only the docs required by the implementation.

If the active Spec Kit task list supports marking completed tasks, update it accurately.

Do not mark Gemini/live-provider tasks complete.

If relevant, update:

- README development instructions;
- architecture/instruction files only if the actual shipped architecture changed;
- feature task status;
- fake provider configuration notes.

Do not produce final W04 evidence yet unless a small intermediate note is part of the repository workflow.

---

# Implementation Strategy

Use a conservative sequence.

## Step 1 — Inspect

Read the required context and exact current feature plan/tasks.

Inspect the code paths for:

- shot creation;
- projectile termination;
- bounce handling;
- green threat state;
- target capture;
- life loss/reset;
- Game Over;
- Level Complete;
- manual reset;
- HUD/buttons;
- frontend API client;
- backend routing;
- runtime validation;
- current tests.

## Step 2 — Contracts first

Implement validated telemetry/request/response contracts.

Run focused tests.

## Step 3 — Run lifecycle

Implement current-run lifecycle and completed history before adding provider/UI behavior.

Run lifecycle tests.

## Step 4 — Passive telemetry

Add the five coaching signal families.

Run deterministic unit tests.

## Step 5 — Fake backend flow

Add provider abstraction, fake provider, endpoint, validation, failure mapping.

Run backend tests.

## Step 6 — UI

Add Coach trigger and result state.

Ensure no-history path avoids the backend.

## Step 7 — Integration

Connect frontend request to fake endpoint.

Verify 1–3 runs and active-run exclusion.

## Step 8 — Regression

Run existing game tests/build/typecheck and manually verify core gameplay as appropriate.

## Step 9 — Review diff

Confirm there is:

- no Gemini;
- no API key;
- no gameplay redesign;
- no unbounded telemetry;
- no accidental current-run inclusion;
- no database;
- no unrelated refactor.

---

# Acceptance Criteria

This task is complete only when all applicable items pass.

## Telemetry

- [ ] A current run has a bounded telemetry model.
- [ ] Ordinary life loss does not finalize the run.
- [ ] Level Complete finalizes a run.
- [ ] Game Over finalizes a run.
- [ ] Manual active reset follows the approved discard behavior.
- [ ] Green-threat prioritization facts are tracked deterministically.
- [ ] Blocked direct attempts are tracked deterministically.
- [ ] Rushed-bounce heuristic is bounded and deterministic.
- [ ] Same-position retry heuristic is bounded and deterministic.
- [ ] Range exhaustion uses authoritative projectile facts.
- [ ] No unbounded frame/mouse log exists.

## History

- [ ] Only terminal runs are archived.
- [ ] Active run is excluded.
- [ ] History supports 1–3 runs.
- [ ] Fourth completed run removes the oldest.
- [ ] Persistence matches the approved feature plan.

## Frontend

- [ ] AI Coach control exists.
- [ ] No main menu was added.
- [ ] Zero-history state makes zero backend/provider calls.
- [ ] Loading state prevents accidental duplicates.
- [ ] Valid fake advice is displayed.
- [ ] Safe failure is displayed.
- [ ] Gameplay/reset remain usable.

## Backend

- [ ] Coach endpoint exists.
- [ ] Request is runtime-validated.
- [ ] Invalid input cannot reach the provider.
- [ ] Fake provider implements a small provider abstraction.
- [ ] Provider output is runtime-validated.
- [ ] Malformed fake output is rejected.
- [ ] Safe error mapping exists.
- [ ] No Gemini/live provider exists.

## Tests

- [ ] Lifecycle tests pass.
- [ ] Telemetry heuristic tests pass.
- [ ] Valid 1-run request test passes.
- [ ] Valid 3-run request test passes.
- [ ] Invalid input test proves `providerCallCount === 0`.
- [ ] Provider failure test passes.
- [ ] Malformed provider output test passes.
- [ ] History-cap test passes.
- [ ] Active-run exclusion test passes.
- [ ] Existing relevant tests still pass.
- [ ] Relevant build/typecheck checks pass.

## Security / Scope

- [ ] No provider secret exists.
- [ ] No direct frontend → AI provider call exists.
- [ ] No database added.
- [ ] No live network AI call added.
- [ ] No unrelated gameplay change added.

---

# Required Final Report

After implementation, provide a concise but concrete report.

## 1. What Was Implemented

Summarize:

- telemetry;
- run lifecycle;
- history;
- UI;
- endpoint;
- fake provider.

## 2. Files Changed

List important created/modified files.

## 3. Run Lifecycle

Explain exact behavior for:

- run start;
- life loss;
- manual reset;
- Level Complete;
- Game Over;
- fourth completed run.

## 4. Telemetry Signals

For each of the five coaching areas, state the exact deterministic heuristic implemented.

Include threshold/config values and where they live.

## 5. Contracts

Show concise request/response shapes or point to their exact source files.

## 6. Fake Provider Behavior

Explain how deterministic fake advice is chosen and how failure/malformed output is simulated in tests.

## 7. Backend Flow

Document method/path and validation sequence.

## 8. Validation Performed

List exact commands actually run and their results.

Separate:

- unit/integration tests;
- build/typecheck;
- manual browser checks.

Do not claim checks not performed.

## 9. Existing Gameplay Regression Assessment

State whether gameplay code was instrumented and why behavior remains unchanged.

Call out any unavoidable behavior-affecting change explicitly.

## 10. Remaining Work

State clearly that the next phase is:

```text
Gemini provider integration
+ production provider prompt
+ timeout
+ bounded retry
+ provider failure policy
+ usage logging
+ limited live validation
```

Do not implement those items now.

---

# Final Constraint

At the end of this task, a reviewer should be able to run SELFBOUND, complete one or more games, click **AI Coach**, and see a deterministic fake coaching result produced through the real frontend → backend → provider abstraction path.

The only missing piece should be replacing the fake provider with the reliable Gemini integration in the next phase.
