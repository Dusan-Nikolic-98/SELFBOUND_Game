# Codex Task — Create Spec Kit Feature `001-ai-coach`

## Objective

Create the complete **Spec Kit feature definition** for a new SELFBOUND Week 4 feature:

```text
001-ai-coach
```

This task is **specification and planning only**.

Do **not** implement the feature yet.
Do **not** install or call Gemini yet.
Do **not** modify gameplay code yet.
Do **not** add telemetry code yet.

The purpose of this task is to produce an implementation-ready feature specification, technical plan, and ordered task list that a later Codex implementation prompt can execute safely.

---

# Required Context to Read First

Before writing the feature files:

1. Read `.github/copilot-instructions.md`.
2. Read `.github/00-index.instructions.md`.
3. Follow the routing rules in the index and read the relevant modules, especially:
   - architecture;
   - conventions;
   - testing;
   - workflow;
   - security;
   - code review;
   - external services.
4. Read `.specify/memory/constitution.md`.
5. Read `GAME_SPEC.md`.
6. Read `CONTEXT_MANIFEST.md`.
7. Inspect the current repository structure.
8. Inspect the current frontend/backend boundary.
9. Inspect current game state, reset, win, Game Over, projectile, enemy, and level code sufficiently to ensure the spec matches the shipped game.
10. Inspect actual test/build tooling and runtime-validation approach.

The generated feature files must describe the **actual current SELFBOUND repository**.

Do not invent paths, frameworks, validators, test runners, scripts, or architecture that do not exist.

---

# Output Location

Create:

```text
specs/
└── 001-ai-coach/
    ├── spec.md
    ├── plan.md
    └── tasks.md
```

If the repository's established Spec Kit convention uses additional required files or slightly different names, preserve that convention, but `spec.md`, `plan.md`, and `tasks.md` must exist.

Do not implement the tasks during this request.

---

# Feature Summary

SELFBOUND should gain a user-visible **AI Coach**.

The Coach analyzes up to the **three most recently completed game runs**, excluding the run that is currently in progress.

The player explicitly requests analysis by clicking an **AI Coach** button.

Because SELFBOUND currently has no main menu, the likely UI location is near the existing **Reset Level** control in the game HUD/control area.

The exact visual placement should be confirmed against the current UI, but the feature should not require creating a new main menu.

The Coach should provide concise, actionable advice about recurring mistakes and how the player can improve.

This is a **read-only coaching feature**.

The AI must not control the player, change game state, create enemies, alter physics, modify level geometry, change difficulty, or select actions on behalf of the player.

---

# Core Run-History Model

The feature should distinguish between:

```text
current run
```

and:

```text
completed run history
```

## Current run

The game tracks telemetry for the run currently being played.

The current run must **not** be included in AI Coach analysis while it is still active.

## Completed run

A run becomes eligible for Coach history only when it reaches a genuine terminal outcome:

```text
level_complete
```

or:

```text
game_over
```

When a run reaches one of those terminal states:

1. finalize its telemetry summary;
2. add it to completed-run history;
3. retain only the most recent three completed runs;
4. discard older completed runs beyond that limit.

The history therefore behaves approximately like:

```text
completedRuns = last 3 terminal runs
```

Example:

```text
Run A complete
history = [A]

Run B game over
history = [A, B]

Run C complete
history = [A, B, C]

Run D complete
history = [B, C, D]
```

The current in-progress run is never part of that array.

---

# Important Run-Lifecycle Questions the Spec Must Resolve

The specification must explicitly inspect current SELFBOUND behavior and define these cases.

## Losing one life

The existing game can reset level state after a failure while preserving remaining lives.

That is **not automatically a completed run**.

Unless the shipped game semantics clearly indicate otherwise, treat all life losses before Game Over as events within the same run.

Example:

```text
run starts with 3 lives
→ green threat hits player
→ lives = 2
→ level state resets
→ same run continues
```

Telemetry for that run should continue.

