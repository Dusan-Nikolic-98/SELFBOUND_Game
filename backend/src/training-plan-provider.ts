import { TrainingPlanModelStepInput } from "./training-plan-prompt.js";

export type TrainingPlanProviderFailureKind =
  | "transient_network" | "rate_limit" | "temporary_service"
  | "timeout" | "cancelled" | "authentication" | "invalid_request" | "refusal" | "invalid_output" | "permanent";

export class TrainingPlanProviderFailure extends Error {
  constructor(readonly kind: TrainingPlanProviderFailureKind) {
    super("Training Plan provider attempt failed.");
    this.name = "TrainingPlanProviderFailure";
  }
}

export interface TrainingPlanModelStepProvider {
  generateStep(input: TrainingPlanModelStepInput, signal: AbortSignal, timeoutMs: number): Promise<unknown>;
}

