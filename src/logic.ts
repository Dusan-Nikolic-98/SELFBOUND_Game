import { BlueProjectile, Vector2 } from "./types.js";

export const PROJECTILE_RANGE = 450;
export const PROJECTILE_SPEED = 900;
export const BOUNCE_BONUS = 150;
export const MAX_BOUNCES = 3;

export function createBlueProjectile(position: Vector2, direction: Vector2): BlueProjectile {
  return {
    position: { ...position },
    velocity: { x: direction.x * PROJECTILE_SPEED, y: direction.y * PROJECTILE_SPEED },
    radius: 7,
    remainingRange: PROJECTILE_RANGE,
    bounces: 0,
  };
}

export function consumeProjectileTravel(projectile: BlueProjectile, distance: number): number {
  projectile.remainingRange = Math.max(0, projectile.remainingRange - Math.max(0, distance));
  return projectile.remainingRange;
}

export function applyProjectileBounce(
  projectile: BlueProjectile,
  normal: Vector2,
  bonus = BOUNCE_BONUS,
  maxBounces = MAX_BOUNCES,
): boolean {
  if (projectile.bounces >= maxBounces) return false;
  if (normal.x !== 0) projectile.velocity.x *= -1;
  if (normal.y !== 0) projectile.velocity.y *= -1;
  projectile.bounces += 1;
  projectile.remainingRange += bonus;
  return true;
}
