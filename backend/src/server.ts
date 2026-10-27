import { createServer as createHttpServer, IncomingMessage, Server, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import {
  AiCoachProvider,
  FakeAiCoachProvider,
} from "./ai-coach-provider.js";
import { parseAiCoachRuntimeConfig, BackendConfigurationError } from "./ai-coach-config.js";
import { createAiCoachProvider } from "./ai-coach-runtime.js";
import { FakeTrainingPlanProvider } from "./fake-training-plan-provider.js";
import {
  MAX_COACH_REQUEST_BYTES,
  validateAiCoachAdvice,
  validateAiCoachRequest,
} from "./ai-coach-contract.js";
import { MAX_TRAINING_PLAN_REQUEST_BYTES, TrainingPlanRequest, validateTrainingPlanRequest } from "./training-plan-contract.js";
import { parseTrainingPlanRuntimeConfig, TrainingPlanConfigurationError } from "./training-plan-config.js";
import { TrainingPlanOrchestrator } from "./training-plan-orchestrator.js";
import { TrainingPlanModelStepProvider } from "./training-plan-provider.js";
import { createTrainingPlanRuntime } from "./training-plan-runtime.js";
import { AiRequestLimits } from "./request-limits.js";

const allowedOrigins = new Set([
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);
export const BODY_IDLE_TIMEOUT_MS = 10_000;

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'");
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage, maxBytes = MAX_COACH_REQUEST_BYTES, strictUtf8 = false, idleTimeoutMs = BODY_IDLE_TIMEOUT_MS): Promise<{ value?: unknown; tooLarge: boolean; malformed: boolean }> {
  const lengthHeader = request.headers["content-length"];
  if (lengthHeader !== undefined) {
    const length = Number(lengthHeader);
    if (!Number.isSafeInteger(length) || length < 0) return { tooLarge: false, malformed: true };
    if (length > maxBytes) {
      request.pause();
      return { tooLarge: true, malformed: false };
    }
  }
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let receivedBytes = 0;
    let settled = false;
    const cleanup = () => {
      request.off("data", onData);
      request.off("end", onEnd);
      request.off("error", onError);
      request.off("aborted", onAborted);
      request.socket.setTimeout(0);
    };
    const finish = (result: { value?: unknown; tooLarge: boolean; malformed: boolean }) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    const onData = (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      receivedBytes += buffer.byteLength;
      if (receivedBytes > maxBytes) {
        request.pause();
        finish({ tooLarge: true, malformed: false });
        // Keep an error listener after abandoning the unread request body.
        request.on("error", () => undefined);
        return;
      }
      chunks.push(buffer);
    };
    const onEnd = () => {
      try {
        const body = Buffer.concat(chunks);
        const text = strictUtf8 ? new TextDecoder("utf-8", { fatal: true }).decode(body) : body.toString("utf8");
        finish({ value: JSON.parse(text) as unknown, tooLarge: false, malformed: false });
      } catch { finish({ tooLarge: false, malformed: true }); }
    };
    const onError = () => finish({ tooLarge: false, malformed: true });
    const onAborted = () => finish({ tooLarge: false, malformed: true });
    const onIdleTimeout = () => {
      request.pause();
      request.destroy();
      finish({ tooLarge: false, malformed: true });
    };
    request.on("data", onData);
    request.once("end", onEnd);
    request.once("error", onError);
    request.once("aborted", onAborted);
    request.socket.setTimeout(idleTimeoutMs, onIdleTimeout);
  });
}

async function handleTrainingPlanRequest(
  request: IncomingMessage,
  response: ServerResponse,
  provider: TrainingPlanModelStepProvider,
  orchestrator: TrainingPlanOrchestrator,
  limits: AiRequestLimits,
  bodyIdleTimeoutMs: number,
): Promise<void> {
  const contentType = request.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    request.pause();
    response.shouldKeepAlive = false;
    sendJson(response, 400, { ok: false, error: "invalid_request" });
    request.socket.end();
    return;
  }
  const parsed = await readJsonBody(request, MAX_TRAINING_PLAN_REQUEST_BYTES, true, bodyIdleTimeoutMs);
  if (parsed.tooLarge) {
    response.shouldKeepAlive = false;
    sendJson(response, 413, { ok: false, error: "invalid_request" });
    request.socket.end();
    return;
  }
  if (parsed.malformed || !validateTrainingPlanRequest(parsed.value)) {
    if (request.aborted || response.destroyed) return;
    sendJson(response, 400, { ok: false, error: "invalid_request" });
    return;
  }
  const trainingRequest = parsed.value as TrainingPlanRequest;
  const previous = trainingRequest.previousPlan;
  if (previous && !trainingRequest.runs.some((run) => run.sequence > previous.baseline.maxSequence)) {
    sendJson(response, 409, { ok: false, error: "regeneration_not_eligible" });
    return;
  }

  const permit = limits.tryAcquire();
  if ("rejection" in permit) {
    sendJson(response, 429, { ok: false, error: permit.rejection });
    return;
  }

  const controller = new AbortController();
  const cancelOnDisconnect = () => { if (!response.writableEnded) controller.abort(); };
  request.once("aborted", cancelOnDisconnect);
  response.once("close", cancelOnDisconnect);
  try {
    const run = await orchestrator.run(trainingRequest, provider, controller.signal);
    if (controller.signal.aborted || response.destroyed) return;
    if (!run.ok || !run.result) {
      sendJson(response, 503, { ok: false, error: "training_plan_unavailable" });
      return;
    }
    sendJson(response, 200, run.result);
  } catch {
    if (!controller.signal.aborted && !response.destroyed) sendJson(response, 503, { ok: false, error: "training_plan_unavailable" });
  } finally {
    permit.release();
    request.off("aborted", cancelOnDisconnect);
    response.off("close", cancelOnDisconnect);
  }
}

