export const MAX_COACH_RUNS = 3;
export const MAX_TARGET_SUMMARIES = 16;
export const MAX_REPRESENTATIVE_EVENTS = 8;
export const MAX_COACH_REQUEST_BYTES = 32 * 1024;
export const MAX_VISIBLE_ADVICE_CHARS = 1200;

export const COACHING_CATEGORIES = [
  "threat_management",
  "bounce_strategy",
  "aim_timing",
  "positioning",
  "range_management",
  "general",
] as const;

export type CoachingCategory = (typeof COACHING_CATEGORIES)[number];
export type CompletedRunOutcome = "level_complete" | "game_over";

export type TargetRunSummary = {
  targetId: string;
  attempts: number;
  captures: number;
  failedShots: number;
  blockedDirectAttempts: number;
  bouncedAttempts: number;
  rushedBouncedFailures: number;
  samePositionFailures: number;
  rangeExpirations: number;
};

export type CoachingEvent =
  | { type: "ignored_threat"; targetId: string; aimedAtTarget: boolean }
  | { type: "blocked_direct"; targetId: string; attemptCount: number }
  | { type: "rushed_bounce"; targetId: string; aimSettleMs: number }
  | { type: "same_position"; targetId: string; attemptCount: number; movementDistance: number }
  | { type: "range_expired"; targetId: string; targetDistance: number; travelBudget: number; bounceCount: number };

export type CompletedRunSummary = {
  outcome: CompletedRunOutcome;
  durationMs: number;
  livesLost: number;
  shotsFired: number;
  failedShots: number;
  captures: number;
  greenThreatsCreated: number;
  greenThreatHits: number;
  shotsWhileThreatActive: number;
  defensiveShots: number;
  successfulDefensiveShots: number;
  shotsAimedAtThreat: number;
  shotsAimedAtCurrentTargetWhileThreatActive: number;
  offensiveShotsWhileThreatActive: number;
  blockedDirectAttempts: number;
  bouncedAttempts: number;
  successfulBounceCaptures: number;
  rushedBouncedFailures: number;
  repeatedSamePositionFailures: number;
  rangeExpiredShots: number;
  targetStats: TargetRunSummary[];
  representativeEvents: CoachingEvent[];
};

export type AiCoachRequest = { runs: CompletedRunSummary[] };

export type AiCoachAdvice = {
  summary: string;
  primaryCategory: CoachingCategory;
  primaryAdvice: string;
  secondaryAdvice?: string;
  practiceGoal: string;
};

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

function isTargetSummary(value: unknown): value is TargetRunSummary {
  if (!isRecord(value)) return false;
  const fields = ["targetId", "attempts", "captures", "failedShots", "blockedDirectAttempts", "bouncedAttempts", "rushedBouncedFailures", "samePositionFailures", "rangeExpirations"] as const;
  if (!hasOnlyKeys(value, fields) || fields.some((field) => !(field in value))) return false;
  if (typeof value.targetId !== "string" || value.targetId.trim().length < 1 || value.targetId.length > 64) return false;
  const counts = fields.slice(1).map((field) => value[field]);
  if (!counts.every(isCount)) return false;
  return (value.captures as number) + (value.failedShots as number) <= (value.attempts as number)
    && (value.blockedDirectAttempts as number) <= (value.attempts as number)
    && (value.bouncedAttempts as number) <= (value.attempts as number)
    && (value.rushedBouncedFailures as number) <= (value.failedShots as number)
    && (value.samePositionFailures as number) <= (value.failedShots as number)
    && (value.rangeExpirations as number) <= (value.failedShots as number);
}

function isCoachingEvent(value: unknown): value is CoachingEvent {
  if (!isRecord(value) || typeof value.type !== "string" || typeof value.targetId !== "string" || value.targetId.trim().length < 1 || value.targetId.length > 64) return false;
  switch (value.type) {
    case "ignored_threat":
      return hasOnlyKeys(value, ["type", "targetId", "aimedAtTarget"]) && typeof value.aimedAtTarget === "boolean";
    case "blocked_direct":
      return hasOnlyKeys(value, ["type", "targetId", "attemptCount"]) && isCount(value.attemptCount) && value.attemptCount >= 1;
    case "rushed_bounce":
      return hasOnlyKeys(value, ["type", "targetId", "aimSettleMs"]) && isMetric(value.aimSettleMs);
    case "same_position":
      return hasOnlyKeys(value, ["type", "targetId", "attemptCount", "movementDistance"]) && isCount(value.attemptCount) && value.attemptCount >= 3 && isMetric(value.movementDistance);
    case "range_expired":
      return hasOnlyKeys(value, ["type", "targetId", "targetDistance", "travelBudget", "bounceCount"]) && isMetric(value.targetDistance) && isMetric(value.travelBudget) && isCount(value.bounceCount) && value.bounceCount <= 3;
    default:
      return false;
  }
}

