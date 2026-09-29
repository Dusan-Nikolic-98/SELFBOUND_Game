import assert from "node:assert/strict";
import test from "node:test";
import { AddressInfo } from "node:net";
import { AiCoachRequest, validateAiCoachAdvice, validateAiCoachRequest } from "../backend/src/ai-coach-contract.js";
import { GEMINI_MODEL_ID, parseAiCoachRuntimeConfig } from "../backend/src/ai-coach-config.js";
import { createAiCoachProvider } from "../backend/src/ai-coach-runtime.js";
import {
  GeminiAiCoachProvider,
  GeminiGenerateContentRequest,
  GeminiGenerateContentResult,
  GeminiGenerateContentClient,
  GeminiSdkFactory,
  GeminiHttpOptions,
  GeminiUsageRecord,
  GEMINI_TOTAL_DEADLINE_MS,
  GEMINI_MAX_ATTEMPTS,
  GEMINI_MAX_PROVIDER_CALLS,
  GEMINI_RETRY_DELAY_MS,
  AiFailureClass,
  createGeminiSdkFactory,
  buildGeminiGenerateContentRequest,
  GEMINI_SDK_HTTP_OPTIONS,
} from "../backend/src/gemini-ai-coach-provider.js";
import { AiCoachProvider, FakeAiCoachProvider } from "../backend/src/ai-coach-provider.js";
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

function successfulResult(text = JSON.stringify(advice)): GeminiGenerateContentResult {
  return { text, usage: { inputTokens: 34, outputTokens: 29, totalTokens: 63 } };
}

class TestGeminiClient implements GeminiGenerateContentClient {
  calls = 0;
  requests: GeminiGenerateContentRequest[] = [];
  constructor(private readonly respond: (call: number, request: GeminiGenerateContentRequest, signal: AbortSignal) => Promise<GeminiGenerateContentResult> | GeminiGenerateContentResult) {}
  async generateContent(input: GeminiGenerateContentRequest, signal: AbortSignal): Promise<GeminiGenerateContentResult> {
    this.calls += 1;
    this.requests.push(input);
    return this.respond(this.calls, input, signal);
  }
}

