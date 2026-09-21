# SELFBOUND - Game Specification

## 1. Project Name

**SELFBOUND**

Working title. The title may be changed later without changing the gameplay specification.

## 2. Game Description

SELFBOUND is a small retro-inspired 2D side-scrolling browser game built with TypeScript, HTML, CSS, and the HTML Canvas API. The player controls a small blue sphere that can fire a small piece of itself toward the mouse cursor. When the shot hits the current target enemy, the player teleports to that enemy's position and continues from there. If a shot fails to capture a target, the projectile turns green and homes toward the player, creating an immediate defensive problem that must be solved with another shot. The objective of each level is to capture a predefined sequence of enemies and then reach the exit.

## 3. Platform and Technical Boundary

- Target platform: desktop browser.
- Primary implementation language: TypeScript.
- Rendering: HTML Canvas.
- UI: HTML and CSS.
- Gameplay state: plain TypeScript objects and arrays.
- Collision geometry: axis-aligned rectangles and simple circles.
- No physics engine.
- No game engine.
- No backend.
- No database.
- No multiplayer.
- No procedural level generation.
- No external AI service in Week 3.
- No generic scripting or code execution system.
- Do not add a framework unless the existing starter already uses one.

If the repository is genuinely empty and has no existing starter/tooling, use only the minimal TypeScript browser tooling required to run and test the project.

## 4. Player Goal

The player must:

1. capture the required enemies in the exact order defined by the current level;
2. survive the hazards created by missed shots;
3. reach the exit after the required capture sequence is complete.

A level is won only when the required sequence is complete and the player reaches the exit area.

## 5. Controls

- `A` or `ArrowLeft`: move left.
- `D` or `ArrowRight`: move right.
- Left mouse button: fire the self-projectile toward the current mouse position.
- `R` or the on-screen `Reset Level` button: reset the current level.
- No jump button.
- No crouch button.
- No secondary ability button.

The player may move horizontally while airborne. Airborne movement is possible only because of gravity and falling; there is no jump mechanic.

## 6. Core Game Loop

```text
move horizontally
    -> aim with mouse
    -> fire self-projectile
    -> projectile travels / bounces
    -> target hit?
       -> yes: teleport to target and capture it
       -> no: projectile becomes a green homing threat
    -> destroy the green threat when necessary
    -> repeat until the required sequence is complete
    -> reach the exit
```

## 7. Player Rules

- The player is represented by a blue circle.
- The player has a small circular collision body.
- The player moves only on the horizontal axis through direct horizontal velocity.
- Gravity continuously affects vertical velocity.
- The player can stand on solid rectangular platforms.
- The player cannot move through solid platform rectangles.
- The player does not jump.
- Falling below the playable level bounds counts as a failure event.
- A failure event removes one life and resets the level state while preserving the remaining lives.
- The player starts each level with the configured number of lives.
- Core configuration uses 3 lives.

## 8. Camera Rules

- The camera follows the player horizontally and vertically.
- Camera movement is smoothed enough to avoid abrupt jumps but should remain simple.
- Camera position is always clamped to the level bounds.
- The camera must never render outside the defined level rectangle.
- Levels are larger than the visible canvas so the game is a true side-scroller.

## 9. Aiming Rules

- The mouse position determines the firing direction.
- The direction is the normalized vector from the player center to the mouse position in world coordinates.
- A visible aim line is rendered while the player is able to fire.
- The aim line is visual guidance only and is not itself collision geometry.
- No charge mechanic is required.

## 10. Self-Projectile Rules

- The projectile is a small blue irregular-looking shape; a simple circle is acceptable for the first implementation.
- The projectile launches from the player center in the mouse direction.
- The projectile travels at a constant speed.
- The projectile has a finite travel-distance budget.
- Core values:
  - starting travel range: 450 world units;
  - speed: 900 world units per second;
  - wall-bounce bonus: +150 world units to remaining range;
  - maximum wall bounces per shot: 3;
  - firing cooldown: 600 milliseconds.
- A projectile ends when one of these happens:
  1. it captures the current target;
  2. it collides with a wall/platform and has exhausted its bounce allowance or remaining range;
  3. it reaches zero remaining travel distance without capturing the current target;
  4. while a green threat is active, it successfully destroys that threat.
