import { GameConfig, LevelData } from "./types.js";

export const DEFAULT_GAME_CONFIG: GameConfig = {
  lives: 3,
  startingSpeed: 220,
  difficulty: "normal",
};

type ValidationResult<T> = {
  valid: boolean;
  value?: T;
  errors: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function validateGameConfig(input: unknown): ValidationResult<GameConfig> {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ["GameConfig must be an object."] };

  if (!Number.isInteger(input.lives) || (input.lives as number) < 1) {
    errors.push("lives must be a positive integer.");
  }
  if (!finiteNumber(input.startingSpeed) || (input.startingSpeed as number) <= 0) {
    errors.push("startingSpeed must be a finite positive number.");
  }
  if (input.difficulty !== "easy" && input.difficulty !== "normal" && input.difficulty !== "hard") {
    errors.push('difficulty must be "easy", "normal", or "hard".');
  }

  if (errors.length > 0) return { valid: false, errors };
  return {
    valid: true,
    value: {
      lives: input.lives as number,
      startingSpeed: input.startingSpeed as number,
      difficulty: input.difficulty as GameConfig["difficulty"],
    },
    errors,
  };
}

export function getSafeGameConfig(input: unknown): GameConfig {
  const result = validateGameConfig(input);
  return result.valid && result.value ? result.value : { ...DEFAULT_GAME_CONFIG };
}

function validateRect(value: unknown, label: string, errors: string[]): boolean {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return false;
  }
  for (const key of ["x", "y", "width", "height"]) {
    if (!finiteNumber(value[key])) errors.push(`${label}.${key} must be finite.`);
  }
  if (finiteNumber(value.width) && value.width <= 0) errors.push(`${label}.width must be positive.`);
  if (finiteNumber(value.height) && value.height <= 0) errors.push(`${label}.height must be positive.`);
  return errors.length === 0;
}

export function validateLevelData(input: unknown): ValidationResult<LevelData> {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ["LevelData must be an object."] };

  if (typeof input.id !== "string" || input.id.length === 0) errors.push("id must be a non-empty string.");
  if (!finiteNumber(input.width) || (input.width as number) <= 0) errors.push("width must be positive and finite.");
  if (!finiteNumber(input.height) || (input.height as number) <= 0) errors.push("height must be positive and finite.");
  if (!isRecord(input.spawn) || !finiteNumber(input.spawn.x) || !finiteNumber(input.spawn.y)) {
    errors.push("spawn must contain finite x and y values.");
  }
  if (!Array.isArray(input.platforms)) errors.push("platforms must be an array.");
  if (!Array.isArray(input.enemies)) errors.push("enemies must be an array.");
  if (!Array.isArray(input.requiredSequence)) errors.push("requiredSequence must be an array.");
  validateRect(input.exit, "exit", errors);

  const enemyIds = new Set<string>();
  if (Array.isArray(input.platforms)) {
    input.platforms.forEach((platform, index) => {
      if (!isRecord(platform) || typeof platform.id !== "string" || platform.id.length === 0) {
        errors.push(`platforms[${index}] must have a non-empty id.`);
      }
      validateRect(platform, `platforms[${index}]`, errors);
    });
  }

  if (Array.isArray(input.enemies)) {
    input.enemies.forEach((enemy, index) => {
      if (!isRecord(enemy)) {
        errors.push(`enemies[${index}] must be an object.`);
        return;
      }
      if (typeof enemy.id !== "string" || enemy.id.length === 0) errors.push(`enemies[${index}].id must be non-empty.`);
      if (typeof enemy.id === "string" && enemyIds.has(enemy.id)) errors.push(`Duplicate enemy id: ${enemy.id}.`);
      if (typeof enemy.id === "string") enemyIds.add(enemy.id);
      for (const key of ["x", "y", "radius"]) {
        if (!finiteNumber(enemy[key])) errors.push(`enemies[${index}].${key} must be finite.`);
      }
      if (finiteNumber(enemy.radius) && enemy.radius <= 0) errors.push(`enemies[${index}].radius must be positive.`);
      if (!isRecord(enemy.behavior) || (enemy.behavior.kind !== "stationary" && enemy.behavior.kind !== "patrol")) {
        errors.push(`enemies[${index}].behavior must be stationary or patrol.`);
      } else if (enemy.behavior.kind === "patrol") {
        for (const key of ["minX", "maxX", "speed"]) {
          if (!finiteNumber(enemy.behavior[key])) errors.push(`enemies[${index}].behavior.${key} must be finite.`);
        }
        if (finiteNumber(enemy.behavior.minX) && finiteNumber(enemy.behavior.maxX) && enemy.behavior.minX >= enemy.behavior.maxX) {
          errors.push(`enemies[${index}] patrol minX must be less than maxX.`);
        }
        if (finiteNumber(enemy.behavior.speed) && enemy.behavior.speed <= 0) errors.push(`enemies[${index}] patrol speed must be positive.`);
      }
    });
  }

  if (Array.isArray(input.requiredSequence)) {
    input.requiredSequence.forEach((id, index) => {
      if (typeof id !== "string" || !enemyIds.has(id)) errors.push(`requiredSequence[${index}] references an unknown enemy.`);
    });
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, value: input as unknown as LevelData, errors };
}

export function assertValidLevelData(input: unknown): LevelData {
  const result = validateLevelData(input);
  if (!result.valid || !result.value) throw new Error(`Invalid LevelData: ${result.errors.join(" ")}`);
  return result.value;
}
