import assert from "node:assert/strict";
import test from "node:test";
import { AiCoachClient } from "../frontend/src/ai-coach-client.js";
import {
  AiCoachRequest,
  CompletedRunSummary,
  validateAiCoachRequest,
} from "../frontend/src/ai-coach-contract.js";
import {
  CoachRunHistory,
  isApproximatelyAimed,
  segmentIntersectsRect,
  ShotTelemetryContext,
} from "../frontend/src/coach-telemetry.js";
import { Game } from "../frontend/src/game.js";
import { createInputState } from "../frontend/src/input.js";
import { GameConfig, LevelData } from "../frontend/src/types.js";
import { assertValidLevelData } from "../frontend/src/validation.js";

const CONFIG: GameConfig = { lives: 3, startingSpeed: 220, difficulty: "normal" };

function summary(outcome: CompletedRunSummary["outcome"] = "game_over"): CompletedRunSummary {
  return {
    outcome, durationMs: 1000, livesLost: 0, shotsFired: 0, failedShots: 0, captures: 0,
    greenThreatsCreated: 0, greenThreatHits: 0, shotsWhileThreatActive: 0, defensiveShots: 0,
    successfulDefensiveShots: 0, shotsAimedAtThreat: 0, shotsAimedAtCurrentTargetWhileThreatActive: 0,
    offensiveShotsWhileThreatActive: 0, blockedDirectAttempts: 0,
    bouncedAttempts: 0, successfulBounceCaptures: 0, rushedBouncedFailures: 0,
    repeatedSamePositionFailures: 0, rangeExpiredShots: 0, targetStats: [], representativeEvents: [],
  };
}

function makeLevel(requiredSequence = ["target"]): LevelData {
  return assertValidLevelData({
    id: "coach-test-level", width: 1200, height: 800, spawn: { x: 100, y: 582 },
    platforms: [{ id: "ground", x: 0, y: 600, width: 800, height: 200 }],
    enemies: [{ id: "target", x: 400, y: 582, radius: 18, behavior: { kind: "stationary" } }],
    requiredSequence, exit: { x: 100, y: 540, width: 100, height: 80 },
  });
}

function makeGame(lives = 3, sequence = ["target"]): Game {
  return new Game({ ...CONFIG, lives }, makeLevel(sequence), { width: 640, height: 480 }, createInputState());
}

function advance(game: Game, seconds: number): void {
  for (let frame = 0; frame < Math.ceil(seconds * 60); frame += 1) game.update(1 / 60);
}

function shotContext(overrides: Partial<ShotTelemetryContext> = {}): ShotTelemetryContext {
  return {
    targetId: "target", targetDistance: 500, threatActive: false, aimedAtThreat: false,
    aimedAtTarget: false, directLineBlocked: false, aimSettleMs: 400,
    playerPosition: { x: 100, y: 100 }, ...overrides,
  };
}

function recordFailedShot(history: CoachRunHistory, context: ShotTelemetryContext, result: { bounceCount?: number; rangeExpired?: boolean } = {}): void {
  history.recordShotStart(context);
  history.recordShotEnd({ outcome: "failed", bounceCount: result.bounceCount ?? 0, rangeExpired: result.rangeExpired });
}

test("aim alignment uses the 20 degree cone and rejects zero vectors", () => {
  assert.equal(isApproximatelyAimed({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 2 }), true);
  assert.equal(isApproximatelyAimed({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 5 }), false);
  assert.equal(isApproximatelyAimed({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }), false);
});

test("segment obstruction includes intersection/tangency but ignores a separated rectangle", () => {
  const wall = { x: 4, y: -2, width: 2, height: 4 };
  assert.equal(segmentIntersectsRect({ x: 0, y: 0 }, { x: 10, y: 0 }, wall), true);
  assert.equal(segmentIntersectsRect({ x: 0, y: 2 }, { x: 10, y: 2 }, wall), true);
  assert.equal(segmentIntersectsRect({ x: 0, y: 5 }, { x: 10, y: 5 }, wall), false);
});

test("threat telemetry distinguishes defensive aim from an offensive shot", () => {
  const history = new CoachRunHistory();
  history.startRun(0);
  history.recordShotStart(shotContext({ threatActive: true, aimedAtThreat: true }));
  history.recordShotEnd({ outcome: "threat_destroyed", bounceCount: 0 });
  history.recordShotStart(shotContext({ threatActive: true, aimedAtTarget: true }));
  history.recordShotEnd({ outcome: "failed", bounceCount: 0 });
  const current = history.currentRunStats;
  assert.equal(current?.shotsFired, 2);
  const completed = history.finalize("game_over", 1000);
  assert.equal(completed?.shotsWhileThreatActive, 2);
  assert.equal(completed?.defensiveShots, 2);
  assert.equal(completed?.successfulDefensiveShots, 1);
  assert.equal(completed?.shotsAimedAtThreat, 1);
  assert.equal(completed?.shotsAimedAtCurrentTargetWhileThreatActive, 1);
  assert.equal(completed?.offensiveShotsWhileThreatActive, 1);
});

