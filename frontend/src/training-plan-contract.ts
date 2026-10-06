import { CompletedRunSummary, isCompletedRunSummary } from "./ai-coach-contract.js";

export const MAX_TRAINING_PLAN_RUNS = 3;
export const MAX_TRAINING_PLAN_REQUEST_BYTES = 48 * 1024;
export const MAX_TRAINING_PLAN_OUTPUT_BYTES = 8 * 1024;
export const TRAINING_PLAN_FOCI = ["threat_management", "bounce_strategy", "aim_timing", "positioning", "range_management"] as const;
export const TRAINING_PLAN_METRICS = ["threat_offensive_rate", "blocked_direct_rate", "rushed_bounce_failure_rate", "repeated_same_position_rate", "range_expiry_rate"] as const;
export const TRAINING_PLAN_ASSESSMENTS = ["not_applicable", "improved", "not_improved", "insufficient_evidence"] as const;

export type TrainingPlanFocus = (typeof TRAINING_PLAN_FOCI)[number];
export type TrainingPlanMetricId = (typeof TRAINING_PLAN_METRICS)[number];
export type TrainingPlanAssessment = (typeof TRAINING_PLAN_ASSESSMENTS)[number];
export type TrainingPlanEvidence = {
  source: "recent_run_evidence" | "previous_plan_evaluation";
  metric: TrainingPlanMetricId;
  runSequences: number[];
  opportunities: number;
  undesirable: number;
};
export type TrainingPlanDraft = {
  summary: string;
  previousAssessment: TrainingPlanAssessment;
  primaryFocus: TrainingPlanFocus;
  practiceGoal: string;
  evidence: TrainingPlanEvidence[];
  confidence: "low" | "medium" | "high";
};
export type TrainingPlan = TrainingPlanDraft & { completed: true };
export type TrainingPlanBaseline = { runSequences: number[]; maxSequence: number; primaryFocusMetric: { opportunities: number; undesirable: number } };
export type PreviousTrainingPlanState = { plan: TrainingPlan; baseline: TrainingPlanBaseline };
export type TrainingPlanRunEntry = { sequence: number; summary: CompletedRunSummary };
export type TrainingPlanRequest = { runs: TrainingPlanRunEntry[]; previousPlan?: PreviousTrainingPlanState };
export type TrainingPlanSuccess = { plan: TrainingPlan; baseline: TrainingPlanBaseline };
export type TrainingPlanErrorCode = "invalid_request" | "regeneration_not_eligible" | "training_plan_unavailable";
export type FocusMetric = { id: TrainingPlanMetricId; opportunities: number; undesirable: number };