## Game Over

When remaining lives reach zero:

```text
terminal outcome = game_over
```

Finalize the run and add it to completed-run history.

## Level Complete

When the required sequence is complete and the player reaches the exit:

```text
terminal outcome = level_complete
```

Finalize the run and add it to completed-run history.

## Manual Reset Level

The existing Reset Level control performs a full manual level reset.

A manual reset of an active run should **not silently count as a completed run** for coaching unless there is a strong existing product reason to do so.

Preferred Core behavior:

```text
manual reset during active run
→ discard current telemetry
→ begin a fresh current run
→ do not add abandoned run to completed history
```

Document this explicitly.

If repository behavior makes another interpretation more appropriate, explain it in the plan.

## Starting another run from a terminal screen

Inspect how the current game restarts after Level Complete or Game Over.

Ensure the plan defines exactly when a new current-run telemetry object begins.

---

# History Persistence Boundary

The Core feature needs only the **last three completed runs**.

Do not add a database.

The plan must explicitly decide whether completed-run history is:

```text
session-only / in-memory
```

or stored in an existing lightweight browser persistence mechanism if one already exists and is clearly appropriate.

Default preference for Week 4 Core:

```text
session-only, in-memory
```

unless preserving data across browser reloads provides clear value without expanding scope.

Reasons:

- no account system exists;
- no database is required;
- no save-game system should be introduced;
- the assignment asks for one small AI flow;
- three local completed runs are enough to demonstrate the feature.

If localStorage is proposed, the plan must justify why it is worth the additional behavior and define validation/versioning of stored data.

Do not add backend persistence just for run history.

---

# User Interaction

The AI Coach should be user-triggered.

Likely interaction:

```text
[Reset Level] [AI Coach]
```

or an equivalent placement appropriate to the current HUD.

The Coach button should analyze completed run history only.

## When zero completed runs exist

The UI must not send a provider request.

Choose and specify one clear behavior, preferably:

- button disabled with short explanatory text; or
- click produces a local message such as:
  `Complete at least one run before requesting coaching.`

No provider call should occur.

## When one or two completed runs exist

The Coach analyzes the available runs.

It must not require exactly three runs.

## When three completed runs exist

Analyze all three.

## While a current run is active

The current run remains excluded.

This should be true even if the user clicks AI Coach in the middle of gameplay.

## During loading

Define a small loading state.

The game itself should not need to freeze while the request is pending unless the current UI architecture makes a modal pause intentionally preferable.

Avoid making an AI response part of the frame-by-frame game loop.

## On provider/error failure

Show a safe user-facing message.

Do not expose raw provider errors, stack traces, prompt contents, secrets, or internal payloads.

---

# What the Game Should Track

The goal is not to send a huge raw application state.

Track the **smallest useful deterministic telemetry** that lets the Coach reason about player mistakes.

The feature should support coaching around the following five areas.

---

# Coaching Area 1 — Green Threat Prioritization

The Coach should be able to determine whether the player responds correctly while the hostile green projectile is active.

Track enough facts to answer:

- Was a green threat active when the player fired?
- If yes, was the shot approximately directed toward the green threat?
- Or was it approximately directed toward the current red target instead?
- Did the shot destroy the green threat?
- Did the player continue making offensive attempts while the threat remained active?
- Was the player eventually hit by the threat?
- How many defensive shots were required?

Do not require perfect semantic intention detection.

Use deterministic geometry to classify shot direction approximately where practical.

For example, a shot can be classified by comparing the fired direction against:

- vector from player to green threat;
- vector from player to current target.

The exact angular tolerance should be defined in the technical plan and implemented later as a deterministic constant/config value.

The telemetry should distinguish facts such as:

```text
shotWhileThreatActive
aimedApproximatelyAtThreat
aimedApproximatelyAtTarget
threatDestroyed
threatHitPlayer
```

Do not let the LLM infer these purely from prose or screenshots.

---

