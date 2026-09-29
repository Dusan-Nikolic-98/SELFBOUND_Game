import { AddressInfo } from "node:net";
import { parseAiCoachRuntimeConfig, BackendConfigurationError } from "./ai-coach-config.js";
import { validateAiCoachResponse } from "./ai-coach-contract.js";
import { GeminiAiCoachProvider, GeminiUsageRecord } from "./gemini-ai-coach-provider.js";
import { createServer } from "./server.js";

const requestBody = {
  runs: [{
    outcome: "level_complete" as const,
    durationMs: 90_000,
    livesLost: 1,
    shotsFired: 7,
    failedShots: 3,
    captures: 4,
    greenThreatsCreated: 2,
    greenThreatHits: 1,
    shotsWhileThreatActive: 3,
    defensiveShots: 2,
    successfulDefensiveShots: 1,
    shotsAimedAtThreat: 2,
    shotsAimedAtCurrentTargetWhileThreatActive: 1,
    offensiveShotsWhileThreatActive: 1,
    blockedDirectAttempts: 2,
    bouncedAttempts: 2,
    successfulBounceCaptures: 1,
    rushedBouncedFailures: 1,
    repeatedSamePositionFailures: 0,
    rangeExpiredShots: 1,
    targetStats: [],
    representativeEvents: [],
  }],
};

async function runLiveValidation(): Promise<void> {
  const configuredMode = process.env.AI_COACH_PROVIDER?.trim() || "fake";
  if (configuredMode !== "gemini") {
    console.info("Live Gemini validation: NOT PERFORMED (AI_COACH_PROVIDER is not gemini).");
    return;
  }
  if (!process.env.GEMINI_API_KEY?.trim()) {
    console.info("Live Gemini validation: NOT PERFORMED (backend key is unavailable).");
    return;
  }

  const config = parseAiCoachRuntimeConfig(process.env);
  let usageRecord: GeminiUsageRecord | undefined;
  const provider = new GeminiAiCoachProvider({
    apiKey: config.apiKey,
    model: config.model,
    logger: (record) => { usageRecord = record; },
  });
  const server = createServer(provider);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/ai/coach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const value: unknown = await response.json();
    if (response.status !== 200 || !validateAiCoachResponse(value)) {
      console.error(JSON.stringify({
        liveValidation: "FAIL",
        provider: "gemini",
        model: config.model,
        latencyMs: usageRecord?.latencyMs,
        attempts: usageRecord?.attempts,
        runtimeValidation: false,
        failureCategory: usageRecord?.failureCategory ?? "invalid_provider_output",
      }));
      process.exitCode = 1;
      return;
    }
    const primaryCategory = (value as { advice: { primaryCategory: string } }).advice.primaryCategory;
    console.info(JSON.stringify({
      liveValidation: "PASS",
      provider: "gemini",
      model: config.model,
      latencyMs: usageRecord?.latencyMs,
      attempts: usageRecord?.attempts,
      runtimeValidation: true,
      primaryCategory,
      ...(usageRecord?.inputTokens === undefined ? {} : { inputTokens: usageRecord.inputTokens }),
      ...(usageRecord?.outputTokens === undefined ? {} : { outputTokens: usageRecord.outputTokens }),
      ...(usageRecord?.totalTokens === undefined ? {} : { totalTokens: usageRecord.totalTokens }),
    }));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

if (require.main === module) {
  runLiveValidation().catch((error: unknown) => {
    console.error(error instanceof BackendConfigurationError
      ? "Live Gemini validation: FAIL (backend configuration is invalid)."
      : "Live Gemini validation: FAIL (sanitized provider or local request failure).");
    process.exitCode = 1;
  });
}
