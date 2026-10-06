import {
  PreviousPlanEvaluationResult,
  RecentRunEvidenceResult,
  TrainingPlanRequest,
  TrainingPlanToolName,
  TrainingPlanToolResult,
  validatePreviousPlanEvaluationResult,
  validateToolArguments,
  validateTrainingPlanEvidenceResult,
} from "./training-plan-contract.js";
import { evaluatePreviousPlan, normalizedMetricsForRun } from "./training-plan-evaluator.js";

export const CORE_TRAINING_PLAN_TOOLS = ["get_recent_run_evidence", "evaluate_previous_training_plan"] as const satisfies readonly TrainingPlanToolName[];

export type ToolActionContext = {
  request: TrainingPlanRequest;
  newerSequences: number[];
};
export type TrainingPlanToolHandlers = {
  get_recent_run_evidence: (context: ToolActionContext, args: { limit: 1 | 2 | 3 }) => unknown;
  evaluate_previous_training_plan: (context: ToolActionContext, args: Record<string, never>) => unknown;
};

function cloneRequest(request: TrainingPlanRequest): TrainingPlanRequest {
  const runs = request.runs.map((entry) => ({
    sequence: entry.sequence,
    summary: {
      ...entry.summary,
      targetStats: entry.summary.targetStats.map((target) => ({ ...target })),
      representativeEvents: entry.summary.representativeEvents.map((event) => ({ ...event })) as TrainingPlanRequest["runs"][number]["summary"]["representativeEvents"],
    },
  }));
  const previousPlan = request.previousPlan ? {
    plan: { ...request.previousPlan.plan, evidence: request.previousPlan.plan.evidence.map((item) => ({ ...item, runSequences: [...item.runSequences] })) },
    baseline: { ...request.previousPlan.baseline, runSequences: [...request.previousPlan.baseline.runSequences], primaryFocusMetric: { ...request.previousPlan.baseline.primaryFocusMetric } },
  } : undefined;
  return { runs, ...(previousPlan ? { previousPlan } : {}) };
}
function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}
function equalJson(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => equalJson(value, right[index]));
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) return false;
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
  const aKeys = Object.keys(a).sort(), bKeys = Object.keys(b).sort();
  return aKeys.length === bKeys.length && aKeys.every((key, index) => key === bKeys[index] && equalJson(a[key], b[key]));
}

const defaultHandlers: TrainingPlanToolHandlers = {
  get_recent_run_evidence(context, args) {
    const bounded = cloneRequest(context.request);
    const selected = bounded.runs.slice(-args.limit);
    const result: RecentRunEvidenceResult = {
      kind: "recent_run_evidence",
      runs: selected.map((entry) => ({ sequence: entry.sequence, outcome: entry.summary.outcome, metrics: normalizedMetricsForRun(entry) })),
    };
    return result;
  },
  evaluate_previous_training_plan(context) {
    const bounded = cloneRequest(context.request);
    return bounded.previousPlan ? evaluatePreviousPlan(bounded.previousPlan, bounded.runs) : null;
  },
};

/** Closed Core registry: these are the only handlers the W05 orchestrator can dispatch. */
export class TrainingPlanToolRegistry {
  readonly names = CORE_TRAINING_PLAN_TOOLS;
  readonly context: ToolActionContext;
  private readonly handlers: TrainingPlanToolHandlers;
  private readonly dispatched: TrainingPlanToolName[] = [];

  constructor(request: TrainingPlanRequest, handlers: TrainingPlanToolHandlers = defaultHandlers) {
    const newerSequences = request.previousPlan
      ? request.runs.filter((entry) => entry.sequence > request.previousPlan!.baseline.maxSequence).map((entry) => entry.sequence)
      : [];
    this.context = deepFreeze({ request: cloneRequest(request), newerSequences });
    this.handlers = handlers;
  }

  get dispatchedTools(): readonly TrainingPlanToolName[] { return [...this.dispatched]; }

  isAvailable(tool: string): tool is TrainingPlanToolName {
    if (tool === "get_recent_run_evidence") return true;
    return tool === "evaluate_previous_training_plan" && Boolean(this.context.request.previousPlan) && this.context.newerSequences.length > 0;
  }

  validateArguments(tool: string, args: unknown): boolean {
    return this.isAvailable(tool) && validateToolArguments(tool, args, this.context.request.runs.length);
  }

  stateVersion(tool: TrainingPlanToolName): string {
    if (tool === "get_recent_run_evidence") return this.context.request.runs.map((entry) => entry.sequence).join(",");
    const previous = this.context.request.previousPlan;
    if (!previous) return "unavailable";
    return `${previous.baseline.maxSequence}|${this.context.newerSequences.join(",")}|${previous.plan.primaryFocus}`;
  }

  actionIdentity(tool: TrainingPlanToolName, args: unknown): string {
    // Arguments have passed exact-key validation before callers request this identity.
    return `${tool}|${JSON.stringify(args)}|${this.stateVersion(tool)}`;
  }

  dispatch(tool: TrainingPlanToolName, args: unknown, onDispatch: () => void = () => undefined): unknown {
    if (!this.validateArguments(tool, args)) throw new Error("invalid_tool_arguments");
    this.dispatched.push(tool);
    onDispatch();
    let result: unknown;
    if (tool === "get_recent_run_evidence") {
      result = this.handlers.get_recent_run_evidence(this.context, args as { limit: 1 | 2 | 3 });
    } else {
      result = this.handlers.evaluate_previous_training_plan(this.context, args as Record<string, never>);
    }
    return result;
  }

  validateOutput(tool: TrainingPlanToolName, result: unknown): result is TrainingPlanToolResult {
    if (tool === "get_recent_run_evidence") {
      if (!validateTrainingPlanEvidenceResult(result, this.context.request.runs.map((entry) => entry.sequence))) return false;
      const expectedRuns = this.context.request.runs.slice(-((result as RecentRunEvidenceResult).runs.length));
      const expected = {
        kind: "recent_run_evidence",
        runs: expectedRuns.map((entry) => ({ sequence: entry.sequence, outcome: entry.summary.outcome, metrics: normalizedMetricsForRun(entry) })),
      };
      return equalJson(result, expected);
    }
    if (!validatePreviousPlanEvaluationResult(result)) return false;
    const previous = this.context.request.previousPlan;
    if (!previous) return false;
    const expected: PreviousPlanEvaluationResult | null = evaluatePreviousPlan(previous, this.context.request.runs);
    return expected !== null && equalJson(result, expected);
  }
}

