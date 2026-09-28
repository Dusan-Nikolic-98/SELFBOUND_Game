import {
  AiCoachRequest,
  CoachingEvent,
  CompletedRunOutcome,
  CompletedRunSummary,
  MAX_COACH_RUNS,
  MAX_REPRESENTATIVE_EVENTS,
  MAX_TARGET_SUMMARIES,
  TargetRunSummary,
  validateAiCoachRequest,
} from "./ai-coach-contract.js";
import { Rect, Vector2 } from "./types.js";

export const AIM_ALIGNMENT_DEGREES = 20;
export const AIM_CHANGE_DEGREES = 5;
export const RUSHED_AIM_SETTLE_MS = 250;
export const SAME_POSITION_DISTANCE = 40;
export const SAME_POSITION_FAILURE_COUNT = 3;
export const STARTING_PROJECTILE_RANGE = 450;
export const BOUNCE_RANGE_BONUS = 150;

export type ShotTelemetryContext = {
  targetId: string | null;
  targetDistance: number | null;
  threatActive: boolean;
  aimedAtThreat: boolean;
  aimedAtTarget: boolean;
  directLineBlocked: boolean;
  aimSettleMs: number;
  playerPosition: Vector2;
};

export type ShotTelemetryResult = {
  outcome: "captured" | "failed" | "threat_destroyed";
  bounceCount: number;
  rangeExpired?: boolean;
};

type MutableTargetSummary = TargetRunSummary;
type MutableRun = Omit<CompletedRunSummary, "targetStats" | "representativeEvents" | "outcome"> & {
  targetStats: Map<string, MutableTargetSummary>;
  representativeEvents: CoachingEvent[];
  startedAtMs: number;
  activeShot: ShotTelemetryContext | null;
  lastFailedTargetId: string | null;
  lastFailedPosition: Vector2 | null;
  samePositionFailureStreak: number;
};

function makeTargetSummary(targetId: string): MutableTargetSummary {
  return { targetId, attempts: 0, captures: 0, failedShots: 0, blockedDirectAttempts: 0, bouncedAttempts: 0, rushedBouncedFailures: 0, samePositionFailures: 0, rangeExpirations: 0 };
}

function makeRun(startedAtMs: number): MutableRun {
  return {
    durationMs: 0, livesLost: 0, shotsFired: 0, failedShots: 0, captures: 0,
    greenThreatsCreated: 0, greenThreatHits: 0, shotsWhileThreatActive: 0,
    defensiveShots: 0, successfulDefensiveShots: 0, shotsAimedAtThreat: 0,
    shotsAimedAtCurrentTargetWhileThreatActive: 0, offensiveShotsWhileThreatActive: 0,
    blockedDirectAttempts: 0, bouncedAttempts: 0, successfulBounceCaptures: 0,
    rushedBouncedFailures: 0, repeatedSamePositionFailures: 0, rangeExpiredShots: 0,
    targetStats: new Map(), representativeEvents: [], startedAtMs, activeShot: null,
    lastFailedTargetId: null, lastFailedPosition: null, samePositionFailureStreak: 0,
  };
}

export function isApproximatelyAimed(direction: Vector2, origin: Vector2, point: Vector2): boolean {
  const directionLength = Math.hypot(direction.x, direction.y);
  const targetX = point.x - origin.x;
  const targetY = point.y - origin.y;
  const targetLength = Math.hypot(targetX, targetY);
  if (directionLength === 0 || targetLength === 0) return false;
  const dot = (direction.x * targetX + direction.y * targetY) / (directionLength * targetLength);
  return dot >= Math.cos((AIM_ALIGNMENT_DEGREES * Math.PI) / 180);
}

/** Liang–Barsky segment test; platform-edge tangency counts as blocked. */
export function segmentIntersectsRect(start: Vector2, end: Vector2, rect: Rect): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const p = [-dx, dx, -dy, dy];
  const q = [start.x - rect.x, rect.x + rect.width - start.x, start.y - rect.y, rect.y + rect.height - start.y];
  let lower = 0;
  let upper = 1;
  for (let index = 0; index < p.length; index += 1) {
    const denominator = p[index] ?? 0;
    const numerator = q[index] ?? 0;
    if (denominator === 0) {
      if (numerator < 0) return false;
      continue;
    }
    const ratio = numerator / denominator;
    if (denominator < 0) lower = Math.max(lower, ratio);
    else upper = Math.min(upper, ratio);
    if (lower > upper) return false;
  }
  return true;
}

function cloneSummary(summary: CompletedRunSummary): CompletedRunSummary {
  return {
    ...summary,
    targetStats: summary.targetStats.map((target) => ({ ...target })),
    representativeEvents: summary.representativeEvents.map((event) => ({ ...event })) as CoachingEvent[],
  };
}

