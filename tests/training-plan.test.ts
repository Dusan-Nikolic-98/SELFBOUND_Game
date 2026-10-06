import assert from "node:assert/strict";
import test from "node:test";
import {
  CompletedRunSummary,
} from "../frontend/src/ai-coach-contract.js";
import {
  TrainingPlanRequest,
  TrainingPlanRunEntry,
  TrainingPlanSuccess,
  PreviousTrainingPlanState,
  validateToolArguments,
  validateTrainingPlanRequest,
  validateTrainingPlanSuccess,
} from "../backend/src/training-plan-contract.js";
import * as backendContract from "../backend/src/training-plan-contract.js";
import * as frontendContract from "../frontend/src/training-plan-contract.js";
import { aggregateFocusMetric, evaluatePreviousPlan, metricForRun } from "../backend/src/training-plan-evaluator.js";
import { FakeTrainingPlanProvider, ScriptedTrainingPlanProvider } from "../backend/src/fake-training-plan-provider.js";
import { TrainingPlanOrchestrator } from "../backend/src/training-plan-orchestrator.js";
import { TrainingPlanProviderFailure } from "../backend/src/training-plan-provider.js";
import { TrainingPlanToolRegistry, TrainingPlanToolHandlers } from "../backend/src/training-plan-tools.js";
import { TrainingPlanSession } from "../frontend/src/training-plan-session.js";
import { TrainingPlanClient } from "../frontend/src/training-plan-client.js";

function makeSummary(overrides: Partial<CompletedRunSummary> = {}): CompletedRunSummary {
  const summary: CompletedRunSummary = {
    outcome: "game_over", durationMs: 20_000, livesLost: 1, shotsFired: 3, failedShots: 2, captures: 1,
    greenThreatsCreated: 1, greenThreatHits: 1, shotsWhileThreatActive: 2, defensiveShots: 2,
    successfulDefensiveShots: 1, shotsAimedAtThreat: 1, shotsAimedAtCurrentTargetWhileThreatActive: 1,
    offensiveShotsWhileThreatActive: 1, blockedDirectAttempts: 1, bouncedAttempts: 1,
    successfulBounceCaptures: 0, rushedBouncedFailures: 1, repeatedSamePositionFailures: 0,
    rangeExpiredShots: 1,
    targetStats: [{ targetId: "enemy_1", attempts: 3, captures: 1, failedShots: 2, blockedDirectAttempts: 1, bouncedAttempts: 1, rushedBouncedFailures: 1, samePositionFailures: 0, rangeExpirations: 1 }],
    representativeEvents: [],
  };
  return { ...summary, ...overrides };
}
function entry(sequence: number, summary = makeSummary()): TrainingPlanRunEntry { return { sequence, summary }; }
function baseline(runSequences: number[], opportunities = 2, undesirable = 1) {
  return { runSequences, maxSequence: runSequences[runSequences.length - 1]!, primaryFocusMetric: { opportunities, undesirable } };
}
function previousState(runSequences = [1], opportunities = 2, undesirable = 1): PreviousTrainingPlanState {
  return {
    plan: {
      summary: "Practice threat response.", previousAssessment: "not_applicable" as const,
      primaryFocus: "threat_management" as const, practiceGoal: "Clear the threat before returning to the target.",
      evidence: [{ source: "recent_run_evidence" as const, metric: "threat_offensive_rate" as const, runSequences: [...runSequences], opportunities, undesirable }],
      confidence: "low" as const, completed: true as const,
    },
    baseline: baseline([...runSequences], opportunities, undesirable),
  };
}
function req(runs: TrainingPlanRunEntry[] = [entry(1)]): TrainingPlanRequest { return { runs }; }
function successFor(request: TrainingPlanRequest): TrainingPlanSuccess {
  const sequences = request.runs.map((run) => run.sequence);
  const opportunities = request.runs.reduce((sum, run) => sum + run.summary.shotsWhileThreatActive, 0);
  const undesirable = request.runs.reduce((sum, run) => sum + run.summary.offensiveShotsWhileThreatActive, 0);
  return {
    plan: {
      summary: "Practice responding to an active threat.", previousAssessment: "not_applicable", primaryFocus: "threat_management",
      practiceGoal: "Clear the green threat before aiming at the target.", confidence: "low", completed: true,
      evidence: [{ source: "recent_run_evidence", metric: "threat_offensive_rate", runSequences: sequences, opportunities, undesirable }],
    },
    baseline: { runSequences: sequences, maxSequence: sequences[sequences.length - 1]!, primaryFocusMetric: { opportunities, undesirable } },
  };
}
function customHandlers(getEvidence: TrainingPlanToolHandlers["get_recent_run_evidence"]): TrainingPlanToolHandlers {
  return { get_recent_run_evidence: getEvidence, evaluate_previous_training_plan: (context) => {
    return context.request.previousPlan ? evaluatePreviousPlan(context.request.previousPlan, context.request.runs) : null;
  } };
}

