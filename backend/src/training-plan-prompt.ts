import { TrainingPlanToolResult } from "./training-plan-contract.js";

export const TRAINING_PLAN_GOAL = "Analyze my available completed runs, determine the most useful next practice focus, and produce a focused training plan for my next run.";
export const TRAINING_PLAN_SYSTEM_INSTRUCTION = [
  "You are the SELFBOUND Training Planner. Give one practical focus for the player's next run using only validated tool results and bounded workflow metadata supplied to you.",
  "Do not infer skill, intent, motivation, causation, or the existence of a viable bounce route. A blocked direct attempt is only a proxy. Zero opportunities are not improvement.",
  "Use get_recent_run_evidence before producing a final result. If evaluate_previous_training_plan ran, copy its assessment and cite its exact normalized result. If it did not run, set previousAssessment to not_applicable.",
  "Return only one proposal object: either {kind:'tool_call',tool,arguments} or {kind:'final',result}. The final result must contain summary (1-240 chars), previousAssessment, primaryFocus, practiceGoal (1-240 chars), 1-4 exact evidence tuples, confidence (low|medium|high). Do not include completed; the backend sets it.",
  "Recent evidence must use the metric matching primaryFocus and copy the exact sequences and pooled integer counts from a validated recent_run_evidence result. Evaluation evidence must exactly match previous_plan_evaluation. Do not add explanation fields, hidden reasoning, or extra keys.",
].join(" ");

export type ModelStepAllowedTool = {
  name: "get_recent_run_evidence" | "evaluate_previous_training_plan";
  arguments: "{limit:1|2|3}" | "{}";
  description: string;
};
export type TrainingPlanModelStepInput = {
  goal: string;
  instructions: string;
  step: number;
  state: "evidence_required" | "ready_to_finish";
  currentRunCount: number;
  currentSequences: number[];
  previousPlan?: { primaryFocus: string; baselineMaxSequence: number };
  allowedTools: ModelStepAllowedTool[];
  toolResults: TrainingPlanToolResult[];
};

/** Construct a model step from bounded workflow metadata, never raw run summaries. */
export function createTrainingPlanModelStepInput(input: Omit<TrainingPlanModelStepInput, "goal" | "instructions">): TrainingPlanModelStepInput {
  return {
    goal: TRAINING_PLAN_GOAL,
    instructions: TRAINING_PLAN_SYSTEM_INSTRUCTION,
    ...input,
    currentSequences: [...input.currentSequences],
    previousPlan: input.previousPlan ? { ...input.previousPlan } : undefined,
    allowedTools: input.allowedTools.map((tool) => ({ ...tool })),
    toolResults: input.toolResults.map((result) => JSON.parse(JSON.stringify(result)) as TrainingPlanToolResult),
  };
}