async function withServer<T>(provider: AiCoachProvider, run: (baseUrl: string) => Promise<T>): Promise<T> {
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

function providerFor(client: GeminiGenerateContentClient, logger: (record: GeminiUsageRecord) => void = () => undefined): GeminiAiCoachProvider {
  return new GeminiAiCoachProvider({ client, model: GEMINI_MODEL_ID, logger, sleep: async () => undefined, random: () => 0 });
}

test("GenerateContent request uses bounded telemetry, production instruction, schema, and no tools/history", async () => {
  const client = new TestGeminiClient(() => successfulResult());
  const output = await providerFor(client).getAdvice(request);
  assert.equal(validateAiCoachAdvice(output), true);
  assert.equal(client.calls, 1);

  const input = client.requests[0];
  assert.equal(input.model, GEMINI_MODEL_ID);
  assert.deepEqual(JSON.parse(input.contents), request);
  assert.equal(input.config.responseMimeType, "application/json");
  assert.deepEqual(input.config.responseJsonSchema.required, ["summary", "primaryCategory", "primaryAdvice", "practiceGoal"]);
  const properties = input.config.responseJsonSchema.properties as Record<string, { enum?: string[]; maxLength?: number }>;
  assert.deepEqual(properties.primaryCategory.enum, ["threat_management", "bounce_strategy", "aim_timing", "positioning", "range_management", "general"]);
  assert.equal(properties.secondaryAdvice.maxLength, 300);
  assert.equal((input.config.responseJsonSchema.required as string[]).includes("secondaryAdvice"), false);
  assert.equal(input.config.maxOutputTokens, 512);
  assert.equal(input.config.systemInstruction.includes("SELFBOUND AI Coach"), true);
  assert.match(input.config.systemInstruction, /only the required Coach structure/i);
  assert.equal("tools" in input, false);
  assert.equal("history" in input, false);
  assert.equal("store" in input, false);
});

test("GenerateContent valid structured output passes runtime validation and returns HTTP 200", async () => {
  const provider = providerFor(new TestGeminiClient(() => successfulResult()));
  await withServer(provider, async (baseUrl) => {
    const response = await post(baseUrl, request);
    assert.equal(response.status, 200);
    const body = await response.json() as { advice: unknown };
    assert.equal(validateAiCoachAdvice(body.advice), true);
  });
});

test("primary first-call success has no fallback or repair", async () => {
  const records: GeminiUsageRecord[] = [];
  const client = new TestGeminiClient(() => successfulResult());
  const provider = new GeminiAiCoachProvider({ client, logger: (record) => records.push(record) });
  assert.equal(validateAiCoachAdvice(await provider.getAdvice(request)), true);
  assert.equal(client.calls, 1);
  const summary = records[records.length - 1];
  assert.equal(summary.success, true);
  assert.equal(summary.attempts, 1);
  assert.equal(summary.fallbackUsed, false);
  assert.equal(summary.repairUsed, false);
});

test("malformed and contract-invalid provider output gets one repair then safe 503", async () => {
  for (const text of ["not json", JSON.stringify({ ...advice, primaryCategory: "unapproved" })]) {
    const client = new TestGeminiClient(() => successfulResult(text));
    const records: GeminiUsageRecord[] = [];
    await withServer(providerFor(client, (record) => records.push(record)), async (baseUrl) => {
      const response = await post(baseUrl, request);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { ok: false, error: "coach_unavailable" });
      assert.equal(client.calls, 2);
      assert.equal(client.requests[1].config.systemInstruction.includes("previous generation could not be accepted"), true);
      assert.equal(records.find((record) => record.attempt?.attemptKind === "repair")?.attempt?.failureClass, text === "not json" ? "invalid_json" : "schema_validation_failed");
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
    client, model: GEMINI_MODEL_ID, logger: (record) => records.push(record),
    sleep: async (milliseconds) => { delays.push(milliseconds); }, now: () => 1000, random: () => 0,
  });
  assert.equal(validateAiCoachAdvice(await provider.getAdvice(request)), true);
  assert.equal(client.calls, 2);
  assert.deepEqual(delays, [GEMINI_RETRY_DELAY_MS]);
  assert.equal(records.length, 3);
  assert.deepEqual(records.slice(0, 2).map((record) => [record.attempt?.attemptKind, record.attempt?.status, record.attempt?.attemptNumber]), [["initial", "failure", 1], ["retry", "success", 2]]);
  assert.equal(records[2].success, true);
  assert.equal(records[2].attempts, 2);
  assert.equal(records[2].inputTokens, 34);
  assert.equal(Number.isNaN(Date.parse(records[2].timestamp)), false);
});

test("retryable statuses and network errors retry at most once; 400/401/403 do not", async () => {
  for (const status of [408, 429, 500, 502, 503, 504]) {
    const client = new TestGeminiClient((call) => {
      if (call === 1) throw { status };
      return successfulResult();
    });
    if (status === 408) {
      await assert.rejects(providerFor(client).getAdvice(request));
      assert.equal(client.calls, 1);
    } else {
      assert.equal(validateAiCoachAdvice(await providerFor(client).getAdvice(request)), true);
      assert.equal(client.calls, GEMINI_MAX_ATTEMPTS);
    }
  }

  const network = new TestGeminiClient((call) => {
    if (call === 1) throw Object.assign(new TypeError("network failure"), { cause: { code: "ECONNRESET" } });
    return successfulResult();
  });
  assert.equal(validateAiCoachAdvice(await providerFor(network).getAdvice(request)), true);
  assert.equal(network.calls, 2);

  for (const status of [400, 401, 403]) {
    const calls: string[] = [];
    const provider = new GeminiAiCoachProvider({
      modelChain: [GEMINI_MODEL_ID, "gemini-3.5-flash-lite"],
      clientFactory: (model) => ({ generateContent: async () => { calls.push(model); throw { status }; } }),
      logger: () => undefined,
    });
    await assert.rejects(provider.getAdvice(request), { name: "GeminiProviderFailure" });
    assert.deepEqual(calls, [GEMINI_MODEL_ID]);
  }
});

test("429 Retry-After is honored within the shared deadline and remains bounded", async () => {
  const delays: number[] = [];
  const client = new TestGeminiClient((call) => {
    if (call === 1) throw { status: 429, headers: { "retry-after": "2" } };
    return successfulResult();
  });
  const provider = new GeminiAiCoachProvider({ client, retryDelayMs: 20, random: () => 0, sleep: async (ms) => { delays.push(ms); }, logger: () => undefined });
  assert.equal(validateAiCoachAdvice(await provider.getAdvice(request)), true);
  assert.deepEqual(delays, [1500]);
  assert.equal(client.calls, 2);
});

test("transient primary exhaustion uses allowlisted fallback as third and final call", async () => {
  const calls: string[] = [];
  const records: GeminiUsageRecord[] = [];
  const provider = new GeminiAiCoachProvider({
    modelChain: [GEMINI_MODEL_ID, "gemini-3.5-flash-lite"],
    clientFactory: (model) => ({ generateContent: async () => {
      calls.push(model);
      if (model === GEMINI_MODEL_ID) throw { status: 503 };
      return successfulResult();
    } }),
    random: () => 0, sleep: async () => undefined, logger: (record) => records.push(record),
  });
  assert.equal(validateAiCoachAdvice(await provider.getAdvice(request)), true);
  assert.deepEqual(calls, [GEMINI_MODEL_ID, GEMINI_MODEL_ID, "gemini-3.5-flash-lite"]);
  assert.equal(calls.length, GEMINI_MAX_PROVIDER_CALLS);
  assert.deepEqual(records.filter((record) => record.attempt).map((record) => [record.attempt?.attemptKind, record.attempt?.model]), [
    ["initial", GEMINI_MODEL_ID], ["retry", GEMINI_MODEL_ID], ["fallback", "gemini-3.5-flash-lite"],
  ]);
  assert.equal(records[records.length - 1]?.fallbackUsed, true);
});

test("all configured models failing transiently stops after three calls with safe summary", async () => {
  const calls: string[] = [];
  const records: GeminiUsageRecord[] = [];
  const provider = new GeminiAiCoachProvider({
    modelChain: [GEMINI_MODEL_ID, "gemini-3.5-flash-lite"],
    clientFactory: (model) => ({ generateContent: async () => { calls.push(model); throw { status: 503 }; } }),
    random: () => 0, sleep: async () => undefined, logger: (record) => records.push(record),
  });
  await assert.rejects(provider.getAdvice(request));
  assert.deepEqual(calls, [GEMINI_MODEL_ID, GEMINI_MODEL_ID, "gemini-3.5-flash-lite"]);
  assert.equal(records[records.length - 1]?.success, false);
  assert.equal(records[records.length - 1]?.failureCategory, "provider_unavailable");
  assert.equal(records[records.length - 1]?.attempts, GEMINI_MAX_PROVIDER_CALLS);
});

test("model-not-found may fallback, arbitrary 404 does not", async () => {
  for (const failure of [{ status: 404 }, { status: 404, message: "model gemini-3.1-flash-lite not found" }]) {
    const models: string[] = [];
    const provider = new GeminiAiCoachProvider({
      modelChain: [GEMINI_MODEL_ID, "gemini-3.5-flash-lite"],
      clientFactory: (model) => ({ generateContent: async () => { models.push(model); if (model === GEMINI_MODEL_ID) throw failure; return successfulResult(); } }),
      logger: () => undefined,
    });
    const valid = await provider.getAdvice(request).then((value) => validateAiCoachAdvice(value), () => false);
    assert.equal(valid, failure.message ? true : false);
    assert.deepEqual(models, failure.message ? [GEMINI_MODEL_ID, "gemini-3.5-flash-lite"] : [GEMINI_MODEL_ID]);
  }
});

test("output classifications distinguish empty, JSON, schema, and semantic failures", async () => {
  const longAdvice = { ...advice, summary: "s".repeat(240), primaryAdvice: "p".repeat(500), secondaryAdvice: "s".repeat(300), practiceGoal: "g".repeat(180) };
  const cases: Array<[string | undefined, AiFailureClass]> = [
    [undefined, "empty_provider_output"], ["{", "invalid_json"], [JSON.stringify({ ...advice, extra: "field" }), "schema_validation_failed"], [JSON.stringify(longAdvice), "semantic_validation_failed"],
  ];
  for (const [text, expected] of cases) {
    const records: GeminiUsageRecord[] = [];
    const client = new TestGeminiClient(() => ({ ...(text === undefined ? {} : { text }) }));
    const provider = providerFor(client, (record) => records.push(record));
    await assert.rejects(provider.getAdvice(request));
    assert.equal(records.find((record) => record.attempt?.attemptKind === "repair")?.attempt?.failureClass, expected);
    assert.equal(client.calls, 2);
  }
});

test("invalid repair never model-hops and safety refusal is not retried", async () => {
  const calls: string[] = [];
  const provider = new GeminiAiCoachProvider({
    modelChain: [GEMINI_MODEL_ID, "gemini-3.5-flash-lite"],
    clientFactory: (model) => ({ generateContent: async () => { calls.push(model); return { text: "not-json" }; } }),
    logger: () => undefined,
  });
  await assert.rejects(provider.getAdvice(request));
  assert.deepEqual(calls, [GEMINI_MODEL_ID, GEMINI_MODEL_ID]);
  const refusalCalls: string[] = [];
  const refusal = new GeminiAiCoachProvider({
    modelChain: [GEMINI_MODEL_ID, "gemini-3.5-flash-lite"],
    clientFactory: (model) => ({ generateContent: async () => { refusalCalls.push(model); return { safetyRefusal: true }; } }),
    logger: () => undefined,
  });
  await assert.rejects(refusal.getAdvice(request));
  assert.deepEqual(refusalCalls, [GEMINI_MODEL_ID]);
});

test("telemetry records ordered sanitized attempts without request or provider content", async () => {
  const privateRequest = { runs: [{ ...request.runs[0], targetStats: [{ targetId: "PRIVATE_REQUEST_SENTINEL", attempts: 0, captures: 0, failedShots: 0, blockedDirectAttempts: 0, bouncedAttempts: 0, rushedBouncedFailures: 0, samePositionFailures: 0, rangeExpirations: 0 }] }] } as AiCoachRequest;
  const records: GeminiUsageRecord[] = [];
  const client = new TestGeminiClient((call) => call === 1 ? { text: "PRIVATE_RESPONSE_SENTINEL" } : successfulResult());
  const value = await providerFor(client, (record) => records.push(record)).getAdvice(privateRequest);
  assert.equal(validateAiCoachAdvice(value), true);
  assert.deepEqual(records.filter((record) => record.attempt).map((record) => [record.attempt?.provider, record.attempt?.model, record.attempt?.attemptKind, record.attempt?.attemptNumber, record.attempt?.status]), [
    ["gemini", GEMINI_MODEL_ID, "initial", 1, "failure"], ["gemini", GEMINI_MODEL_ID, "repair", 2, "success"],
  ]);
  assert.equal(records.some((record) => record.attempt?.failureClass === "empty_provider_output" || record.attempt?.failureClass === "schema_validation_failed"), false);
  assert.equal(JSON.stringify(records).includes("PRIVATE_REQUEST_SENTINEL"), false);
  assert.equal(JSON.stringify(records).includes("PRIVATE_RESPONSE_SENTINEL"), false);
});

test("abort during pending backoff prevents a second provider call", async () => {
  const controller = new AbortController();
  const client = new TestGeminiClient(() => { throw { status: 503 }; });
  const provider = new GeminiAiCoachProvider({ client, sleep: async (_ms, signal) => { controller.abort(); if (signal?.aborted) throw new Error("aborted"); }, logger: () => undefined });
  await assert.rejects(provider.getAdvice(request, controller.signal));
  assert.equal(client.calls, 1);
});

test("request abort immediately settles even when provider work ignores AbortSignal", async () => {
  const controller = new AbortController();
  const client = new TestGeminiClient(() => new Promise(() => undefined));
  const provider = providerFor(client);
  const pending = provider.getAdvice(request, controller.signal);
  setTimeout(() => controller.abort(), 5);
  await assert.rejects(pending, (error: unknown) => error instanceof Error && error.name === "GeminiProviderFailure");
  assert.equal(client.calls, 1);
});

test("HTTP client disconnect aborts the provider signal", async () => {
  let receivedSignal: AbortSignal | undefined;
  let signalStarted!: () => void;
  const called = new Promise<void>((resolve) => { signalStarted = resolve; });
  const provider: AiCoachProvider = {
    getAdvice: async (_value, signal) => new Promise((_resolve) => {
      receivedSignal = signal;
      signalStarted();
      signal?.addEventListener("abort", () => _resolve(undefined), { once: true });
    }),
  };
  await withServer(provider, async (baseUrl) => {
    const controller = new AbortController();
    const pending = fetch(`${baseUrl}/api/ai/coach`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal: controller.signal }).catch(() => undefined);
    await called;
    controller.abort();
    await pending;
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(receivedSignal?.aborted, true);
  });
});

