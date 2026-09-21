import { LevelData } from "./types.js";
import { assertValidLevelData } from "./validation.js";

const CORE_LEVEL_1: LevelData = {
  id: "core-level-1",
  width: 3600,
  height: 1400,
  spawn: { x: 180, y: 1120 },
  platforms: [
    { id: "start-ground", x: 0, y: 1160, width: 900, height: 240 },
    { id: "middle-platform", x: 850, y: 980, width: 1000, height: 40 },
    { id: "lower-route", x: 1700, y: 1080, width: 800, height: 40 },
    { id: "upper-route", x: 2250, y: 820, width: 1300, height: 40 },
    { id: "bounce-cap", x: 2300, y: 610, width: 260, height: 40 },
    { id: "bounce-wall", x: 2550, y: 610, width: 40, height: 160 },
  ],
  enemies: [
    { id: "enemy_1", x: 600, y: 1142, radius: 18, behavior: { kind: "stationary" } },
    { id: "enemy_2", x: 1000, y: 962, radius: 18, behavior: { kind: "stationary" } },
    { id: "enemy_3", x: 2050, y: 1062, radius: 18, behavior: { kind: "stationary" } },
    {
      id: "enemy_4",
      x: 2700,
      y: 802,
      radius: 18,
      behavior: { kind: "patrol", minX: 2470, maxX: 3130, speed: 95 },
    },
  ],
  requiredSequence: ["enemy_1", "enemy_2", "enemy_3", "enemy_4"],
  exit: { x: 3200, y: 700, width: 240, height: 120 },
};

assertValidLevelData(CORE_LEVEL_1);

export function getCoreLevel(): LevelData {
  return {
    ...CORE_LEVEL_1,
    spawn: { ...CORE_LEVEL_1.spawn },
    platforms: CORE_LEVEL_1.platforms.map((platform) => ({ ...platform })),
    enemies: CORE_LEVEL_1.enemies.map((enemy) => ({
      ...enemy,
      behavior: { ...enemy.behavior },
    })),
    requiredSequence: [...CORE_LEVEL_1.requiredSequence],
    exit: { ...CORE_LEVEL_1.exit },
  };
}
