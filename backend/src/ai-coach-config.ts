export const GEMINI_MODEL_ID = "gemini-3.1-flash-lite";
export const GEMINI_FALLBACK_MODEL_ID = "gemini-3.5-flash-lite";
export const GEMINI_ALLOWED_MODELS = [GEMINI_MODEL_ID, GEMINI_FALLBACK_MODEL_ID] as const;

export type AiCoachProviderMode = "fake" | "gemini";

export type AiCoachRuntimeConfig = {
  provider: AiCoachProviderMode;
  model: typeof GEMINI_MODEL_ID;
  modelChain: string[];
  apiKey?: string;
};

export class BackendConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackendConfigurationError";
  }
}

/** Reads only named backend settings. Callers must never log the returned key. */
export function parseAiCoachRuntimeConfig(env: Record<string, string | undefined>): AiCoachRuntimeConfig {
  const providerValue = env.AI_COACH_PROVIDER?.trim() || "fake";
  if (providerValue !== "fake" && providerValue !== "gemini") {
    throw new BackendConfigurationError("AI_COACH_PROVIDER must be either fake or gemini.");
  }

  const model = env.GEMINI_MODEL?.trim() || GEMINI_MODEL_ID;
  if (model !== GEMINI_MODEL_ID) throw new BackendConfigurationError(`GEMINI_MODEL must be ${GEMINI_MODEL_ID}.`);
  const configuredChain = env.GEMINI_MODEL_CHAIN?.trim();
  const modelChain = configuredChain ? configuredChain.split(",").map((entry) => entry.trim()) : [GEMINI_MODEL_ID];
  if (modelChain.length < 1 || modelChain.length > 2 || modelChain[0] !== GEMINI_MODEL_ID
    || modelChain.some((candidate) => !(GEMINI_ALLOWED_MODELS as readonly string[]).includes(candidate))
    || new Set(modelChain).size !== modelChain.length) {
    throw new BackendConfigurationError(`GEMINI_MODEL_CHAIN must start with ${GEMINI_MODEL_ID} and may include the allowlisted fallback ${GEMINI_FALLBACK_MODEL_ID}.`);
  }

  if (providerValue === "fake") {
    return { provider: "fake", model: GEMINI_MODEL_ID, modelChain };
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    throw new BackendConfigurationError("GEMINI_API_KEY is required when AI_COACH_PROVIDER=gemini.");
  }
  return { provider: "gemini", model: GEMINI_MODEL_ID, modelChain, apiKey: apiKey.trim() };
}
