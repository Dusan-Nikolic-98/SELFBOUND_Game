import { TrainingPlanConfigurationError, TrainingPlanRuntimeConfig } from "./training-plan-config.js";
import { FakeTrainingPlanProvider } from "./fake-training-plan-provider.js";
import { TrainingPlanOrchestrator } from "./training-plan-orchestrator.js";
import { TrainingPlanModelStepProvider } from "./training-plan-provider.js";
import { GeminiTrainingPlanProvider } from "./gemini-training-plan-provider.js";

export type TrainingPlanRuntime = { provider: TrainingPlanModelStepProvider; orchestrator: TrainingPlanOrchestrator };
export type TrainingPlanRuntimeDependencies = {
  provider?: TrainingPlanModelStepProvider;
  orchestrator?: TrainingPlanOrchestrator;
};

export function createTrainingPlanRuntime(config: TrainingPlanRuntimeConfig, dependencies: TrainingPlanRuntimeDependencies = {}): TrainingPlanRuntime {
  if (dependencies.provider) return { provider: dependencies.provider, orchestrator: dependencies.orchestrator ?? new TrainingPlanOrchestrator() };
  if (config.provider === "fake") return { provider: new FakeTrainingPlanProvider("first_plan_success"), orchestrator: dependencies.orchestrator ?? new TrainingPlanOrchestrator() };
  if (!config.apiKey) throw new TrainingPlanConfigurationError("TRAINING_PLAN_GEMINI_API_KEY is required when TRAINING_PLAN_PROVIDER=gemini.");
  return {
    provider: new GeminiTrainingPlanProvider(config.apiKey, config.model),
    orchestrator: dependencies.orchestrator ?? new TrainingPlanOrchestrator(),
  };
}