# Coaching Area 2 — Direct Shot vs Required/Useful Bounce

The Coach should be able to identify repeated attempts to shoot directly at a target when level geometry blocks a direct route.

Track enough data at shot time to indicate:

- current target;
- player position;
- target position;
- whether direct line-of-sight to the target is obstructed by solid geometry;
- whether the shot initially points approximately directly at the target;
- bounce count achieved by the shot;
- whether the shot ultimately captured the target;
- relevant failure reason.

Important:

Do not require an advanced pathfinding or arbitrary ricochet solver merely to classify a mistake.

A useful Core signal can be:

```text
directLineBlocked = true
```

combined with:

```text
shotAimedApproximatelyDirectlyAtTarget = true
```

and repeated failure.

This is enough for coaching such as:

> Direct attempts are blocked here; look for a bounce route.

Do not falsely label every blocked direct line as mathematically proving that a particular bounce path is possible unless the game already has deterministic knowledge of that route.

If some targets in the hand-authored level are intentionally designed as bounce-learning targets, the plan may use explicit level metadata if that is cleaner and more reliable than geometric inference.

Any new metadata must remain minimal and validated.

---

# Coaching Area 3 — Rushed Bounce Aiming

The Coach should have a signal for the player firing too quickly when a precise bounce is needed.

This must be specified as a deterministic telemetry heuristic rather than vague AI mind-reading.

Potential facts to track:

- timestamp when a prior shot ended;
- timestamp when the next shot fired;
- recent mouse/aim direction samples or a compact aim-stability metric;
- amount of angular change shortly before firing;
- whether the shot involved or attempted a bounce;
- whether repeated rushed attempts missed.

Prefer a compact derived metric rather than storing high-frequency mouse movement history.

For example, the implementation plan may define:

```text
aimSettleMs
```

or:

```text
aimAngularChangeBeforeShot
```

computed locally from a small rolling window.

The specification must avoid frame-by-frame telemetry uploads.

The AI should receive a summary such as:

```text
bounceAttempts: 5
rushedBounceAttempts: 4
successfulBounceAttempts: 1
```

possibly with a few representative event examples.

The plan must clearly acknowledge that "rushed aiming" is a heuristic, not a certainty.

---

# Coaching Area 4 — Repeated Attempts From a Bad Position

The Coach should detect patterns where the player repeatedly fires from nearly the same ineffective position without repositioning.

Track facts such as:

- player position when each shot starts;
- distance moved since previous failed attempt at the same target;
- consecutive failed attempts against the same target;
- whether those attempts originated from approximately the same position/zone;
- direct-line obstruction at those positions;
- success/failure.

Prefer coarse, robust classification such as:

```text
samePositionRetry = distanceMovedSincePreviousAttempt < threshold
```

rather than exact-coordinate equality.

The plan must define the threshold deterministically.

A useful derived pattern might be:

```text
repeatedStationaryFailuresOnTarget
```

This lets the Coach say:

> You repeated the same angle from nearly the same position several times; reposition before trying again.

Do not require the AI to reconstruct full movement trajectories.

---

# Coaching Area 5 — Target Out of Useful Range

The Coach should identify shots where the target was too far for the attempted shot geometry.

Track useful facts such as:

- player-to-target direct distance at fire time;
- projectile starting range;
- remaining/extended range actually available;
- number of bounces;
- travel distance used before failure;
- whether the projectile expired because its travel budget reached zero;
- whether the target remained uncaptured.

Be careful with semantics:

A target being farther than the initial direct range does **not necessarily mean impossible**, because wall bounces add travel range.

Therefore the feature should avoid simplistic logic like:

```text
distance > 450 => impossible
```

unless the attempted shot was direct and no bounce occurred.

Prefer factual telemetry such as:

```text
targetDistanceAtFire
initialRange
bounceCount
totalTravelBudgetGranted
projectileExpiredByRange
```

and let coaching use those facts conservatively.

If the game can deterministically classify an attempted shot as out-of-range, specify the exact rule.

