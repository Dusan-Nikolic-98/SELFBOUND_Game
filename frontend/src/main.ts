import { Game } from "./game.js";
import { createInputState } from "./input.js";
import { getCoreLevel } from "./level.js";
import { getSafeGameConfig, validateGameConfig } from "./validation.js";
import { AiCoachClient, AI_COACH_UNAVAILABLE_MESSAGE } from "./ai-coach-client.js";
import { TrainingPlanClient, TRAINING_PLAN_UNAVAILABLE_MESSAGE } from "./training-plan-client.js";
import { TrainingPlanSession } from "./training-plan-session.js";

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
const trainingPlanButtonCandidate = document.querySelector<HTMLButtonElement>("#training-plan-button");
const trainingPlanAvailabilityCandidate = document.querySelector<HTMLElement>("#training-plan-availability");
const trainingPlanPanelCandidate = document.querySelector<HTMLElement>("#training-plan-panel");
const trainingPlanStatusCandidate = document.querySelector<HTMLElement>("#training-plan-status");
const trainingPlanResultCandidate = document.querySelector<HTMLElement>("#training-plan-result");
const trainingPlanSummaryCandidate = document.querySelector<HTMLElement>("#training-plan-summary");
const trainingPlanFocusCandidate = document.querySelector<HTMLElement>("#training-plan-focus");
const trainingPlanGoalCandidate = document.querySelector<HTMLElement>("#training-plan-goal");
const trainingPlanAssessmentCandidate = document.querySelector<HTMLElement>("#training-plan-assessment");
const trainingPlanEvidenceCandidate = document.querySelector<HTMLElement>("#training-plan-evidence");
const trainingPlanConfidenceCandidate = document.querySelector<HTMLElement>("#training-plan-confidence");

if (!canvasElement || !resetButtonElement || !livesElementCandidate || !progressElementCandidate || !stateElementCandidate || !messageElementCandidate || !coachButtonCandidate || !coachAvailabilityCandidate || !coachPanelCandidate || !coachStatusCandidate || !coachAdviceCandidate || !coachSummaryCandidate || !coachPrimaryCandidate || !coachSecondaryCandidate || !coachGoalCandidate || !trainingPlanButtonCandidate || !trainingPlanAvailabilityCandidate || !trainingPlanPanelCandidate || !trainingPlanStatusCandidate || !trainingPlanResultCandidate || !trainingPlanSummaryCandidate || !trainingPlanFocusCandidate || !trainingPlanGoalCandidate || !trainingPlanAssessmentCandidate || !trainingPlanEvidenceCandidate || !trainingPlanConfidenceCandidate) {
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
const trainingPlanButton = trainingPlanButtonCandidate;
const trainingPlanAvailability = trainingPlanAvailabilityCandidate;
const trainingPlanPanel = trainingPlanPanelCandidate;
const trainingPlanStatus = trainingPlanStatusCandidate;
const trainingPlanResult = trainingPlanResultCandidate;
const trainingPlanSummary = trainingPlanSummaryCandidate;
const trainingPlanFocus = trainingPlanFocusCandidate;
const trainingPlanGoal = trainingPlanGoalCandidate;
const trainingPlanAssessment = trainingPlanAssessmentCandidate;
const trainingPlanEvidence = trainingPlanEvidenceCandidate;
const trainingPlanConfidence = trainingPlanConfidenceCandidate;

const context = canvas.getContext("2d");
if (!context) throw new Error("SELFBOUND could not create a 2D canvas context.");
const renderContext = context;

const input = createInputState();
const configCandidate = { lives: 3, startingSpeed: 220, difficulty: "normal" };
const configValidation = validateGameConfig(configCandidate);
const config = getSafeGameConfig(configValidation.valid ? configValidation.value : undefined);
const game = new Game(config, getCoreLevel(), { width: canvas.width, height: canvas.height }, input);
const coachClient = new AiCoachClient();
const trainingPlanClient = new TrainingPlanClient();
const trainingPlanSession = new TrainingPlanSession();

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

function updateTrainingPlanControls(): void {
  trainingPlanButton.disabled = !trainingPlanSession.canGenerate || trainingPlanClient.isPending;
  trainingPlanAvailability.hidden = trainingPlanSession.canGenerate;
  if (!trainingPlanSession.canGenerate) {
    trainingPlanAvailability.textContent = trainingPlanSession.previousPlan
      ? "Complete another run before requesting another plan."
      : "Complete a run before requesting a training plan.";
  }
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

trainingPlanButton.addEventListener("click", async () => {
  const request = trainingPlanSession.createRequestSnapshot();
  if (!request || trainingPlanClient.isPending) return;
  trainingPlanPanel.hidden = false;
  trainingPlanStatus.textContent = "Preparing a focused plan from completed runs…";
  updateTrainingPlanControls();
  try {
    const response = await trainingPlanClient.request(request);
    if (!trainingPlanSession.recordSuccess(response, request)) throw new Error("Training Plan response failed session validation.");
    trainingPlanSummary.textContent = response.plan.summary;
    trainingPlanFocus.textContent = `Primary focus: ${response.plan.primaryFocus.replace(/_/g, " ")}`;
    trainingPlanGoal.textContent = `Next-run practice goal: ${response.plan.practiceGoal}`;
    trainingPlanAssessment.textContent = `Previous plan: ${response.plan.previousAssessment.replace(/_/g, " ")}`;
    trainingPlanConfidence.textContent = `Confidence: ${response.plan.confidence}`;
    trainingPlanEvidence.textContent = response.plan.evidence.map((item) => {
      const sequences = item.runSequences.join(", ");
      return `${item.source.replace(/_/g, " ")} — ${item.metric.replace(/_/g, " ")}; runs ${sequences}; ${item.undesirable}/${item.opportunities} undesirable opportunities`;
    }).join(". ");
    trainingPlanResult.hidden = false;
    trainingPlanStatus.textContent = "Training plan ready for your next run.";
  } catch {
    trainingPlanStatus.textContent = TRAINING_PLAN_UNAVAILABLE_MESSAGE;
  } finally {
    updateTrainingPlanControls();
  }
});

function updateUi(): void {
  updateCoachControls();
  updateTrainingPlanControls();
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
  const completedRuns = game.coachHistory.completedRuns;
  trainingPlanSession.observeGameStatus(game.status, completedRuns[completedRuns.length - 1]);
  game.render(renderContext);
  updateUi();
  requestAnimationFrame(frame);
}

game.render(renderContext);
updateUi();
requestAnimationFrame(frame);
