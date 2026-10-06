import { performance } from "node:perf_hooks";
import {
  CORE_TRAINING_PLAN_TOOLS,
  TrainingPlanToolRegistry,
} from "./training-plan-tools.js";
import {
  MAX_TRAINING_PLAN_OUTPUT_BYTES,
  PRIMARY_FOCUS_METRIC,
  RecentRunEvidenceResult,
  TrainingPlanDraft,
  TrainingPlanRequest,
  TrainingPlanSuccess,
  TrainingPlanToolName,
  TrainingPlanToolResult,
  validatePreviousPlanEvaluationResult,
  validateTrainingPlanDraft,
  validateTrainingPlanRequestSize,
  validateTrainingPlanSuccess,
  validateToolArguments,
} from "./training-plan-contract.js";
import { computeTrainingPlanBaseline } from "./training-plan-evaluator.js";
import { createTrainingPlanModelStepInput, TrainingPlanModelStepInput } from "./training-plan-prompt.js";
import { TrainingPlanModelStepProvider, TrainingPlanProviderFailure, TrainingPlanProviderFailureKind } from "./training-plan-provider.js";

export const MAX_AGENT_STEPS = 3;
export const MAX_TOOL_CALLS = 2;
export const MAX_PROVIDER_ATTEMPTS = 4;
export const MAX_PROVIDER_ATTEMPT_MS = 15_000;
export const MAX_AGENT_RUN_MS = 45_000;
export const MAX_RETRY_BACKOFF_MS = 500;

export type TrainingPlanTerminalReason =
  | "goal_completed" | "invalid_input" | "invalid_model_proposal" | "unknown_tool"
  | "invalid_tool_arguments" | "invalid_tool_result" | "provider_failed" | "provider_timeout"
  | "tool_failed" | "step_limit" | "tool_call_limit" | "provider_attempt_limit"
  | "deadline" | "repeated_action" | "invalid_final_result" | "cancelled";
export type TrainingPlanCounters = { agentSteps: number; toolCalls: number; providerAttempts: number };
export type TrainingPlanRunResult = {
  ok: boolean;
  terminal: TrainingPlanTerminalReason;
  result?: TrainingPlanSuccess;
  counters: TrainingPlanCounters;
};
export type TrainingPlanLogRecord = Record<string, string | number | boolean>;
export type TrainingPlanOrchestratorOptions = {
  now?: () => number;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
  sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  retryBackoffMs?: number;
  runIdFactory?: () => string;
  logger?: (record: TrainingPlanLogRecord) => void;
  toolRegistryFactory?: (request: TrainingPlanRequest) => TrainingPlanToolRegistry;
};

let nextRunId = 1;
const ALLOWLIST = new Set<string>(CORE_TRAINING_PLAN_TOOLS);

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function validProposal(value: unknown): { kind: "tool_call"; tool: string; arguments: unknown } | { kind: "final"; result: unknown } | null {
  if (!isRecord(value) || typeof value.kind !== "string") return null;
  if (value.kind === "tool_call") {
    if (Object.keys(value).sort().join("|") !== "arguments|kind|tool" || typeof value.tool !== "string" || !("arguments" in value)) return null;
    return { kind: "tool_call", tool: value.tool, arguments: value.arguments };
  }
  if (value.kind === "final") {
    if (Object.keys(value).sort().join("|") !== "kind|result" || !("result" in value)) return null;
    return { kind: "final", result: value.result };
  }
  return null;
}
function proposalWithinLimit(value: unknown): boolean {
  try {
    const text = JSON.stringify(value);
    return typeof text === "string" && new TextEncoder().encode(text).byteLength <= MAX_TRAINING_PLAN_OUTPUT_BYTES;
  } catch { return false; }
}
function transient(kind: TrainingPlanProviderFailureKind): boolean {
  return kind === "transient_network" || kind === "rate_limit" || kind === "temporary_service";
}
function classifyFailure(error: unknown): TrainingPlanProviderFailureKind {
  return error instanceof TrainingPlanProviderFailure ? error.kind : "permanent";
}
function sleepAbortable(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new TrainingPlanProviderFailure("cancelled"));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, milliseconds);
    const onAbort = () => { clearTimeout(timer); signal.removeEventListener("abort", onAbort); reject(new TrainingPlanProviderFailure("cancelled")); };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
function safelyLog(logger: (record: TrainingPlanLogRecord) => void, record: TrainingPlanLogRecord): void {
  try { logger(record); } catch { /* Operational logging must not change run behavior. */ }
}

/** Explicit bounded W05 proposal loop. It owns all execution authority and budgets. */
export class TrainingPlanOrchestrator {
  private readonly now: () => number;
  private readonly setTimer: typeof setTimeout;
  private readonly clearTimer: typeof clearTimeout;
  private readonly sleep: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  private readonly backoffMs: number;
  private readonly makeRunId: () => string;
  private readonly logger: (record: TrainingPlanLogRecord) => void;
  private readonly toolRegistryFactory: (request: TrainingPlanRequest) => TrainingPlanToolRegistry;

