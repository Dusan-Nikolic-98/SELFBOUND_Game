import assert from "node:assert/strict";
import test from "node:test";
import { Game } from "../frontend/src/game.js";
import { createInputState } from "../frontend/src/input.js";
import { assertValidLevelData } from "../frontend/src/validation.js";
import { GameConfig, LevelData, Platform } from "../frontend/src/types.js";

const CONFIG: GameConfig = { lives: 3, startingSpeed: 220, difficulty: "normal" };
const VIEWPORT = { width: 640, height: 480 };
const GROUND_TOP = 600;
const STAND_Y = GROUND_TOP - 18;

/** Small hand-made level so the gameplay tests do not depend on Core Level 1 tuning. */
function makeLevel(extraPlatforms: Platform[] = []): LevelData {
  const level: LevelData = {
    id: "test-level",
    width: 1200,
    height: 800,
    spawn: { x: 100, y: STAND_Y },
    platforms: [
      { id: "ground", x: 0, y: GROUND_TOP, width: 800, height: 200 },
      { id: "ledge", x: 950, y: GROUND_TOP, width: 250, height: 200 },
      ...extraPlatforms,
    ],
    enemies: [
      { id: "e1", x: 400, y: STAND_Y, radius: 18, behavior: { kind: "stationary" } },
      { id: "e2", x: 250, y: 450, radius: 18, behavior: { kind: "stationary" } },
      { id: "e3", x: 900, y: 300, radius: 18, behavior: { kind: "patrol", minX: 850, maxX: 950, speed: 100 } },
    ],
    requiredSequence: ["e1", "e2", "e3"],
    exit: { x: 1000, y: 540, width: 120, height: 60 },
  };
  return assertValidLevelData(level);
}

function makeGame(options: { lives?: number; platforms?: Platform[] } = {}) {
  const input = createInputState();
  const config = { ...CONFIG, lives: options.lives ?? CONFIG.lives };
  const game = new Game(config, makeLevel(options.platforms), VIEWPORT, input);
  return { game, input };
}

/** Fire one shot at a world point and run frames until the blue projectile is gone. */
function fireAt(game: Game, input: ReturnType<typeof createInputState>, worldX: number, worldY: number): void {
  input.mouse.x = worldX - game.camera.x;
  input.mouse.y = worldY - game.camera.y;
  input.fireRequested = true;
  for (let frame = 0; frame < 120; frame += 1) {
    game.update(1 / 60);
    if (frame > 0 && !game.blueProjectile) return;
  }
}

function run(game: Game, seconds: number): void {
  for (let frame = 0; frame < Math.round(seconds * 60); frame += 1) game.update(1 / 60);
}

test("a hit on the current target teleports the player and advances the sequence", () => {
  const { game, input } = makeGame();
  fireAt(game, input, 400, STAND_Y);
  assert.equal(game.capturedCount, 1);
  assert.equal(game.currentTargetId, "e2");
  assert.equal(game.player.position.x, 400);
  assert.equal(game.enemies.some((enemy) => enemy.id === "e1"), false);
  assert.equal(game.greenThreat, null);
});

test("a hit on a non-target enemy does not capture it and creates one green threat", () => {
  const { game, input } = makeGame();
  fireAt(game, input, 250, 450);
  assert.equal(game.capturedCount, 0);
  assert.equal(game.enemies.some((enemy) => enemy.id === "e2"), true);
  assert.notEqual(game.greenThreat, null);

  const first = game.greenThreat;
  fireAt(game, input, 250, 450);
  assert.equal(game.greenThreat, first, "a second failed shot must not create a second green threat");
});

test("a blue projectile destroys the green threat without costing a life", () => {
  const { game, input } = makeGame();
  game.greenThreat = { position: { x: 300, y: STAND_Y }, radius: 11 };
  fireAt(game, input, 300, STAND_Y);
  assert.equal(game.greenThreat, null);
  assert.equal(game.blueProjectile, null);
  assert.equal(game.lives, 3);
  assert.equal(game.capturedCount, 0);
});

test("the green threat costs one life and resets the level state", () => {
  const { game, input } = makeGame();
  fireAt(game, input, 400, STAND_Y);
  assert.equal(game.capturedCount, 1);

  game.greenThreat = { position: { x: game.player.position.x + 60, y: game.player.position.y }, radius: 11 };
  run(game, 3);

  assert.equal(game.lives, 2);
  assert.equal(game.greenThreat, null);
  assert.equal(game.capturedCount, 0, "sequence progress must be reset");
  assert.equal(game.enemies.length, 3, "captured enemies must come back after a life is lost");
  assert.deepEqual(game.player.position, { x: 100, y: STAND_Y });
  assert.equal(game.status, "playing");
});

test("falling below the level bounds costs exactly one life and keeps the rest", () => {
  const { game } = makeGame();
  game.player.position = { x: 870, y: STAND_Y };
  run(game, 3);
  assert.equal(game.lives, 2);
  assert.deepEqual(game.player.position, { x: 100, y: STAND_Y });
  assert.equal(game.status, "playing");
});

test("reaching zero lives produces the game over state", () => {
  const { game } = makeGame({ lives: 1 });
  game.player.position = { x: 870, y: STAND_Y };
  run(game, 3);
  assert.equal(game.lives, 0);
  assert.equal(game.status, "gameover");
});

test("a patrol enemy stays between its endpoints and reverses direction", () => {
  const { game } = makeGame();
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  for (let frame = 0; frame < 600; frame += 1) {
    game.update(1 / 60);
    const enemy = game.enemies.find((candidate) => candidate.id === "e3");
    assert.ok(enemy);
    assert.ok(enemy.x >= 850 && enemy.x <= 950, `patrol enemy left its range at x=${enemy.x}`);
    minX = Math.min(minX, enemy.x);
    maxX = Math.max(maxX, enemy.x);
  }
  assert.ok(maxX - minX > 50, "the patrol enemy should travel and reverse, not stand still");
});

test("a solid platform blocks the projectile instead of letting it pass through", () => {
  const wall: Platform = { id: "wall", x: 300, y: 300, width: 40, height: 300 };
  const { game, input } = makeGame({ platforms: [wall] });
  fireAt(game, input, 400, STAND_Y);
  assert.equal(game.capturedCount, 0, "the shot must not capture through a wall");
  assert.notEqual(game.greenThreat, null, "a blocked shot is a failed shot");
});

test("the exit only completes the level after the full sequence is captured", () => {
  const { game } = makeGame();
  game.player.position = { x: 1020, y: STAND_Y };
  game.update(1 / 60);
  assert.equal(game.status, "playing", "the exit must not win the level before the sequence is done");

  game.capturedCount = game.level.requiredSequence.length;
  game.player.position = { x: 1020, y: STAND_Y };
  game.update(1 / 60);
  assert.equal(game.status, "won");
});

test("reset restores the full initial state and the configured lives", () => {
  const { game, input } = makeGame();
  fireAt(game, input, 400, STAND_Y);
  game.player.position = { x: 870, y: STAND_Y };
  run(game, 3);
  assert.equal(game.lives, 2);

  game.resetLevel();

  assert.equal(game.lives, 3);
  assert.equal(game.capturedCount, 0);
  assert.equal(game.currentTargetId, "e1");
  assert.equal(game.enemies.length, 3);
  assert.equal(game.blueProjectile, null);
  assert.equal(game.greenThreat, null);
  assert.equal(game.status, "playing");
  assert.deepEqual(game.player.position, { x: 100, y: STAND_Y });
  assert.deepEqual(game.player.velocity, { x: 0, y: 0 });
});
