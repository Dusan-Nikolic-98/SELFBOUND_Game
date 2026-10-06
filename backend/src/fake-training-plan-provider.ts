import { FocusMetric, PreviousPlanEvaluationResult, RecentRunEvidenceResult, TrainingPlanMetricId } from "./training-plan-contract.js";
import { TrainingPlanModelStepInput } from "./training-plan-prompt.js";
import { TrainingPlanModelStepProvider, TrainingPlanProviderFailure, TrainingPlanProviderFailureKind } from "./training-plan-provider.js";

export type FakeTrainingPlanScenario =
  | "first_plan_success" | "later_plan_success" | "unknown_tool" | "invalid_tool_arguments"
  | "malformed_proposal" | "invalid_tool_result" | "repeated_action" | "transient_provider_error"
  | "timeout" | "delayed_response" | "step_limit" | "tool_limit" | "provider_attempt_exhaustion"
  | "invalid_final_result";
export type FakeScriptEntry = { output?: unknown; error?: TrainingPlanProviderFailureKind; delayMs?: number; never?: boolean };

const focusMetric: Record<string, TrainingPlanMetricId> = {
  threat_management: "threat_offensive_rate", bounce_strategy: "blocked_direct_rate", aim_timing: "rushed_bounce_failure_rate",
  positioning: "repeated_same_position_rate", range_management: "range_expiry_rate",
};

function allResults(input: TrainingPlanModelStepInput): TrainingPlanMetricId[] {
  return input.toolResults.filter((item): item is RecentRunEvidenceResult => item.kind === "recent_run_evidence").flatMap((result) => result.runs.flatMap((run) => run.metrics.map((metric) => metric.id)));
}
function deriveFinal(input: TrainingPlanModelStepInput): unknown {
  const evidenceResult = [...input.toolResults].reverse().find((result): result is RecentRunEvidenceResult => result.kind === "recent_run_evidence");
  if (!evidenceResult) return { kind: "final", result: { summary: "missing evidence", previousAssessment: "not_applicable", primaryFocus: "threat_management", practiceGoal: "Try again.", evidence: [], confidence: "low" } };
  const primaryFocus = "threat_management" as const;
  const metric = focusMetric[primaryFocus] as TrainingPlanMetricId;
  const selected = evidenceResult.runs.map((run) => ({ run, metric: run.metrics.find((candidate) => candidate.id === metric) })).filter((item) => item.metric);
  const opportunitiesBig = selected.reduce((sum, item) => sum + BigInt(item.metric!.opportunities), 0n);
  const undesirableBig = selected.reduce((sum, item) => sum + BigInt(item.metric!.undesirable), 0n);
  const opportunities = Number(opportunitiesBig), undesirable = Number(undesirableBig);
  const evidence: Array<{ source: "recent_run_evidence" | "previous_plan_evaluation"; metric: TrainingPlanMetricId; runSequences: number[]; opportunities: number; undesirable: number }> = [
    { source: "recent_run_evidence", metric, runSequences: selected.map((item) => item.run.sequence), opportunities, undesirable },
  ];
  const evaluation = [...input.toolResults].reverse().find((result): result is PreviousPlanEvaluationResult => result.kind === "previous_plan_evaluation");
  if (evaluation) evidence.push({ source: "previous_plan_evaluation", metric: evaluation.metricId, runSequences: [...evaluation.newer.runSequences], opportunities: evaluation.newer.opportunities, undesirable: evaluation.newer.undesirable });
  return {
    kind: "final",
    result: {
      summary: "Practice a deliberate response to an active green threat.",
      previousAssessment: evaluation?.assessment ?? "not_applicable",
      primaryFocus,
      practiceGoal: "When a green threat appears, aim to clear it before returning to the current target.",
      evidence,
      confidence: "low",
    },
  };
}

function defaultProposal(input: TrainingPlanModelStepInput): unknown {
  const hasEvidence = allResults(input).length > 0;
  if (!hasEvidence) {
    const evaluationAvailable = input.allowedTools.some((tool) => tool.name === "evaluate_previous_training_plan");
    const hasEvaluation = input.toolResults.some((result) => result.kind === "previous_plan_evaluation");
    if (evaluationAvailable && !hasEvaluation) return { kind: "tool_call", tool: "evaluate_previous_training_plan", arguments: {} };
    return { kind: "tool_call", tool: "get_recent_run_evidence", arguments: { limit: input.currentRunCount } };
  }
  return deriveFinal(input);
}

