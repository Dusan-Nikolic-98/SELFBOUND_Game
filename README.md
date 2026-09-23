# 🔵 SELFBOUND

A retro-inspired 2D side-scroller where you don't jump, you **shoot yourself**. Fire a piece of your own body at an enemy, teleport into its place, capture the whole target sequence in order and reach the exit. Built with strictly typed TypeScript, HTML Canvas and runtime-validated game data.

> 🎮 Developed as part of the **Retro AI Engineering Challenge**, Sessions 003–004 (SITA AI Bootcamp 2026)

---

## 📸 Project Overview

<video controls src="Base_game_demo.mp4" title="Base gameplay"></video>


https://github.com/user-attachments/assets/0e67083a-ac3d-447a-a70a-49c3a5682a7b



SELFBOUND takes the classic side-scrolling platformer and replaces jumping with a single core mechanic: **self-projectile teleportation**. The player is a small blue sphere that can only walk left and right. To get anywhere higher or farther, it has to shoot a piece of itself at the right enemy.

The main focus of the project is on:

- a small, clearly defined scope (`docs/GAME_SPEC.md`);
- clean, modular TypeScript architecture with no game engine;
- runtime validation of game configuration and level data;
- deterministic, testable gameplay logic;
- documented, auditable AI-assisted development (prompt, context, evals and evidence).

---

## ✨ Key Features

### 🎯 Self-Projectile and Teleport Capture

- Aim with the mouse. A dashed **aim line** shows the shot direction.
- Fire a blue self-projectile toward the cursor (**600 ms** cooldown).
- Hit the **current target** and the player teleports to its position, the enemy is removed and the capture counter increases.
- The projectile travels at **900 units/s** with a limited travel range of **450 units**.

### 🧱 Wall Bounces

- The projectile reflects off solid platforms. Horizontal surfaces flip vertical movement and vertical surfaces flip horizontal movement.
- Each bounce adds **+150 units** of range.
- Maximum of **3 bounces** per shot.

### 🟢 Green Homing Threat

A missed shot doesn't just disappear. It turns into a **green projectile** that homes in on the player at **260 units/s**.

- Only **one** green threat can exist at a time.
- Shoot it with a blue projectile to destroy it.
- If it reaches you, you lose a life and the level state resets.

### 🔴 Enemies and Target Sequence

- Red **stationary** and **horizontally patrolling** enemies.
- Every level defines an ordered `requiredSequence` of enemy IDs.
- Only the next enemy in the sequence can be captured, and it is highlighted with a yellow **TARGET** marker.
- Hitting any other enemy counts as a failed shot.

### ❤️ Lives, Reset and Win State

- **3 lives** in the normal configuration.
- A life is lost when the player falls below the level or is hit by the green threat. The level resets and the remaining lives are kept.
- At 0 lives the game shows **Game Over**.
- Capture the full sequence and enter the exit to see **Level Complete**.
- **Reset Level** button or the `R` key performs a full reset at any time.

### 🎥 Side-Scrolling Camera

The camera smoothly follows the player on both axes and is always **clamped to the level bounds** (3600 × 1400 world, 1280 × 720 viewport).

---

## 🛡️ Runtime Validation

TypeScript types alone are not trusted. Both `GameConfig` and `LevelData` are validated at runtime in `src/validation.ts`.

```ts
type GameConfig = {
  lives: number;
  startingSpeed: number;
  difficulty: "easy" | "normal" | "hard";
};

// Normal defaults
{ lives: 3, startingSpeed: 220, difficulty: "normal" }
```

Invalid input such as `{ lives: -1, startingSpeed: NaN, difficulty: "expert" }` is rejected with clear errors, and the game falls back to the safe default configuration instead of running in an invalid state.

---

## 🛠️ Technologies

| Technology                        | Usage                                        |
| --------------------------------- | -------------------------------------------- |
| TypeScript                        | Main programming language, `strict` mode     |
| HTML5 Canvas                      | Game rendering (primitives only, no sprites) |
| HTML / CSS3                       | HUD, layout and reset button                 |
| Node.js test runner (`node:test`) | Unit tests for pure game logic               |
| Node.js (`scripts/serve.mjs`)     | Minimal local static server                  |

No game engine, physics engine, framework, backend or database.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18 or higher
- **npm**

### 1. Clone the Repository

