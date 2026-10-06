import type { GoogleGenAI as GoogleGenAIClient, HttpOptions } from "@google/genai" with { "resolution-mode": "import" };
import {
  MAX_TRAINING_PLAN_OUTPUT_BYTES,
  TRAINING_PLAN_ASSESSMENTS,
  TRAINING_PLAN_FOCI,
  TRAINING_PLAN_METRICS,
} from "./training-plan-contract.js";
import { TRAINING_PLAN_GEMINI_MODEL } from "./training-plan-config.js";
import { TrainingPlanModelStepInput } from "./training-plan-prompt.js";
import { TrainingPlanModelStepProvider, TrainingPlanProviderFailure } from "./training-plan-provider.js";

export const TRAINING_PLAN_GEMINI_MAX_OUTPUT_TOKENS = 1_024;
export type TrainingPlanGeminiHttpOptions = { timeout: number; retryOptions: { attempts: number; httpStatusCodes: number[] }; fetch?: HttpOptions["fetch"] };
export type TrainingPlanGeminiRequest = {
  model: string;
  contents: string;
  config: {
    systemInstruction: string;
    responseMimeType: "application/json";
    responseJsonSchema: Record<string, unknown>;
    maxOutputTokens: number;
    abortSignal?: AbortSignal;
  };
};
export type TrainingPlanGeminiResult = { text?: string; safetyRefusal?: boolean };
export interface TrainingPlanGeminiClient {
  generateContent(request: TrainingPlanGeminiRequest, signal: AbortSignal): Promise<TrainingPlanGeminiResult>;
}
export type TrainingPlanGeminiClientFactory = (apiKey: string, httpOptions: TrainingPlanGeminiHttpOptions) => TrainingPlanGeminiClient;

export const TRAINING_PLAN_GEMINI_RESPONSE_SCHEMA: Record<string, unknown> = {
  oneOf: [
    {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["tool_call"] },
        tool: { type: "string", enum: ["get_recent_run_evidence", "evaluate_previous_training_plan"] },
        arguments: {
          oneOf: [
            { type: "object", properties: { limit: { type: "integer", enum: [1, 2, 3] } }, required: ["limit"], additionalProperties: false },
            { type: "object", properties: {}, required: [], additionalProperties: false },
          ],
        },
      },
      required: ["kind", "tool", "arguments"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["final"] },
        result: {
          type: "object",
          properties: {
            summary: { type: "string", minLength: 1, maxLength: 240 },
            previousAssessment: { type: "string", enum: [...TRAINING_PLAN_ASSESSMENTS] },
            primaryFocus: { type: "string", enum: [...TRAINING_PLAN_FOCI] },
            practiceGoal: { type: "string", minLength: 1, maxLength: 240 },
            evidence: {
              type: "array", minItems: 1, maxItems: 4,
              items: {
                type: "object",
                properties: {
                  source: { type: "string", enum: ["recent_run_evidence", "previous_plan_evaluation"] },
                  metric: { type: "string", enum: [...TRAINING_PLAN_METRICS] },
                  runSequences: { type: "array", minItems: 1, maxItems: 3, items: { type: "integer", minimum: 1 } },
                  opportunities: { type: "integer", minimum: 0 },
                  undesirable: { type: "integer", minimum: 0 },
                },
                required: ["source", "metric", "runSequences", "opportunities", "undesirable"],
                additionalProperties: false,
              },
            },
            confidence: { type: "string", enum: ["low", "medium", "high"] },
          },
          required: ["summary", "previousAssessment", "primaryFocus", "practiceGoal", "evidence", "confidence"],
          additionalProperties: false,
        },
      },
      required: ["kind", "result"],
      additionalProperties: false,
    },
  ],
};

export function buildTrainingPlanGeminiRequest(input: TrainingPlanModelStepInput, timeoutMs: number): TrainingPlanGeminiRequest {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TrainingPlanProviderFailure("timeout");
  return {
    model: TRAINING_PLAN_GEMINI_MODEL,
    contents: JSON.stringify(input),
    config: {
      systemInstruction: input.instructions,
      responseMimeType: "application/json",
      responseJsonSchema: TRAINING_PLAN_GEMINI_RESPONSE_SCHEMA,
      maxOutputTokens: TRAINING_PLAN_GEMINI_MAX_OUTPUT_TOKENS,
    },
  };
}

