import assert from "node:assert/strict";
import test from "node:test";
import { clampCamera } from "../src/camera.js";
import { circleIntersectsCircle, circleIntersectsRect } from "../src/collision.js";
import { applyProjectileBounce, consumeProjectileTravel, createBlueProjectile } from "../src/logic.js";
import { validateGameConfig, validateLevelData } from "../src/validation.js";
import { getCoreLevel } from "../src/level.js";

test("runtime validation rejects invalid GameConfig values", () => {
  const result = validateGameConfig({ lives: -1, startingSpeed: Number.NaN, difficulty: "expert" });
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 3);
});

test("the authored Core level passes runtime validation", () => {
  const level = getCoreLevel();
  const result = validateLevelData(level);
  assert.equal(result.valid, true);
  assert.deepEqual(level.requiredSequence, ["enemy_1", "enemy_2", "enemy_3", "enemy_4"]);
});

test("camera clamps to every level edge", () => {
  assert.deepEqual(clampCamera({ x: -100, y: -100 }, 3600, 1400, 1280, 720), { x: 0, y: 0 });
  assert.deepEqual(clampCamera({ x: 9999, y: 9999 }, 3600, 1400, 1280, 720), { x: 2320, y: 680 });
});

test("projectile range is consumed and each allowed bounce adds range", () => {
  const projectile = createBlueProjectile({ x: 0, y: 0 }, { x: 1, y: 0 });
  consumeProjectileTravel(projectile, 100);
  assert.equal(projectile.remainingRange, 350);
  assert.equal(applyProjectileBounce(projectile, { x: 0, y: -1 }), true);
  assert.equal(projectile.bounces, 1);
  assert.equal(projectile.remainingRange, 500);
  assert.equal(applyProjectileBounce(projectile, { x: 1, y: 0 }), true);
  assert.equal(applyProjectileBounce(projectile, { x: 1, y: 0 }), true);
  assert.equal(applyProjectileBounce(projectile, { x: 1, y: 0 }), false);
});

test("circle collision helpers detect simple enemy and platform hits", () => {
  assert.equal(circleIntersectsCircle({ position: { x: 0, y: 0 }, radius: 5 }, { position: { x: 9, y: 0 }, radius: 5 }), true);
  assert.equal(circleIntersectsRect({ position: { x: 10, y: 10 }, radius: 3 }, { x: 12, y: 12, width: 20, height: 20 }), true);
  assert.equal(circleIntersectsRect({ position: { x: 0, y: 0 }, radius: 3 }, { x: 12, y: 12, width: 20, height: 20 }), false);
});