test("backend and browser W05 contracts accept matching wire fixtures and reject trust-boundary drift", () => {
  const request = req([entry(1), entry(2, makeSummary({ outcome: "level_complete" }))]);
  assert.equal(backendContract.validateTrainingPlanRequest(request), true);
  assert.equal(frontendContract.validateTrainingPlanRequest(request), true);
  assert.equal(validateTrainingPlanSuccess(successFor(request), request), true);
  assert.equal(frontendContract.validateTrainingPlanSuccess(successFor(request), request), true);
  assert.equal(validateTrainingPlanRequest({ ...request, unexpected: true }), false);
  assert.equal(validateTrainingPlanRequest({ runs: [{ ...request.runs[0], extra: 1 }] }), false);
  assert.equal(validateTrainingPlanRequest({ runs: [entry(0)] }), false);
  assert.equal(validateTrainingPlanRequest({ runs: [entry(Number.MAX_SAFE_INTEGER + 1)] }), false);
  assert.equal(validateTrainingPlanRequest({ runs: [entry(2), entry(1)] }), false);
  assert.equal(validateTrainingPlanRequest({ runs: [{ sequence: 1, summary: { ...makeSummary(), fake: 1 } }] }), false);
  assert.equal(validateToolArguments("get_recent_run_evidence", { limit: 3 }, 2), false);
  assert.equal(validateToolArguments("get_recent_run_evidence", { limit: 2, runs: [] }, 2), false);
  assert.equal(validateToolArguments("evaluate_previous_training_plan", { focus: "threat_management" }, 2), false);
  assert.equal(frontendContract.validateTrainingPlanBaseline({ runSequences: [1, 3], maxSequence: 3, primaryFocusMetric: { opportunities: 1, undesirable: 2 } }, "threat_management"), false);
  assert.equal(frontendContract.validatePreviousTrainingPlan({ plan: { ...previousState().plan, completed: false }, baseline: baseline([1]) }), false);
  const badMembership = previousState();
  badMembership.plan.evidence[0]!.runSequences = [2];
  assert.equal(frontendContract.validatePreviousTrainingPlan(badMembership), false);
  const modelCompleted = { kind: "final", result: { ...successFor(request).plan } };
  assert.equal(backendContract.validateTrainingPlanDraft(modelCompleted.result), false);
});

test("W05 run ledger assigns distinct ordered IDs, observes terminal transitions once, and evicts oldest", () => {
  const session = new TrainingPlanSession();
  const same = makeSummary({ outcome: "level_complete" });
  assert.equal(session.canGenerate, false);
  assert.equal(session.observeGameStatus("playing", undefined), null);
  assert.equal(session.observeGameStatus("won", same)?.sequence, 1);
  assert.equal(session.observeGameStatus("won", same), null);
  session.observeGameStatus("playing", undefined); // terminal reset is not a completion
  assert.equal(session.observeGameStatus("won", same)?.sequence, 2);
  session.observeGameStatus("playing", undefined);
  session.observeGameStatus("gameover", makeSummary());
  session.observeGameStatus("playing", undefined);
  assert.equal(session.observeGameStatus("won", same)?.sequence, 4);
  assert.deepEqual(session.runs.map((run) => run.sequence), [2, 3, 4]);
  assert.notEqual(session.runs[0]?.summary, session.runs[1]?.summary);
  assert.equal(session.canGenerate, true);

  const snapshot = session.runs;
  snapshot[0]!.summary.shotsFired = 99;
  assert.notEqual(session.runs[0]?.summary.shotsFired, 99);
});

