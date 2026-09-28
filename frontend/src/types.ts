export type Vector2 = { x: number; y: number };

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Platform = Rect & { id: string };

export type EnemyBehavior =
  | { kind: "stationary" }
  | { kind: "patrol"; minX: number; maxX: number; speed: number };

export type EnemyDefinition = {
  id: string;
  x: number;
  y: number;
  radius: number;
  behavior: EnemyBehavior;
};

export type LevelData = {
  id: string;
  width: number;
  height: number;
  spawn: Vector2;
  platforms: Platform[];
  enemies: EnemyDefinition[];
  requiredSequence: string[];
  exit: Rect;
};

export type Difficulty = "easy" | "normal" | "hard";

export type GameConfig = {
  lives: number;
  startingSpeed: number;
  difficulty: Difficulty;
};

export type PlayerState = {
  position: Vector2;
  velocity: Vector2;
  radius: number;
};

export type RuntimeEnemy = EnemyDefinition & { direction: 1 | -1 };

export type BlueProjectile = {
  position: Vector2;
  velocity: Vector2;
  radius: number;
  remainingRange: number;
  bounces: number;
};

export type GreenThreat = {
  position: Vector2;
  radius: number;
};