export function createTrainingPlanGeminiClientFactory(): TrainingPlanGeminiClientFactory {
  return (apiKey, options) => {
    const sdkModule = require("@google/genai") as { GoogleGenAI: typeof GoogleGenAIClient };
    const sdk = new sdkModule.GoogleGenAI({ apiKey, httpOptions: options as HttpOptions });
    return {
      generateContent: async (request, signal) => {
        const result = await sdk.models.generateContent({
          model: request.model,
          contents: request.contents,
          config: { ...request.config, abortSignal: signal },
        });
        const candidate = result.candidates?.[0];
        const blockReason = result.promptFeedback?.blockReason;
        return {
          text: result.text,
          safetyRefusal: Boolean(blockReason && String(blockReason) !== "BLOCK_REASON_UNSPECIFIED") || candidate?.finishReason === "SAFETY",
        };
      },
    };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function statusOf(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  const status = error.status ?? error.statusCode;
  return typeof status === "number" && Number.isInteger(status) ? status : undefined;
}
function networkCodeOf(error: unknown): string | undefined {
  if (!isRecord(error)) return undefined;
  if (typeof error.code === "string") return error.code;
  return isRecord(error.cause) && typeof error.cause.code === "string" ? error.cause.code : undefined;
}
export function classifyTrainingPlanGeminiFailure(error: unknown, signal?: AbortSignal): TrainingPlanProviderFailure {
  if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) return new TrainingPlanProviderFailure("cancelled");
  if (error instanceof Error && error.name === "TimeoutError") return new TrainingPlanProviderFailure("timeout");
  const status = statusOf(error);
  if (status === 401 || status === 403) return new TrainingPlanProviderFailure("authentication");
  if (status === 400) return new TrainingPlanProviderFailure("invalid_request");
  if (status === 408) return new TrainingPlanProviderFailure("timeout");
  if (status === 429) return new TrainingPlanProviderFailure("rate_limit");
  if (status !== undefined && status >= 500 && status <= 599) return new TrainingPlanProviderFailure("temporary_service");
  const networkCode = networkCodeOf(error);
  if (networkCode && ["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT"].includes(networkCode)) return new TrainingPlanProviderFailure("timeout");
  if (networkCode && ["ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "ENOTFOUND", "EHOSTUNREACH", "ENETUNREACH", "UND_ERR_SOCKET"].includes(networkCode)) {
    return new TrainingPlanProviderFailure("transient_network");
  }
  return new TrainingPlanProviderFailure("permanent");
}

export class GeminiTrainingPlanProvider implements TrainingPlanModelStepProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model = TRAINING_PLAN_GEMINI_MODEL,
    private readonly clientFactory: TrainingPlanGeminiClientFactory = createTrainingPlanGeminiClientFactory(),
  ) {
    if (!apiKey.trim()) throw new Error("TRAINING_PLAN_GEMINI_API_KEY is required for Training Plan Gemini mode.");
    if (model !== TRAINING_PLAN_GEMINI_MODEL) throw new Error(`Training Plan model must be ${TRAINING_PLAN_GEMINI_MODEL}.`);
  }

  async generateStep(input: TrainingPlanModelStepInput, signal: AbortSignal, timeoutMs: number): Promise<unknown> {
    if (signal.aborted) throw new TrainingPlanProviderFailure("cancelled");
    const request = buildTrainingPlanGeminiRequest(input, timeoutMs);
    let result: TrainingPlanGeminiResult;
    try {
      const client = this.clientFactory(this.apiKey, { timeout: timeoutMs, retryOptions: { attempts: 1, httpStatusCodes: [] } });
      result = await client.generateContent({ ...request, model: this.model }, signal);
    } catch (error) {
      throw classifyTrainingPlanGeminiFailure(error, signal);
    }
    if (signal.aborted) throw new TrainingPlanProviderFailure("cancelled");
    if (result.safetyRefusal) throw new TrainingPlanProviderFailure("refusal");
    if (typeof result.text !== "string" || result.text.trim().length === 0) throw new TrainingPlanProviderFailure("invalid_output");
    if (Buffer.byteLength(result.text, "utf8") > MAX_TRAINING_PLAN_OUTPUT_BYTES) throw new TrainingPlanProviderFailure("invalid_output");
    try { return JSON.parse(result.text) as unknown; }
    catch { throw new TrainingPlanProviderFailure("invalid_output"); }
  }
}

