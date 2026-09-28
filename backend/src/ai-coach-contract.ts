export const MAX_COACH_RUNS = 3;
export const MAX_TARGET_SUMMARIES = 16;
export const MAX_REPRESENTATIVE_EVENTS = 8;
export const MAX_COACH_REQUEST_BYTES = 32 * 1024;
export const MAX_VISIBLE_ADVICE_CHARS = 1200;

export const COACHING_CATEGORIES = ["threat_management", "bounce_strategy", "aim_timing", "positioning", "range_management", "general"] as const;
export type CoachingCategory = (typeof COACHING_CATEGORIES)[number];
export type CompletedRunOutcome = "level_complete" | "game_over";

export type TargetRunSummary = {
  targetId: string; attempts: number; captures: number; failedShots: number;
  blockedDirectAttempts: number; bouncedAttempts: number; rushedBouncedFailures: number;
  samePositionFailures: number; rangeExpirations: number;
};

export type CoachingEvent =
  | { type: "ignored_threat"; targetId: string; aimedAtTarget: boolean }
  | { type: "blocked_direct"; targetId: string; attemptCount: number }
  | { type: "rushed_bounce"; targetId: string; aimSettleMs: number }
  | { type: "same_position"; targetId: string; attemptCount: number; movementDistance: number }
  | { type: "range_expired"; targetId: string; targetDistance: number; travelBudget: number; bounceCount: number };

export type CompletedRunSummary = {
  outcome: CompletedRunOutcome; durationMs: number; livesLost: number; shotsFired: number;
  failedShots: number; captures: number; greenThreatsCreated: number; greenThreatHits: number;
  shotsWhileThreatActive: number; defensiveShots: number; successfulDefensiveShots: number;
  shotsAimedAtThreat: number; shotsAimedAtCurrentTargetWhileThreatActive: number;
  offensiveShotsWhileThreatActive: number; blockedDirectAttempts: number; bouncedAttempts: number;
  successfulBounceCaptures: number; rushedBouncedFailures: number; repeatedSamePositionFailures: number;
  rangeExpiredShots: number; targetStats: TargetRunSummary[]; representativeEvents: CoachingEvent[];
};

export type AiCoachRequest = { runs: CompletedRunSummary[] };
export type AiCoachAdvice = { summary: string; primaryCategory: CoachingCategory; primaryAdvice: string; secondaryAdvice?: string; practiceGoal: string };
export type AiCoachResponse = { advice: AiCoachAdvice };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isMetric(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000;
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 64;
}

function isTarget(value: unknown): value is TargetRunSummary {
  if (!isRecord(value)) return false;
  const keys = ["targetId", "attempts", "captures", "failedShots", "blockedDirectAttempts", "bouncedAttempts", "rushedBouncedFailures", "samePositionFailures", "rangeExpirations"];
  if (!hasOnlyKeys(value, keys) || keys.some((key) => !(key in value)) || !isId(value.targetId)) return false;
  const counts = keys.slice(1).map((key) => value[key]);
  return counts.every(isCount)
    && (value.captures as number) + (value.failedShots as number) <= (value.attempts as number)
    && (value.blockedDirectAttempts as number) <= (value.attempts as number)
    && (value.bouncedAttempts as number) <= (value.attempts as number)
    && (value.rushedBouncedFailures as number) <= (value.failedShots as number)
    && (value.samePositionFailures as number) <= (value.failedShots as number)
    && (value.rangeExpirations as number) <= (value.failedShots as number);
}

function isEvent(value: unknown): value is CoachingEvent {
  if (!isRecord(value) || !isId(value.targetId) || typeof value.type !== "string") return false;
  switch (value.type) {
    case "ignored_threat": return hasOnlyKeys(value, ["type", "targetId", "aimedAtTarget"]) && typeof value.aimedAtTarget === "boolean";
    case "blocked_direct": return hasOnlyKeys(value, ["type", "targetId", "attemptCount"]) && isCount(value.attemptCount) && value.attemptCount >= 1;
    case "rushed_bounce": return hasOnlyKeys(value, ["type", "targetId", "aimSettleMs"]) && isMetric(value.aimSettleMs);
    case "same_position": return hasOnlyKeys(value, ["type", "targetId", "attemptCount", "movementDistance"]) && isCount(value.attemptCount) && value.attemptCount >= 3 && isMetric(value.movementDistance);
    case "range_expired": return hasOnlyKeys(value, ["type", "targetId", "targetDistance", "travelBudget", "bounceCount"]) && isMetric(value.targetDistance) && isMetric(value.travelBudget) && isCount(value.bounceCount) && value.bounceCount <= 3;
    default: return false;
  }
}