const RUN_COUNT_FIELDS = [
  "livesLost", "shotsFired", "failedShots", "captures", "greenThreatsCreated", "greenThreatHits",
  "shotsWhileThreatActive", "defensiveShots", "successfulDefensiveShots", "shotsAimedAtThreat",
  "shotsAimedAtCurrentTargetWhileThreatActive", "offensiveShotsWhileThreatActive",
  "blockedDirectAttempts", "bouncedAttempts", "successfulBounceCaptures", "rushedBouncedFailures",
  "repeatedSamePositionFailures", "rangeExpiredShots",
] as const;

export function isCompletedRunSummary(value: unknown): value is CompletedRunSummary {
  if (!isRecord(value)) return false;
  const keys = ["outcome", "durationMs", ...RUN_COUNT_FIELDS, "targetStats", "representativeEvents"];
  if (!hasOnlyKeys(value, keys) || keys.some((key) => !(key in value))) return false;
  if (value.outcome !== "level_complete" && value.outcome !== "game_over") return false;
  if (!isMetric(value.durationMs) || !RUN_COUNT_FIELDS.every((key) => isCount(value[key]))) return false;
  if (!Array.isArray(value.targetStats) || value.targetStats.length > MAX_TARGET_SUMMARIES || !value.targetStats.every(isTargetSummary)) return false;
  if (new Set(value.targetStats.map((target) => target.targetId)).size !== value.targetStats.length) return false;
  if (!Array.isArray(value.representativeEvents) || value.representativeEvents.length > MAX_REPRESENTATIVE_EVENTS || !value.representativeEvents.every(isCoachingEvent)) return false;
  if ((value.failedShots as number) + (value.captures as number) > (value.shotsFired as number)) return false;
  if ((value.greenThreatHits as number) > (value.livesLost as number)
    || (value.blockedDirectAttempts as number) > (value.shotsFired as number)
    || (value.bouncedAttempts as number) > (value.shotsFired as number)
    || (value.successfulBounceCaptures as number) > (value.captures as number)
    || (value.rushedBouncedFailures as number) > Math.min(value.failedShots as number, value.bouncedAttempts as number)
    || (value.rangeExpiredShots as number) > (value.failedShots as number)) return false;
  if ((value.successfulDefensiveShots as number) > (value.defensiveShots as number)
    || (value.defensiveShots as number) > (value.shotsWhileThreatActive as number)
    || (value.shotsAimedAtThreat as number) > (value.shotsWhileThreatActive as number)
    || (value.shotsAimedAtCurrentTargetWhileThreatActive as number) > (value.shotsWhileThreatActive as number)
    || (value.offensiveShotsWhileThreatActive as number) > (value.shotsAimedAtCurrentTargetWhileThreatActive as number)) return false;
  return true;
}

export function validateAiCoachRequest(value: unknown): value is AiCoachRequest {
  return isRecord(value) && hasOnlyKeys(value, ["runs"]) && Array.isArray(value.runs) && value.runs.length >= 1 && value.runs.length <= MAX_COACH_RUNS && value.runs.every(isCompletedRunSummary);
}

export function validateAiCoachAdvice(value: unknown): value is AiCoachAdvice {
  if (!isRecord(value) || !hasOnlyKeys(value, ["summary", "primaryCategory", "primaryAdvice", "secondaryAdvice", "practiceGoal"])) return false;
  const boundedText = (text: unknown, max: number): text is string => typeof text === "string" && text.trim().length > 0 && text.length <= max;
  if (!boundedText(value.summary, 240) || !COACHING_CATEGORIES.includes(value.primaryCategory as CoachingCategory)) return false;
  if (!boundedText(value.primaryAdvice, 500) || !boundedText(value.practiceGoal, 180)) return false;
  if ("secondaryAdvice" in value && !boundedText(value.secondaryAdvice, 300)) return false;
  const visibleSize = (value.summary as string).length + (value.primaryAdvice as string).length + (value.practiceGoal as string).length + (typeof value.secondaryAdvice === "string" ? value.secondaryAdvice.length : 0);
  return visibleSize <= MAX_VISIBLE_ADVICE_CHARS;
}

export function validateAiCoachResponse(value: unknown): value is AiCoachResponse {
  return isRecord(value) && hasOnlyKeys(value, ["advice"]) && "advice" in value && validateAiCoachAdvice(value.advice);
}