---

# Other Useful Core Telemetry

Inspect the current game and determine the smallest additional run metrics that improve coaching.

Likely useful metrics include:

```text
outcome
durationMs
livesLost
shotsFired
successfulCaptures
failedShots
accuracy
greenThreatsCreated
greenThreatHitsOnPlayer
defensiveShots
successfulDefensiveShots
bounceAttempts
successfulBounceCaptures
manualReset?  // probably excluded run instead
perTarget attempts
```

Do not track data merely because it is available.

Do not send full game state when a small summary is sufficient.

Do not log secrets or unrelated browser/user data.

---

# Telemetry Design Principle

Separate:

```text
raw local gameplay facts
```

from:

```text
derived deterministic coaching signals
```

from:

```text
LLM coaching interpretation
```

Example:

```text
RAW FACTS
player position
target position
shot direction
threat position
bounce count
range exhaustion
timestamps

        ↓ deterministic local analysis

DERIVED SIGNALS
shotWhileThreatActive
aimedAtThreat
directLineBlocked
samePositionRetry
rushedBounceAttempt
projectileExpiredByRange

        ↓ summarized request

AI COACH
"Your biggest issue is threat prioritization..."
```

The LLM must not be responsible for determining collision truth, target identity, whether a threat existed, or whether the projectile actually hit something.

Those are authoritative game facts.

---

# Telemetry Volume

Do not send every frame or an unbounded event log to the backend/provider.

The plan must define bounded telemetry.

Preferred shape:

```text
up to 3 completed RunSummary objects
```

Each run may contain:

- aggregate metrics;
- per-target aggregates;
- a small bounded collection of representative mistake events.

For example:

```text
maxRepresentativeEventsPerRun = small fixed number
```

The exact value should be chosen during planning.

Old/noisy duplicate events should be summarized locally.

The request payload must have a clear maximum size or event-count bound.

---

# Suggested Conceptual Data Model

The exact types must be adapted to the real codebase and validation library.

The following is conceptual, not mandatory syntax.

```ts
type CompletedRunOutcome =
  | "level_complete"
  | "game_over";

type CoachingCategory =
  | "threat_management"
  | "bounce_strategy"
  | "aim_timing"
  | "positioning"
  | "range_management"
  | "general";

type RunSummary = {
  runId: string;
  outcome: CompletedRunOutcome;
  durationMs: number;
  livesLost: number;

  shotsFired: number;
  failedShots: number;
  captures: number;

  greenThreatsCreated: number;
  shotsWhileThreatActive: number;
  defensiveShots: number;
  successfulDefensiveShots: number;
  offensiveShotsWhileThreatActive: number;

  blockedDirectAttempts: number;
  bounceAttempts: number;
  successfulBounceCaptures: number;
  rushedBounceAttempts: number;

  repeatedSamePositionFailures: number;
  rangeExpiredShots: number;

  targetStats: TargetRunSummary[];
  representativeEvents: CoachingEvent[];
};
```

Do not blindly copy this type.

Inspect actual game concepts and create the smallest coherent contract.

---

# Representative Events

A small representative-event list can help the Coach give specific advice.

Conceptual examples:

```ts
type CoachingEvent =
  | {
      type: "ignored_green_threat";
      targetId: string;
      threatDistance: number;
    }
  | {
      type: "blocked_direct_attempt";
      targetId: string;
      repeatedCount: number;
    }
  | {
      type: "rushed_bounce_attempt";
      targetId: string;
      aimSettleMs: number;
    }
  | {
      type: "same_position_retry";
      targetId: string;
      attempts: number;
      movementDistance: number;
    }
  | {
      type: "range_expired";
      targetId: string;
      targetDistanceAtFire: number;
      travelBudget: number;
    };
```

Again, this is conceptual.

The final plan should use the repository's validation and naming conventions.

Events should contain gameplay data only.

No free-form user input is needed for this feature.

---

# AI Coach Request Contract