  constructor(options: TrainingPlanOrchestratorOptions = {}) {
    this.now = options.now ?? (() => performance.now());
    this.setTimer = options.setTimer ?? setTimeout;
    this.clearTimer = options.clearTimer ?? clearTimeout;
    this.sleep = options.sleep ?? sleepAbortable;
    this.backoffMs = Math.max(0, Math.min(MAX_RETRY_BACKOFF_MS, options.retryBackoffMs ?? 100));
    this.makeRunId = options.runIdFactory ?? (() => `training-plan-${nextRunId++}`);
    this.logger = options.logger ?? ((record) => console.info(JSON.stringify(record)));
    this.toolRegistryFactory = options.toolRegistryFactory ?? ((request) => new TrainingPlanToolRegistry(request));
  }

  async run(request: TrainingPlanRequest, provider: TrainingPlanModelStepProvider, parentSignal?: AbortSignal): Promise<TrainingPlanRunResult> {
    const counters: TrainingPlanCounters = { agentSteps: 0, toolCalls: 0, providerAttempts: 0 };
    if (!validateTrainingPlanRequestSize(request)) return { ok: false, terminal: "invalid_input", counters };
    const runId = this.makeRunId();
    const startedAt = this.now();
    const deadline = startedAt + MAX_AGENT_RUN_MS;
    const runController = new AbortController();
    let deadlineReached = false;
    const abortFromParent = () => runController.abort();
    if (parentSignal?.aborted) runController.abort();
    else parentSignal?.addEventListener("abort", abortFromParent, { once: true });
    const deadlineTimer = this.setTimer(() => { deadlineReached = true; runController.abort(); }, MAX_AGENT_RUN_MS);
    const registry = this.toolRegistryFactory(request);
    const toolResults: TrainingPlanToolResult[] = [];
    const recentResults: RecentRunEvidenceResult[] = [];
    let evaluationResult: TrainingPlanToolResult | undefined;
    const attemptedActions = new Set<string>();
    let terminal: TrainingPlanTerminalReason = "provider_failed";
    let successful: TrainingPlanSuccess | undefined;
    safelyLog(this.logger, { event: "training_plan_start", runId, provider: provider.constructor.name === "FakeTrainingPlanProvider" || provider.constructor.name === "ScriptedTrainingPlanProvider" ? "fake" : "configured" });

    const finish = (reason: TrainingPlanTerminalReason, result?: TrainingPlanSuccess): TrainingPlanRunResult => {
      terminal = reason;
      successful = result;
      return { ok: reason === "goal_completed" && result !== undefined, terminal: reason, ...(result ? { result } : {}), counters: { ...counters } };
    };

    try {
      if (parentSignal?.aborted) return finish("cancelled");
      if (this.now() >= deadline) return finish("deadline");
      while (true) {
        if (runController.signal.aborted) return finish(parentSignal?.aborted ? "cancelled" : "deadline");
        if (this.now() >= deadline) return finish("deadline");
        if (counters.agentSteps >= MAX_AGENT_STEPS) return finish("step_limit");
        if (counters.providerAttempts >= MAX_PROVIDER_ATTEMPTS) return finish("provider_attempt_limit");

        counters.agentSteps += 1;
        const stepInput = this.makeStepInput(request, registry, toolResults, counters.agentSteps);
        let proposalValue: unknown;
        let retriesThisStep = 0;
        while (true) {
          if (runController.signal.aborted) return finish(parentSignal?.aborted ? "cancelled" : "deadline");
          const remaining = deadline - this.now();
          if (remaining <= 0) return finish("deadline");
          if (counters.providerAttempts >= MAX_PROVIDER_ATTEMPTS) return finish("provider_attempt_limit");
          const timeoutMs = Math.min(MAX_PROVIDER_ATTEMPT_MS, remaining);
          counters.providerAttempts += 1;
          const attemptNumber = counters.providerAttempts;
          safelyLog(this.logger, { event: "training_plan_provider_attempt", runId, step: counters.agentSteps, attempt: attemptNumber, timeoutMs, remainingMs: Math.max(0, Math.floor(remaining)) });
          try {
            proposalValue = await this.providerAttempt(provider, stepInput, timeoutMs, runController.signal, deadline, () => this.now());
            if (this.now() >= deadline) return finish("deadline");
            break;
          } catch (error) {
            if (parentSignal?.aborted) return finish("cancelled");
            if (deadlineReached || this.now() >= deadline) return finish("deadline");
            const kind = classifyFailure(error);
            if (kind === "timeout") return finish("provider_timeout");
            if (kind === "cancelled") return finish("cancelled");
            if (transient(kind) && retriesThisStep < 1 && counters.providerAttempts < MAX_PROVIDER_ATTEMPTS) {
              retriesThisStep += 1;
              const backoff = Math.min(this.backoffMs, Math.max(0, deadline - this.now()));
              if (backoff > 0) {
                try { await this.sleep(backoff, runController.signal); }
                catch { return finish(parentSignal?.aborted ? "cancelled" : "deadline"); }
              }
              if (this.now() >= deadline) return finish("deadline");
              continue;
            }
            if (counters.providerAttempts >= MAX_PROVIDER_ATTEMPTS) return finish("provider_attempt_limit");
            return finish("provider_failed");
          }
        }

        if (runController.signal.aborted) return finish(parentSignal?.aborted ? "cancelled" : "deadline");
        if (this.now() >= deadline) return finish("deadline");
        if (!proposalWithinLimit(proposalValue)) return finish("invalid_model_proposal");
        const proposal = validProposal(proposalValue);
        if (!proposal) return finish("invalid_model_proposal");
        if (proposal.kind === "final") {
          if (recentResults.length === 0) return finish("invalid_final_result");
          if (!validateTrainingPlanDraft(proposal.result)) return finish("invalid_final_result");
          const draft = proposal.result as TrainingPlanDraft;
          if (!this.groundFinalDraft(draft, request, recentResults, evaluationResult)) return finish("invalid_final_result");
          const plan = { ...draft, completed: true as const };
          const baseline = computeTrainingPlanBaseline(request.runs, plan.primaryFocus);
          const response = { plan, baseline };
          if (!validateTrainingPlanSuccess(response, request)) return finish("invalid_final_result");
          return finish("goal_completed", response);
        }

        if (proposal.kind !== "tool_call") return finish("invalid_model_proposal");
        if (!ALLOWLIST.has(proposal.tool)) return finish("unknown_tool");
        const tool = proposal.tool as TrainingPlanToolName;
        if (typeof proposal.arguments !== "object" || proposal.arguments === null || Array.isArray(proposal.arguments)) return finish("invalid_tool_arguments");
        if (!validateToolArguments(tool, proposal.arguments, request.runs.length)) return finish("invalid_tool_arguments");
        if (counters.toolCalls >= MAX_TOOL_CALLS) return finish("tool_call_limit");
        if (this.now() >= deadline) return finish("deadline");
        const identity = registry.actionIdentity(tool, proposal.arguments);
        if (attemptedActions.has(identity)) return finish("repeated_action");
        attemptedActions.add(identity);
        if (!registry.isAvailable(tool)) return finish("invalid_model_proposal");
        if (counters.agentSteps >= MAX_AGENT_STEPS) return finish("step_limit");
        if (runController.signal.aborted) return finish(parentSignal?.aborted ? "cancelled" : "deadline");
        if (this.now() >= deadline) return finish("deadline");

        let toolOutput: unknown;
        try { toolOutput = registry.dispatch(tool, proposal.arguments, () => { counters.toolCalls += 1; }); }
        catch { return finish("tool_failed"); }
        if (runController.signal.aborted) return finish(parentSignal?.aborted ? "cancelled" : "deadline");
        if (this.now() >= deadline) return finish("deadline");
        if (!registry.validateOutput(tool, toolOutput)) return finish("invalid_tool_result");
        const normalized = toolOutput as TrainingPlanToolResult;
        toolResults.push(normalized);
        if (normalized.kind === "recent_run_evidence") recentResults.push(normalized);
        else evaluationResult = normalized;
        safelyLog(this.logger, { event: "training_plan_tool_dispatched", runId, tool, toolCalls: counters.toolCalls, elapsedMs: Math.max(0, Math.floor(this.now() - startedAt)) });
      }
    } catch {
      return finish(parentSignal?.aborted ? "cancelled" : deadlineReached ? "deadline" : "provider_failed");
    } finally {
      this.clearTimer(deadlineTimer);
      parentSignal?.removeEventListener("abort", abortFromParent);
      safelyLog(this.logger, {
        event: "training_plan_end", runId, terminal, steps: counters.agentSteps, providerAttempts: counters.providerAttempts,
        toolCalls: counters.toolCalls, elapsedMs: Math.max(0, Math.floor(this.now() - startedAt)), success: Boolean(successful),
      });
    }
  }