function cloneInput(input: TrainingPlanModelStepInput): TrainingPlanModelStepInput {
  return JSON.parse(JSON.stringify(input)) as TrainingPlanModelStepInput;
}

function scenarioScript(scenario: FakeTrainingPlanScenario): FakeScriptEntry[] {
  const evidenceOne = { kind: "tool_call", tool: "get_recent_run_evidence", arguments: { limit: 1 } };
  switch (scenario) {
    case "unknown_tool": return [{ output: { kind: "tool_call", tool: "read_files", arguments: {} } }];
    case "invalid_tool_arguments": return [{ output: { kind: "tool_call", tool: "get_recent_run_evidence", arguments: { limit: 3 } } }];
    case "malformed_proposal": return [{ output: { kind: "tool_call", tool: "get_recent_run_evidence" } }];
    case "repeated_action": return [{ output: evidenceOne }, { output: evidenceOne }];
    case "transient_provider_error": return [{ error: "transient_network" }];
    case "timeout": return [{ error: "timeout" }];
    case "delayed_response": return [{ delayMs: 25 }];
    case "step_limit": return [
      { output: evidenceOne },
      { output: { kind: "tool_call", tool: "get_recent_run_evidence", arguments: { limit: 2 } } },
      { output: { kind: "tool_call", tool: "get_recent_run_evidence", arguments: { limit: 3 } } },
    ];
    case "tool_limit": return [
      { output: evidenceOne },
      { output: { kind: "tool_call", tool: "get_recent_run_evidence", arguments: { limit: 2 } } },
      { output: { kind: "tool_call", tool: "evaluate_previous_training_plan", arguments: {} } },
    ];
    case "provider_attempt_exhaustion": return [
      { error: "transient_network" }, { output: evidenceOne },
      { error: "transient_network" }, { output: { kind: "tool_call", tool: "get_recent_run_evidence", arguments: { limit: 2 } } },
    ];
    case "invalid_final_result": return [
      { output: evidenceOne },
      { output: { kind: "final", result: { summary: "bad", previousAssessment: "not_applicable", primaryFocus: "threat_management", practiceGoal: "Try it", evidence: [], confidence: "low" } } },
    ];
    case "invalid_tool_result":
    case "first_plan_success":
    case "later_plan_success": return [];
  }
}

/** Deterministic offline provider. It never performs network or filesystem work. */
export class FakeTrainingPlanProvider implements TrainingPlanModelStepProvider {
  readonly inputs: TrainingPlanModelStepInput[] = [];
  readonly attemptedProposals: unknown[] = [];
  private cursor = 0;
  private readonly script: FakeScriptEntry[];

  constructor(readonly scenario: FakeTrainingPlanScenario = "first_plan_success", script?: readonly FakeScriptEntry[]) {
    this.script = script ? [...script] : scenarioScript(scenario);
  }

  get callCount(): number { return this.inputs.length; }

  async generateStep(input: TrainingPlanModelStepInput, signal: AbortSignal, timeoutMs: number): Promise<unknown> {
    if (signal.aborted) throw new TrainingPlanProviderFailure("cancelled");
    if (timeoutMs <= 0) throw new TrainingPlanProviderFailure("timeout");
    this.inputs.push(cloneInput(input));
    const entry = this.script[this.cursor++];
    if (entry?.never) return new Promise<never>(() => undefined);
    if (entry?.delayMs) await delay(entry.delayMs, signal);
    if (entry?.error) throw new TrainingPlanProviderFailure(entry.error);
    const proposal = entry && "output" in entry ? entry.output : defaultProposal(input);
    this.attemptedProposals.push(proposal);
    return proposal;
  }
}

export class ScriptedTrainingPlanProvider extends FakeTrainingPlanProvider {
  constructor(script: readonly FakeScriptEntry[], scenario: FakeTrainingPlanScenario = "first_plan_success") { super(scenario, script); }
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, milliseconds);
    const onAbort = () => { clearTimeout(timer); signal.removeEventListener("abort", onAbort); reject(new TrainingPlanProviderFailure("cancelled")); };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

