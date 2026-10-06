import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyTrainingPlanGeminiFailure,
  createTrainingPlanGeminiClientFactory,
  GeminiTrainingPlanProvider,
  TRAINING_PLAN_GEMINI_MAX_OUTPUT_TOKENS,
  TrainingPlanGeminiHttpOptions,
  TrainingPlanGeminiRequest,
} from "../backend/src/gemini-training-plan-provider.js";
import { parseTrainingPlanRuntimeConfig, TrainingPlanConfigurationError } from "../backend/src/training-plan-config.js";
import { createTrainingPlanModelStepInput } from "../backend/src/training-plan-prompt.js";
import { TrainingPlanProviderFailure } from "../backend/src/training-plan-provider.js";

const proposal = { kind: "tool_call", tool: "get_recent_run_evidence", arguments: { limit: 1 } };
function input() {
  return createTrainingPlanModelStepInput({
    step: 1,
    state: "evidence_required",
    currentRunCount: 1,
    currentSequences: [1],
    allowedTools: [{ name: "get_recent_run_evidence", arguments: "{limit:1|2|3}", description: "Get normalized recent evidence." }],
    toolResults: [],
  });
}

test("W05 Gemini configuration uses its independent names and model allowlist", () => {
  assert.deepEqual(parseTrainingPlanRuntimeConfig({ TRAINING_PLAN_PROVIDER: "gemini", TRAINING_PLAN_GEMINI_API_KEY: "placeholder", TRAINING_PLAN_GEMINI_MODEL: "gemini-3.1-flash-lite" }), {
    provider: "gemini", model: "gemini-3.1-flash-lite", apiKey: "placeholder",
  });
  assert.throws(() => parseTrainingPlanRuntimeConfig({ TRAINING_PLAN_PROVIDER: "gemini", TRAINING_PLAN_GEMINI_API_KEY: "placeholder", TRAINING_PLAN_GEMINI_MODEL: "other-model" }), TrainingPlanConfigurationError);
});

test("adapter makes one provider request with JSON schema and SDK retries disabled", async () => {
  let providerCalls = 0;
  let optionsSeen: TrainingPlanGeminiHttpOptions | undefined;
  let requestSeen: TrainingPlanGeminiRequest | undefined;
  let signalSeen: AbortSignal | undefined;
  const provider = new GeminiTrainingPlanProvider("offline-placeholder", "gemini-3.1-flash-lite", (_key, options) => {
    optionsSeen = options;
    return { generateContent: async (request, signal) => { providerCalls += 1; requestSeen = request; signalSeen = signal; return { text: JSON.stringify(proposal) }; } };
  });
  const signal = new AbortController().signal;
  assert.deepEqual(await provider.generateStep(input(), signal, 12_000), proposal);
  assert.equal(providerCalls, 1);
  assert.equal(signalSeen, signal);
  assert.equal(optionsSeen?.timeout, 12_000);
  assert.deepEqual(optionsSeen?.retryOptions, { attempts: 1, httpStatusCodes: [] });
  assert.equal(requestSeen?.model, "gemini-3.1-flash-lite");
  assert.equal(requestSeen?.config.responseMimeType, "application/json");
  assert.equal(requestSeen?.config.maxOutputTokens, TRAINING_PLAN_GEMINI_MAX_OUTPUT_TOKENS);
  assert.equal("tools" in (requestSeen ?? {}), false);
  assert.equal(requestSeen?.contents.includes("shotsFired"), false);
  assert.equal(requestSeen?.config.responseJsonSchema.oneOf instanceof Array, true);
});

test("adapter rejects timeout, malformed/oversized output, refusal, and normalizes failures safely", async () => {
  const noRequest = new GeminiTrainingPlanProvider("offline-placeholder", undefined, () => ({ generateContent: async () => ({ text: "{}" }) }));
  await assert.rejects(noRequest.generateStep(input(), new AbortController().signal, 0), { name: "TrainingPlanProviderFailure" });
  const malformed = new GeminiTrainingPlanProvider("offline-placeholder", undefined, () => ({ generateContent: async () => ({ text: "not json" }) }));
  await assert.rejects(malformed.generateStep(input(), new AbortController().signal, 1), (error: unknown) => error instanceof TrainingPlanProviderFailure && error.kind === "invalid_output");
  const tooLarge = new GeminiTrainingPlanProvider("offline-placeholder", undefined, () => ({ generateContent: async () => ({ text: `${" ".repeat(8 * 1024)}${JSON.stringify(proposal)}` }) }));
  await assert.rejects(tooLarge.generateStep(input(), new AbortController().signal, 1), (error: unknown) => error instanceof TrainingPlanProviderFailure && error.kind === "invalid_output");
  const refusal = new GeminiTrainingPlanProvider("offline-placeholder", undefined, () => ({ generateContent: async () => ({ text: "{}", safetyRefusal: true }) }));
  await assert.rejects(refusal.generateStep(input(), new AbortController().signal, 1), (error: unknown) => error instanceof TrainingPlanProviderFailure && error.kind === "refusal");
  assert.equal(classifyTrainingPlanGeminiFailure({ status: 429 }).kind, "rate_limit");
  assert.equal(classifyTrainingPlanGeminiFailure({ status: 503 }).kind, "temporary_service");
  assert.equal(classifyTrainingPlanGeminiFailure({ status: 401 }).kind, "authentication");
  assert.equal(classifyTrainingPlanGeminiFailure({ cause: { code: "ECONNRESET" } }).kind, "transient_network");
  assert.equal(classifyTrainingPlanGeminiFailure({ cause: { code: "ETIMEDOUT" } }).kind, "timeout");
});

