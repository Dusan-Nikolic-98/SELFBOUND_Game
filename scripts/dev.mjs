import { spawn } from "node:child_process";

const children = ["frontend", "backend"].map((side) =>
  spawn(process.execPath, ["scripts/dev-side.mjs", side], { stdio: "inherit" }),
);

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill("SIGINT");
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
for (const child of children) child.on("exit", (code) => {
  if (code && code !== 0) process.exitCode = code;
  shutdown();
});