test("W05 success gates unchanged history, stores a validated baseline, and permits a newer sequence", () => {
  const session = new TrainingPlanSession();
  session.observeGameStatus("won", makeSummary({ outcome: "level_complete" }));
  const request = session.createRequestSnapshot();
  assert.ok(request);
  assert.equal(session.recordSuccess(successFor(request), request), true);
  assert.equal(session.canGenerate, false);
  assert.equal(session.createRequestSnapshot(), null);
  session.observeGameStatus("playing", undefined);
  session.observeGameStatus("gameover", makeSummary());
  assert.equal(session.canGenerate, true);
  assert.deepEqual(session.createRequestSnapshot()?.runs.map((run) => run.sequence), [1, 2]);
  assert.equal(session.recordSuccess({ plan: { completed: false }, baseline: {} }, request), false);
  assert.equal(session.previousPlan?.baseline.maxSequence, 1);
});

test("saved baseline aggregates remain eligible after all source summaries leave the three-run ledger", () => {
  const session = new TrainingPlanSession();
  for (let sequence = 1; sequence <= 3; sequence += 1) {
    session.observeGameStatus("won", makeSummary({ outcome: "level_complete" }));
    if (sequence < 3) session.observeGameStatus("playing", undefined);
  }
  const originalRequest = session.createRequestSnapshot();
  assert.ok(originalRequest);
  assert.equal(session.recordSuccess(successFor(originalRequest), originalRequest), true);
  session.observeGameStatus("playing", undefined);
  for (let sequence = 4; sequence <= 6; sequence += 1) {
    session.observeGameStatus("gameover", makeSummary());
    if (sequence < 6) session.observeGameStatus("playing", undefined);
  }
  assert.deepEqual(session.runs.map((run) => run.sequence), [4, 5, 6]);
  const newerRequest = session.createRequestSnapshot();
  assert.deepEqual(newerRequest?.runs.map((run) => run.sequence), [4, 5, 6]);
  assert.deepEqual(newerRequest?.previousPlan?.baseline.runSequences, [1, 2, 3]);
  assert.equal(newerRequest?.previousPlan?.baseline.maxSequence, 3);
});

test("zero history creates no request and the Training Plan client prevents duplicates and validates success", async () => {
  const session = new TrainingPlanSession();
  let fetchCalls = 0;
  const client = new TrainingPlanClient(async () => { fetchCalls += 1; return new Response("{}", { status: 200 }); });
  assert.equal(session.createRequestSnapshot(), null);
  assert.equal(fetchCalls, 0);

  const completed = new TrainingPlanSession();
  completed.observeGameStatus("won", makeSummary({ outcome: "level_complete" }));
  const request = completed.createRequestSnapshot();
  assert.ok(request);
  let resolveFetch!: (response: Response) => void;
  const pendingClient = new TrainingPlanClient(() => new Promise<Response>((resolve) => { resolveFetch = resolve; }));
  const valid = successFor(request);
  const first = pendingClient.request(request);
  await assert.rejects(pendingClient.request(request), /already in progress/);
  resolveFetch(new Response(JSON.stringify(valid), { status: 200 }));
  assert.equal((await first).plan.completed, true);
  assert.equal(pendingClient.isPending, false);
  const invalid = new TrainingPlanClient(async () => new Response(JSON.stringify({ plan: { completed: true }, baseline: {} }), { status: 200 }));
  await assert.rejects(invalid.request(request), /response is invalid/);
});

