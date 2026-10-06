export const TRAINING_PLAN_GEMINI_MODEL = "gemini-3.1-flash-lite" as const;
export const TRAINING_PLAN_ALLOWED_MODELS = [TRAINING_PLAN_GEMINI_MODEL] as const;
export type TrainingPlanProviderMode = "fake" | "gemini";
export type TrainingPlanRuntimeConfig = {
  provider: TrainingPlanProviderMode;
  model: typeof TRAINING_PLAN_GEMINI_MODEL;
  apiKey?: string;
};

export class TrainingPlanConfigurationError extends Error {
  constructor(message: string) { super(message); this.name = "TrainingPlanConfigurationError"; }
}

/** In fake mode this deliberately never reads TRAINING_PLAN_GEMINI_API_KEY. */
export function parseTrainingPlanRuntimeConfig(env: Record<string, string | undefined>): TrainingPlanRuntimeConfig {
  const selected = env.TRAINING_PLAN_PROVIDER?.trim() || "fake";
  if (selected !== "fake" && selected !== "gemini") throw new TrainingPlanConfigurationError("TRAINING_PLAN_PROVIDER must be either fake or gemini.");
  if (selected === "fake") return { provider: "fake", model: TRAINING_PLAN_GEMINI_MODEL };
  const model = env.TRAINING_PLAN_GEMINI_MODEL?.trim() || TRAINING_PLAN_GEMINI_MODEL;
  if (!(TRAINING_PLAN_ALLOWED_MODELS as readonly string[]).includes(model)) throw new TrainingPlanConfigurationError(`TRAINING_PLAN_GEMINI_MODEL must be ${TRAINING_PLAN_GEMINI_MODEL}.`);
  const apiKey = env.TRAINING_PLAN_GEMINI_API_KEY;
  if (!apiKey?.trim()) throw new TrainingPlanConfigurationError("TRAINING_PLAN_GEMINI_API_KEY is required when TRAINING_PLAN_PROVIDER=gemini.");
  return { provider: "gemini", model: TRAINING_PLAN_GEMINI_MODEL, apiKey: apiKey.trim() };
}