The backend endpoint should eventually receive a validated request containing only completed-run summaries.

The plan must define the endpoint and request schema.

A likely endpoint is:

```text
POST /api/ai/coach
```

but inspect existing API conventions before finalizing the path.

Conceptually:

```ts
type AiCoachRequest = {
  runs: RunSummary[]; // min 1, max 3
};
```

Requirements:

- minimum 1 completed run;
- maximum 3;
- current active run excluded;
- bounded event list;
- finite numeric values;
- supported enums only;
- no missing required properties;
- reject malformed data before provider invocation.

The provider must not be called for invalid local/backend input.

A future test must prove:

```text
providerCallCount === 0
```

for invalid input.

---

# AI Coach Response Contract

Do not use unrestricted free-form text as the only response.

Define a small structured response.

Preferred conceptual shape:

```ts
type AiCoachAdvice = {
  summary: string;
  primaryCategory: CoachingCategory;
  primaryAdvice: string;
  secondaryAdvice?: string;
  practiceGoal: string;
};
```

Potential alternative:

```ts
type AiCoachAdvice = {
  headline: string;
  observations: [
    {
      category: CoachingCategory;
      message: string;
    }
  ];
  nextRunGoal: string;
};
```

Choose one small contract.

Keep output concise enough for the game's UI.

The response should:

- identify the most important recurring issue;
- explain it in plain language;
- give one concrete improvement;
- optionally mention one secondary pattern;
- give a simple practice focus for the next run.

Avoid:

- long essays;
- fabricated statistics;
- claims unsupported by telemetry;
- telling the player an exact shot angle unless reliable geometry is provided;
- pretending heuristics are certainties.

---

# Grounding Requirement

The AI prompt/provider contract must instruct the model to base advice **only on supplied telemetry**.

If evidence is insufficient, the model should say so concisely rather than invent a diagnosis.

Examples:

Good:

> You fired at the current target three times while a green threat was active. Prioritize destroying the threat first.

Bad:

> Your reaction time is poor.

unless telemetry actually supports a carefully defined reaction-time claim.

Good:

> Several failed shots came from nearly the same position.

Bad:

> You panic under pressure.

Do not make psychological or personality judgments.

---

# AI Provider Boundary

Week 4 intends to use Gemini.

The feature design must assume:

```text
Frontend
   ↓
SELFBOUND backend
   ↓
Gemini
```

Provider API key:

- backend only;
- environment configuration only;
- never frontend;
- never committed;
- never logged;
- never placed in prompt files/evidence/screenshots.

The spec must not require a particular Gemini model unless a model has already been selected elsewhere in the repository.

The plan should define a selection principle:

> use the smallest/cheapest model that reliably satisfies the structured coaching contract.

Actual model selection may be finalized during provider implementation.

---

# Fake Provider First

The plan must follow:

```text
request contract
→ runtime validation
→ fake provider
→ frontend/backend success flow
→ invalid-input test
→ malformed-output test
→ timeout/failure test
→ bounded retry test if applicable
→ limited live Gemini validation
```

Most automated tests must not require live Gemini calls.

---

# Timeout / Retry / Safe Failure

The plan must define explicit future behavior.

## Timeout

Choose a documented timeout appropriate for a user-triggered coaching request.

The assignment suggests an explicit value such as around 15 seconds, but inspect project conventions and choose deliberately.

## Retry

Use bounded retry only for transient failures where retry makes sense.

Do not retry:

- invalid local input;
- invalid schema;
- deterministic malformed provider output unless there is a documented reason;
- programming errors.

## Safe failure

Frontend should receive a stable response or error envelope and show a short safe message such as:

```text
AI Coach is currently unavailable. Try again later.
```

Do not expose provider internals.

---

# AI Button State / UX

The spec must define button behavior for:

## 0 completed runs

No provider call.

## 1–3 completed runs

Request analysis of the available history.

## Request already in progress

Prevent accidental duplicate requests.

