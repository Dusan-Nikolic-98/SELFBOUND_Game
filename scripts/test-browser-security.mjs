import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const externalCdpUrl = process.env.W08_BROWSER_CDP_URL;
const browserCandidates = [
  process.env.W08_BROWSER_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
].filter(Boolean);
let browserPath;
for (const path of browserCandidates) {
  try { await access(path); browserPath = path; break; } catch { /* try next known browser */ }
}
if (!externalCdpUrl) assert.ok(browserPath, "Set W08_BROWSER_PATH or W08_BROWSER_CDP_URL to run the real-browser suite.");

const portServer = createServer();
await new Promise((resolve, reject) => { portServer.once("error", reject); portServer.listen(0, "127.0.0.1", resolve); });
const port = portServer.address().port;
await new Promise((resolve, reject) => portServer.close((error) => error ? reject(error) : resolve()));
const userData = await mkdtemp(join(tmpdir(), "selfbound-w08-browser-"));
const frontend = spawn(process.execPath, [join(root, "scripts/serve.mjs")], {
  cwd: root, env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) }, stdio: "ignore",
});
let browser;
let browserPid;
let socket;
try {
  const base = `http://127.0.0.1:${port}`;
  const assets = await readdir(join(root, "frontend/dist"), { recursive: true, withFileTypes: true });
  for (const asset of assets.filter((entry) => entry.isFile())) {
    const assetPath = join(asset.parentPath ?? asset.path, asset.name);
    assert.equal((await readFile(assetPath, "utf8")).includes("W08_SERVER_SECRET_DO_NOT_EXPOSE"), false, `synthetic sentinel found in ${asset.name}`);
  }
  let headers;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { headers = await fetch(base).then((response) => response.headers); break; }
    catch { await delay(100); }
  }
  assert.ok(headers, "Production static server did not start.");
  assert.match(headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.match(headers.get("content-security-policy") ?? "", /script-src 'self'/);
  assert.doesNotMatch(headers.get("content-security-policy") ?? "", /unsafe-(?:inline|eval)/);
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("referrer-policy"), "no-referrer");
  console.log("Static production header checks and frontend bundle/source-map sentinel scan passed.");

  let debugPort;
  if (externalCdpUrl) {
    debugPort = Number(new URL(externalCdpUrl).port);
  } else if (process.platform === "win32") {
    const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
    const launcher = join(userData, "launch-browser.ps1");
    const argumentsList = ["--headless=new", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=0", `--user-data-dir=${userData}`, "about:blank"];
    await writeFile(launcher, `$arguments = @(${argumentsList.map(quote).join(",")}); Start-Process -FilePath ${quote(browserPath)} -ArgumentList $arguments -PassThru -WindowStyle Hidden | Select-Object -ExpandProperty Id`);
    browser = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", launcher], { stdio: ["ignore", "pipe", "pipe"] });
    let pidOutput = "";
    let launcherErrors = "";
    browser.stdout.setEncoding("utf8").on("data", (chunk) => { pidOutput += chunk; });
    browser.stderr.setEncoding("utf8").on("data", (chunk) => { launcherErrors += chunk; });
    await new Promise((resolve, reject) => { browser.once("error", reject); browser.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Browser launcher failed: ${launcherErrors}`))); });
    browserPid = Number(pidOutput.trim());
    assert.ok(Number.isInteger(browserPid) && browserPid > 0, `Browser launcher returned an invalid process ID: ${launcherErrors}`);
  } else {
    browser = spawn(browserPath, ["--headless=new", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=0", `--user-data-dir=${userData}`, "about:blank"], { stdio: "ignore" });
    await new Promise((resolve, reject) => { browser.once("error", reject); browser.once("spawn", resolve); });
  }
  if (!externalCdpUrl) {
    const activePortFile = join(userData, "DevToolsActivePort");
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try { debugPort = Number((await readFile(activePortFile, "utf8")).split(/\r?\n/)[0]); break; }
      catch { await delay(100); }
    }
  }
  assert.ok(debugPort, "Browser did not expose its DevTools endpoint.");
  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(base)}`, { method: "PUT" });
  assert.equal(targetResponse.ok, true);
  const target = await targetResponse.json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, (message) => message.error ? reject(new Error(message.error.message)) : resolve(message.result));
    socket.send(JSON.stringify({ id, method, params }));
  });
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Page.navigate", { url: base });
  await delay(400);
  const evaluate = async (expression) => {
    const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const ready = await evaluate("Boolean(document.querySelector('#game-canvas')) && document.readyState === 'complete'");
  assert.equal(ready, true, "The game page must load under its production CSP.");
  const marker = '<img src=x onerror="window.__w08XssExecuted=true"><script>window.__w08XssExecuted=true</script> O\'Reilly — č ć ž š đ; a < b';
  const rendered = await evaluate(`(async () => {
    const { setPlainText } = await import('/dist/plain-text.js');
    const target = document.createElement('p'); target.id = 'w08-render-probe'; document.body.append(target);
    window.__w08XssExecuted = false;
    setPlainText(target, ${JSON.stringify(marker)});
    return { text: target.textContent, html: target.innerHTML, dangerous: [...target.querySelectorAll('script,img,svg,iframe,object')].length || [...target.querySelectorAll('*')].some((node) => [...node.attributes].some((attribute) => /^on/i.test(attribute.name))), executed: window.__w08XssExecuted };
  })()`);
  assert.equal(rendered.text, marker);
  assert.equal(rendered.dangerous, false);
  assert.equal(rendered.executed, false);
  assert.match(rendered.html, /&lt;img/);

  const csp = await evaluate(`(async () => {
    window.__w08CspBlocked = false; window.__w08Violations = [];
    document.addEventListener('securitypolicyviolation', (event) => window.__w08Violations.push(event.violatedDirective));
    const script = document.createElement('script'); script.textContent = 'window.__w08CspBlocked=true'; document.head.append(script);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { blocked: !window.__w08CspBlocked, violations: window.__w08Violations };
  })()`);
  assert.equal(csp.blocked, true);
  assert.ok(csp.violations.some((directive) => directive.startsWith("script-src")));
  console.log("Browser security checks passed: production CSP/headers, plain-text XSS marker, Unicode text, and enforced inline-script block.");
} catch (error) {
  if (error?.code === "EPERM" && !externalCdpUrl) {
    console.error("Browser security test could not start Edge: this environment denied child-process creation (spawn EPERM). Set W08_BROWSER_CDP_URL to an already running Chromium DevTools endpoint to run the browser assertions.");
    process.exitCode = 1;
  } else {
    throw error;
  }
} finally {
  socket?.close();
  if (browserPid) await new Promise((resolve) => execFile("powershell.exe", ["-NoProfile", "-Command", `Stop-Process -Id ${browserPid} -Force -ErrorAction SilentlyContinue`], () => resolve()));
  else browser?.kill();
  frontend.kill();
  await rm(userData, { recursive: true, force: true });
}
