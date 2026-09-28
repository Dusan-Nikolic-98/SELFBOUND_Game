import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const args = [];
if (existsSync(".env")) args.push("--env-file=.env");
args.push("backend/dist/live-validation.js");

const child = spawn(process.execPath, args, { stdio: "inherit", env: process.env });
child.once("error", () => {
  console.error("Live Gemini validation runner could not start.");
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