Possible Core behavior:

- disable button while loading.

## Success

Display Coach advice in a small panel/modal/overlay consistent with the current game UI.

Do not create a full new menu system.

## Failure

Display safe error and leave gameplay/restart controls usable.

## New completed run

History updates immediately.

The next Coach request should use the newest last-three set.

---

# Current Run Exclusion Example

The specification should include examples such as:

```text
Completed history:
Run 7
Run 8
Run 9

Current active run:
Run 10

AI Coach request:
Run 7 + Run 8 + Run 9
```

After Run 10 finishes:

```text
Completed history:
Run 8
Run 9
Run 10

New current run:
Run 11

AI Coach request:
Run 8 + Run 9 + Run 10
```

---

# No Main Menu Requirement

Do not introduce a main menu solely for this feature.

The project currently does not need one.

The Coach should fit into the existing game screen.

Likely:

```text
HUD / controls
Lives | Capture Progress | Reset Level | AI Coach
```

or a nearby equivalent that matches existing layout.

The plan should identify the actual component/DOM location after repository inspection.

---

# Non-Goals / Out of Scope

The feature specification must explicitly exclude:

- frame-by-frame LLM calls;
- AI-controlled enemies;
- boss AI;
- procedural level generation;
- dynamic difficulty controlled by the model;
- AI modifying player/game state;
- AI choosing shots for the player;
- autonomous agent loops;
- tool execution by the model;
- RAG;
- vector database;
- accounts/login;
- server-side run database;
- leaderboard;
- multiplayer;
- long-term player profiles;
- unlimited run history;
- analysis of current unfinished run in Core;
- screenshots/video as model input;
- voice coaching;
- arbitrary chat interface;
- user-entered prompt box;
- new main menu;
- exact psychological/player-skill profiling.

Keep Week 4 scope intentionally small.

---

# Important Heuristic Boundaries

The spec and plan must clearly label heuristic concepts.

These include:

```text
aimed approximately at threat
aimed approximately at target
rushed bounce attempt
same-position retry
bad position
```

Define each in deterministic, testable terms.

Do not write requirements like:

> detect when the player is careless

or:

> understand when the player aimed badly

without measurable rules.

If a concept cannot be made reliable enough with small telemetry, simplify it.

---

# Suggested Deterministic Heuristics to Evaluate

The plan should evaluate, not blindly adopt, rules such as:

## Approximate aim target

Angular difference between shot direction and direction to entity at shot time:

```text
angleDiff <= configured threshold
```

## Same-position retry

Distance between consecutive shot origins against the same target:

```text
movementDistance <= configured threshold
```

for consecutive failed attempts.

## Rushed shot

A small rolling aim window immediately before fire:

```text
aim settle duration below threshold
```

or angular instability above threshold.

Do not store every mouse event indefinitely.

## Direct line blocked

Segment from player center to current target intersects solid platform geometry.

Reuse existing collision/geometry primitives if possible.

## Range exhaustion

Projectile ended because remaining travel budget reached zero without capture.

Do not call a target impossible solely because straight-line distance exceeds starting range when bounce bonuses can increase travel budget.

All chosen thresholds should live in explicit config/constants and be testable.

---

# Feature Spec: `spec.md`

Write `spec.md` from the user's/product perspective.

It must include at minimum:

## Overview / Problem

Why the Coach exists.

## User Value

How it helps a SELFBOUND player improve.

## User Scenarios

Include at least:

1. user has no completed runs;
2. user has one completed run;
3. user has three completed runs;
4. user requests coaching while another run is active;
5. a run finishes and enters history;
6. fourth completed run evicts the oldest;
7. manual reset abandons current telemetry;
8. provider unavailable;
9. malformed AI output.

## Functional Requirements

Number them clearly.

Cover:

- telemetry lifecycle;
- history limit;
- current-run exclusion;
- Coach button;
- request trigger;
- structured response;
- safe failure;
- no gameplay mutation.

