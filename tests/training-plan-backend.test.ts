import assert from "node:assert/strict";
import test from "node:test";
import { AddressInfo } from "node:net";
import { request as httpRequest } from "node:http";
import { AiCoachProvider, FakeAiCoachProvider } from "../backend/src/ai-coach-provider.js";
import { TrainingPlanRequest } from "../backend/src/training-plan-contract.js";
import { parseTrainingPlanRuntimeConfig, TrainingPlanConfigurationError } from "../backend/src/training-plan-config.js";
import { FakeTrainingPlanProvider, ScriptedTrainingPlanProvider } from "../backend/src/fake-training-plan-provider.js";
import { TrainingPlanOrchestrator } from "../backend/src/training-plan-orchestrator.js";
import { TrainingPlanToolRegistry } from "../backend/src/training-plan-tools.js";
import { TrainingPlanProviderFailure } from "../backend/src/training-plan-provider.js";
import { TrainingPlanModelStepProvider } from "../backend/src/training-plan-provider.js";
import { createServer } from "../backend/src/server.js";
import { CompletedRunSummary } from "../frontend/src/ai-coach-contract.js";
import { PreviousTrainingPlanState } from "../frontend/src/training-plan-contract.js";

function summary(overrides: Partial<CompletedRunSummary> = {}): CompletedRunSummary {
  return {
    outcome: "game_over", durationMs: 12_000, livesLost: 1, shotsFired: 3, failedShots: 2, captures: 1,
    greenThreatsCreated: 1, greenThreatHits: 1, shotsWhileThreatActive: 2, defensiveShots: 2,
    successfulDefensiveShots: 1, shotsAimedAtThreat: 1, shotsAimedAtCurrentTargetWhileThreatActive: 1,
    offensiveShotsWhileThreatActive: 1, blockedDirectAttempts: 1, bouncedAttempts: 1,
    successfulBounceCaptures: 0, rushedBouncedFailures: 1, repeatedSamePositionFailures: 0, rangeExpiredShots: 1,
    targetStats: [{ targetId: "enemy_1", attempts: 3, captures: 1, failedShots: 2, blockedDirectAttempts: 1, bouncedAttempts: 1, rushedBouncedFailures: 1, samePositionFailures: 0, rangeExpirations: 1 }],
    representativeEvents: [],
    ...overrides,
  };
}
function request(sequence = 1): TrainingPlanRequest { return { runs: [{ sequence, summary: summary() }] }; }
function prior(): PreviousTrainingPlanState {
  return {
    plan: {
      summary: "Practice threat response.", previousAssessment: "not_applicable", primaryFocus: "threat_management",
      practiceGoal: "Clear the threat before returning to the target.", confidence: "low", completed: true,
      evidence: [{ source: "recent_run_evidence", metric: "threat_offensive_rate", runSequences: [1], opportunities: 2, undesirable: 1 }],
    },
    baseline: { runSequences: [1], maxSequence: 1, primaryFocusMetric: { opportunities: 2, undesirable: 1 } },
  };
}
async function withServer<T>(run: (baseUrl: string) => Promise<T>, w05: TrainingPlanModelStepProvider = new FakeTrainingPlanProvider(), coach: AiCoachProvider = new FakeAiCoachProvider(), orchestrator?: TrainingPlanOrchestrator, now?: () => number, bodyIdleTimeoutMs?: number): Promise<T> {
  const server = createServer(coach, w05, orchestrator ?? new TrainingPlanOrchestrator({ logger: () => undefined }), { now, bodyIdleTimeoutMs });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address() as AddressInfo;
  try { return await run(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}
function post(base: string, body: string, contentType = "application/json", signal?: AbortSignal): Promise<Response> {
  return fetch(`${base}/api/training-plan`, { method: "POST", headers: { "Content-Type": contentType }, body, signal });
}

test("W05 config defaults to fake without touching any Gemini/W04 setting or secret", () => {
  const neverRead = (): never => { throw new Error("unexpected environment read"); };
  const env: Record<string, string | undefined> = {
    get TRAINING_PLAN_PROVIDER() { return undefined; },
    get TRAINING_PLAN_GEMINI_API_KEY() { return neverRead(); },
    get TRAINING_PLAN_GEMINI_MODEL() { return neverRead(); },
    get AI_COACH_PROVIDER() { return neverRead(); },
    get GEMINI_API_KEY() { return neverRead(); },
    get GEMINI_MODEL() { return neverRead(); },
  };
  assert.deepEqual(parseTrainingPlanRuntimeConfig(env), { provider: "fake", model: "gemini-3.1-flash-lite" });
  assert.throws(() => parseTrainingPlanRuntimeConfig({ TRAINING_PLAN_PROVIDER: "other" }), TrainingPlanConfigurationError);
  assert.throws(() => parseTrainingPlanRuntimeConfig({ TRAINING_PLAN_PROVIDER: "gemini" }), /TRAINING_PLAN_GEMINI_API_KEY/);
});

test("POST /api/training-plan succeeds with backend-owned completed and baseline while Coach route stays available", async () => {
  const w05 = new FakeTrainingPlanProvider();
  await withServer(async (base) => {
    const result = await post(base, JSON.stringify(request()));
    assert.equal(result.status, 200);
    const payload = await result.json() as { plan: { completed: boolean; primaryFocus: string }; baseline: { runSequences: number[]; maxSequence: number } };
    assert.equal(payload.plan.completed, true);
    assert.deepEqual(payload.baseline.runSequences, [1]);
    assert.equal(payload.baseline.maxSequence, 1);
    assert.equal(w05.callCount, 2);
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    const coachResponse = await fetch(`${base}/api/ai/coach`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runs: [summary()] }) });
    assert.equal(coachResponse.status, 200);
  }, w05);
});