- A projectile collision with a non-target enemy is treated as a failed shot. The projectile does not capture that enemy.
- A failed shot becomes a green homing threat.
- A projectile must not pass through solid platform rectangles.

## 11. Wall Bounce Rules

- Platforms are solid axis-aligned rectangles.
- The projectile reflects from the impacted surface.
- A horizontal surface reverses the vertical component of projectile velocity.
- A vertical surface reverses the horizontal component of projectile velocity.
- Each bounce adds the configured bounce bonus to remaining travel distance.
- A maximum of 3 bounces is allowed for one blue projectile.
- The collision system should prevent obvious repeated collision with the same surface during a single frame.

## 12. Enemy Rules

- Every enemy is initially red.
- Enemies use the same simple circular visual/collision representation.
- An enemy may be:
  - stationary; or
  - a horizontal patrol enemy moving between two predefined points on one platform.
- Patrol enemies use constant speed and reverse direction at their patrol limits.
- No pathfinding.
- No combat AI.
- No line-of-sight system.
- No autonomous enemy attacks.

## 13. Target Sequence and Capture Rules

Each level defines an ordered array of enemy IDs called `requiredSequence`.

Example:

```ts
requiredSequence: ["enemy_1", "enemy_3", "enemy_2", "enemy_4"]
```

Rules:

- Only the next enemy in `requiredSequence` is capturable.
- The current target receives a simple visual target marker so the player can identify it.
- Hitting the current target with the blue projectile is a successful capture.
- On successful capture:
  1. the player's previous visual representation disappears;
  2. the player moves to the target enemy's world position;
  3. the target enemy is removed from the enemy list;
  4. the captured count increases by one;
  5. the next sequence target becomes active.
- The game does not create a separate "possessed enemy" entity. There is still exactly one player entity.
- A short flash, scale pulse, or simple color transition may be used as feedback, but no complex animation is required.
- Hitting a non-target enemy does not capture it and counts as a failed shot.
- The target sequence is reset when the level is reset.

## 14. Green Homing Threat Rules

A missed or invalid blue shot becomes a green projectile.

- The green projectile is visually distinct from the blue projectile.
- It continuously steers directly toward the current player position.
- Core speed: 260 world units per second.
- There may be at most one active green threat at a time.
- While a green threat exists, the next blue shot is primarily a defensive shot.
- If the blue projectile collides with the green threat, the green threat is destroyed and the blue projectile also disappears.
- If the blue projectile does not hit the green threat, it does not create a second green threat. The existing green threat remains active.
- If the green threat reaches the player, the player loses one life and the level resets.
- The green threat does not damage platforms or enemies.

## 15. Lives and Reset Rules

- Core lives: 3.
- Losing a life happens when:
  - the player is hit by the green threat; or
  - the player falls below the level bounds.
- When a life is lost, the current level state is restored to its initial gameplay state while the remaining life count is preserved.
- When lives reach zero, the game enters a `Game Over` state and gameplay input is paused.
- The on-screen `Reset Level` button always performs a full manual level reset and restores the configured starting life count.
- A reset restores:
  - player position;
  - player velocity;
  - enemy positions;
  - captured count;
  - required sequence progress;
  - active projectiles;
  - green threat;
  - camera target;
  - win state.

## 16. Level Rules

Levels are hand-authored data. They are not generated procedurally.

A level is represented using plain TypeScript data.

Example platform shape:

```ts
type Platform = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
```

Example level shape:

```ts
type LevelData = {
  id: string;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  platforms: Platform[];
  enemies: EnemyDefinition[];
  requiredSequence: string[];
  exit: { x: number; y: number; width: number; height: number };
};
```

The same platform data is used both for rendering and collision. Do not derive collision geometry from a screenshot or painted image.

## 17. Core Level 1

The first level should be a small hand-authored tutorial-like side-scroller with one clear route and increasing use of the core mechanic.

Suggested world size:

- width: 3600
- height: 1400
- visible canvas can be smaller, e.g. 1280 x 720

Suggested sequence:

```text
enemy_1 -> enemy_2 -> enemy_3 -> enemy_4
```

Suggested layout intent:

1. Start on a safe lower platform.
2. Place `enemy_1` close enough to teach the basic capture shot.
3. Use a gap or height difference so the player naturally benefits from teleporting to `enemy_2`.
4. Place `enemy_3` behind a simple wall that demonstrates one bounce.
5. Make `enemy_4` patrol horizontally on a higher platform.
6. Put the exit beyond `enemy_4`, on the final elevated section.