  private makeStepInput(request: TrainingPlanRequest, registry: TrainingPlanToolRegistry, results: TrainingPlanToolResult[], step: number): TrainingPlanModelStepInput {
    const allowedTools: TrainingPlanModelStepInput["allowedTools"] = [{
      name: "get_recent_run_evidence", arguments: "{limit:1|2|3}", description: "Return normalized telemetry for the latest requested runs; limit cannot exceed the available run count.",
    }];
    if (registry.isAvailable("evaluate_previous_training_plan")) allowedTools.push({
      name: "evaluate_previous_training_plan", arguments: "{}", description: "Compare the previous plan's focus baseline with newer completed runs using deterministic counts.",
    });
    return createTrainingPlanModelStepInput({
      step,
      state: results.some((result) => result.kind === "recent_run_evidence") ? "ready_to_finish" : "evidence_required",
      currentRunCount: request.runs.length,
      currentSequences: request.runs.map((entry) => entry.sequence),
      ...(request.previousPlan ? { previousPlan: { primaryFocus: request.previousPlan.plan.primaryFocus, baselineMaxSequence: request.previousPlan.baseline.maxSequence } } : {}),
      allowedTools,
      toolResults: results,
    });
  }

  private groundFinalDraft(draft: TrainingPlanDraft, request: TrainingPlanRequest, recentResults: RecentRunEvidenceResult[], evaluationResult: TrainingPlanToolResult | undefined): boolean {
    if (evaluationResult && evaluationResult.kind !== "previous_plan_evaluation") return false;
    if (evaluationResult) {
      if (draft.previousAssessment !== evaluationResult.assessment) return false;
    } else if (draft.previousAssessment !== "not_applicable") return false;
    const expectedMetric = PRIMARY_FOCUS_METRIC[draft.primaryFocus];
    let hasPrimaryRecentEvidence = false;
    let hasEvaluationEvidence = false;
    for (const evidence of draft.evidence) {
      if (!evidence.runSequences.every((sequence) => request.runs.some((entry) => entry.sequence === sequence))) return false;
      if (evidence.source === "recent_run_evidence") {
        if (evidence.metric !== expectedMetric) return false;
        const matched = recentResults.some((result) => {
          const selectedRuns = result.runs.filter((run) => evidence.runSequences.includes(run.sequence));
          if (selectedRuns.length !== evidence.runSequences.length) return false;
          const facts = selectedRuns.map((run) => run.metrics.find((metric) => metric.id === evidence.metric));
          if (facts.some((metric) => !metric)) return false;
          const opportunities = facts.reduce((sum, metric) => sum + BigInt(metric!.opportunities), 0n);
          const undesirable = facts.reduce((sum, metric) => sum + BigInt(metric!.undesirable), 0n);
          return opportunities <= BigInt(Number.MAX_SAFE_INTEGER) && undesirable <= BigInt(Number.MAX_SAFE_INTEGER)
            && Number(opportunities) === evidence.opportunities && Number(undesirable) === evidence.undesirable;
        });
        if (!matched) return false;
        hasPrimaryRecentEvidence = true;
      } else {
        if (!evaluationResult || evaluationResult.kind !== "previous_plan_evaluation") return false;
        const evaluated = evaluationResult;
        if (evidence.metric !== evaluated.metricId || evidence.opportunities !== evaluated.newer.opportunities
          || evidence.undesirable !== evaluated.newer.undesirable
          || evidence.runSequences.length !== evaluated.newer.runSequences.length
          || evidence.runSequences.some((sequence, index) => sequence !== evaluated.newer.runSequences[index])) return false;
        hasEvaluationEvidence = true;
      }
    }
    return hasPrimaryRecentEvidence && (!evaluationResult || hasEvaluationEvidence);
  }