test("metric mappings pool exact integer counts and bounce denominator evidence is cross-checked", () => {
  const valid = entry(1, makeSummary());
  assert.deepEqual(metricForRun(valid, "threat_offensive_rate"), { opportunities: 2, undesirable: 1, available: true });
  assert.deepEqual(metricForRun(valid, "blocked_direct_rate"), { opportunities: 3, undesirable: 1, available: true });
  assert.deepEqual(metricForRun(valid, "rushed_bounce_failure_rate"), { opportunities: 1, undesirable: 1, available: true });
  assert.deepEqual(metricForRun(valid, "repeated_same_position_rate"), { opportunities: 2, undesirable: 0, available: true });
  assert.deepEqual(metricForRun(valid, "range_expiry_rate"), { opportunities: 3, undesirable: 1, available: true });
  assert.equal(metricForRun(entry(2, makeSummary({ targetStats: [] })), "blocked_direct_rate").available, false);
  assert.equal(metricForRun(entry(2, makeSummary({ targetStats: [{ ...makeSummary().targetStats[0]!, blockedDirectAttempts: 0 }] })), "blocked_direct_rate").available, false);
  assert.deepEqual(aggregateFocusMetric([valid, entry(2, makeSummary({ shotsWhileThreatActive: 3, offensiveShotsWhileThreatActive: 0 }))], "threat_offensive_rate"), { opportunities: 5, undesirable: 1, available: true });
});

test("previous focus comparison returns improved, not_improved, and insufficient without treating no opportunity as improvement", () => {
  const improved = evaluatePreviousPlan(previousState([1], 2, 1), [entry(1), entry(2, makeSummary({ shotsWhileThreatActive: 3, offensiveShotsWhileThreatActive: 1 }))]);
  assert.equal(improved?.assessment, "improved"); // 1/3 < 1/2, cross-multiplied exactly
  assert.deepEqual(improved?.newer.runSequences, [2]);
  const equal = evaluatePreviousPlan(previousState([1], 2, 1), [entry(1), entry(2)]);
  assert.equal(equal?.assessment, "not_improved");
  const noOpportunity = evaluatePreviousPlan(previousState([1], 2, 1), [entry(1), entry(2, makeSummary({ shotsWhileThreatActive: 0, offensiveShotsWhileThreatActive: 0 }))]);
  assert.equal(noOpportunity?.assessment, "insufficient_evidence");
  const zeroBaseline = evaluatePreviousPlan(previousState([1], 0, 0), [entry(1), entry(2)]);
  assert.equal(zeroBaseline?.assessment, "insufficient_evidence");
  const missingBounce = previousState([1], 3, 1);
  missingBounce.plan.primaryFocus = "bounce_strategy";
  const unavailableBounce = evaluatePreviousPlan(missingBounce, [entry(1), entry(2, makeSummary({ targetStats: [] }))]);
  assert.equal(unavailableBounce?.assessment, "insufficient_evidence");
  assert.equal(evaluatePreviousPlan(previousState([1]), [entry(1)]), null);
});

test("evidence tool is deterministic, selects latest runs, validates limit against available context, and rejects bad output", () => {
  const request = req([entry(1), entry(2), entry(3)]);
  const tools = new TrainingPlanToolRegistry(request);
  assert.equal(tools.names.length, 2);
  assert.equal(tools.validateArguments("get_recent_run_evidence", { limit: 2 }), true);
  assert.equal(new TrainingPlanToolRegistry(req()).validateArguments("get_recent_run_evidence", { limit: 2 }), false);
  assert.equal(tools.validateArguments("unknown", {}), false);
  const output = tools.dispatch("get_recent_run_evidence", { limit: 2 });
  assert.deepEqual((output as { runs: Array<{ sequence: number }> }).runs.map((run) => run.sequence), [2, 3]);
  assert.equal(tools.validateOutput("get_recent_run_evidence", output), true);
  assert.equal(tools.validateOutput("get_recent_run_evidence", { kind: "recent_run_evidence", runs: [] }), false);
});

