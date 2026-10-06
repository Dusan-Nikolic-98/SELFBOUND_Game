import { CompletedRunSummary, isCompletedRunSummary } from "./ai-coach-contract.js";

export const MAX_TRAINING_PLAN_RUNS = 3;
export const MAX_TRAINING_PLAN_REQUEST_BYTES = 48 * 1024;
export const MAX_TRAINING_PLAN_OUTPUT_BYTES = 8 * 1024;
export const TRAINING_PLAN_FOCI = ["threat_management", "bounce_strategy", "aim_timing", "positioning", "range_management"] as const;
export const TRAINING_PLAN_METRICS = ["threat_offensive_rate", "blocked_direct_rate", "rushed_bounce_failure_rate", "repeated_same_position_rate", "range_expiry_rate"] as const;
export const TRAINING_PLAN_ASSESSMENTS = ["not_applicable", "improved", "not_improved", "insufficient_evidence"] as const;
export const PRIMARY_FOCUS_METRIC: Record<TrainingPlanFocus, TrainingPlanMetricId> = {
  threat_management: "threat_offensive_rate",
  bounce_strategy: "blocked_direct_rate",
  aim_timing: "rushed_bounce_failure_rate",
  positioning: "repeated_same_position_rate",
  range_management: "range_expiry_rate",
};

export type TrainingPlanFocus = (typeof TRAINING_PLAN_FOCI)[number];
export type TrainingPlanMetricId = (typeof TRAINING_PLAN_METRICS)[number];
export type TrainingPlanAssessment = (typeof TRAINING_PLAN_ASSESSMENTS)[number];
export type FocusMetric = { id: TrainingPlanMetricId; opportunities: number; undesirable: number };
export type TrainingPlanRunEntry = { sequence: number; summary: CompletedRunSummary };
export type TrainingPlanBaseline = { runSequences: number[]; maxSequence: number; primaryFocusMetric: { opportunities: number; undesirable: number } };
export type TrainingPlanDraft = {
  summary: string;
  previousAssessment: TrainingPlanAssessment;
  primaryFocus: TrainingPlanFocus;
  practiceGoal: string;
  evidence: TrainingPlanEvidence[];
  confidence: "low" | "medium" | "high";
};
export type TrainingPlanEvidence = {
  source: "recent_run_evidence" | "previous_plan_evaluation";
  metric: TrainingPlanMetricId;
  runSequences: number[];
  opportunities: number;
  undesirable: number;
};
export type TrainingPlan = TrainingPlanDraft & { completed: true };
export type PreviousTrainingPlanState = { plan: TrainingPlan; baseline: TrainingPlanBaseline };
export type TrainingPlanRequest = { runs: TrainingPlanRunEntry[]; previousPlan?: PreviousTrainingPlanState };
export type TrainingPlanSuccess = { plan: TrainingPlan; baseline: TrainingPlanBaseline };
export type TrainingPlanErrorCode = "invalid_request" | "regeneration_not_eligible" | "training_plan_unavailable";
export type TrainingPlanToolName = "get_recent_run_evidence" | "evaluate_previous_training_plan";
export type RecentRunEvidenceResult = {
  kind: "recent_run_evidence";
  runs: Array<{ sequence: number; outcome: "level_complete" | "game_over"; metrics: FocusMetric[] }>;
};
export type PreviousPlanEvaluationResult = {
  kind: "previous_plan_evaluation";
  assessment: Exclude<TrainingPlanAssessment, "not_applicable">;
  focus: TrainingPlanFocus;
  metricId: TrainingPlanMetricId;
  baseline: { opportunities: number; undesirable: number };
  newer: { runSequences: number[]; opportunities: number; undesirable: number };
};
export type TrainingPlanToolResult = RecentRunEvidenceResult | PreviousPlanEvaluationResult;
export type TrainingPlanProposal =
  | { kind: "tool_call"; tool: TrainingPlanToolName | string; arguments: unknown }
  | { kind: "final"; result: unknown };

