import { Game } from "./game.js";
import { createInputState } from "./input.js";
import { getCoreLevel } from "./level.js";
import { getSafeGameConfig, validateGameConfig } from "./validation.js";
import { AiCoachClient, AI_COACH_UNAVAILABLE_MESSAGE } from "./ai-coach-client.js";

const canvasElement = document.querySelector<HTMLCanvasElement>("#game-canvas");
const resetButtonElement = document.querySelector<HTMLButtonElement>("#reset-level");
const livesElementCandidate = document.querySelector<HTMLElement>("#lives");
const progressElementCandidate = document.querySelector<HTMLElement>("#progress");
const stateElementCandidate = document.querySelector<HTMLElement>("#state");
const messageElementCandidate = document.querySelector<HTMLElement>("#message");
const coachButtonCandidate = document.querySelector<HTMLButtonElement>("#ai-coach");
const coachAvailabilityCandidate = document.querySelector<HTMLElement>("#coach-availability");
const coachPanelCandidate = document.querySelector<HTMLElement>("#coach-panel");
const coachStatusCandidate = document.querySelector<HTMLElement>("#coach-status");
const coachAdviceCandidate = document.querySelector<HTMLElement>("#coach-advice");
const coachSummaryCandidate = document.querySelector<HTMLElement>("#coach-summary");
const coachPrimaryCandidate = document.querySelector<HTMLElement>("#coach-primary");
const coachSecondaryCandidate = document.querySelector<HTMLElement>("#coach-secondary");
const coachGoalCandidate = document.querySelector<HTMLElement>("#coach-goal");

if (!canvasElement || !resetButtonElement || !livesElementCandidate || !progressElementCandidate || !stateElementCandidate || !messageElementCandidate || !coachButtonCandidate || !coachAvailabilityCandidate || !coachPanelCandidate || !coachStatusCandidate || !coachAdviceCandidate || !coachSummaryCandidate || !coachPrimaryCandidate || !coachSecondaryCandidate || !coachGoalCandidate) {
  throw new Error("SELFBOUND could not find its required HTML elements.");
}

const canvas = canvasElement;
const resetButton = resetButtonElement;
const livesElement = livesElementCandidate;
const progressElement = progressElementCandidate;
const stateElement = stateElementCandidate;
const messageElement = messageElementCandidate;
const coachButton = coachButtonCandidate;
const coachAvailability = coachAvailabilityCandidate;
const coachPanel = coachPanelCandidate;
const coachStatus = coachStatusCandidate;
const coachAdvice = coachAdviceCandidate;
const coachSummary = coachSummaryCandidate;
const coachPrimary = coachPrimaryCandidate;
const coachSecondary = coachSecondaryCandidate;
const coachGoal = coachGoalCandidate;

const context = canvas.getContext("2d");
if (!context) throw new Error("SELFBOUND could not create a 2D canvas context.");
const renderContext = context;

const input = createInputState();
const configCandidate = { lives: 3, startingSpeed: 220, difficulty: "normal" };
const configValidation = validateGameConfig(configCandidate);
const config = getSafeGameConfig(configValidation.valid ? configValidation.value : undefined);
const game = new Game(config, getCoreLevel(), { width: canvas.width, height: canvas.height }, input);
const coachClient = new AiCoachClient();

function setKey(event: KeyboardEvent, isDown: boolean): void {
  const key = event.key.toLowerCase();
  if (["a", "d", "arrowleft", "arrowright"].includes(key)) {
    event.preventDefault();
    if (isDown) input.keys.add(key);
    else input.keys.delete(key);
  }
}

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "r") {
    event.preventDefault();
    game.resetLevel();
    return;
  }
  setKey(event, true);
});
window.addEventListener("keyup", (event) => setKey(event, false));

function updateMouse(event: PointerEvent): void {
  const bounds = canvas.getBoundingClientRect();
  input.mouse.x = ((event.clientX - bounds.left) / bounds.width) * canvas.width;
  input.mouse.y = ((event.clientY - bounds.top) / bounds.height) * canvas.height;
  game.observeAimDirection();
}

canvas.addEventListener("pointermove", updateMouse);
canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  updateMouse(event);
  input.fireRequested = true;
  canvas.focus();
});
resetButton.addEventListener("click", () => game.resetLevel());

function updateCoachControls(): void {
  const hasCompletedRun = game.coachHistory.completedRuns.length > 0;
  coachButton.disabled = !hasCompletedRun || coachClient.isPending;
  coachAvailability.hidden = hasCompletedRun;
}

coachButton.addEventListener("click", async () => {
  const request = game.coachHistory.createRequestSnapshot();
  if (!request || coachClient.isPending) return;
  coachPanel.hidden = false;
  coachAdvice.hidden = true;
  coachStatus.textContent = "Analyzing completed runs…";
  updateCoachControls();
  try {
    const advice = await coachClient.request(request);
    coachSummary.textContent = advice.summary;
    coachPrimary.textContent = `${advice.primaryCategory.replace(/_/g, " ")}: ${advice.primaryAdvice}`;
    coachSecondary.textContent = advice.secondaryAdvice ?? "";
    coachSecondary.hidden = !advice.secondaryAdvice;
    coachGoal.textContent = `Next-run goal: ${advice.practiceGoal}`;
    coachStatus.textContent = `Advice based on ${request.runs.length} completed ${request.runs.length === 1 ? "run" : "runs"}.`;
    coachAdvice.hidden = false;
  } catch {
    coachStatus.textContent = AI_COACH_UNAVAILABLE_MESSAGE;
    coachAdvice.hidden = true;
  } finally {
    updateCoachControls();
  }
});

function updateUi(): void {
  updateCoachControls();
  livesElement.textContent = `Lives: ${game.lives}`;
  progressElement.textContent = `Captures: ${game.capturedCount} / ${game.level.requiredSequence.length}`;
  if (game.status === "won") {
    stateElement.textContent = "Level complete";
    messageElement.textContent = "Level Complete";
    messageElement.hidden = false;
  } else if (game.status === "gameover") {
    stateElement.textContent = "Game over";
    messageElement.textContent = "Game Over";
    messageElement.hidden = false;
  } else if (game.greenThreat) {
    stateElement.textContent = "Green threat active — fire defensively";
    messageElement.hidden = true;
  } else if (game.isSequenceComplete) {
    stateElement.textContent = "Reach the exit";
    messageElement.hidden = true;
  } else {
    stateElement.textContent = `Target: ${game.currentTargetId ?? "complete"}`;
    messageElement.hidden = true;
  }
}

let previousTime = performance.now();
function frame(time: number): void {
  const deltaSeconds = (time - previousTime) / 1000;
  previousTime = time;
  game.update(deltaSeconds);
  game.render(renderContext);
  updateUi();
  requestAnimationFrame(frame);
}

game.render(renderContext);
updateUi();
requestAnimationFrame(frame);