test("tool registry rejects unknown, invalid, unavailable, and repeated actions before execution", () => {
  let dispatches = 0;
  const tools = new TrainingPlanToolRegistry(req(), customHandlers(() => { dispatches += 1; return {}; }));
  assert.equal(tools.isAvailable("get_recent_run_evidence"), true);
  assert.equal(tools.isAvailable("evaluate_previous_training_plan"), false);
  assert.equal(tools.validateArguments("get_recent_run_evidence", { limit: 3 }), false);
  assert.equal(tools.validateArguments("open_url", {}), false);
  assert.equal(dispatches, 0);
  assert.equal(tools.actionIdentity("get_recent_run_evidence", { limit: 1 }), tools.actionIdentity("get_recent_run_evidence", { limit: 1 }));
  assert.notEqual(tools.actionIdentity("get_recent_run_evidence", { limit: 1 }), tools.actionIdentity("get_recent_run_evidence", { limit: 2 }));
});

test("fake provider completes first and later plans and model inputs contain only bounded workflow plus tool results", async () => {
  const firstRequest = req();
  const firstFake = new FakeTrainingPlanProvider("first_plan_success");
  const first = await new TrainingPlanOrchestrator({ logger: () => undefined }).run(firstRequest, firstFake);
  assert.equal(first.terminal, "goal_completed");
  assert.equal(first.counters.agentSteps, 2);
  assert.equal(first.counters.toolCalls, 1);
  assert.equal(first.counters.providerAttempts, 2);
  assert.equal(firstFake.callCount, 2);
  assert.equal("summary" in (firstFake.inputs[0] as unknown as Record<string, unknown>), false);
  assert.equal(JSON.stringify(firstFake.inputs[0]).includes("shotsFired"), false);
  assert.equal(JSON.stringify(firstFake.inputs[1]).includes("shotsFired"), false);
  assert.ok(firstFake.inputs[1]?.toolResults.some((result) => result.kind === "recent_run_evidence"));

  const laterRequest: TrainingPlanRequest = { runs: [entry(1), entry(2, makeSummary({ shotsWhileThreatActive: 3, offensiveShotsWhileThreatActive: 1 }))], previousPlan: previousState([1], 2, 1) };
  const laterFake = new FakeTrainingPlanProvider("later_plan_success");
  const later = await new TrainingPlanOrchestrator({ logger: () => undefined }).run(laterRequest, laterFake);
  assert.equal(later.terminal, "goal_completed");
  assert.equal(later.counters.agentSteps, 3);
  assert.equal(later.counters.toolCalls, 2);
  assert.equal(later.counters.providerAttempts, 3);
  assert.equal(later.result?.plan.previousAssessment, "improved");
});

test("unknown tools, invalid arguments, malformed proposals, and malformed final evidence never succeed", async () => {
  const orchestrator = new TrainingPlanOrchestrator({ logger: () => undefined });
  for (const [scenario, terminal] of [["unknown_tool", "unknown_tool"], ["invalid_tool_arguments", "invalid_tool_arguments"], ["malformed_proposal", "invalid_model_proposal"]] as const) {
    const fake = new FakeTrainingPlanProvider(scenario);
    const result = await orchestrator.run(req(), fake);
    assert.equal(result.terminal, terminal);
    assert.equal(result.counters.toolCalls, 0);
    assert.equal(fake.callCount, 1);
  }
  const invalidFinal = await orchestrator.run(req(), new FakeTrainingPlanProvider("invalid_final_result"));
  assert.equal(invalidFinal.terminal, "invalid_final_result");
  const oversizedProposal = await orchestrator.run(req(), new ScriptedTrainingPlanProvider([{ output: { kind: "final", result: { huge: "x".repeat(9_000) } } }]));
  assert.equal(oversizedProposal.terminal, "invalid_model_proposal");
  assert.equal(oversizedProposal.counters.toolCalls, 0);
  const forged = new ScriptedTrainingPlanProvider([
    { output: { kind: "tool_call", tool: "get_recent_run_evidence", arguments: { limit: 1 } } },
    { output: { kind: "final", result: { ...successFor(req()).plan, evidence: [{ source: "recent_run_evidence", metric: "threat_offensive_rate", runSequences: [1], opportunities: 999, undesirable: 999 }] } } },
  ]);
  const forgedResult = await orchestrator.run(req(), forged);
  assert.equal(forgedResult.terminal, "invalid_final_result");
  assert.equal(forgedResult.ok, false);
});

