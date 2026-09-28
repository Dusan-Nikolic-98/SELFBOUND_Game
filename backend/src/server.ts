import { createServer } from "node:http";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3001);
const allowedOrigins = new Set([
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

const server = createServer((request, response) => {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }

  if (request.method === "OPTIONS") {
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.writeHead(204).end();
    return;
  }

  if (request.method === "GET" && request.url === "/api/health") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, service: "selfbound-backend" }));
    return;
  }

  const status = request.url === "/api/health" ? 405 : 404;
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ ok: false, error: status === 405 ? "Method not allowed" : "Not found" }));
});

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(`SELFBOUND backend failed to start: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`SELFBOUND backend listening at http://${host}:${port}`);
});
