import { CompletedRunSummary, isCompletedRunSummary } from "./ai-coach-contract.js";
import {
  PreviousTrainingPlanState,
  TrainingPlanBaseline,
  TrainingPlanRequest,
  TrainingPlanSuccess,
  validatePreviousTrainingPlan,
  validateTrainingPlanRequestSize,
  validateTrainingPlanSuccess,
} from "./training-plan-contract.js";

export type TrainingPlanTerminalStatus = "playing" | "won" | "gameover";
export type TrainingPlanRunEntry = { sequence: number; summary: CompletedRunSummary };
const HISTORY_LIMIT = 3;

function cloneSummary(summary: CompletedRunSummary): CompletedRunSummary {
  return {
    ...summary,
    targetStats: summary.targetStats.map((target) => ({ ...target })),
    representativeEvents: summary.representativeEvents.map((event) => ({ ...event })) as CompletedRunSummary["representativeEvents"],
  };
}
function cloneBaseline(baseline: TrainingPlanBaseline): TrainingPlanBaseline {
  return { ...baseline, runSequences: [...baseline.runSequences], primaryFocusMetric: { ...baseline.primaryFocusMetric } };
}
function clonePrevious(state: PreviousTrainingPlanState): PreviousTrainingPlanState {
  return { plan: { ...state.plan, evidence: state.plan.evidence.map((item) => ({ ...item, runSequences: [...item.runSequences] })) }, baseline: cloneBaseline(state.baseline) };
}

/** Page-memory ledger and regeneration gate for W05. No browser storage is used. */
export class TrainingPlanSession {
  private entries: TrainingPlanRunEntry[] = [];
  private nextSequence = 1;
  private previousStatus: TrainingPlanTerminalStatus = "playing";
  private latestSuccess: PreviousTrainingPlanState | null = null;

  get runs(): TrainingPlanRunEntry[] {
    return this.entries.map((entry) => ({ sequence: entry.sequence, summary: cloneSummary(entry.summary) }));
  }

  get previousPlan(): PreviousTrainingPlanState | null {
    return this.latestSuccess ? clonePrevious(this.latestSuccess) : null;
  }

  get canGenerate(): boolean {
    if (this.entries.length === 0) return false;
    if (!this.latestSuccess) return true;
    return this.entries.some((entry) => entry.sequence > this.latestSuccess!.baseline.maxSequence);
  }

  /** Call once per observed frame after Game.update; repeated terminal frames are ignored. */
  observeGameStatus(status: TrainingPlanTerminalStatus, newestCompletedSummary: CompletedRunSummary | undefined): TrainingPlanRunEntry | null {
    const enteredWon = this.previousStatus === "playing" && status === "won";
    const enteredGameOver = this.previousStatus === "playing" && status === "gameover";
    this.previousStatus = status;
    if (!enteredWon && !enteredGameOver) return null;
    const expectedOutcome = enteredWon ? "level_complete" : "game_over";
    if (!newestCompletedSummary || newestCompletedSummary.outcome !== expectedOutcome || !isCompletedRunSummary(newestCompletedSummary)) return null;
    if (!Number.isSafeInteger(this.nextSequence) || this.nextSequence < 1) return null;
    const entry = { sequence: this.nextSequence, summary: cloneSummary(newestCompletedSummary) };
    this.nextSequence += 1;
    this.entries.push(entry);
    if (this.entries.length > HISTORY_LIMIT) this.entries.splice(0, this.entries.length - HISTORY_LIMIT);
    return { sequence: entry.sequence, summary: cloneSummary(entry.summary) };
  }

  createRequestSnapshot(): TrainingPlanRequest | null {
    if (!this.canGenerate) return null;
    const candidate: TrainingPlanRequest = {
      runs: this.runs,
      ...(this.latestSuccess ? { previousPlan: clonePrevious(this.latestSuccess) } : {}),
    };
    return validateTrainingPlanRequestSize(candidate) ? candidate : null;
  }

  recordSuccess(value: unknown, request: TrainingPlanRequest): value is TrainingPlanSuccess {
    if (!validateTrainingPlanSuccess(value, request)) return false;
    const state: PreviousTrainingPlanState = { plan: value.plan, baseline: value.baseline };
    if (!validatePreviousTrainingPlan(state)) return false;
    this.latestSuccess = clonePrevious(state);
    return true;
  }
}

