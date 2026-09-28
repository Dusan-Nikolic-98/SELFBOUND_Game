import assert from "node:assert/strict";
import test from "node:test";
import { AddressInfo } from "node:net";
import { AiCoachRequest, validateAiCoachAdvice } from "../backend/src/ai-coach-contract.js";
import { GEMINI_MODEL_ID, parseAiCoachRuntimeConfig } from "../backend/src/ai-coach-config.js";
import { createAiCoachProvider } from "../backend/src/ai-coach-runtime.js";
import {
  GeminiAiCoachProvider,
  GeminiInteractionRequest,
  GeminiInteractionResult,
  GeminiInteractionsClient,
  GeminiSdkFactory,
  GeminiUsageRecord,
  GEMINI_ATTEMPT_TIMEOUT_MS,
  GEMINI_MAX_ATTEMPTS,
  GEMINI_RETRY_DELAY_MS,
  createGeminiSdkFactory,
} from "../backend/src/gemini-ai-coach-provider.js";
import { FakeAiCoachProvider } from "../backend/src/ai-coach-provider.js";
import { createServer } from "../backend/src/server.js";

const request: AiCoachRequest = {
  runs: [{
    outcome: "level_complete",
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

const advice = {
  summary: "This run has too little telemetry to show a clear pattern.",
  primaryCategory: "general" as const,
  primaryAdvice: "Complete more runs to build useful coaching evidence.",
  practiceGoal: "Finish another run and review its summary.",
};

function successfulResult(outputText = JSON.stringify(advice)): GeminiInteractionResult {
  return { outputText, usage: { inputTokens: 34, outputTokens: 29 } };
}

class TestGeminiClient implements GeminiInteractionsClient {
  calls = 0;
  requests: GeminiInteractionRequest[] = [];
  constructor(private readonly respond: (call: number, request: GeminiInteractionRequest, signal: AbortSignal) => Promise<GeminiInteractionResult> | GeminiInteractionResult) {}
  async create(input: GeminiInteractionRequest, signal: AbortSignal): Promise<GeminiInteractionResult> {
    this.calls += 1;
    this.requests.push(input);
    return this.respond(this.calls, input, signal);
  }
}

async function withServer<T>(provider: GeminiAiCoachProvider, run: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = createServer(provider);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function post(baseUrl: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}/api/ai/coach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function providerFor(client: GeminiInteractionsClient, logger: (record: GeminiUsageRecord) => void = () => undefined): GeminiAiCoachProvider {
  return new GeminiAiCoachProvider({ client, model: GEMINI_MODEL_ID, logger, sleep: async () => undefined });
}

test("Gemini request uses only bounded telemetry, explicit schema, stable model, and stateless generation", async () => {
  const client = new TestGeminiClient(() => successfulResult());
  const provider = providerFor(client);
  const output = await provider.getAdvice(request);
  assert.equal(validateAiCoachAdvice(output), true);
  assert.equal(client.calls, 1);

  const input = client.requests[0];
  assert.equal(input.model, GEMINI_MODEL_ID);
  assert.deepEqual(JSON.parse(input.input), request);
  assert.equal(input.store, false);
  assert.equal(input.response_format.type, "text");
  assert.equal(input.response_format.mime_type, "application/json");
  assert.deepEqual(input.response_format.schema.required, ["summary", "primaryCategory", "primaryAdvice", "practiceGoal"]);
  const properties = input.response_format.schema.properties as Record<string, { enum?: string[] }>;
  assert.deepEqual(properties.primaryCategory.enum, ["threat_management", "bounce_strategy", "aim_timing", "positioning", "range_management", "general"]);
  assert.deepEqual(input.generation_config, { temperature: 0.2, max_output_tokens: 512 });
  assert.equal(input.system_instruction.includes("SELFBOUND AI Coach"), true);
  assert.equal("tools" in input, false);
  assert.equal("background" in input, false);
  assert.equal("previous_interaction_id" in input, false);
});

test("Gemini valid structured output passes runtime validation and returns HTTP 200", async () => {
  const provider = providerFor(new TestGeminiClient(() => successfulResult()));
  await withServer(provider, async (baseUrl) => {
    const response = await post(baseUrl, request);
    assert.equal(response.status, 200);
    const body = await response.json() as { advice: unknown };
    assert.equal(validateAiCoachAdvice(body.advice), true);
  });
});

test("malformed JSON and contract-invalid JSON return safe 503 without retry", async () => {
  for (const output of ["not json", JSON.stringify({ ...advice, primaryCategory: "unapproved" })]) {
    const client = new TestGeminiClient(() => successfulResult(output));
    const provider = providerFor(client);
    await withServer(provider, async (baseUrl) => {
      const response = await post(baseUrl, request);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { ok: false, error: "coach_unavailable" });
      assert.equal(client.calls, 1);
    });
  }
});

test("transient 503 retries once then succeeds with safe usage metadata", async () => {
  const client = new TestGeminiClient((call) => {
    if (call === 1) throw { status: 503 };
    return successfulResult();
  });
  const records: GeminiUsageRecord[] = [];
  const delays: number[] = [];
  const provider = new GeminiAiCoachProvider({
    client,
    model: GEMINI_MODEL_ID,
    logger: (record) => records.push(record),
    sleep: async (milliseconds) => { delays.push(milliseconds); },
    now: () => 1000,
  });
  const output = await provider.getAdvice(request);
  assert.equal(validateAiCoachAdvice(output), true);
  assert.equal(client.calls, 2);
  assert.deepEqual(delays, [GEMINI_RETRY_DELAY_MS]);
  assert.equal(records.length, 1);
  assert.deepEqual(records[0], {
    operation: "ai.coach", provider: "gemini", model: GEMINI_MODEL_ID,
    timestamp: new Date(1000).toISOString(), latencyMs: 0, success: true, attempts: 2,
    inputTokens: 34, outputTokens: 29,
  });
});

test("429 may retry once and exhausted attempts map to a safe failure", async () => {
  const client = new TestGeminiClient(() => { throw { status: 429 }; });
  const records: GeminiUsageRecord[] = [];
  const provider = new GeminiAiCoachProvider({ client, logger: (record) => records.push(record), sleep: async () => undefined });
  await withServer(provider, async (baseUrl) => {
    const response = await post(baseUrl, request);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, error: "coach_unavailable" });
  });
  assert.equal(client.calls, GEMINI_MAX_ATTEMPTS);
  assert.equal(records[0].failureCategory, "rate_limited");
  assert.equal(records[0].success, false);
});

test("connection failures retry once, while provider request errors do not", async () => {
  const transient = new TestGeminiClient((call) => {
    if (call === 1) throw { cause: { code: "ECONNRESET" } };
    return successfulResult();
  });
  assert.equal(validateAiCoachAdvice(await providerFor(transient).getAdvice(request)), true);
  assert.equal(transient.calls, 2);

  const badRequest = new TestGeminiClient(() => { throw { status: 400 }; });
  await assert.rejects(providerFor(badRequest).getAdvice(request), { name: "GeminiProviderFailure" });
  assert.equal(badRequest.calls, 1);
});

test("per-attempt timeout aborts requests and stays within two attempts", async () => {
  let abortCount = 0;
  const client = new TestGeminiClient((_call, _request, signal) => new Promise((_resolve) => {
    signal.addEventListener("abort", () => { abortCount += 1; }, { once: true });
  }));
  const records: GeminiUsageRecord[] = [];
  const provider = new GeminiAiCoachProvider({
    client,
    timeoutMs: 5,
    retryDelayMs: 1,
    logger: (record) => records.push(record),
    sleep: async () => undefined,
  });
  await assert.rejects(provider.getAdvice(request), { name: "GeminiProviderFailure" });
  assert.equal(client.calls, GEMINI_MAX_ATTEMPTS);
  assert.equal(abortCount, GEMINI_MAX_ATTEMPTS);
  assert.equal(records[0].failureCategory, "timeout");
});

test("401 and 403 authentication failures are not retried", async () => {
  for (const status of [401, 403]) {
    const client = new TestGeminiClient(() => { throw { status }; });
    const records: GeminiUsageRecord[] = [];
    const provider = new GeminiAiCoachProvider({ client, logger: (record) => records.push(record), sleep: async () => undefined });
    await assert.rejects(provider.getAdvice(request), { name: "GeminiProviderFailure" });
    assert.equal(client.calls, 1);
    assert.equal(records[0].failureCategory, "authentication");
  }
});

test("invalid local input is rejected before Gemini client invocation", async () => {
  const client = new TestGeminiClient(() => successfulResult());
  await withServer(providerFor(client), async (baseUrl) => {
    const response = await post(baseUrl, { runs: [] });
    assert.equal(response.status, 400);
    const providerCallCount = client.calls;
    assert.equal(providerCallCount, 0);
  });
});

test("Gemini config reports missing key without revealing values and fake mode needs no key", () => {
  assert.deepEqual(parseAiCoachRuntimeConfig({}), { provider: "fake", model: GEMINI_MODEL_ID });
  assert.ok(createAiCoachProvider(parseAiCoachRuntimeConfig({})) instanceof FakeAiCoachProvider);
  const geminiConfig = parseAiCoachRuntimeConfig({ AI_COACH_PROVIDER: "gemini", GEMINI_API_KEY: "unit-test-placeholder" });
  assert.ok(createAiCoachProvider(geminiConfig) instanceof GeminiAiCoachProvider);
  assert.throws(
    () => parseAiCoachRuntimeConfig({ AI_COACH_PROVIDER: "gemini", GEMINI_API_KEY: "" }),
    (error: unknown) => error instanceof Error && error.message.includes("GEMINI_API_KEY is required") && !error.message.includes("secret"),
  );
  assert.throws(() => parseAiCoachRuntimeConfig({ GEMINI_MODEL: "another-model" }), /GEMINI_MODEL must be gemini-3\.5-flash-lite/);
});

test("SDK retry settings leave exactly one attempt to the explicit reliability layer", async () => {
  let optionsSeen: Parameters<GeminiSdkFactory>[1] | undefined;
  const sdkFactory: GeminiSdkFactory = (_apiKey, httpOptions) => {
    optionsSeen = httpOptions;
    return { create: async () => ({ outputText: JSON.stringify(advice) }) };
  };
  const provider = new GeminiAiCoachProvider({ apiKey: "unit-test-placeholder", sdkFactory, logger: () => undefined });
  await provider.getAdvice(request);
  assert.equal(optionsSeen?.timeout, GEMINI_ATTEMPT_TIMEOUT_MS);
  assert.deepEqual(optionsSeen?.retryOptions, { attempts: 1, httpStatusCodes: [] });
});

test("official Gemini SDK CommonJS entry can be created without making a network request", () => {
  const client = createGeminiSdkFactory()("unit-test-placeholder", {
    timeout: GEMINI_ATTEMPT_TIMEOUT_MS,
    retryOptions: { attempts: 1, httpStatusCodes: [] },
  });
  assert.equal(typeof client.create, "function");
});