test("invalid requests, content types, malformed JSON, and oversized streams make zero provider calls", async () => {
  const w05 = new FakeTrainingPlanProvider();
  let toolRegistryCalls = 0;
  const orchestrator = new TrainingPlanOrchestrator({ logger: () => undefined, toolRegistryFactory: (validated) => {
    toolRegistryCalls += 1;
    return new TrainingPlanToolRegistry(validated);
  } });
  await withServer(async (base) => {
    for (const response of [
      await post(base, JSON.stringify({ runs: [] })),
      await post(base, "{bad"),
      await post(base, JSON.stringify(request()), "application/jsonp"),
    ]) {
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { ok: false, error: "invalid_request" });
    }
    const tooLarge = " ".repeat(48 * 1024 + 1) + JSON.stringify(request());
    const largeResponse = await post(base, tooLarge);
    assert.equal(largeResponse.status, 413);
    assert.deepEqual(await largeResponse.json(), { ok: false, error: "invalid_request" });
    assert.equal(w05.callCount, 0);
    assert.equal(toolRegistryCalls, 0);
    const method = await fetch(`${base}/api/training-plan`);
    assert.equal(method.status, 405);
    const missing = await fetch(`${base}/api/not-a-route`);
    assert.equal(missing.status, 404);
  }, w05, new FakeAiCoachProvider(), orchestrator);
});

test("a valid previous plan with unchanged sequences returns 409 before provider invocation", async () => {
  const w05 = new FakeTrainingPlanProvider();
  const unchanged: TrainingPlanRequest = { runs: [{ sequence: 1, summary: summary() }], previousPlan: prior() };
  await withServer(async (base) => {
    const response = await post(base, JSON.stringify(unchanged));
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { ok: false, error: "regeneration_not_eligible" });
    assert.equal(w05.callCount, 0);
  }, w05);
});

test("newer sequence unlocks later deterministic assessment and advances baseline", async () => {
  const w05 = new FakeTrainingPlanProvider("later_plan_success");
  const eligible: TrainingPlanRequest = { runs: [
    { sequence: 1, summary: summary() },
    { sequence: 2, summary: summary({ shotsWhileThreatActive: 3, offensiveShotsWhileThreatActive: 1 }) },
  ], previousPlan: prior() };
  await withServer(async (base) => {
    const response = await post(base, JSON.stringify(eligible));
    assert.equal(response.status, 200);
    const payload = await response.json() as { plan: { previousAssessment: string }; baseline: { runSequences: number[]; maxSequence: number } };
    assert.equal(payload.plan.previousAssessment, "improved");
    assert.deepEqual(payload.baseline.runSequences, [1, 2]);
    assert.equal(payload.baseline.maxSequence, 2);
    assert.equal(w05.callCount, 3);
  }, w05);
});

test("provider and invalid-proposal failures expose only the safe 503 envelope", async () => {
  const raw = new ScriptedTrainingPlanProvider([{ output: { kind: "final", result: { prompt: "private", apiKey: "never-return" } } }]);
  await withServer(async (base) => {
    const response = await post(base, JSON.stringify(request()));
    assert.equal(response.status, 503);
    const body = await response.text();
    assert.equal(body, JSON.stringify({ ok: false, error: "training_plan_unavailable" }));
    assert.equal(body.includes("never-return"), false);
    assert.equal(raw.callCount, 1);
  }, raw);
  const sentinel = "W08_SERVER_SECRET_DO_NOT_EXPOSE";
  const providerFailure = { generateStep: async () => { throw new Error(`${sentinel}\nforged_event=true`); } };
  await withServer(async (base) => {
    const response = await post(base, JSON.stringify(request()));
    assert.equal(response.status, 503);
    const responseText = await response.text();
    assert.equal(responseText, JSON.stringify({ ok: false, error: "training_plan_unavailable" }));
    assert.equal(responseText.includes(sentinel), false);
  }, providerFailure);
});