async function handleCoachRequest(request: IncomingMessage, response: ServerResponse, provider: AiCoachProvider, limits: AiRequestLimits, bodyIdleTimeoutMs: number): Promise<void> {
  const contentType = request.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    request.pause();
    response.shouldKeepAlive = false;
    sendJson(response, 400, { ok: false, error: "invalid_request" });
    request.socket.end();
    return;
  }
  const parsed = await readJsonBody(request, MAX_COACH_REQUEST_BYTES, false, bodyIdleTimeoutMs);
  if (parsed.tooLarge) {
    response.shouldKeepAlive = false;
    sendJson(response, 413, { ok: false, error: "invalid_request" });
    request.socket.end();
    return;
  }
  if (parsed.malformed || !validateAiCoachRequest(parsed.value)) {
    if (request.aborted || response.destroyed) return;
    sendJson(response, 400, { ok: false, error: "invalid_request" });
    return;
  }

  const permit = limits.tryAcquire();
  if ("rejection" in permit) {
    sendJson(response, 429, { ok: false, error: permit.rejection });
    return;
  }

  const controller = new AbortController();
  const cancelOnDisconnect = () => { if (!response.writableEnded) controller.abort(); };
  request.once("aborted", cancelOnDisconnect);
  response.once("close", cancelOnDisconnect);
  try {
    const providerOutput: unknown = await provider.getAdvice(parsed.value, controller.signal);
    if (controller.signal.aborted || response.destroyed) return;
    if (!validateAiCoachAdvice(providerOutput)) {
      sendJson(response, 503, { ok: false, error: "coach_unavailable" });
      return;
    }
    sendJson(response, 200, { advice: providerOutput });
  } catch {
    if (!controller.signal.aborted && !response.destroyed) sendJson(response, 503, { ok: false, error: "coach_unavailable" });
  } finally {
    permit.release();
    request.off("aborted", cancelOnDisconnect);
    response.off("close", cancelOnDisconnect);
  }
}

export function createServer(
  provider: AiCoachProvider = new FakeAiCoachProvider(),
  trainingPlanProvider: TrainingPlanModelStepProvider = new FakeTrainingPlanProvider("first_plan_success"),
  trainingPlanOrchestrator: TrainingPlanOrchestrator = new TrainingPlanOrchestrator(),
  options: { now?: () => number; bodyIdleTimeoutMs?: number } = {},
): Server {
  const limits = new AiRequestLimits(options.now);
  const bodyIdleTimeoutMs = options.bodyIdleTimeoutMs ?? BODY_IDLE_TIMEOUT_MS;
  return createHttpServer((request, response) => {
    setSecurityHeaders(response);
    const origin = request.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
    }

    if (request.method === "OPTIONS") {
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type");
      response.writeHead(204).end();
      return;
    }

    if (request.method === "GET" && request.url === "/api/health") {
      sendJson(response, 200, { ok: true, service: "selfbound-backend" });
      return;
    }
    if (request.method === "POST" && request.url === "/api/ai/coach") {
      void handleCoachRequest(request, response, provider, limits, bodyIdleTimeoutMs).catch(() => {
        if (!response.destroyed && !response.writableEnded) sendJson(response, 400, { ok: false, error: "invalid_request" });
      });
      return;
    }
    if (request.method === "POST" && request.url === "/api/training-plan") {
      void handleTrainingPlanRequest(request, response, trainingPlanProvider, trainingPlanOrchestrator, limits, bodyIdleTimeoutMs).catch(() => {
        if (!response.destroyed && !response.writableEnded) sendJson(response, 400, { ok: false, error: "invalid_request" });
      });
      return;
    }

    if (request.url === "/api/health") {
      sendJson(response, 405, { ok: false, error: "Method not allowed" });
      return;
    }
    if (request.url === "/api/ai/coach") {
      sendJson(response, 405, { ok: false, error: "method_not_allowed" });
      return;
    }
    if (request.url === "/api/training-plan") {
      sendJson(response, 405, { ok: false, error: "method_not_allowed" });
      return;
    }
    sendJson(response, 404, { ok: false, error: "Not found" });
  });
}

export function startServer(): Server {
  const host = process.env.HOST || "127.0.0.1";
  const port = Number(process.env.PORT || 3001);
  const provider = createAiCoachProvider(parseAiCoachRuntimeConfig(process.env));
  const trainingPlanRuntime = createTrainingPlanRuntime(parseTrainingPlanRuntimeConfig(process.env));
  const server = createServer(provider, trainingPlanRuntime.provider, trainingPlanRuntime.orchestrator);
  server.on("error", (error: NodeJS.ErrnoException) => {
    const reasonCode = error.code === "EADDRINUSE" || error.code === "EACCES" ? error.code : "startup_failed";
    console.error(JSON.stringify({ event: "backend_start", outcome: "failure", reasonCode, correlationId: randomUUID(), providerAttempts: 0, toolCalls: 0, durationMs: 0, status: 503 }));
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    console.log(JSON.stringify({ event: "backend_start", outcome: "success", reasonCode: "listening", correlationId: randomUUID(), providerAttempts: 0, toolCalls: 0, durationMs: 0, status: 200 }));
  });
  return server;
}

if (require.main === module) {
  try {
    startServer();
  } catch (error) {
    const reasonCode = error instanceof BackendConfigurationError || error instanceof TrainingPlanConfigurationError ? "configuration_invalid" : "startup_failed";
    console.error(JSON.stringify({ event: "backend_start", outcome: "failure", reasonCode, correlationId: randomUUID(), providerAttempts: 0, toolCalls: 0, durationMs: 0, status: 503 }));
    process.exitCode = 1;
  }
}