const FOCUS_SET = new Set<string>(TRAINING_PLAN_FOCI);
const METRIC_SET = new Set<string>(TRAINING_PLAN_METRICS);
const ASSESSMENT_SET = new Set<string>(TRAINING_PLAN_ASSESSMENTS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) && Object.keys(value).every((key) => allowed.has(key));
}
function isSafeCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function isSequenceList(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_TRAINING_PLAN_RUNS) return false;
  let previous = 0;
  for (const sequence of value) {
    if (!Number.isSafeInteger(sequence) || sequence <= previous) return false;
    previous = sequence;
  }
  return true;
}
function isMetricCounts(value: unknown): value is { opportunities: number; undesirable: number } {
  return isRecord(value) && exactKeys(value, ["opportunities", "undesirable"])
    && isSafeCount(value.opportunities) && isSafeCount(value.undesirable) && value.undesirable <= value.opportunities;
}
function boundedText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}
function isEvidence(value: unknown): value is TrainingPlanEvidence {
  if (!isRecord(value) || !exactKeys(value, ["source", "metric", "runSequences", "opportunities", "undesirable"])) return false;
  if (value.source !== "recent_run_evidence" && value.source !== "previous_plan_evaluation") return false;
  return typeof value.metric === "string" && METRIC_SET.has(value.metric) && isSequenceList(value.runSequences)
    && isMetricCounts({ opportunities: value.opportunities, undesirable: value.undesirable });
}
function isDraft(value: unknown): value is TrainingPlanDraft {
  if (!isRecord(value) || !exactKeys(value, ["summary", "previousAssessment", "primaryFocus", "practiceGoal", "evidence", "confidence"])) return false;
  if (!boundedText(value.summary, 240) || !boundedText(value.practiceGoal, 240)) return false;
  if (typeof value.previousAssessment !== "string" || !ASSESSMENT_SET.has(value.previousAssessment)) return false;
  if (typeof value.primaryFocus !== "string" || !FOCUS_SET.has(value.primaryFocus)) return false;
  if (value.confidence !== "low" && value.confidence !== "medium" && value.confidence !== "high") return false;
  if (!Array.isArray(value.evidence) || value.evidence.length < 1 || value.evidence.length > 4 || !value.evidence.every(isEvidence)) return false;
  return value.evidence.every((item) => item.source !== "recent_run_evidence" || item.metric === PRIMARY_FOCUS_METRIC[value.primaryFocus as TrainingPlanFocus]);
}
function isTrainingPlan(value: unknown): value is TrainingPlan {
  if (!isRecord(value) || value.completed !== true) return false;
  const { completed: _completed, ...draft } = value;
  return isDraft(draft);
}
function isBaselineForFocus(value: unknown, focus: TrainingPlanFocus): value is TrainingPlanBaseline {
  if (!isRecord(value) || !exactKeys(value, ["runSequences", "maxSequence", "primaryFocusMetric"])) return false;
  return isSequenceList(value.runSequences) && value.runSequences.length <= MAX_TRAINING_PLAN_RUNS
    && Number.isSafeInteger(value.maxSequence) && value.maxSequence === value.runSequences[value.runSequences.length - 1]
    && isMetricCounts(value.primaryFocusMetric);
}
export function validateTrainingPlanBaseline(value: unknown, focus: TrainingPlanFocus): value is TrainingPlanBaseline {
  return FOCUS_SET.has(focus) && isBaselineForFocus(value, focus);
}
export function validatePreviousTrainingPlan(value: unknown): value is PreviousTrainingPlanState {
  if (!isRecord(value) || !exactKeys(value, ["plan", "baseline"]) || !isTrainingPlan(value.plan)) return false;
  if (!isBaselineForFocus(value.baseline, value.plan.primaryFocus)) return false;
  const saved = value.baseline as TrainingPlanBaseline;
  return value.plan.evidence.every((item) => item.runSequences.every((sequence) => saved.runSequences.includes(sequence)));
}
export function validateTrainingPlanRequest(value: unknown): value is TrainingPlanRequest {
  if (!isRecord(value) || !exactKeys(value, ["runs"], ["previousPlan"])) return false;
  if (!Array.isArray(value.runs) || value.runs.length < 1 || value.runs.length > MAX_TRAINING_PLAN_RUNS) return false;
  let previous = 0;
  for (const entry of value.runs) {
    if (!isRecord(entry) || !exactKeys(entry, ["sequence", "summary"]) || !Number.isSafeInteger(entry.sequence) || (entry.sequence as number) <= previous || !isCompletedRunSummary(entry.summary)) return false;
    previous = entry.sequence as number;
  }
  return !Object.prototype.hasOwnProperty.call(value, "previousPlan") || validatePreviousTrainingPlan(value.previousPlan);
}
export function trainingPlanRequestBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
export function validateTrainingPlanRequestSize(value: unknown): value is TrainingPlanRequest {
  return validateTrainingPlanRequest(value) && trainingPlanRequestBytes(value) <= MAX_TRAINING_PLAN_REQUEST_BYTES;
}
export function validateTrainingPlanDraft(value: unknown): value is TrainingPlanDraft {
  if (!isDraft(value)) return false;
  return new TextEncoder().encode(JSON.stringify(value)).byteLength <= MAX_TRAINING_PLAN_OUTPUT_BYTES;
}
export function validateTrainingPlanSuccess(value: unknown, request?: TrainingPlanRequest): value is TrainingPlanSuccess {
  if (!isRecord(value) || !exactKeys(value, ["plan", "baseline"]) || !isTrainingPlan(value.plan)
    || !isBaselineForFocus(value.baseline, value.plan.primaryFocus)) return false;
  const responseBaseline = value.baseline as TrainingPlanBaseline;
  if (!value.plan.evidence.every((item) => item.runSequences.every((sequence) => responseBaseline.runSequences.includes(sequence)))) return false;
  if (new TextEncoder().encode(JSON.stringify(value.plan)).byteLength > MAX_TRAINING_PLAN_OUTPUT_BYTES) return false;
  if (request) {
    const expected = request.runs.map((entry) => entry.sequence);
    if (expected.length !== responseBaseline.runSequences.length || expected.some((sequence, index) => sequence !== responseBaseline.runSequences[index])) return false;
    if (value.baseline.maxSequence !== expected[expected.length - 1]) return false;
  }
  return true;
}
export function validateTrainingPlanEvidenceResult(value: unknown, currentSequences?: readonly number[]): value is RecentRunEvidenceResult {
  if (!isRecord(value) || !exactKeys(value, ["kind", "runs"]) || value.kind !== "recent_run_evidence" || !Array.isArray(value.runs) || value.runs.length < 1 || value.runs.length > 3) return false;
  let previous = 0;
  for (const run of value.runs) {
    if (!isRecord(run) || !exactKeys(run, ["sequence", "outcome", "metrics"]) || !Number.isSafeInteger(run.sequence) || (run.sequence as number) <= previous) return false;
    previous = run.sequence as number;
    if (currentSequences && !currentSequences.includes(run.sequence as number)) return false;
    if (run.outcome !== "level_complete" && run.outcome !== "game_over") return false;
    if (!Array.isArray(run.metrics) || run.metrics.length !== TRAINING_PLAN_METRICS.length) return false;
    const metricIds = new Set<string>();
    for (const metric of run.metrics) {
      if (!isRecord(metric) || !exactKeys(metric, ["id", "opportunities", "undesirable"]) || typeof metric.id !== "string" || !METRIC_SET.has(metric.id) || metricIds.has(metric.id) || !isMetricCounts({ opportunities: metric.opportunities, undesirable: metric.undesirable })) return false;
      metricIds.add(metric.id);
    }
    if (metricIds.size !== TRAINING_PLAN_METRICS.length) return false;
  }
  return true;
}
export function validatePreviousPlanEvaluationResult(value: unknown): value is PreviousPlanEvaluationResult {
  if (!isRecord(value) || !exactKeys(value, ["kind", "assessment", "focus", "metricId", "baseline", "newer"]) || value.kind !== "previous_plan_evaluation") return false;
  if (value.assessment !== "improved" && value.assessment !== "not_improved" && value.assessment !== "insufficient_evidence") return false;
  if (typeof value.focus !== "string" || !FOCUS_SET.has(value.focus) || value.metricId !== PRIMARY_FOCUS_METRIC[value.focus as TrainingPlanFocus]) return false;
  if (!isMetricCounts(value.baseline) || !isRecord(value.newer) || !exactKeys(value.newer, ["runSequences", "opportunities", "undesirable"])) return false;
  return Array.isArray(value.newer.runSequences) && value.newer.runSequences.length <= 3
    && (value.newer.runSequences.length === 0 || isSequenceList(value.newer.runSequences))
    && isMetricCounts({ opportunities: value.newer.opportunities, undesirable: value.newer.undesirable });
}
export function validateToolArguments(tool: string, value: unknown, currentRunCount: number): boolean {
  if (!isRecord(value)) return false;
  if (tool === "get_recent_run_evidence") return exactKeys(value, ["limit"]) && (value.limit === 1 || value.limit === 2 || value.limit === 3) && value.limit <= currentRunCount;
  if (tool === "evaluate_previous_training_plan") return exactKeys(value, []);
  return false;
}