test("request disconnect aborts an in-flight provider and prevents later model steps", async () => {
  let calls = 0;
  let startedResolve!: () => void;
  const started = new Promise<void>((resolve) => { startedResolve = resolve; });
  const provider = {
    generateStep: (_input: unknown, signal: AbortSignal) => {
      calls += 1;
      startedResolve();
      return new Promise<unknown>((_resolve, reject) => signal.addEventListener("abort", () => reject(new TrainingPlanProviderFailure("cancelled")), { once: true }));
    },
  };
  const controller = new AbortController();
  await withServer(async (base) => {
    const pending = post(base, JSON.stringify(request()), "application/json", controller.signal).catch(() => undefined);
    await started;
    controller.abort();
    await pending;
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(calls, 1);
  }, provider);
});

test("shared server headers, CORS allowlist, and client policy fields stay bounded", async () => {
  const w05 = new FakeTrainingPlanProvider();
  await withServer(async (base) => {
    const health = await fetch(`${base}/api/health`, { headers: { Origin: "http://127.0.0.1:4173" } });
    assert.equal(health.headers.get("access-control-allow-origin"), "http://127.0.0.1:4173");
    assert.equal(health.headers.get("x-content-type-options"), "nosniff");
    assert.equal(health.headers.get("referrer-policy"), "no-referrer");
    assert.match(health.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    const untrusted = await fetch(`${base}/api/health`, { headers: { Origin: "https://untrusted.invalid" } });
    assert.equal(untrusted.headers.get("access-control-allow-origin"), null);
    const invalid = await post(base, JSON.stringify({ ...request(), provider: "gemini", model: "changed", maxSteps: 99, maxToolCalls: 999, ownerId: "someone", role: "admin" }));
    assert.equal(invalid.status, 400);
    assert.equal(w05.callCount, 0);
  }, w05);
});

test("Content-Length above either route cap is rejected before body read or provider call", async () => {
  const w05 = new FakeTrainingPlanProvider();
  let coachCalls = 0;
  const coach: AiCoachProvider = { async getAdvice() { coachCalls += 1; return {}; } };
  await withServer(async (base) => {
    const earlyReject = (path: string, contentLength: number) => new Promise<number>((resolve, reject) => {
      const target = new URL(path, base);
      const outgoing = httpRequest({ hostname: target.hostname, port: target.port, path: target.pathname, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": String(contentLength) } }, (response) => {
        response.resume(); response.on("end", () => resolve(response.statusCode ?? 0));
      });
      outgoing.on("error", reject);
      outgoing.write("{");
    });
    assert.equal(await earlyReject("/api/ai/coach", 32 * 1024 + 1), 413);
    assert.equal(await earlyReject("/api/training-plan", 48 * 1024 + 1), 413);
    assert.equal(coachCalls, 0);
    assert.equal(w05.callCount, 0);
  }, w05, coach);
});

test("oversized chunked upload is rejected as soon as the streaming cap is crossed", async () => {
  const w05 = new FakeTrainingPlanProvider();
  await withServer(async (base) => {
    const target = new URL("/api/training-plan", base);
    const responseStatus = new Promise<number>((resolve, reject) => {
      const outgoing = httpRequest({ hostname: target.hostname, port: target.port, path: target.pathname, method: "POST", headers: { "Content-Type": "application/json", "Transfer-Encoding": "chunked" } }, (response) => {
        response.resume(); response.on("end", () => resolve(response.statusCode ?? 0));
      });
      outgoing.on("error", (error) => {
        if (error.message.includes("socket hang up")) reject(new Error("Server closed the stream without its stable 413 response."));
        else reject(error);
      });
      outgoing.write(" ".repeat(48 * 1024 + 1));
    });
    assert.equal(await responseStatus, 413);
    assert.equal(w05.callCount, 0);
  }, w05);
});

test("idle request bodies are closed at the configured read timeout", async () => {
  let calls = 0;
  const w05: TrainingPlanModelStepProvider = { async generateStep() { calls += 1; return {}; } };
  await withServer(async (base) => {
    const target = new URL("/api/training-plan", base);
    await new Promise<void>((resolve, reject) => {
      const outgoing = httpRequest({ hostname: target.hostname, port: target.port, path: target.pathname, method: "POST", headers: { "Content-Type": "application/json", "Transfer-Encoding": "chunked" } });
      outgoing.on("error", () => resolve());
      outgoing.on("response", (response) => { response.resume(); response.on("end", () => reject(new Error("Idle incomplete request should be closed without starting work."))); });
      outgoing.flushHeaders();
    });
    assert.equal(calls, 0);
  }, w05, new FakeAiCoachProvider(), undefined, undefined, 20);
});

test("W04 and W05 accept valid JSON exactly at their UTF-8 body caps", async () => {
  const w05 = new FakeTrainingPlanProvider();
  let coachCalls = 0;
  const coach: AiCoachProvider = { async getAdvice(value) { coachCalls += 1; return new FakeAiCoachProvider().getAdvice(value); } };
  await withServer(async (base) => {
    const w05Json = JSON.stringify(request());
    const w05Body = " ".repeat(48 * 1024 - Buffer.byteLength(w05Json, "utf8")) + w05Json;
    assert.equal(Buffer.byteLength(w05Body, "utf8"), 48 * 1024);
    assert.equal((await post(base, w05Body)).status, 200);
    const w04Json = JSON.stringify({ runs: [summary()] });
    const w04Body = " ".repeat(32 * 1024 - Buffer.byteLength(w04Json, "utf8")) + w04Json;
    assert.equal(Buffer.byteLength(w04Body, "utf8"), 32 * 1024);
    assert.equal((await postCoach(base, w04Body)).status, 200);
    assert.equal(w05.callCount, 2);
    assert.equal(coachCalls, 1);
  }, w05, coach);
});

test("two shared W04/W05 slots reject a third before providers, then permit a later request", async () => {
  let coachCalls = 0;
  let startBoth!: () => void;
  const bothStarted = new Promise<void>((resolve) => { startBoth = resolve; });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const coach: AiCoachProvider = {
    async getAdvice() { coachCalls += 1; if (coachCalls === 2) startBoth(); await gate; return new FakeAiCoachProvider().getAdvice({ runs: [summary()] }); },
  };
  const w05 = new FakeTrainingPlanProvider();
  await withServer(async (base) => {
    const first = postCoach(base, JSON.stringify({ runs: [summary()] }));
    const second = postCoach(base, JSON.stringify({ runs: [summary()] }));
    await bothStarted;
    const third = await post(base, JSON.stringify(request()));
    assert.equal(third.status, 429);
    assert.deepEqual(await third.json(), { ok: false, error: "server_busy" });
    assert.equal(w05.callCount, 0);
    assert.equal(coachCalls, 2);
    release();
    assert.equal((await first).status, 200);
    assert.equal((await second).status, 200);
    assert.equal((await post(base, JSON.stringify(request()))).status, 200);
    assert.equal(w05.callCount, 2);
  }, w05, coach);
});

test("global rolling rate accepts five starts, returns 429 for six, and resets at 60 seconds", async () => {
  let now = 0;
  let calls = 0;
  const coach: AiCoachProvider = { async getAdvice(request) { calls += 1; return new FakeAiCoachProvider().getAdvice(request); } };
  await withServer(async (base) => {
    for (let i = 0; i < 5; i += 1) assert.equal((await postCoach(base, JSON.stringify({ runs: [summary()] }))).status, 200);
    const limited = await postCoach(base, JSON.stringify({ runs: [summary()] }));
    assert.equal(limited.status, 429);
    assert.deepEqual(await limited.json(), { ok: false, error: "rate_limited" });
    assert.equal(calls, 5);
    now = 60_000;
    assert.equal((await post(base, JSON.stringify(request()))).status, 200);
    assert.equal(calls, 5);
  }, new FakeTrainingPlanProvider(), coach, undefined, () => now);
});

test("disconnect releases a global permit and a cancelled provider result cannot succeed late", async () => {
  let calls = 0;
  let started!: () => void;
  const entered = new Promise<void>((resolve) => { started = resolve; });
  const coach: AiCoachProvider = {
    getAdvice(_request, signal) {
      calls += 1;
      if (calls > 1) return new FakeAiCoachProvider().getAdvice({ runs: [summary()] });
      started();
      return new Promise((_resolve, reject) => signal?.addEventListener("abort", () => reject(new Error("cancelled")), { once: true }));
    },
  };
  await withServer(async (base) => {
    const abort = new AbortController();
    const pending = postCoach(base, JSON.stringify({ runs: [summary()] }), "application/json", abort.signal).catch(() => undefined);
    await entered;
    abort.abort();
    await pending;
    const next = await postCoach(base, JSON.stringify({ runs: [summary()] }));
    assert.equal(next.status, 200);
    assert.equal(calls, 2);
  }, new FakeTrainingPlanProvider(), coach);
});

function postCoach(base: string, body: string, contentType = "application/json", signal?: AbortSignal): Promise<Response> {
  return fetch(`${base}/api/ai/coach`, { method: "POST", headers: { "Content-Type": contentType }, body, signal });
}