test("Game records independent threat/target aim classifications at fire time", () => {
  const defensive = makeGame();
  defensive.greenThreat = { position: { x: 100, y: 450 }, radius: 11 };
  defensive.input.mouse = { x: 100, y: 450 };
  defensive.input.fireRequested = true;
  defensive.update(1 / 60);
  const defensiveRun = defensive.coachHistory.finalize("game_over", defensive.elapsedMs);
  assert.equal(defensiveRun?.shotsAimedAtThreat, 1);
  assert.equal(defensiveRun?.shotsAimedAtCurrentTargetWhileThreatActive, 0);

  const offensive = makeGame();
  offensive.greenThreat = { position: { x: 100, y: 450 }, radius: 11 };
  offensive.input.mouse = { x: 400, y: 582 };
  offensive.input.fireRequested = true;
  offensive.update(1 / 60);
  const offensiveRun = offensive.coachHistory.finalize("game_over", offensive.elapsedMs);
  assert.equal(offensiveRun?.shotsAimedAtThreat, 0);
  assert.equal(offensiveRun?.shotsAimedAtCurrentTargetWhileThreatActive, 1);
  assert.equal(offensiveRun?.offensiveShotsWhileThreatActive, 1);
});

test("blocked direct attempts require both a blocked segment and approximate direct aim", () => {
  const history = new CoachRunHistory();
  history.startRun(0);
  recordFailedShot(history, shotContext({ directLineBlocked: true, aimedAtTarget: true }));
  recordFailedShot(history, shotContext({ directLineBlocked: true, aimedAtTarget: false }));
  assert.equal(history.finalize("game_over", 1000)?.blockedDirectAttempts, 1);
});

test("same-position failure streak uses movement tolerance and breaks after repositioning", () => {
  const history = new CoachRunHistory();
  history.startRun(0);
  recordFailedShot(history, shotContext({ playerPosition: { x: 100, y: 100 } }));
  recordFailedShot(history, shotContext({ playerPosition: { x: 120, y: 100 } }));
  recordFailedShot(history, shotContext({ playerPosition: { x: 140, y: 100 } }));
  assert.equal(history.currentRunStats?.failedShots, 3);
  const summaryAfterThree = history.finalize("game_over", 1000);
  assert.equal(summaryAfterThree?.repeatedSamePositionFailures, 1);

  history.startRun(1000);
  recordFailedShot(history, shotContext({ playerPosition: { x: 100, y: 100 } }));
  recordFailedShot(history, shotContext({ playerPosition: { x: 120, y: 100 } }));
  recordFailedShot(history, shotContext({ playerPosition: { x: 200, y: 100 } }));
  recordFailedShot(history, shotContext({ playerPosition: { x: 220, y: 100 } }));
  assert.equal(history.finalize("game_over", 2000)?.repeatedSamePositionFailures, 0);
});

test("range telemetry uses authoritative expiration and counts actual bounce bonus", () => {
  const history = new CoachRunHistory();
  history.startRun(0);
  recordFailedShot(history, shotContext({ targetDistance: 700 }), { bounceCount: 1, rangeExpired: false });
  recordFailedShot(history, shotContext({ targetDistance: 700 }), { bounceCount: 1, rangeExpired: true });
  const result = history.finalize("game_over", 1000);
  assert.equal(result?.rangeExpiredShots, 1);
  assert.deepEqual(result?.representativeEvents.find((event) => event.type === "range_expired"), {
    type: "range_expired", targetId: "target", targetDistance: 700, travelBudget: 600, bounceCount: 1,
  });
});

test("rushed bounced failures use the settle cutoff and actual bounce count", () => {
  const history = new CoachRunHistory();
  history.startRun(0);
  recordFailedShot(history, shotContext({ aimSettleMs: 249 }), { bounceCount: 1 });
  recordFailedShot(history, shotContext({ aimSettleMs: 250 }), { bounceCount: 1 });
  recordFailedShot(history, shotContext({ aimSettleMs: 0 }), { bounceCount: 0 });
  assert.equal(history.finalize("game_over", 1000)?.rushedBouncedFailures, 1);
});

test("life loss preserves the current run; Game Over archives once", () => {
  const game = makeGame(2);
  game.coachHistory.recordShotStart(shotContext());
  game.player.position.y = game.level.height + 100;
  game.update(1 / 60);
  assert.equal(game.lives, 1);
  assert.equal(game.coachHistory.completedRuns.length, 0);
  assert.equal(game.coachHistory.currentRunStats?.shotsFired, 1);
  assert.equal(game.coachHistory.currentRunStats?.livesLost, 1);

  game.player.position.y = game.level.height + 100;
  game.update(1 / 60);
  assert.equal(game.status, "gameover");
  assert.equal(game.coachHistory.completedRuns.length, 1);
  assert.equal(game.coachHistory.completedRuns[0]?.outcome, "game_over");
  assert.equal(game.coachHistory.completedRuns[0]?.livesLost, 2);
  game.update(1 / 60);
  assert.equal(game.coachHistory.completedRuns.length, 1);
});