export class CoachRunHistory {
  private current: MutableRun | null = null;
  private readonly completed: CompletedRunSummary[] = [];

  get completedRuns(): CompletedRunSummary[] {
    return this.completed.map(cloneSummary);
  }

  get currentRunStats(): Readonly<Pick<MutableRun, "shotsFired" | "failedShots" | "captures" | "livesLost">> | null {
    if (!this.current) return null;
    const { shotsFired, failedShots, captures, livesLost } = this.current;
    return { shotsFired, failedShots, captures, livesLost };
  }

  startRun(nowMs: number): void {
    this.current = makeRun(nowMs);
  }

  discardCurrentRun(): void {
    this.current = null;
  }

  recordShotStart(context: ShotTelemetryContext): void {
    const run = this.current;
    if (!run) return;
    run.shotsFired += 1;
    run.activeShot = { ...context, playerPosition: { ...context.playerPosition } };
    const target = this.getTarget(run, context.targetId);
    if (target) target.attempts += 1;

    if (context.threatActive) {
      run.shotsWhileThreatActive += 1;
      run.defensiveShots += 1;
      if (context.aimedAtThreat) run.shotsAimedAtThreat += 1;
      if (context.aimedAtTarget) run.shotsAimedAtCurrentTargetWhileThreatActive += 1;
      if (context.aimedAtTarget && !context.aimedAtThreat) {
        run.offensiveShotsWhileThreatActive += 1;
        if (context.targetId) this.pushEvent(run, { type: "ignored_threat", targetId: context.targetId, aimedAtTarget: true });
      }
    }
    if (context.directLineBlocked && context.aimedAtTarget) {
      run.blockedDirectAttempts += 1;
      if (target) target.blockedDirectAttempts += 1;
      if (context.targetId) this.updateCountEvent(run, "blocked_direct", context.targetId, { type: "blocked_direct", targetId: context.targetId, attemptCount: 1 });
    }
  }

  recordShotEnd(result: ShotTelemetryResult): void {
    const run = this.current;
    if (!run?.activeShot) return;
    const shot = run.activeShot;
    run.activeShot = null;
    const target = this.getTarget(run, shot.targetId);

    if (result.bounceCount > 0) {
      run.bouncedAttempts += 1;
      if (target) target.bouncedAttempts += 1;
    }
    if (result.outcome === "captured") {
      run.captures += 1;
      if (target) target.captures += 1;
      if (result.bounceCount > 0) run.successfulBounceCaptures += 1;
      run.lastFailedTargetId = null;
      run.lastFailedPosition = null;
      run.samePositionFailureStreak = 0;
      return;
    }
    if (result.outcome === "threat_destroyed") {
      if (shot.threatActive) run.successfulDefensiveShots += 1;
      run.lastFailedTargetId = null;
      run.lastFailedPosition = null;
      run.samePositionFailureStreak = 0;
      return;
    }

    run.failedShots += 1;
    if (target) target.failedShots += 1;
    if (result.rangeExpired) {
      run.rangeExpiredShots += 1;
      if (target) target.rangeExpirations += 1;
      if (shot.targetId && shot.targetDistance !== null) {
        this.pushEvent(run, {
          type: "range_expired", targetId: shot.targetId, targetDistance: Math.round(shot.targetDistance),
          travelBudget: STARTING_PROJECTILE_RANGE + BOUNCE_RANGE_BONUS * result.bounceCount, bounceCount: result.bounceCount,
        });
      }
    }
    if (result.bounceCount > 0 && shot.aimSettleMs < RUSHED_AIM_SETTLE_MS) {
      run.rushedBouncedFailures += 1;
      if (target) target.rushedBouncedFailures += 1;
      if (shot.targetId) this.pushEvent(run, { type: "rushed_bounce", targetId: shot.targetId, aimSettleMs: Math.round(shot.aimSettleMs) });
    }
    this.recordSamePositionFailure(run, shot, target);
  }

  cancelActiveShot(): void {
    if (this.current) this.current.activeShot = null;
  }

  recordThreatCreated(): void {
    if (this.current) this.current.greenThreatsCreated += 1;
  }

  recordLifeLoss(reason: "fall" | "threat"): void {
    if (!this.current) return;
    this.current.livesLost += 1;
    if (reason === "threat") this.current.greenThreatHits += 1;
    this.current.activeShot = null;
    this.current.lastFailedTargetId = null;
    this.current.lastFailedPosition = null;
    this.current.samePositionFailureStreak = 0;
  }