Approximate example coordinates may be used as a starting point, but exact coordinates may be adjusted during baseline tuning:

```text
spawn:    (180, 1120)
enemy_1:  (720, 1100)
enemy_2:  (1420, 930)
enemy_3:  (2150, 1140)
enemy_4:  (2860, 820)
exit:     (3350, 560, 180, 100)
```

The implementation should remain simple and readable. Level geometry may be tuned after the baseline is captured, but the change must be documented in `EVIDENCE_003.md` if it is the selected controlled change.

## 18. Visual Requirements

Minimum visual requirements:

- dark or neutral background;
- blue player;
- red enemies;
- green homing threat;
- visually distinct solid platforms;
- visible aim line;
- clear exit marker;
- HUD showing lives and capture progress;
- reset button;
- visible win state.

The game does not require custom pixel art, complex sprites, particles, or animations.

## 19. Runtime-Validated Structured Data

At least one gameplay structure must be validated at runtime rather than relying only on TypeScript types.

The Core implementation should runtime-validate both `GameConfig` and `LevelData` when practical.

Minimum `GameConfig` contract:

```ts
type GameConfig = {
  lives: number;
  startingSpeed: number;
  difficulty: "easy" | "normal" | "hard";
};
```

Normal Core defaults:

```ts
{
  lives: 3,
  startingSpeed: 220,
  difficulty: "normal"
}
```

The validator must reject invalid values such as negative lives, non-finite speed, missing properties, or unsupported difficulty strings. The application must use a safe fallback or show a clear configuration error instead of continuing with invalid state.

TypeScript annotations alone do not count as runtime validation.

## 20. Win and Lose States

Win:

- required sequence is complete;
- player enters the exit rectangle;
- gameplay input is paused;
- a simple `Level Complete` message is shown;
- a reset button remains available.

Lose:

- the player's life count reaches zero after one or more failure events;
- gameplay input is paused;
- a simple `Game Over` message is shown;
- the reset button remains available.

Failure events:

- player is hit by the green threat; or
- player falls below the level bounds.

Each failure consumes one life and resets the current level gameplay state while preserving the remaining lives.

## 21. Out of Scope

- multiplayer;
- online leaderboard;
- accounts and login;
- backend services;
- database;
- procedural generation;
- infinite levels;
- custom audio system;
- external AI integration during Week 3;
- autonomous AI-controlled enemies;
- enemy pathfinding;
- physics engine;
- particle system as a required feature;
- complex sprite animation;
- inventory and item systems;
- upgrades and shops;
- save-game system;
- level editor;
- generic scripting or code execution tools;
- arbitrary tool execution;
- extra abilities beyond movement and shooting.

## 22. Definition of Done - Week 3 Core

The Week 3 Core is complete when all of the following are true:

- the game starts in a desktop browser;
- the player can move left and right;
- gravity makes the player fall when not supported;
- solid rectangular platforms correctly support and block the player;
- the camera follows the player and is clamped to level bounds;
- the mouse controls shot direction;
- the aim line is visible;
- the player can fire on cooldown;
- the blue projectile has limited range;
- the projectile bounces from solid rectangular platforms;
- each bounce extends remaining travel distance according to the spec;
- enemies can be stationary or horizontally patrolling;
- only the current target can be captured;
- successful capture teleports the player and advances the sequence;
- missed shots create the green homing threat;
- the green threat can be destroyed by a blue shot;
- the green threat can damage the player and trigger a one-life loss plus level-state reset;
- falling below the level bounds triggers a one-life loss plus level-state reset;
- the reset button restores the full initial level state;
- the player can complete the required sequence and reach the exit;
- reaching zero lives produces a visible `Game Over` state;
- the HUD shows lives and sequence progress;
- runtime validation exists for the structured config/data;
- at least four eval cases are documented;
- one baseline eval contains a real observed issue before the controlled change;
- the baseline is saved and is not overwritten by the final version;
- Week 3 documentation and AI usage logging are complete.

## 23. Future Week 4 Boundary

Week 4 will add one small read-only AI capability. The planned direction is an `Ask AI for Hint` button backed by a read-only game-state snapshot.

Week 3 must not add a live provider call or a generic AI agent loop. The Core game remains the authority over its own state.