test("invalid tool output never reaches the next model step and dispatched calls are counted", async () => {
  const request = req();
  let handlerCalls = 0;
  const fake = new FakeTrainingPlanProvider("invalid_tool_result");
  const orchestrator = new TrainingPlanOrchestrator({ logger: () => undefined, toolRegistryFactory: (validated) => new TrainingPlanToolRegistry(validated, customHandlers(() => { handlerCalls += 1; return { kind: "recent_run_evidence", runs: [] }; })) });
  const result = await orchestrator.run(request, fake);
  assert.equal(result.terminal, "invalid_tool_result");
  assert.equal(result.counters.toolCalls, 1);
  assert.equal(handlerCalls, 1);
  assert.equal(fake.callCount, 1);
});

test("a third dispatched-tool proposal stops at the two-call limit without dispatch", async () => {
  const fake = new FakeTrainingPlanProvider("tool_limit");
  const result = await new TrainingPlanOrchestrator({ logger: () => undefined }).run(req([entry(1), entry(2), entry(3)]), fake);
  assert.equal(result.terminal, "tool_call_limit");
  assert.equal(result.counters.agentSteps, 3);
  assert.equal(result.counters.toolCalls, 2);
  assert.equal(result.counters.providerAttempts, 3);
});

test("repeated equivalent action executes at most once; changed evidence limits are distinct", async () => {
  const request = req([entry(1), entry(2)]);
  let handlerCalls = 0;
  const handlers: TrainingPlanToolHandlers = {
    get_recent_run_evidence(context, args) { handlerCalls += 1; return new TrainingPlanToolRegistry(context.request).dispatch("get_recent_run_evidence", args); },
    evaluate_previous_training_plan(context) { return context.request.previousPlan ? evaluatePreviousPlan(context.request.previousPlan, context.request.runs) : null; },
  };
  const repeated = new ScriptedTrainingPlanProvider([
    { output: { kind: "tool_call", tool: "get_recent_run_evidence", arguments: { limit: 1 } } },
    { output: { kind: "tool_call", tool: "get_recent_run_evidence", arguments: { limit: 1 } } },
  ]);
  const result = await new TrainingPlanOrchestrator({ logger: () => undefined, toolRegistryFactory: (valid) => new TrainingPlanToolRegistry(valid, handlers) }).run(request, repeated);
  assert.equal(result.terminal, "repeated_action");
  assert.equal(handlerCalls, 1);
  assert.equal(result.counters.toolCalls, 1);
});

test("transient retry stays in its step; timeout, provider-attempt exhaustion, and permanent failures are bounded", async () => {
  const transient = await new TrainingPlanOrchestrator({ logger: () => undefined, retryBackoffMs: 0 }).run(req(), new FakeTrainingPlanProvider("transient_provider_error"));
  assert.equal(transient.terminal, "goal_completed");
  assert.equal(transient.counters.agentSteps, 2);
  assert.equal(transient.counters.providerAttempts, 3);
  const timeout = await new TrainingPlanOrchestrator({ logger: () => undefined }).run(req(), new FakeTrainingPlanProvider("timeout"));
  assert.equal(timeout.terminal, "provider_timeout");
  assert.equal(timeout.counters.providerAttempts, 1);
  const exhaustion = await new TrainingPlanOrchestrator({ logger: () => undefined, retryBackoffMs: 0 }).run(req([entry(1), entry(2), entry(3)]), new FakeTrainingPlanProvider("provider_attempt_exhaustion"));
  assert.equal(exhaustion.terminal, "provider_attempt_limit");
  assert.equal(exhaustion.counters.providerAttempts, 4);
  const permanent = new ScriptedTrainingPlanProvider([{ error: "authentication" }]);
  const failed = await new TrainingPlanOrchestrator({ logger: () => undefined }).run(req(), permanent);
  assert.equal(failed.terminal, "provider_failed");
  assert.equal(failed.counters.providerAttempts, 1);
});

