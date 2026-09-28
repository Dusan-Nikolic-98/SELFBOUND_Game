export const GEMINI_MODEL_ID = "gemini-3.5-flash-lite";

export type AiCoachProviderMode = "fake" | "gemini";

export type AiCoachRuntimeConfig = {
  provider: AiCoachProviderMode;
  model: typeof GEMINI_MODEL_ID;
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
  if (model !== GEMINI_MODEL_ID) {
    throw new BackendConfigurationError(`GEMINI_MODEL must be ${GEMINI_MODEL_ID}.`);
  }

  if (providerValue === "fake") {
    return { provider: "fake", model: GEMINI_MODEL_ID };
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    throw new BackendConfigurationError("GEMINI_API_KEY is required when AI_COACH_PROVIDER=gemini.");
  }
  return { provider: "gemini", model: GEMINI_MODEL_ID, apiKey: apiKey.trim() };
}
