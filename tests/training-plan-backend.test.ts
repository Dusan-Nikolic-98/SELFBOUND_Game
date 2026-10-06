import assert from "node:assert/strict";
import test from "node:test";
import { AddressInfo } from "node:net";
import { AiCoachProvider, FakeAiCoachProvider } from "../backend/src/ai-coach-provider.js";
import { TrainingPlanRequest } from "../backend/src/training-plan-contract.js";
import { parseTrainingPlanRuntimeConfig, TrainingPlanConfigurationError } from "../backend/src/training-plan-config.js";
import { FakeTrainingPlanProvider, ScriptedTrainingPlanProvider } from "../backend/src/fake-training-plan-provider.js";
import { TrainingPlanOrchestrator } from "../backend/src/training-plan-orchestrator.js";
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
async function withServer<T>(run: (baseUrl: string) => Promise<T>, w05: TrainingPlanModelStepProvider = new FakeTrainingPlanProvider(), coach: AiCoachProvider = new FakeAiCoachProvider()): Promise<T> {
  const server = createServer(coach, w05, new TrainingPlanOrchestrator({ logger: () => undefined }));
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
    const method = await fetch(`${base}/api/training-plan`);
    assert.equal(method.status, 405);
    const missing = await fetch(`${base}/api/not-a-route`);
    assert.equal(missing.status, 404);
  }, w05);
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
  const providerFailure = { generateStep: async () => { throw new Error("raw provider body and token"); } };
  await withServer(async (base) => {
    const response = await post(base, JSON.stringify(request()));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, error: "training_plan_unavailable" });
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