test("15-second total deadline aborts a hung call and produces safe 503", async () => {
  let abortCount = 0;
  const client = new TestGeminiClient((_call, _input, signal) => new Promise((_resolve) => {
    signal.addEventListener("abort", () => { abortCount += 1; }, { once: true });
  }));
  const records: GeminiUsageRecord[] = [];
  const models: string[] = [];
  const provider = new GeminiAiCoachProvider({ modelChain: [GEMINI_MODEL_ID, "gemini-3.5-flash-lite"], clientFactory: (model) => ({
    generateContent: (input, signal) => { models.push(model); return client.generateContent(input, signal); },
  }), totalDeadlineMs: 30, minimumAttemptBudgetMs: 1, logger: (record) => records.push(record) });
  await withServer(provider, async (baseUrl) => {
    const started = Date.now();
    const response = await post(baseUrl, request);
    assert.equal(Date.now() - started < 1000, true);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, error: "coach_unavailable" });
  });
  assert.equal(client.calls, 1);
  assert.deepEqual(models, [GEMINI_MODEL_ID]);
  assert.equal(abortCount, 1);
  assert.equal(records[0].failureCategory, "timeout");
  assert.equal(records[0].attempts, 1);
});

test("deadline is shared across retry delay and a second request gets only remaining time", async () => {
  let clock = 0;
  const client = new TestGeminiClient((call) => {
    if (call === 1) {
      clock += 800;
      throw { status: 503 };
    }
    clock += 1600;
    throw { status: 408 };
  });
  const delays: number[] = [];
  const signals: AbortSignal[] = [];
  const wrappedClient: GeminiGenerateContentClient = {
    generateContent: (input, signal) => {
      signals.push(signal);
      return client.generateContent(input, signal);
    },
  };
  const provider = new GeminiAiCoachProvider({
    client: wrappedClient, totalDeadlineMs: 2600, retryDelayMs: 100, minimumAttemptBudgetMs: 1,
    now: () => clock,
    sleep: async (ms) => { delays.push(ms); clock += ms; }, random: () => 0,
    logger: () => undefined,
  });
  await assert.rejects(provider.getAdvice(request), { name: "GeminiProviderFailure" });
  assert.deepEqual(delays, [100]);
  assert.equal(client.calls, 2);
  assert.equal(signals[1].aborted, false);
});