test("real SDK transport double observes one offline HTTP request, expected schema, and AbortSignal", async () => {
  let calls = 0;
  let sawAbortSignal = false;
  const sdkFactory = createTrainingPlanGeminiClientFactory();
  const client = sdkFactory("offline-placeholder", {
    timeout: 3_000,
    retryOptions: { attempts: 1, httpStatusCodes: [] },
    fetch: async (resource, init) => {
      calls += 1;
      const outgoing = new Request(resource, init);
      assert.equal(outgoing.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent");
      const body = await outgoing.json() as Record<string, unknown>;
      assert.equal("tools" in body, false);
      const generationConfig = body.generationConfig as Record<string, unknown>;
      assert.equal(generationConfig.responseMimeType, "application/json");
      assert.equal(generationConfig.maxOutputTokens, 100);
      assert.equal(typeof generationConfig.responseJsonSchema, "object");
      const aborted = new Promise<never>((_resolve, reject) => outgoing.signal.addEventListener("abort", () => {
        sawAbortSignal = true;
        reject(new DOMException("offline abort", "AbortError"));
      }, { once: true }));
      return Promise.race([Promise.resolve(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(proposal) }] } }] }), { status: 200, headers: { "Content-Type": "application/json" } })), aborted]);
    },
  });
  const controller = new AbortController();
  const response = await client.generateContent({
    model: "gemini-3.1-flash-lite", contents: JSON.stringify(input()),
    config: { systemInstruction: "Bounded W05 instructions", responseMimeType: "application/json", responseJsonSchema: {}, maxOutputTokens: 100 },
  }, controller.signal);
  assert.equal(response.text, JSON.stringify(proposal));
  assert.equal(calls, 1);
  assert.equal(sawAbortSignal, false);
});

test("real SDK transport double makes one HTTP attempt on server failure", async () => {
  let calls = 0;
  const client = createTrainingPlanGeminiClientFactory()("offline-placeholder", {
    timeout: 1_000,
    retryOptions: { attempts: 1, httpStatusCodes: [] },
    fetch: async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: { code: 503, message: "offline failure" } }), { status: 503, headers: { "Content-Type": "application/json" } });
    },
  });
  await assert.rejects(client.generateContent({
    model: "gemini-3.1-flash-lite", contents: "{}",
    config: { systemInstruction: "offline", responseMimeType: "application/json", responseJsonSchema: {}, maxOutputTokens: 100 },
  }, new AbortController().signal));
  assert.equal(calls, 1);
});

test("real SDK transport double propagates cancellation without a live request", async () => {
  const controller = new AbortController();
  let calls = 0;
  let observedAbort = false;
  const client = createTrainingPlanGeminiClientFactory()("offline-placeholder", {
    timeout: 1_000,
    retryOptions: { attempts: 1, httpStatusCodes: [] },
    fetch: async (resource, init) => {
      calls += 1;
      const outgoing = new Request(resource, init);
      const pending = new Promise<Response>((_resolve, reject) => outgoing.signal.addEventListener("abort", () => {
        observedAbort = true;
        reject(new DOMException("offline cancellation", "AbortError"));
      }, { once: true }));
      controller.abort();
      return pending;
    },
  });
  await assert.rejects(client.generateContent({
    model: "gemini-3.1-flash-lite", contents: "{}",
    config: { systemInstruction: "offline", responseMimeType: "application/json", responseJsonSchema: {}, maxOutputTokens: 100 },
  }, controller.signal));
  assert.equal(calls, 1);
  assert.equal(observedAbort, true);
});

test("Gemini adapter cancellation reaches its injected model transport", async () => {
  const controller = new AbortController();
  let calls = 0;
  let sawSignal: AbortSignal | undefined;
  const provider = new GeminiTrainingPlanProvider("offline-placeholder", undefined, () => ({ generateContent: (_request, signal) => {
    calls += 1;
    sawSignal = signal;
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("offline abort", "AbortError")), { once: true }));
  } }));
  const pending = provider.generateStep(input(), controller.signal, 2_000);
  controller.abort();
  await assert.rejects(pending, (error: unknown) => error instanceof TrainingPlanProviderFailure && error.kind === "cancelled");
  assert.equal(calls, 1);
  assert.equal(sawSignal, controller.signal);
});