```bash
git clone https://github.com/Dusan-Nikolic-98/SELFBOUND_Game.git
cd SELFBOUND_Game
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build and Start the Game

```bash
npm start
```

The game will be available at:

```text
http://127.0.0.1:4173
```

Open it in a desktop browser. You can change the port with the `PORT` environment variable.

---

## 📜 Available Commands

| Command             | Description                                                        |
| ------------------- | ------------------------------------------------------------------ |
| `npm start`         | Builds the project and starts the local server.                    |
| `npm run dev`       | Same as `npm start`.                                               |
| `npm run build`     | Compiles TypeScript from `src/` into `dist/`.                      |
| `npm run serve`     | Serves the already built game on port 4173.                        |
| `npm run typecheck` | Type-checks the game code without emitting files (`tsc --noEmit`). |
| `npm test`          | Compiles and runs the unit tests with the Node.js test runner.     |

---

## 🎮 Controls

| Control                      | Action               |
| ---------------------------- | -------------------- |
| ⬅️ `A` / Arrow Left          | Move left            |
| ➡️ `D` / Arrow Right         | Move right           |
| 🖱️ Mouse move                | Aim                  |
| 🖱️ Left click                | Fire self-projectile |
| `R` / **Reset Level** button | Full level reset     |

There is **no jump button**. The only way up is capturing an enemy.

---

## 📂 Project Structure

```text
SELFBOUND_Game/
├── docs/
│   ├── GAME_SPEC.md            # Game rules, scope and Definition of Done
│   ├── BUILD_PROMPT_V1.md      # First prompt given to the coding agent
│   ├── CONTEXT_MANIFEST.md     # What context the agent received and what was excluded
│   ├── EVALS.md                # Eval cases defined before the controlled change
│   ├── EVIDENCE_003.md         # Baseline, hypothesis, change and results
│   ├── AI_USAGE_LOG.md         # Log of significant AI calls
│   └── image.png               # Baseline screenshot
│
├── scripts/
│   ├── serve.mjs               # Local static server
│   └── check-reachability.mjs  # Headless check: can every target be captured?
│
├── src/
│   ├── main.ts                 # Bootstrap, input events, HUD and game loop
│   ├── game.ts                 # Game state, player, projectile, enemies, green threat, rendering
│   ├── logic.ts                # Projectile constants, range and bounce logic
│   ├── collision.ts            # Circle/circle and circle/rectangle collision
│   ├── camera.ts               # Camera follow and clamping
│   ├── level.ts                # Core Level 1 data
│   ├── validation.ts           # Runtime validation for GameConfig and LevelData
│   ├── input.ts                # Input state
│   └── types.ts                # Shared types and contracts
│
├── tests/
│   ├── logic.test.ts           # Unit tests for pure logic
│   └── tsconfig.json           # Editor config for tests (extends tsconfig.test.json)
│
├── index.html
├── styles.css
├── package.json
├── tsconfig.json               # Game build config
└── tsconfig.test.json          # Test build config (Node types)
```

### 📁 Main Directories

- **`docs/`**: specification, prompt, context manifest, evals and evidence
- **`scripts/`**: local server and helper checks
- **`src/`**: game source code
- **`tests/`**: unit tests

---

## 🧪 Tests and Validation

The unit tests in `tests/logic.test.ts` cover:

- ✅ rejection of an invalid `GameConfig`;
- ✅ runtime validation of Core Level 1;
- ✅ camera clamping on every level edge;
- ✅ projectile range consumption and bounce limits;
- ✅ circle and rectangle collision helpers.

Run the full check before every commit:

```bash
npm run typecheck && npm test
```

To check that every enemy in `requiredSequence` can actually be captured:

```bash
npm run build && node scripts/check-reachability.mjs
```

Manual gameplay evals (spawn, falling, capture, camera bounds, invalid config) and their results are documented in [`docs/EVALS.md`](docs/EVALS.md) and [`docs/EVIDENCE_003.md`](docs/EVIDENCE_003.md).

---

## 🤖 AI-Assisted Development

This project was built with a coding agent under a documented process:

```text
IDEA -> SPECIFICATION -> PROMPT + CONTEXT -> BASELINE -> EVAL + EVIDENCE -> CONTROLLED CHANGE
```

- **Baseline:** git tag `baseline-v1` (commit `7d6dc17`) is preserved and never overwritten.
- Every significant AI call is recorded in [`docs/AI_USAGE_LOG.md`](docs/AI_USAGE_LOG.md).
- **Week 4 (planned):** a read-only **Ask AI for Hint** feature backed by a validated `get_game_state` tool and a structured `HintResponse`.

---

## 📝 License

This project was developed for educational purposes as part of the SITA AI Bootcamp 2026 (Endava · SITA).
