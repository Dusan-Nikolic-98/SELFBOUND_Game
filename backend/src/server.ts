import { createServer as createHttpServer, IncomingMessage, Server, ServerResponse } from "node:http";
import {
  AiCoachProvider,
  FakeAiCoachProvider,
} from "./ai-coach-provider.js";
import {
  MAX_COACH_REQUEST_BYTES,
  validateAiCoachAdvice,
  validateAiCoachRequest,
} from "./ai-coach-contract.js";

const allowedOrigins = new Set([
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage): Promise<{ value?: unknown; tooLarge: boolean; malformed: boolean }> {
  const chunks: Buffer[] = [];
  let receivedBytes = 0;
  let tooLarge = false;
  try {
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      receivedBytes += buffer.byteLength;
      if (receivedBytes > MAX_COACH_REQUEST_BYTES) {
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
    return { value: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown, tooLarge: false, malformed: false };
  } catch {
    return { tooLarge: false, malformed: true };
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

  try {
    const providerOutput: unknown = await provider.getAdvice(parsed.value);
    if (!validateAiCoachAdvice(providerOutput)) {
      sendJson(response, 503, { ok: false, error: "coach_unavailable" });
      return;
    }
    sendJson(response, 200, { advice: providerOutput });
  } catch {
    sendJson(response, 503, { ok: false, error: "coach_unavailable" });
  }
}

export function createServer(provider: AiCoachProvider = new FakeAiCoachProvider()): Server {
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

    if (request.url === "/api/health") {
      sendJson(response, 405, { ok: false, error: "Method not allowed" });
      return;
    }
    if (request.url === "/api/ai/coach") {
      sendJson(response, 405, { ok: false, error: "method_not_allowed" });
      return;
    }
    sendJson(response, 404, { ok: false, error: "Not found" });
  });
}

export function startServer(): Server {
  const host = process.env.HOST || "127.0.0.1";
  const port = Number(process.env.PORT || 3001);
  const server = createServer();
  server.on("error", (error: NodeJS.ErrnoException) => {
    console.error(`SELFBOUND backend failed to start: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    console.log(`SELFBOUND backend listening at http://${host}:${port}`);
  });
  return server;
}

if (require.main === module) startServer();
