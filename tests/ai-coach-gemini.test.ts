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
  GEMINI_RETRY_DELAY_MS,
  createGeminiSdkFactory,
  buildGeminiGenerateContentRequest,
  GEMINI_SDK_HTTP_OPTIONS,
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

function providerFor(client: GeminiGenerateContentClient, logger: (record: GeminiUsageRecord) => void = () => undefined): GeminiAiCoachProvider {
  return new GeminiAiCoachProvider({ client, model: GEMINI_MODEL_ID, logger, sleep: async () => undefined });
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
  const properties = input.config.responseJsonSchema.properties as Record<string, { enum?: string[] }>;
  assert.deepEqual(properties.primaryCategory.enum, ["threat_management", "bounce_strategy", "aim_timing", "positioning", "range_management", "general"]);
  assert.equal(input.config.maxOutputTokens, 512);
  assert.equal(input.config.systemInstruction.includes("SELFBOUND AI Coach"), true);
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

test("malformed and contract-invalid provider output return safe 503 without retry", async () => {
  for (const text of ["not json", JSON.stringify({ ...advice, primaryCategory: "unapproved" })]) {
    const client = new TestGeminiClient(() => successfulResult(text));
    await withServer(providerFor(client), async (baseUrl) => {
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
    client, model: GEMINI_MODEL_ID, logger: (record) => records.push(record),
    sleep: async (milliseconds) => { delays.push(milliseconds); }, now: () => 1000,
  });
  assert.equal(validateAiCoachAdvice(await provider.getAdvice(request)), true);
  assert.equal(client.calls, 2);
  assert.deepEqual(delays, [GEMINI_RETRY_DELAY_MS]);
  assert.equal(records.length, 1);
  assert.deepEqual(records[0], {
    operation: "ai.coach", provider: "gemini", model: GEMINI_MODEL_ID,
    timestamp: records[0].timestamp, latencyMs: 0, success: true, attempts: 2,
    inputTokens: 34, outputTokens: 29,
    totalTokens: 63,
  });
  assert.equal(Number.isNaN(Date.parse(records[0].timestamp)), false);
});

test("retryable statuses and network errors retry at most once; 400/401/403 do not", async () => {
  for (const status of [408, 429, 500, 502, 503, 504]) {
    const client = new TestGeminiClient((call) => {
      if (call === 1) throw { status };
      return successfulResult();
    });
    assert.equal(validateAiCoachAdvice(await providerFor(client).getAdvice(request)), true);
    assert.equal(client.calls, GEMINI_MAX_ATTEMPTS);
  }

  const network = new TestGeminiClient((call) => {
    if (call === 1) throw Object.assign(new TypeError("network failure"), { cause: { code: "ECONNRESET" } });
    return successfulResult();
  });
  assert.equal(validateAiCoachAdvice(await providerFor(network).getAdvice(request)), true);
  assert.equal(network.calls, 2);

  for (const status of [400, 401, 403]) {
    const client = new TestGeminiClient(() => { throw { status }; });
    await assert.rejects(providerFor(client).getAdvice(request), { name: "GeminiProviderFailure" });
    assert.equal(client.calls, 1);
  }
});

test("15-second total deadline aborts a hung call and produces safe 503", async () => {
  let abortCount = 0;
  const client = new TestGeminiClient((_call, _input, signal) => new Promise((_resolve) => {
    signal.addEventListener("abort", () => { abortCount += 1; }, { once: true });
  }));
  const records: GeminiUsageRecord[] = [];
  const provider = new GeminiAiCoachProvider({ client, totalDeadlineMs: 10, logger: (record) => records.push(record) });
  await withServer(provider, async (baseUrl) => {
    const started = Date.now();
    const response = await post(baseUrl, request);
    assert.equal(Date.now() - started < 1000, true);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, error: "coach_unavailable" });
  });
  assert.equal(client.calls, 1);
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
    return new Promise((_resolve) => undefined);
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
    client: wrappedClient, totalDeadlineMs: 2600, retryDelayMs: 100,
    now: () => clock,
    sleep: async (ms) => { delays.push(ms); clock += ms; },
    logger: () => undefined,
  });
  await assert.rejects(provider.getAdvice(request), { name: "GeminiProviderFailure" });
  assert.deepEqual(delays, [100]);
  assert.equal(client.calls, 2);
  assert.equal(signals[1].aborted, true);
});

test("no second request starts when the retry delay leaves too little useful attempt time", async () => {
  let clock = 0;
  const client = new TestGeminiClient(() => { clock += 900; throw { status: 503 }; });
  const delays: number[] = [];
  const provider = new GeminiAiCoachProvider({
    client, totalDeadlineMs: 2600, retryDelayMs: 500,
    now: () => clock, sleep: async (ms) => { delays.push(ms); clock += ms + 700; },
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
  assert.deepEqual(parseAiCoachRuntimeConfig({}), { provider: "fake", model: GEMINI_MODEL_ID });
  assert.ok(createAiCoachProvider(parseAiCoachRuntimeConfig({})) instanceof FakeAiCoachProvider);
  const geminiConfig = parseAiCoachRuntimeConfig({ AI_COACH_PROVIDER: "gemini", GEMINI_API_KEY: "unit-test-placeholder" });
  assert.ok(createAiCoachProvider(geminiConfig) instanceof GeminiAiCoachProvider);
  assert.throws(
    () => parseAiCoachRuntimeConfig({ AI_COACH_PROVIDER: "gemini", GEMINI_API_KEY: "" }),
    (error: unknown) => error instanceof Error && error.message.includes("GEMINI_API_KEY is required") && !error.message.includes("secret"),
  );
  assert.throws(() => parseAiCoachRuntimeConfig({ GEMINI_MODEL: "another-model" }), /GEMINI_MODEL must be gemini-3\.1-flash-lite/);
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
  assert.deepEqual(await client.generateContent(input, new AbortController().signal), successfulResult());
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