  finalize(outcome: CompletedRunOutcome, nowMs: number): CompletedRunSummary | null {
    const run = this.current;
    if (!run) return null;
    run.activeShot = null;
    const summary: CompletedRunSummary = {
      outcome,
      durationMs: Math.max(0, Math.round(nowMs - run.startedAtMs)),
      livesLost: run.livesLost,
      shotsFired: run.shotsFired,
      failedShots: run.failedShots,
      captures: run.captures,
      greenThreatsCreated: run.greenThreatsCreated,
      greenThreatHits: run.greenThreatHits,
      shotsWhileThreatActive: run.shotsWhileThreatActive,
      defensiveShots: run.defensiveShots,
      successfulDefensiveShots: run.successfulDefensiveShots,
      shotsAimedAtThreat: run.shotsAimedAtThreat,
      shotsAimedAtCurrentTargetWhileThreatActive: run.shotsAimedAtCurrentTargetWhileThreatActive,
      offensiveShotsWhileThreatActive: run.offensiveShotsWhileThreatActive,
      blockedDirectAttempts: run.blockedDirectAttempts,
      bouncedAttempts: run.bouncedAttempts,
      successfulBounceCaptures: run.successfulBounceCaptures,
      rushedBouncedFailures: run.rushedBouncedFailures,
      repeatedSamePositionFailures: run.repeatedSamePositionFailures,
      rangeExpiredShots: run.rangeExpiredShots,
      targetStats: [...run.targetStats.values()].map((target) => ({ ...target })),
      representativeEvents: run.representativeEvents.map((event) => ({ ...event })) as CoachingEvent[],
    };
    this.current = null;
    this.completed.push(summary);
    if (this.completed.length > MAX_COACH_RUNS) this.completed.splice(0, this.completed.length - MAX_COACH_RUNS);
    return cloneSummary(summary);
  }

  createRequestSnapshot(): AiCoachRequest | null {
    const request = { runs: this.completedRuns };
    return validateAiCoachRequest(request) ? request : null;
  }

  private getTarget(run: MutableRun, targetId: string | null): MutableTargetSummary | null {
    if (!targetId) return null;
    let target = run.targetStats.get(targetId);
    if (!target && run.targetStats.size < MAX_TARGET_SUMMARIES) {
      target = makeTargetSummary(targetId);
      run.targetStats.set(targetId, target);
    }
    return target ?? null;
  }

  private recordSamePositionFailure(run: MutableRun, shot: ShotTelemetryContext, target: MutableTargetSummary | null): void {
    if (!shot.targetId || !target) return;
    const previous = run.lastFailedTargetId === shot.targetId ? run.lastFailedPosition : null;
    const movementDistance = previous ? Math.hypot(shot.playerPosition.x - previous.x, shot.playerPosition.y - previous.y) : Number.POSITIVE_INFINITY;
    run.samePositionFailureStreak = movementDistance <= SAME_POSITION_DISTANCE ? run.samePositionFailureStreak + 1 : 1;
    run.lastFailedTargetId = shot.targetId;
    run.lastFailedPosition = { ...shot.playerPosition };
    if (run.samePositionFailureStreak >= SAME_POSITION_FAILURE_COUNT) {
      run.repeatedSamePositionFailures += 1;
      target.samePositionFailures += 1;
      const existing = run.representativeEvents.find((event) => event.type === "same_position" && event.targetId === shot.targetId);
      if (existing?.type === "same_position") {
        existing.attemptCount += 1;
        existing.movementDistance = Math.round(movementDistance);
      } else {
        this.pushEvent(run, { type: "same_position", targetId: shot.targetId, attemptCount: SAME_POSITION_FAILURE_COUNT, movementDistance: Math.round(movementDistance) });
      }
    }
  }

  private updateCountEvent(run: MutableRun, type: "blocked_direct", targetId: string, initial: CoachingEvent): void {
    const existing = run.representativeEvents.find((event) => event.type === type && event.targetId === targetId);
    if (existing?.type === "blocked_direct") existing.attemptCount += 1;
    else this.pushEvent(run, initial);
  }

  private pushEvent(run: MutableRun, event: CoachingEvent): void {
    const existing = run.representativeEvents.find((candidate) => candidate.type === event.type && candidate.targetId === event.targetId);
    if (existing) {
      if (existing.type === "rushed_bounce" && event.type === "rushed_bounce") {
        existing.aimSettleMs = Math.min(existing.aimSettleMs, event.aimSettleMs);
      } else if (existing.type === "range_expired" && event.type === "range_expired" && event.targetDistance > existing.targetDistance) {
        existing.targetDistance = event.targetDistance;
        existing.travelBudget = event.travelBudget;
        existing.bounceCount = event.bounceCount;
      }
      return;
    }
    if (run.representativeEvents.length < MAX_REPRESENTATIVE_EVENTS) run.representativeEvents.push(event);
  }
}