test("no second request starts when the retry delay leaves too little useful attempt time", async () => {
  let clock = 0;
  const client = new TestGeminiClient(() => { clock += 900; throw { status: 503 }; });
  const delays: number[] = [];
  const provider = new GeminiAiCoachProvider({
    client, totalDeadlineMs: 2600, retryDelayMs: 500,
    now: () => clock, sleep: async (ms) => { delays.push(ms); clock += ms + 700; }, random: () => 0,
    logger: () => undefined,
  });
  await assert.rejects(provider.getAdvice(request), { name: "GeminiProviderFailure" });
  assert.deepEqual(delays, [500]);
  assert.equal(client.calls, 1);
});

test("invalid local input is rejected before Gemini client invocation", async () => {
  const client = new TestGeminiClient(() => successfulResult());
  const invalid = { runs: [] } as unknown as AiCoachRequest;
  assert.equal(validateAiCoachRequest(invalid), false);
  await assert.rejects(providerFor(client).getAdvice(invalid), { name: "GeminiProviderFailure" });
  assert.equal(client.calls, 0);
  await withServer(providerFor(client), async (baseUrl) => {
    const response = await post(baseUrl, invalid);
    assert.equal(response.status, 400);
    assert.equal(client.calls, 0);
  });
});

test("Gemini config defaults to the migrated model; fake mode remains keyless", () => {
  assert.equal(GEMINI_MODEL_ID, "gemini-3.1-flash-lite");
  assert.deepEqual(parseAiCoachRuntimeConfig({}), { provider: "fake", model: GEMINI_MODEL_ID, modelChain: [GEMINI_MODEL_ID] });
  assert.ok(createAiCoachProvider(parseAiCoachRuntimeConfig({})) instanceof FakeAiCoachProvider);
  const geminiConfig = parseAiCoachRuntimeConfig({ AI_COACH_PROVIDER: "gemini", GEMINI_API_KEY: "unit-test-placeholder" });
  assert.ok(createAiCoachProvider(geminiConfig) instanceof GeminiAiCoachProvider);
  assert.throws(
    () => parseAiCoachRuntimeConfig({ AI_COACH_PROVIDER: "gemini", GEMINI_API_KEY: "" }),
    (error: unknown) => error instanceof Error && error.message.includes("GEMINI_API_KEY is required") && !error.message.includes("secret"),
  );
  assert.throws(() => parseAiCoachRuntimeConfig({ GEMINI_MODEL: "another-model" }), /GEMINI_MODEL must be gemini-3\.1-flash-lite/);
  assert.deepEqual(parseAiCoachRuntimeConfig({ AI_COACH_PROVIDER: "gemini", GEMINI_API_KEY: "x", GEMINI_MODEL_CHAIN: "gemini-3.1-flash-lite,gemini-3.5-flash-lite" }).modelChain, [GEMINI_MODEL_ID, "gemini-3.5-flash-lite"]);
  assert.throws(() => parseAiCoachRuntimeConfig({ GEMINI_MODEL_CHAIN: "gemini-3.1-flash-lite,arbitrary-model" }), /GEMINI_MODEL_CHAIN/);
});

