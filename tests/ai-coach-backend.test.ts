import assert from "node:assert/strict";
import test from "node:test";
import { AddressInfo } from "node:net";
import { AiCoachAdvice, AiCoachRequest } from "../backend/src/ai-coach-contract.js";
import { AiCoachProvider, FakeAiCoachProvider } from "../backend/src/ai-coach-provider.js";
import { createServer } from "../backend/src/server.js";
import { AiCoachClient } from "../frontend/src/ai-coach-client.js";
import { CompletedRunSummary } from "../frontend/src/ai-coach-contract.js";
import { validateAiCoachRequest as validateFrontendRequest } from "../frontend/src/ai-coach-contract.js";
import { validateAiCoachRequest as validateBackendRequest } from "../backend/src/ai-coach-contract.js";

function makeSummary(): CompletedRunSummary {
  return {
    outcome: "game_over", durationMs: 25000, livesLost: 2, shotsFired: 3, failedShots: 2, captures: 1,
    greenThreatsCreated: 2, greenThreatHits: 1, shotsWhileThreatActive: 2, defensiveShots: 1,
    successfulDefensiveShots: 0, shotsAimedAtThreat: 1, shotsAimedAtCurrentTargetWhileThreatActive: 1,
    offensiveShotsWhileThreatActive: 1, blockedDirectAttempts: 2,
    bouncedAttempts: 1, successfulBounceCaptures: 0, rushedBouncedFailures: 1,
    repeatedSamePositionFailures: 0, rangeExpiredShots: 1,
    targetStats: [{ targetId: "enemy_1", attempts: 3, captures: 1, failedShots: 2, blockedDirectAttempts: 2, bouncedAttempts: 1, rushedBouncedFailures: 1, samePositionFailures: 0, rangeExpirations: 1 }],
    representativeEvents: [
      { type: "ignored_threat", targetId: "enemy_1", aimedAtTarget: true },
      { type: "blocked_direct", targetId: "enemy_1", attemptCount: 2 },
      { type: "rushed_bounce", targetId: "enemy_1", aimSettleMs: 100 },
      { type: "same_position", targetId: "enemy_1", attemptCount: 3, movementDistance: 22 },
      { type: "range_expired", targetId: "enemy_1", targetDistance: 700, travelBudget: 600, bounceCount: 1 },
    ],
  };
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

function post(baseUrl: string, body: string, contentType = "application/json"): Promise<Response> {
  return fetch(`${baseUrl}/api/ai/coach`, { method: "POST", headers: { "Content-Type": contentType }, body });
}

test("frontend and backend runtime contracts accept the same valid one/three-run shapes", () => {
  const request: AiCoachRequest = { runs: [makeSummary(), makeSummary(), makeSummary()] };
  assert.equal(validateFrontendRequest(request), true);
  assert.equal(validateBackendRequest(request), true);
  assert.equal(validateBackendRequest({ runs: [makeSummary(), makeSummary(), makeSummary(), makeSummary()] }), false);
  assert.equal(validateBackendRequest({ runs: [{ ...makeSummary(), representativeEvents: [{ type: "unknown", targetId: "enemy_1" }] }] }), false);
});

test("valid one-run and three-run requests reach the fake provider and return structured advice", async () => {
  let calls = 0;
  let seenRunCount = 0;
  const provider: AiCoachProvider = {
    async getAdvice(request: AiCoachRequest): Promise<unknown> {
      calls += 1;
      seenRunCount = request.runs.length;
      return new FakeAiCoachProvider().getAdvice(request);
    },
  };
  await withServer(provider, async (baseUrl) => {
    const one = await post(baseUrl, JSON.stringify({ runs: [makeSummary()] }));
    assert.equal(one.status, 200);
    const oneBody = await one.json() as { advice: AiCoachAdvice };
    assert.equal(oneBody.advice.primaryCategory, "bounce_strategy");
    assert.equal(calls, 1);
    assert.equal(seenRunCount, 1);

    const three = await post(baseUrl, JSON.stringify({ runs: [makeSummary(), makeSummary(), makeSummary()] }));
    assert.equal(three.status, 200);
    assert.equal(calls, 2);
    assert.equal(seenRunCount, 3);
  });
});

test("frontend client completes a real HTTP round trip through the backend fake provider", async () => {
  await withServer(new FakeAiCoachProvider(), async (baseUrl) => {
    const client = new AiCoachClient(fetch, `${baseUrl}/api/ai/coach`);
    const advice = await client.request({ runs: [makeSummary()] });
    assert.equal(advice.primaryCategory, "bounce_strategy");
    assert.ok(advice.practiceGoal.length > 0);
  });
});

test("invalid, zero-run, and excess-run requests are rejected before provider invocation", async () => {
  let calls = 0;
  const provider: AiCoachProvider = { async getAdvice() { calls += 1; return {}; } };
  await withServer(provider, async (baseUrl) => {
    for (const body of [
      JSON.stringify({ runs: [] }),
      JSON.stringify({ runs: [makeSummary(), makeSummary(), makeSummary(), makeSummary()] }),
      JSON.stringify({ runs: [{ ...makeSummary(), shotsFired: Number.POSITIVE_INFINITY }] }),
      "{ malformed",
    ]) {
      const response = await post(baseUrl, body);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { ok: false, error: "invalid_request" });
    }
    assert.equal(calls, 0);
  });
});

test("oversized request body and wrong content type do not invoke provider", async () => {
  let calls = 0;
  const provider: AiCoachProvider = { async getAdvice() { calls += 1; return {}; } };
  await withServer(provider, async (baseUrl) => {
    const tooLarge = await post(baseUrl, `{"runs":[],"padding":"${"x".repeat(33 * 1024)}"}`);
    assert.equal(tooLarge.status, 413);
    const wrongType = await post(baseUrl, JSON.stringify({ runs: [makeSummary()] }), "text/plain");
    assert.equal(wrongType.status, 400);
    assert.equal(calls, 0);
  });
});

test("provider failure and malformed provider output map to safe unavailable responses", async () => {
  const providers: AiCoachProvider[] = [
    { async getAdvice() { throw new Error("private provider detail"); } },
    { async getAdvice() { return { advice: { summary: "", primaryCategory: "unknown" } }; } },
  ];
  for (const provider of providers) {
    await withServer(provider, async (baseUrl) => {
      const response = await post(baseUrl, JSON.stringify({ runs: [makeSummary()] }));
      assert.equal(response.status, 503);
      const body = await response.json() as Record<string, unknown>;
      assert.deepEqual(body, { ok: false, error: "coach_unavailable" });
      assert.equal(JSON.stringify(body).includes("private provider detail"), false);
    });
  }
});

test("health endpoint and method errors preserve safe API behavior", async () => {
  await withServer(new FakeAiCoachProvider(), async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true, service: "selfbound-backend" });
    const wrongMethod = await fetch(`${baseUrl}/api/ai/coach`);
    assert.equal(wrongMethod.status, 405);
    assert.deepEqual(await wrongMethod.json(), { ok: false, error: "method_not_allowed" });
    const healthWrongMethod = await fetch(`${baseUrl}/api/health`, { method: "POST" });
    assert.equal(healthWrongMethod.status, 405);
    assert.deepEqual(await healthWrongMethod.json(), { ok: false, error: "Method not allowed" });
  });
});
