# BUILD PROMPT V1

```text
You are the coding agent for a small browser game project named SELFBOUND.

Before implementation:
1. Summarize your understanding of the task.
2. Give a concise implementation plan in logical steps.
3. List any genuine ambiguities or assumptions.
4. Do not expand the scope beyond the specification without an explicit reason.

## Goal

Implement the Week 3 Core version of SELFBOUND exactly as described in `docs/GAME_SPEC.md`.

The repository is intended to be a small TypeScript browser game using HTML, CSS, and Canvas. Inspect the existing repository before changing anything. Preserve any existing starter/tooling that is already present. If the repository is genuinely empty and has no starter, create only the minimal TypeScript browser tooling needed to run and test the project.

## Source of truth

`docs/GAME_SPEC.md` is authoritative for gameplay rules and scope.

Do not rewrite, weaken, or silently extend `docs/GAME_SPEC.md`.

## Required technical boundaries

- TypeScript for gameplay logic.
- HTML Canvas for rendering.
- HTML/CSS for UI.
- Plain TypeScript objects and arrays for gameplay data.
- Axis-aligned rectangle collision for platforms.
- Simple circle collision for player, enemies, and projectiles.
- No physics engine.
- No Phaser, Pixi, Unity, React, or another game/framework dependency unless the existing starter already requires it.
- No backend.
- No database.
- No multiplayer.
- No procedural generation.
- No external AI integration in this iteration.
- No generic scripting or code execution system.

## Gameplay requirements

Implement:

1. Blue circular player.
2. Horizontal movement with A/Left and D/Right.
3. Gravity and solid rectangular platforms.
4. Falling below level bounds causes a life loss and resets gameplay state while preserving remaining lives. At zero lives, show `Game Over`.
5. Camera follows the player in both axes and is clamped to level bounds.
6. Mouse-based aiming with a visible aim line.
7. Blue self-projectile with a finite travel range and firing cooldown.
8. Projectile collision with solid rectangular platforms.
9. Projectile bounce reflection from horizontal and vertical surfaces.
10. Bounce adds travel distance, with a maximum of 3 bounces per shot.
11. Red stationary enemies.
12. Red horizontal patrol enemies with fixed patrol endpoints and constant speed.
13. An ordered `requiredSequence` of enemy IDs.
14. A visible indicator for the current target.
15. Only the current target can be captured.
16. Successful capture moves the player to the target position, removes the target enemy, and advances the sequence.
17. A failed shot becomes a green homing projectile.
18. At most one green threat is active at a time.
19. A blue shot can destroy the green threat.
20. A green threat hitting the player costs one life and resets gameplay state while preserving remaining lives. At zero lives, show `Game Over`.
21. Three lives in the normal Core configuration.
22. An on-screen `Reset Level` button and `R` keyboard shortcut.
23. A level exit that becomes valid only after the required sequence is complete.
24. A simple win state.
25. HUD showing lives and capture progress.

## Structured data and validation

Create clear types for at least:

- `GameConfig`
- `LevelData`
- `Platform`
- `EnemyDefinition`

Do not rely on TypeScript types alone. Implement runtime validation for `GameConfig` and, when practical, `LevelData`.

The minimum `GameConfig` contract is:

```ts
type GameConfig = {
  lives: number;
  startingSpeed: number;
  difficulty: "easy" | "normal" | "hard";
};
```

Normal default values:

```ts
{
  lives: 3,
  startingSpeed: 220,
  difficulty: "normal"
}
```

Invalid values must be rejected with a clear, deterministic fallback or configuration error.

## Level data

Keep level geometry as structured data. Do not derive collision from painted images or screenshots.

Use axis-aligned rectangular platforms with numeric `x`, `y`, `width`, and `height` values.

Implement at least the Core Level 1 described in `docs/GAME_SPEC.md`.

## Architecture expectations

Prefer small, focused modules. A reasonable structure is:

- game bootstrap / main loop
- input handling
- game state
- player logic
- enemy logic
- projectile logic
- collision helpers
- camera
- renderer
- level data
- validation
- UI/HUD

Do not create unnecessary abstractions. Keep the architecture easy for a second developer to understand.

## Rendering expectations

Use Canvas primitives for the first playable version. Do not spend implementation time on custom art.

At minimum, render:

- blue player;
- red enemies;
- green homing threat;
- solid platforms;
- current-target marker;
- aim line;
- exit;
- HUD.

## Tests and checks

Before declaring the implementation complete:

1. Inspect the diff.
2. Run the project's available test/lint/typecheck/build commands.
3. If the starter has no test setup, add only lightweight tests for pure logic that materially reduces risk, especially:
   - configuration validation;
   - level validation;
   - camera clamping;
   - projectile range/bounce calculations;
   - simple collision helpers where practical.
4. Run the browser app and manually verify the core loop.
5. Report exactly what you ran and the actual result.
6. Do not claim a test passed if it was not run.

## Scope discipline

Do not add:

- AI hints;
- live AI/provider calls;
- tool calling;
- autonomous agents;
- enemy combat AI;
- procedural generation;
- save systems;
- audio systems;
- extra levels beyond what is needed for Core;
- upgrades;
- inventory;
- particles or complex animations as required features.

If you identify a useful improvement outside the scope, mention it separately instead of implementing it.

## Working style

Work in small, reviewable steps.

After each major step, explain:
- what changed;
- which files changed;
- what checks were run;
- any remaining risk.

Do not overwrite the baseline later in the project. The baseline will be captured separately for the Week 3 evidence process.
```