export const PRIMARY_FOCUS_METRIC: Record<TrainingPlanFocus, TrainingPlanMetricId> = {
  threat_management: "threat_offensive_rate",
  bounce_strategy: "blocked_direct_rate",
  aim_timing: "rushed_bounce_failure_rate",
  positioning: "repeated_same_position_rate",
  range_management: "range_expiry_rate",
};
const foci = new Set<string>(TRAINING_PLAN_FOCI);
const metrics = new Set<string>(TRAINING_PLAN_METRICS);
const assessments = new Set<string>(TRAINING_PLAN_ASSESSMENTS);

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function exact(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) && Object.keys(value).every((key) => allowed.has(key));
}
function count(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function sequences(value: unknown, allowEmpty = false): value is number[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length < 1) || value.length > MAX_TRAINING_PLAN_RUNS) return false;
  let last = 0;
  for (const sequence of value) { if (!Number.isSafeInteger(sequence) || sequence <= last) return false; last = sequence; }
  return true;
}
function counts(value: unknown): value is { opportunities: number; undesirable: number } {
  return isRecord(value) && exact(value, ["opportunities", "undesirable"]) && count(value.opportunities) && count(value.undesirable) && value.undesirable <= value.opportunities;
}
function evidence(value: unknown): value is TrainingPlanEvidence {
  return isRecord(value) && exact(value, ["source", "metric", "runSequences", "opportunities", "undesirable"])
    && (value.source === "recent_run_evidence" || value.source === "previous_plan_evaluation")
    && typeof value.metric === "string" && metrics.has(value.metric) && sequences(value.runSequences)
    && counts({ opportunities: value.opportunities, undesirable: value.undesirable });
}
function draft(value: unknown): value is TrainingPlanDraft {
  if (!isRecord(value) || !exact(value, ["summary", "previousAssessment", "primaryFocus", "practiceGoal", "evidence", "confidence"])) return false;
  if (typeof value.summary !== "string" || value.summary.trim().length < 1 || value.summary.length > 240
    || typeof value.practiceGoal !== "string" || value.practiceGoal.trim().length < 1 || value.practiceGoal.length > 240) return false;
  if (typeof value.previousAssessment !== "string" || !assessments.has(value.previousAssessment)
    || typeof value.primaryFocus !== "string" || !foci.has(value.primaryFocus)) return false;
  if (value.confidence !== "low" && value.confidence !== "medium" && value.confidence !== "high") return false;
  if (!Array.isArray(value.evidence) || value.evidence.length < 1 || value.evidence.length > 4 || !value.evidence.every(evidence)) return false;
  return value.evidence.every((item) => item.source !== "recent_run_evidence" || item.metric === PRIMARY_FOCUS_METRIC[value.primaryFocus as TrainingPlanFocus]);
}
function plan(value: unknown): value is TrainingPlan {
  if (!isRecord(value) || value.completed !== true) return false;
  const copy: Record<string, unknown> = { ...value };
  delete copy.completed;
  return draft(copy);
}
function baseline(value: unknown, focus: TrainingPlanFocus): value is TrainingPlanBaseline {
  return isRecord(value) && exact(value, ["runSequences", "maxSequence", "primaryFocusMetric"])
    && sequences(value.runSequences) && Number.isSafeInteger(value.maxSequence)
    && value.maxSequence === value.runSequences[value.runSequences.length - 1] && counts(value.primaryFocusMetric)
    && Object.prototype.hasOwnProperty.call(PRIMARY_FOCUS_METRIC, focus);
}
export function validateTrainingPlanBaseline(value: unknown, focus: TrainingPlanFocus): value is TrainingPlanBaseline { return foci.has(focus) && baseline(value, focus); }
export function validatePreviousTrainingPlan(value: unknown): value is PreviousTrainingPlanState {
  if (!isRecord(value) || !exact(value, ["plan", "baseline"]) || !plan(value.plan) || !baseline(value.baseline, value.plan.primaryFocus)) return false;
  const saved = value.baseline as TrainingPlanBaseline;
  return value.plan.evidence.every((item) => item.runSequences.every((sequence) => saved.runSequences.includes(sequence)));
}
export function validateTrainingPlanRequest(value: unknown): value is TrainingPlanRequest {
  if (!isRecord(value) || !exact(value, ["runs"], ["previousPlan"]) || !Array.isArray(value.runs) || value.runs.length < 1 || value.runs.length > MAX_TRAINING_PLAN_RUNS) return false;
  let last = 0;
  for (const item of value.runs) {
    if (!isRecord(item) || !exact(item, ["sequence", "summary"]) || !Number.isSafeInteger(item.sequence) || (item.sequence as number) <= last || !isCompletedRunSummary(item.summary)) return false;
    last = item.sequence as number;
  }
  return !Object.prototype.hasOwnProperty.call(value, "previousPlan") || validatePreviousTrainingPlan(value.previousPlan);
}
export function trainingPlanRequestBytes(value: unknown): number { return new TextEncoder().encode(JSON.stringify(value)).byteLength; }
export function validateTrainingPlanRequestSize(value: unknown): value is TrainingPlanRequest {
  return validateTrainingPlanRequest(value) && trainingPlanRequestBytes(value) <= MAX_TRAINING_PLAN_REQUEST_BYTES;
}
export function validateTrainingPlanDraft(value: unknown): value is TrainingPlanDraft {
  return draft(value) && new TextEncoder().encode(JSON.stringify(value)).byteLength <= MAX_TRAINING_PLAN_OUTPUT_BYTES;
}
export function validateTrainingPlanSuccess(value: unknown, request?: TrainingPlanRequest): value is TrainingPlanSuccess {
  if (!isRecord(value) || !exact(value, ["plan", "baseline"]) || !plan(value.plan) || !baseline(value.baseline, value.plan.primaryFocus)) return false;
  const responseBaseline = value.baseline as TrainingPlanBaseline;
  if (!value.plan.evidence.every((item) => item.runSequences.every((sequence) => responseBaseline.runSequences.includes(sequence)))) return false;
  if (new TextEncoder().encode(JSON.stringify(value.plan)).byteLength > MAX_TRAINING_PLAN_OUTPUT_BYTES) return false;
  if (request) {
    const expected = request.runs.map((run) => run.sequence);
    if (expected.length !== responseBaseline.runSequences.length || expected.some((seq, index) => seq !== responseBaseline.runSequences[index])) return false;
  }
  return true;
}