test("SDK defaults disable hidden retries and use the total operation timeout", async () => {
  let optionsSeen: Parameters<GeminiSdkFactory>[1] | undefined;
  const sdkFactory: GeminiSdkFactory = (_apiKey, httpOptions) => {
    optionsSeen = httpOptions;
    return { generateContent: async () => ({ text: JSON.stringify(advice) }) };
  };
  await new GeminiAiCoachProvider({ apiKey: "unit-test-placeholder", sdkFactory, logger: () => undefined }).getAdvice(request);
  assert.equal(optionsSeen?.timeout, GEMINI_TOTAL_DEADLINE_MS);
  assert.deepEqual(optionsSeen?.retryOptions, { attempts: 1, httpStatusCodes: [] });
});

test("real GenerateContent SDK makes one HTTP attempt per provider call for transient errors", async () => {
  for (const failure of [429, 503, "network"] as const) {
    let calls = 0;
    const transport: NonNullable<GeminiHttpOptions["fetch"]> = async () => {
      calls += 1;
      if (failure === "network") throw new TypeError("Offline connection failure");
      return new Response(JSON.stringify({ error: { code: failure, message: "Offline failure" } }), {
        status: failure, headers: { "Content-Type": "application/json" },
      });
    };
    const client = createGeminiSdkFactory()("unit-test-placeholder", { ...GEMINI_SDK_HTTP_OPTIONS, fetch: transport });
    await assert.rejects(client.generateContent(buildGeminiGenerateContentRequest(request, GEMINI_MODEL_ID), new AbortController().signal));
    assert.equal(calls, 1);
  }
});

