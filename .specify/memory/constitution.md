# SELFBOUND project constitution

These durable principles govern changes across the repository. Feature-specific requirements belong in the feature specification and plan.

## I. Preserve Core Gameplay Semantics

Existing game rules remain stable unless an approved feature spec explicitly changes them. `docs/GAME_SPEC.md` remains the detailed source for original gameplay rules.

## II. Keep the Architecture Small and Understandable

Prefer the existing TypeScript, browser, Canvas, and minimal Node server patterns. Add frameworks, infrastructure, and dependencies only for a concrete accepted need.

## III. Maintain the Frontend/Backend Security Boundary

The browser owns gameplay. Secrets and future provider calls stay on the backend. The backend remains independent of browser/game modules.

## IV. Keep Game Authority Deterministic and Local

Game code owns deterministic rules and state transitions. External AI may not decide or arbitrarily mutate gameplay state.

## V. Runtime-Validate Structured Boundaries

Keep runtime validation for `GameConfig` and `LevelData`. Validate future backend inputs and external/provider outputs; static TypeScript types are not runtime checks.

## VI. Make Future AI Small, Structured, and Bounded

Any future AI feature must be useful, read-only/advisory by default, testable, bounded, and safe to fail. It is not part of the frame-by-frame game loop.

## VII. Specify Meaningful Changes Before Implementation

Gameplay, architecture, contract, and AI behavior changes require an appropriate feature spec, plan, and ordered tasks before implementation.

## VIII. Complete Work With Evidence

A change is complete when relevant checks are actually run, docs and contracts agree with behavior, and the handoff states results and known limitations honestly.