  private async providerAttempt(provider: TrainingPlanModelStepProvider, input: TrainingPlanModelStepInput, timeoutMs: number, runSignal: AbortSignal, deadline: number, now: () => number): Promise<unknown> {
    const controller = new AbortController();
    let attemptTimedOut = false;
    let abortCause: "cancelled" | "deadline" | undefined;
    const onRunAbort = () => {
      abortCause = now() >= deadline ? "deadline" : "cancelled";
      controller.abort();
    };
    if (runSignal.aborted) onRunAbort();
    else runSignal.addEventListener("abort", onRunAbort, { once: true });
    const timeoutHandle = this.setTimer(() => { attemptTimedOut = true; controller.abort(); }, timeoutMs);
    let onAttemptAbort!: () => void;
    const aborted = new Promise<never>((_resolve, reject) => {
      onAttemptAbort = () => reject(new TrainingPlanProviderFailure(abortCause === "cancelled" ? "cancelled" : "timeout"));
      if (controller.signal.aborted) onAttemptAbort();
      else controller.signal.addEventListener("abort", onAttemptAbort, { once: true });
    });
    const generation = Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new TrainingPlanProviderFailure(abortCause === "cancelled" ? "cancelled" : "timeout");
      return provider.generateStep(input, controller.signal, timeoutMs);
    });
    try {
      return await Promise.race([generation, aborted]);
    } finally {
      this.clearTimer(timeoutHandle);
      runSignal.removeEventListener("abort", onRunAbort);
      controller.signal.removeEventListener("abort", onAttemptAbort);
    }
  }
}

