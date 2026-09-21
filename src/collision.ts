import { Rect, Vector2 } from "./types.js";

export type Circle = { position: Vector2; radius: number };
export type CollisionResolution = { position: Vector2; normal: Vector2 };

export function circleIntersectsCircle(a: Circle, b: Circle): boolean {
  const dx = a.position.x - b.position.x;
  const dy = a.position.y - b.position.y;
  const radius = a.radius + b.radius;
  return dx * dx + dy * dy <= radius * radius;
}

export function circleIntersectsRect(circle: Circle, rect: Rect): boolean {
  const closestX = Math.max(rect.x, Math.min(circle.position.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(circle.position.y, rect.y + rect.height));
  const dx = circle.position.x - closestX;
  const dy = circle.position.y - closestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

export function resolveCircleRectCollision(
  circle: Circle,
  rect: Rect,
  previousPosition?: Vector2,
): CollisionResolution | null {
  if (!circleIntersectsRect(circle, rect)) return null;

  const previous = previousPosition ?? circle.position;
  if (previous.y + circle.radius <= rect.y) {
    return { position: { x: circle.position.x, y: rect.y - circle.radius }, normal: { x: 0, y: -1 } };
  }
  if (previous.y - circle.radius >= rect.y + rect.height) {
    return { position: { x: circle.position.x, y: rect.y + rect.height + circle.radius }, normal: { x: 0, y: 1 } };
  }
  if (previous.x + circle.radius <= rect.x) {
    return { position: { x: rect.x - circle.radius, y: circle.position.y }, normal: { x: -1, y: 0 } };
  }
  if (previous.x - circle.radius >= rect.x + rect.width) {
    return { position: { x: rect.x + rect.width + circle.radius, y: circle.position.y }, normal: { x: 1, y: 0 } };
  }

  const distances = [
    { distance: Math.abs(circle.position.y - rect.y), position: { x: circle.position.x, y: rect.y - circle.radius }, normal: { x: 0, y: -1 } },
    { distance: Math.abs(circle.position.y - (rect.y + rect.height)), position: { x: circle.position.x, y: rect.y + rect.height + circle.radius }, normal: { x: 0, y: 1 } },
    { distance: Math.abs(circle.position.x - rect.x), position: { x: rect.x - circle.radius, y: circle.position.y }, normal: { x: -1, y: 0 } },
    { distance: Math.abs(circle.position.x - (rect.x + rect.width)), position: { x: rect.x + rect.width + circle.radius, y: circle.position.y }, normal: { x: 1, y: 0 } },
  ];
  distances.sort((a, b) => a.distance - b.distance);
  const closest = distances[0];
  return closest ? { position: closest.position, normal: closest.normal } : null;
}
