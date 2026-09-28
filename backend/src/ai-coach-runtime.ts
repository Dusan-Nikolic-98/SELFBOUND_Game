import { AiCoachRuntimeConfig, BackendConfigurationError } from "./ai-coach-config.js";
import { AiCoachProvider, FakeAiCoachProvider } from "./ai-coach-provider.js";
import { GeminiAiCoachProvider } from "./gemini-ai-coach-provider.js";

export function createAiCoachProvider(config: AiCoachRuntimeConfig): AiCoachProvider {
  if (config.provider === "fake") return new FakeAiCoachProvider();
  if (!config.apiKey) {
    throw new BackendConfigurationError("GEMINI_API_KEY is required when AI_COACH_PROVIDER=gemini.");
  }
  return new GeminiAiCoachProvider({ apiKey: config.apiKey, model: config.model });
}
