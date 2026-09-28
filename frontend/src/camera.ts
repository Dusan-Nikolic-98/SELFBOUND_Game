import { Vector2 } from "./types.js";

export type Camera = Vector2;

export function clampCamera(camera: Camera, levelWidth: number, levelHeight: number, viewportWidth: number, viewportHeight: number): Camera {
  return {
    x: Math.max(0, Math.min(camera.x, Math.max(0, levelWidth - viewportWidth))),
    y: Math.max(0, Math.min(camera.y, Math.max(0, levelHeight - viewportHeight))),
  };
}

export function updateCamera(
  camera: Camera,
  target: Vector2,
  levelWidth: number,
  levelHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  deltaSeconds: number,
): Camera {
  const smoothing = Math.min(1, deltaSeconds * 7);
  const desired = {
    x: target.x - viewportWidth / 2,
    y: target.y - viewportHeight / 2,
  };
  return clampCamera(
    {
      x: camera.x + (desired.x - camera.x) * smoothing,
      y: camera.y + (desired.y - camera.y) * smoothing,
    },
    levelWidth,
    levelHeight,
    viewportWidth,
    viewportHeight,
  );
}
