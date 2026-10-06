import {
  MAX_TRAINING_PLAN_REQUEST_BYTES,
  TrainingPlanRequest,
  TrainingPlanSuccess,
  trainingPlanRequestBytes,
  validateTrainingPlanRequest,
  validateTrainingPlanSuccess,
} from "./training-plan-contract.js";

export const TRAINING_PLAN_ENDPOINT = "http://127.0.0.1:3001/api/training-plan";
export const TRAINING_PLAN_UNAVAILABLE_MESSAGE = "Training Plan is currently unavailable. Try again later.";

export class TrainingPlanClient {
  private pending = false;
  constructor(private readonly fetcher: typeof fetch = fetch, private readonly endpoint = TRAINING_PLAN_ENDPOINT) {}

  get isPending(): boolean { return this.pending; }

  async request(request: TrainingPlanRequest, signal?: AbortSignal): Promise<TrainingPlanSuccess> {
    if (this.pending) throw new Error("Training Plan request already in progress.");
    if (!validateTrainingPlanRequest(request)) throw new Error("Training Plan request is invalid.");
    const body = JSON.stringify(request);
    if (trainingPlanRequestBytes(request) > MAX_TRAINING_PLAN_REQUEST_BYTES) throw new Error("Training Plan request is too large.");
    this.pending = true;
    try {
      const response = await this.fetcher.call(globalThis, this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal,
      });
      if (!response.ok) throw new Error("Training Plan request failed.");
      const output: unknown = await response.json();
      if (!validateTrainingPlanSuccess(output, request)) throw new Error("Training Plan response is invalid.");
      return output;
    } finally {
      this.pending = false;
    }
  }
}

