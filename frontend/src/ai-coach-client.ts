import { AiCoachAdvice, AiCoachRequest, MAX_COACH_REQUEST_BYTES, validateAiCoachRequest, validateAiCoachResponse } from "./ai-coach-contract.js";

export const AI_COACH_ENDPOINT = "http://127.0.0.1:3001/api/ai/coach";
export const AI_COACH_UNAVAILABLE_MESSAGE = "AI Coach is currently unavailable. Try again later.";

export class AiCoachClient {
  private pending = false;

  constructor(private readonly fetcher: typeof fetch = fetch, private readonly endpoint = AI_COACH_ENDPOINT) {}

  get isPending(): boolean {
    return this.pending;
  }

  async request(request: AiCoachRequest): Promise<AiCoachAdvice> {
    if (this.pending) throw new Error("AI Coach request already in progress.");
    if (!validateAiCoachRequest(request)) throw new Error("AI Coach request is invalid.");
    const requestBody = JSON.stringify(request);
    if (new TextEncoder().encode(requestBody).byteLength > MAX_COACH_REQUEST_BYTES) throw new Error("AI Coach request is too large.");
    this.pending = true;
    try {
      // Native browser fetch requires the Window receiver; calling it as a
      // client property makes `this` the AiCoachClient instance.
      const response = await this.fetcher.call(globalThis, this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });
      if (!response.ok) throw new Error("AI Coach request failed.");
      const responseBody: unknown = await response.json();
      if (!validateAiCoachResponse(responseBody)) throw new Error("AI Coach response is invalid.");
      return responseBody.advice;
    } finally {
      this.pending = false;
    }
  }
}