test("Level Complete archives, active reset discards, and history retains three newest runs", () => {
  const game = makeGame(3, []);
  game.player.position = { x: 120, y: 560 };
  game.update(1 / 60);
  assert.equal(game.status, "won");
  assert.equal(game.coachHistory.completedRuns[0]?.outcome, "level_complete");

  for (let index = 0; index < 3; index += 1) {
    game.resetLevel();
    game.player.position = { x: 120, y: 560 };
    game.update(1 / 60);
  }
  assert.equal(game.coachHistory.completedRuns.length, 3);
  assert.deepEqual(game.coachHistory.completedRuns.map((run) => run.outcome), ["level_complete", "level_complete", "level_complete"]);

  game.resetLevel();
  game.coachHistory.recordShotStart(shotContext());
  game.resetLevel();
  assert.equal(game.coachHistory.completedRuns.length, 3);
  assert.equal(game.coachHistory.currentRunStats?.shotsFired, 0);
});

test("Coach request snapshot contains only completed summaries, never the active run", () => {
  assert.equal(new CoachRunHistory().createRequestSnapshot(), null);
  const history = new CoachRunHistory();
  for (let index = 0; index < 4; index += 1) {
    history.startRun(index * 1000);
    history.finalize("game_over", (index + 1) * 1000);
  }
  history.startRun(5000);
  history.recordShotStart(shotContext());
  const request = history.createRequestSnapshot();
  assert.equal(request?.runs.length, 3);
  assert.equal(request?.runs[2]?.durationMs, 1000);
  assert.equal(request?.runs.some((run) => run.shotsFired === 1), false);
  assert.equal(validateAiCoachRequest(request), true);
});

test("frontend contract rejects zero, excess, and malformed run history", () => {
  assert.equal(validateAiCoachRequest({ runs: [] }), false);
  assert.equal(validateAiCoachRequest({ runs: [summary(), summary(), summary(), summary()] }), false);
  const malformed = { ...summary(), shotsFired: Number.POSITIVE_INFINITY };
  assert.equal(validateAiCoachRequest({ runs: [malformed] }), false);
});

test("representative events remain bounded and duplicate patterns are coalesced", () => {
  const history = new CoachRunHistory();
  history.startRun(0);
  for (let index = 0; index < 12; index += 1) {
    history.recordShotStart(shotContext({ targetId: `target-${index}`, threatActive: true, aimedAtTarget: true }));
    history.recordShotEnd({ outcome: "failed", bounceCount: 0 });
  }
  const archived = history.finalize("game_over", 1000);
  assert.equal(archived?.representativeEvents.length, 8);
  assert.ok((archived?.targetStats.length ?? 0) <= 16);
  assert.equal(validateAiCoachRequest({ runs: archived ? [archived] : [] }), true);
});

test("zero completed history does not call the frontend transport", async () => {
  let callCount = 0;
  const client = new AiCoachClient(async () => {
    callCount += 1;
    return new Response("{}", { status: 200 });
  });
  const request = new CoachRunHistory().createRequestSnapshot();
  if (request) await client.request(request);
  assert.equal(request, null);
  assert.equal(callCount, 0);
});

test("frontend client prevents duplicate calls and validates response", async () => {
  let callCount = 0;
  let release: ((response: Response) => void) | undefined;
  const client = new AiCoachClient(() => {
    callCount += 1;
    return new Promise<Response>((resolve) => { release = resolve; });
  });
  const request: AiCoachRequest = { runs: [summary()] };
  const first = client.request(request);
  assert.equal(client.isPending, true);
  await assert.rejects(client.request(request), /already in progress/);
  assert.equal(callCount, 1);
  release?.(new Response(JSON.stringify({ advice: { summary: "Keep playing.", primaryCategory: "general", primaryAdvice: "Use another run to build evidence.", practiceGoal: "Complete one more run." } }), { status: 200, headers: { "Content-Type": "application/json" } }));
  const advice = await first;
  assert.equal(advice.primaryCategory, "general");
  assert.equal(client.isPending, false);
});

test("frontend client calls fetch with the global receiver", async () => {
  let receiver: unknown;
  const fetcher: typeof fetch = function (this: unknown): Promise<Response> {
    receiver = this;
    return Promise.resolve(new Response(JSON.stringify({ advice: {
      summary: "Keep playing.", primaryCategory: "general",
      primaryAdvice: "Use another run to build evidence.", practiceGoal: "Complete one more run.",
    } }), { status: 200, headers: { "Content-Type": "application/json" } }));
  };
  const client = new AiCoachClient(fetcher);
  await client.request({ runs: [summary()] });
  assert.equal(receiver, globalThis);
});

test("frontend client rejects malformed success payload", async () => {
  const client = new AiCoachClient(async () => new Response(JSON.stringify({ advice: { summary: "bad", primaryCategory: "unknown", primaryAdvice: "bad", practiceGoal: "bad" } }), { status: 200 }));
  await assert.rejects(client.request({ runs: [summary()] }), /response is invalid/);
});
