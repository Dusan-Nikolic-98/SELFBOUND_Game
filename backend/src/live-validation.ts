import { AddressInfo } from "node:net";
import { parseAiCoachRuntimeConfig, BackendConfigurationError } from "./ai-coach-config.js";
import { validateAiCoachResponse } from "./ai-coach-contract.js";
import { createAiCoachProvider } from "./ai-coach-runtime.js";
import { createServer } from "./server.js";

const requestBody = {
  runs: [{
    outcome: "level_complete" as const,
    durationMs: 1000,
    livesLost: 0,
    shotsFired: 0,
    failedShots: 0,
    captures: 0,
    greenThreatsCreated: 0,
    greenThreatHits: 0,
    shotsWhileThreatActive: 0,
    defensiveShots: 0,
    successfulDefensiveShots: 0,
    shotsAimedAtThreat: 0,
    shotsAimedAtCurrentTargetWhileThreatActive: 0,
    offensiveShotsWhileThreatActive: 0,
    blockedDirectAttempts: 0,
    bouncedAttempts: 0,
    successfulBounceCaptures: 0,
    rushedBouncedFailures: 0,
    repeatedSamePositionFailures: 0,
    rangeExpiredShots: 0,
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
  const server = createServer(createAiCoachProvider(config));
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
      console.error("Live Gemini validation: FAIL (provider or response validation failed).");
      process.exitCode = 1;
      return;
    }
    console.info(JSON.stringify({ liveValidation: "PASS", provider: "gemini", model: config.model, validated: true }));
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