## Telemetry Requirements

Define the five coaching areas and required facts.

## Request Contract Expectations

Without overcommitting to implementation details.

## Response Contract Expectations

Structured, concise, grounded.

## Acceptance Criteria

Make them observable/testable.

## Error Behavior

## Security Boundary

## Privacy/Data Minimization

Only gameplay telemetry, no unnecessary user data.

## Out of Scope

Use the boundaries above.

## Open Questions

Only include genuine unresolved choices that code inspection cannot answer.

Do not leave obvious product decisions unresolved when the prompt already defines them.

---

# Technical Plan: `plan.md`

Write an implementation-ready technical plan based on the **actual repository**.

It must include:

## Current Architecture

Relevant frontend/backend/game-state/UI pieces and real file paths.

## Proposed Data Flow

For example:

```text
game events
   ↓
CurrentRunTelemetry
   ↓ terminal outcome
CompletedRunSummary
   ↓ keep last 3
AI Coach button
   ↓
frontend request
   ↓
backend validation
   ↓
AI provider abstraction
   ↓
Gemini
   ↓
runtime response validation
   ↓
frontend advice panel
```

## Run Lifecycle

Precise initialization/finalization/discard rules.

## Telemetry Ownership

Identify exact future modules/files that should own:

- current run collection;
- derived metrics;
- history;
- request serialization.

Prefer frontend ownership for gameplay facts.

## Data Contracts

Define proposed validated schemas/types.

Use the repository's existing runtime-validation approach.

## Heuristics

Define chosen measurable rules and thresholds/config strategy.

## Request Size Bounds

Maximum 3 runs and bounded representative events.

## Backend Endpoint

Path, method, request/response envelope.

## Provider Abstraction

Design for fake and Gemini implementations.

Avoid an unnecessary generic agent framework.

## Prompt Strategy

Describe the provider prompt at a high level:

- role = concise SELFBOUND coach;
- only use supplied telemetry;
- no invented facts;
- prioritize recurring/high-impact issue;
- JSON/structured output only;
- concise next-run goal.

Do not need the final production prompt text unless project convention expects it here.

## Runtime Validation

Both local request and provider output.

## Error Model

Internal vs user-facing.

## Timeout / Retry

Explicit bounded policy.

## Usage Logging

Minimal metadata:

- provider;
- model;
- timestamp;
- latency;
- success/failure;
- attempts;
- token usage if available.

No secrets.

## Test Strategy

Map directly to W04 required cases.

## Manual Validation

Browser play-test flow.

## Security

API key boundary and logging rules.

## Compatibility

Existing Week 3 gameplay must remain unchanged apart from passive telemetry and Coach UI.

## Risks / Limitations

Especially heuristic misclassification and small sample size of only 1–3 runs.

---

# Task List: `tasks.md`

Create ordered, implementation-ready tasks.

Do not execute them.

Group tasks by phase.

Suggested ordering:

## Phase 1 — Contracts and telemetry model

- define validated run-summary contracts;
- define coaching categories;
- define current/completed run lifecycle;
- add deterministic telemetry unit tests.

## Phase 2 — Passive game telemetry

- instrument shot/failure/capture/threat events;
- add derived signals;
- finalize run on Level Complete/Game Over;
- discard on manual active reset;
- maintain last-three history.

## Phase 3 — Coach UI without live provider

- add AI Coach button;
- define zero-history behavior;
- add loading/success/error presentation.

## Phase 4 — Backend contract and fake provider

- add request schema;
- endpoint;
- fake provider;
- success tests;
- invalid input with zero provider calls;
- malformed provider output;
- timeout/failure behavior.

## Phase 5 — Gemini provider

- environment key;
- provider adapter;
- model config;
- structured response;
- timeout/retry;
- usage log.

## Phase 6 — Integration / evals / evidence

- run required test matrix;
- limited live provider validation;
- play-test;
- evidence docs;
- known limitations;
- usage record.

Every task should have:

- clear description;
- affected layer;
- dependencies;
- validation/check expected.

Use task IDs if the repository's Spec Kit convention expects them.

Keep tasks small enough that future Codex prompts can implement them phase-by-phase rather than in one giant diff.

---

# W04 Required Eval Coverage

The plan/tasks must support at least these cases:

```text
A1 valid 1-run request
→ structured coaching success

A2 valid 3-run request
→ structured coaching success using all available runs

A3 zero completed runs
→ no provider call

A4 malformed frontend/backend input
→ rejected before provider
→ providerCallCount === 0

A5 provider timeout/failure
→ safe user-facing error

A6 malformed AI/provider output
→ runtime validation rejects it

A7 retryable transient failure
→ attempts remain within configured bound

A8 fourth completed run
→ oldest history entry evicted

A9 manual reset during active run
→ current telemetry discarded
→ not archived as completed

A10 life loss before Game Over
→ telemetry continues in same run

A11 Coach requested during active run
→ active run excluded
→ only completed runs sent
```

Add additional telemetry-specific unit cases for the selected heuristics.

---

# Acceptance Criteria for This Specification Task

This task is complete when:

- [ ] `specs/001-ai-coach/spec.md` exists.
- [ ] `specs/001-ai-coach/plan.md` exists.
- [ ] `specs/001-ai-coach/tasks.md` exists.
- [ ] The feature analyzes 1–3 most recent completed runs.
- [ ] Current active run is explicitly excluded.
- [ ] Level Complete and Game Over finalize runs.
- [ ] Life loss before Game Over remains within the same run.
- [ ] Manual active reset behavior is explicitly defined.
- [ ] Completed history keeps at most 3 runs.
- [ ] The five requested coaching areas are represented by deterministic telemetry.
- [ ] Heuristics are measurable and labeled as heuristics.
- [ ] No unbounded frame/mouse telemetry is proposed.
- [ ] No database is required for Core.
- [ ] AI Coach is user-triggered.
- [ ] Zero-history behavior causes zero provider calls.
- [ ] Request contract is bounded and runtime-validatable.
- [ ] Response contract is structured and runtime-validatable.
- [ ] Gemini remains backend-only.
- [ ] Fake provider comes before live provider.
- [ ] Timeout/failure/malformed-output behavior is planned.
- [ ] Required W04 eval cases are mapped into tasks.
- [ ] Existing gameplay behavior remains authoritative and unchanged.
- [ ] No product code or AI integration is implemented during this task.

---

# Required Final Report

After writing the three Spec Kit files, report:

## 1. Files Created

List exact paths.

## 2. Key Product Decisions

Summarize:

- what counts as completed run;
- manual reset behavior;
- last-three policy;
- current-run exclusion;
- history persistence decision;
- button behavior with 0/1/2/3 runs.

## 3. Telemetry Model

Summarize the deterministic signals chosen for each of the five coaching areas.

## 4. Heuristic Thresholds / Open Decisions

List values selected or intentionally deferred, with reasons.

## 5. Proposed Contracts

Briefly show request and response shapes.

## 6. Planned Backend/Provider Flow

Summarize boundary and fake-first strategy.

## 7. Test/Eval Matrix

List planned required cases.

## 8. Risks / Known Limitations

Especially:

- heuristic classification can be imperfect;
- 1–3 runs is a small sample;
- advice quality depends on telemetry quality;
- no analysis of current unfinished run.

## 9. Implementation Sequencing Recommendation

Recommend whether future Codex implementation should be split into multiple prompts/phases.

Prefer multiple scoped prompts over implementing all tasks in one large change.

Do not begin implementation.

---

# Final Design Principle

The AI Coach should not be valuable because the LLM has access to a huge amount of state.

It should be valuable because SELFBOUND provides a **small, accurate, structured summary of what the player actually did**, and the model turns that into concise, grounded coaching.

Keep deterministic gameplay facts in code.

Use AI for interpretation and communication.