test("real SDK plus Coach policy caps transient HTTP calls at two total", async () => {
  let calls = 0;
  const sdkFactory: GeminiSdkFactory = (apiKey, httpOptions) => createGeminiSdkFactory()(apiKey, {
    ...httpOptions,
    fetch: async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: { code: 503, message: "Offline failure" } }), {
        status: 503, headers: { "Content-Type": "application/json" },
      });
    },
  });
  const provider = new GeminiAiCoachProvider({ apiKey: "unit-test-placeholder", sdkFactory, logger: () => undefined, sleep: async () => undefined });
  await assert.rejects(provider.getAdvice(request), { name: "GeminiProviderFailure" });
  assert.equal(calls, 2);
});

test("real GenerateContent SDK sends expected wire fields and extracts response/usage", async () => {
  const input = buildGeminiGenerateContentRequest(request, GEMINI_MODEL_ID);
  const client = createGeminiSdkFactory()("unit-test-placeholder", {
    ...GEMINI_SDK_HTTP_OPTIONS,
    fetch: async (resource, init) => {
      const outgoing = new Request(resource, init);
      assert.equal(outgoing.url, `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent`);
      assert.equal(outgoing.method, "POST");
      const body = await outgoing.json() as Record<string, unknown>;
      assert.equal(body.contents instanceof Array, true);
      assert.deepEqual(body.generationConfig, {
        maxOutputTokens: 512,
        responseMimeType: "application/json",
        responseJsonSchema: input.config.responseJsonSchema,
      });
      assert.deepEqual(body.systemInstruction, { parts: [{ text: input.config.systemInstruction }], role: "user" });
      assert.equal("tools" in body, false);
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(advice) }] } }],
        usageMetadata: { promptTokenCount: 34, candidatesTokenCount: 29, totalTokenCount: 63 },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  assert.deepEqual(await client.generateContent(input, new AbortController().signal), { ...successfulResult(), safetyRefusal: false });
});

test("real GenerateContent SDK forwards AbortSignal to transport", async () => {
  const controller = new AbortController();
  let observedAbort = false;
  let calls = 0;
  const client = createGeminiSdkFactory()("unit-test-placeholder", {
    ...GEMINI_SDK_HTTP_OPTIONS,
    fetch: async (resource, init) => {
      calls += 1;
      const outgoing = new Request(resource, init);
      const aborted = new Promise<never>((_resolve, reject) => {
        outgoing.signal.addEventListener("abort", () => {
          observedAbort = true;
          reject(new DOMException("Offline cancellation", "AbortError"));
        }, { once: true });
      });
      controller.abort();
      return aborted;
    },
  });
  await assert.rejects(client.generateContent(buildGeminiGenerateContentRequest(request, GEMINI_MODEL_ID), controller.signal));
  assert.equal(observedAbort, true);
  assert.equal(calls, 1);
});

test("official Gemini SDK CommonJS entry can be created without a network request", () => {
  const client = createGeminiSdkFactory()("unit-test-placeholder", GEMINI_SDK_HTTP_OPTIONS);
  assert.equal(typeof client.generateContent, "function");
});