const COUNT_FIELDS = ["livesLost", "shotsFired", "failedShots", "captures", "greenThreatsCreated", "greenThreatHits", "shotsWhileThreatActive", "defensiveShots", "successfulDefensiveShots", "shotsAimedAtThreat", "shotsAimedAtCurrentTargetWhileThreatActive", "offensiveShotsWhileThreatActive", "blockedDirectAttempts", "bouncedAttempts", "successfulBounceCaptures", "rushedBouncedFailures", "repeatedSamePositionFailures", "rangeExpiredShots"] as const;

export function isCompletedRunSummary(value: unknown): value is CompletedRunSummary {
  if (!isRecord(value)) return false;
  const keys = ["outcome", "durationMs", ...COUNT_FIELDS, "targetStats", "representativeEvents"];
  if (!hasOnlyKeys(value, keys) || keys.some((key) => !(key in value))) return false;
  if (value.outcome !== "level_complete" && value.outcome !== "game_over") return false;
  if (!isMetric(value.durationMs) || !COUNT_FIELDS.every((key) => isCount(value[key]))) return false;
  if (!Array.isArray(value.targetStats) || value.targetStats.length > MAX_TARGET_SUMMARIES || !value.targetStats.every(isTarget)) return false;
  if (new Set(value.targetStats.map((target) => target.targetId)).size !== value.targetStats.length) return false;
  if (!Array.isArray(value.representativeEvents) || value.representativeEvents.length > MAX_REPRESENTATIVE_EVENTS || !value.representativeEvents.every(isEvent)) return false;
  return (value.failedShots as number) + (value.captures as number) <= (value.shotsFired as number)
    && (value.greenThreatHits as number) <= (value.livesLost as number)
    && (value.blockedDirectAttempts as number) <= (value.shotsFired as number)
    && (value.bouncedAttempts as number) <= (value.shotsFired as number)
    && (value.successfulBounceCaptures as number) <= (value.captures as number)
    && (value.rushedBouncedFailures as number) <= Math.min(value.failedShots as number, value.bouncedAttempts as number)
    && (value.rangeExpiredShots as number) <= (value.failedShots as number)
    && (value.successfulDefensiveShots as number) <= (value.defensiveShots as number)
    && (value.defensiveShots as number) <= (value.shotsWhileThreatActive as number)
    && (value.shotsAimedAtThreat as number) <= (value.shotsWhileThreatActive as number)
    && (value.shotsAimedAtCurrentTargetWhileThreatActive as number) <= (value.shotsWhileThreatActive as number)
    && (value.offensiveShotsWhileThreatActive as number) <= (value.shotsAimedAtCurrentTargetWhileThreatActive as number);
}

export function validateAiCoachRequest(value: unknown): value is AiCoachRequest {
  return isRecord(value) && hasOnlyKeys(value, ["runs"]) && Array.isArray(value.runs) && value.runs.length >= 1 && value.runs.length <= MAX_COACH_RUNS && value.runs.every(isCompletedRunSummary);
}

export function validateAiCoachAdvice(value: unknown): value is AiCoachAdvice {
  if (!isRecord(value) || !hasOnlyKeys(value, ["summary", "primaryCategory", "primaryAdvice", "secondaryAdvice", "practiceGoal"])) return false;
  const text = (input: unknown, max: number): input is string => typeof input === "string" && input.trim().length > 0 && input.length <= max;
  if (!text(value.summary, 240) || !COACHING_CATEGORIES.includes(value.primaryCategory as CoachingCategory)) return false;
  if (!text(value.primaryAdvice, 500) || !text(value.practiceGoal, 180)) return false;
  if ("secondaryAdvice" in value && !text(value.secondaryAdvice, 300)) return false;
  const length = (value.summary as string).length + (value.primaryAdvice as string).length + (value.practiceGoal as string).length + (typeof value.secondaryAdvice === "string" ? value.secondaryAdvice.length : 0);
  return length <= MAX_VISIBLE_ADVICE_CHARS;
}

export function validateAiCoachResponse(value: unknown): value is AiCoachResponse {
  return isRecord(value) && hasOnlyKeys(value, ["advice"]) && "advice" in value && validateAiCoachAdvice(value.advice);
}
