import { createServer as createHttpServer, IncomingMessage, Server, ServerResponse } from "node:http";
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

const allowedOrigins = new Set([
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage, maxBytes = MAX_COACH_REQUEST_BYTES, strictUtf8 = false): Promise<{ value?: unknown; tooLarge: boolean; malformed: boolean }> {
  const chunks: Buffer[] = [];
  let receivedBytes = 0;
  let tooLarge = false;
  try {
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      receivedBytes += buffer.byteLength;
      if (receivedBytes > maxBytes) {
        tooLarge = true;
        continue;
      }
      chunks.push(buffer);
    }
  } catch {
    return { tooLarge, malformed: true };
  }
  if (tooLarge) return { tooLarge: true, malformed: false };
  try {
    const body = Buffer.concat(chunks);
    const text = strictUtf8 ? new TextDecoder("utf-8", { fatal: true }).decode(body) : body.toString("utf8");
    return { value: JSON.parse(text) as unknown, tooLarge: false, malformed: false };
  } catch {
    return { tooLarge: false, malformed: true };
  }
}

async function handleTrainingPlanRequest(
  request: IncomingMessage,
  response: ServerResponse,
  provider: TrainingPlanModelStepProvider,
  orchestrator: TrainingPlanOrchestrator,
): Promise<void> {
  const contentType = request.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    request.resume();
    sendJson(response, 400, { ok: false, error: "invalid_request" });
    return;
  }
  const parsed = await readJsonBody(request, MAX_TRAINING_PLAN_REQUEST_BYTES, true);
  if (parsed.tooLarge) {
    sendJson(response, 413, { ok: false, error: "invalid_request" });
    return;
  }
  if (parsed.malformed || !validateTrainingPlanRequest(parsed.value)) {
    sendJson(response, 400, { ok: false, error: "invalid_request" });
    return;
  }
  const trainingRequest = parsed.value as TrainingPlanRequest;
  const previous = trainingRequest.previousPlan;
  if (previous && !trainingRequest.runs.some((run) => run.sequence > previous.baseline.maxSequence)) {
    sendJson(response, 409, { ok: false, error: "regeneration_not_eligible" });
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
    request.off("aborted", cancelOnDisconnect);
    response.off("close", cancelOnDisconnect);
  }
}

async function handleCoachRequest(request: IncomingMessage, response: ServerResponse, provider: AiCoachProvider): Promise<void> {
  if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
    request.resume();
    sendJson(response, 400, { ok: false, error: "invalid_request" });
    return;
  }
  const parsed = await readJsonBody(request);
  if (parsed.tooLarge) {
    sendJson(response, 413, { ok: false, error: "invalid_request" });
    return;
  }
  if (parsed.malformed || !validateAiCoachRequest(parsed.value)) {
    sendJson(response, 400, { ok: false, error: "invalid_request" });
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
    request.off("aborted", cancelOnDisconnect);
    response.off("close", cancelOnDisconnect);
  }
}

export function createServer(
  provider: AiCoachProvider = new FakeAiCoachProvider(),
  trainingPlanProvider: TrainingPlanModelStepProvider = new FakeTrainingPlanProvider("first_plan_success"),
  trainingPlanOrchestrator: TrainingPlanOrchestrator = new TrainingPlanOrchestrator(),
): Server {
  return createHttpServer((request, response) => {
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
      void handleCoachRequest(request, response, provider);
      return;
    }
    if (request.method === "POST" && request.url === "/api/training-plan") {
      void handleTrainingPlanRequest(request, response, trainingPlanProvider, trainingPlanOrchestrator);
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
    console.error(`SELFBOUND backend failed to start: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    console.log(`SELFBOUND backend listening at http://${host}:${port}`);
  });
  return server;
}

if (require.main === module) {
  try {
    startServer();
  } catch (error) {
    console.error(error instanceof BackendConfigurationError || error instanceof TrainingPlanConfigurationError ? error.message : "SELFBOUND backend failed to start.");
    process.exitCode = 1;
  }
}
