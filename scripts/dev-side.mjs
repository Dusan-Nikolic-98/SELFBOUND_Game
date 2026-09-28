import { spawn } from "node:child_process";

const side = process.argv[2];
if (side !== "frontend" && side !== "backend") {
  throw new Error('Expected "frontend" or "backend".');
}

const config = side === "frontend" ? "tsconfig.frontend.json" : "tsconfig.backend.json";
const entry = side === "frontend" ? "scripts/serve.mjs" : "backend/dist/server.js";
let server;
let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  server?.kill("SIGINT");
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const compiler = spawn(process.execPath, ["node_modules/typescript/bin/tsc", "-p", config], { stdio: "inherit" });
compiler.on("error", (error) => {
  console.error(`Could not start the ${side} TypeScript build: ${error.message}`);
  process.exitCode = 1;
});
compiler.on("exit", (code) => {
  if (code !== 0 || shuttingDown) {
    process.exitCode = code ?? 1;
    return;
  }
  server = spawn(process.execPath, [entry], { stdio: "inherit" });
  server.on("error", (error) => {
    console.error(`Could not start the ${side} server: ${error.message}`);
    process.exitCode = 1;
  });
  server.on("exit", (serverCode) => {
    process.exitCode = serverCode ?? 0;
    shutdown();
  });
});