test("deadline and provider timeout policies are injected, bounded, and discard late output", async () => {
  const delays: number[] = [];
  const now = () => 10;
  const provider = new ScriptedTrainingPlanProvider([{ error: "timeout" }]);
  const result = await new TrainingPlanOrchestrator({ now, logger: () => undefined, setTimer: ((callback: (...args: unknown[]) => void, ms?: number) => {
    delays.push(Number(ms));
    return setTimeout(callback as TimerHandler, 60_000);
  }) as typeof setTimeout, clearTimer: clearTimeout }).run(req(), provider);
  assert.equal(result.terminal, "provider_timeout");
  assert.ok(delays.includes(45_000));
  assert.ok(delays.some((duration) => duration <= 15_000));
  assert.ok(delays.every((duration) => duration <= 45_000));

  let timedOutCalls = 0;
  let timeoutSignalAborted = false;
  let suppliedAttemptTimeout = 0;
  const waiting = { generateStep: (_input: unknown, signal: AbortSignal, timeoutMs: number) => {
    timedOutCalls += 1;
    suppliedAttemptTimeout = timeoutMs;
    return new Promise<unknown>((_resolve, reject) => signal.addEventListener("abort", () => { timeoutSignalAborted = true; reject(new TrainingPlanProviderFailure("timeout")); }, { once: true }));
  } };
  const autoTimeout = await new TrainingPlanOrchestrator({
    logger: () => undefined,
    setTimer: ((callback: (...args: unknown[]) => void, ms?: number) => setTimeout(callback as TimerHandler, Number(ms) < 45_000 ? 1 : 60_000)) as typeof setTimeout,
    clearTimer: clearTimeout,
  }).run(req(), waiting);
  assert.equal(autoTimeout.terminal, "provider_timeout");
  assert.equal(timedOutCalls, 1);
  assert.equal(timeoutSignalAborted, true);
  assert.equal(suppliedAttemptTimeout, 15_000);

  let clock = 0;
  const late = { generateStep: async () => { clock = 45_000; return { kind: "tool_call", tool: "get_recent_run_evidence", arguments: { limit: 1 } }; } };
  const expired = await new TrainingPlanOrchestrator({ now: () => clock, logger: () => undefined }).run(req(), late);
  assert.equal(expired.terminal, "deadline");
  assert.equal(expired.counters.providerAttempts, 1);
  assert.equal(expired.counters.toolCalls, 0);

  let reads = 0;
  const alreadyExpired = await new TrainingPlanOrchestrator({ now: () => reads++ === 0 ? 0 : 45_000, logger: () => undefined }).run(req(), new FakeTrainingPlanProvider());
  assert.equal(alreadyExpired.terminal, "deadline");
  assert.equal(alreadyExpired.counters.providerAttempts, 0);
});

test("client cancellation stops a hanging provider and sanitized logs omit history and proposal data", async () => {
  const controller = new AbortController();
  const records: Array<Record<string, string | number | boolean>> = [];
  const hanging = { generateStep: (_input: unknown, signal: AbortSignal) => new Promise<unknown>((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new TrainingPlanProviderFailure("cancelled")), { once: true });
  }) };
  const pending = new TrainingPlanOrchestrator({ logger: (record) => records.push(record), runIdFactory: () => "run-1" }).run(req(), hanging, controller.signal);
  setTimeout(() => controller.abort(), 5);
  const cancelled = await pending;
  assert.equal(cancelled.terminal, "cancelled");
  assert.equal(cancelled.counters.providerAttempts, 1);
  const serialized = JSON.stringify(records);
  assert.equal(serialized.includes("shotsFired"), false);
  assert.equal(serialized.includes("proposal"), false);
  assert.equal(serialized.includes("summary"), false);
});

test("no W05 fake scenario makes network requests", async () => {
  const fake = new FakeTrainingPlanProvider("delayed_response");
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => { fetchCalls += 1; throw new Error("offline fake attempted network"); }) as typeof fetch;
  try {
    const result = await new TrainingPlanOrchestrator({ logger: () => undefined }).run(req(), fake);
    assert.equal(result.terminal, "goal_completed");
    assert.equal(fake.callCount, 2);
    assert.equal(fetchCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

