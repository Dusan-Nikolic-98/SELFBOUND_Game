// Eval harness for E4: can every target in requiredSequence actually be captured?
// Usage: npm run build && node scripts/check-reachability.mjs
// It drives the real compiled Game class (frontend/dist/) headlessly: for every capture stage it places
// the player on the platform they would be standing on, fires shots at many angles and counts captures.
// Limitation: it only samples the platform directly under the previous capture point (or spawn);
// it does not simulate walking off ledges onto lower platforms.
import { Game } from "../frontend/dist/game.js";
import { getCoreLevel } from "../frontend/dist/level.js";

const CONFIG = { lives: 3, startingSpeed: 220, difficulty: "normal" };
const PLAYER_RADIUS = 18;
const X_STEP = 10;
const ANGLE_STEP = 0.5;
const PATROL_SAMPLES = 30;

const level = getCoreLevel();

function platformBelow(point) {
  return level.platforms
    .filter((p) => point.x >= p.x && point.x <= p.x + p.width && p.y >= point.y)
    .sort((a, b) => a.y - b.y)[0];
}

function countCaptures(stage, platform) {
  let hits = 0;
  let example = null;
  const target = level.enemies.find((e) => e.id === level.requiredSequence[stage]);
  const samples = target.behavior.kind === "patrol" ? PATROL_SAMPLES : 1;
  for (let x = platform.x + PLAYER_RADIUS; x <= platform.x + platform.width - PLAYER_RADIUS; x += X_STEP) {
    for (let s = 0; s < samples; s += 1) {
      for (let angle = 0; angle < 360; angle += ANGLE_STEP) {
        const input = { keys: new Set(), mouse: { x: 0, y: 0 }, fireRequested: false };
        const game = new Game(CONFIG, getCoreLevel(), { width: 1280, height: 720 }, input);
        const captured = new Set(level.requiredSequence.slice(0, stage));
        game.enemies = game.enemies.filter((e) => !captured.has(e.id));
        game.capturedCount = stage;
        const enemy = game.enemies.find((e) => e.id === target.id);
        if (samples > 1) enemy.x = enemy.behavior.minX + ((enemy.behavior.maxX - enemy.behavior.minX) * s) / (samples - 1);
        const y = platform.y - PLAYER_RADIUS;
        game.player.position = { x, y };
        const rad = (angle * Math.PI) / 180;
        input.mouse = { x: x + Math.cos(rad) * 200, y: y + Math.sin(rad) * 200 };
        input.fireRequested = true;
        for (let frame = 0; frame < 90; frame += 1) {
          game.update(1 / 60);
          if (!game.blueProjectile && frame > 0) break;
        }
        if (game.capturedCount > stage) {
          hits += 1;
          example ??= { playerX: x, angle };
        }
      }
    }
  }
  return { hits, example };
}

let failed = false;
let from = level.spawn;
level.requiredSequence.forEach((id, stage) => {
  const platform = platformBelow(from);
  const { hits, example } = countCaptures(stage, platform);
  const status = hits > 0 ? "PASS" : "FAIL";
  if (hits === 0) failed = true;
  console.log(`${status}  stage ${stage}: ${id} from platform "${platform.id}" -> ${hits} capturing shots`, example ?? "");
  const enemy = level.enemies.find((e) => e.id === id);
  from = { x: enemy.x, y: enemy.y };
});
console.log(failed ? "RESULT: FAIL - requiredSequence cannot be completed" : "RESULT: PASS - every target is capturable");
process.exit(failed ? 1 : 0);
