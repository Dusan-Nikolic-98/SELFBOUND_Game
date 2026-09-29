import type { GoogleGenAI as GoogleGenAIClient, HttpOptions } from "@google/genai" with { "resolution-mode": "import" };
import { performance } from "node:perf_hooks";
import { AiCoachRequest, validateAiCoachAdvice, validateAiCoachRequest } from "./ai-coach-contract.js";
import { GEMINI_MODEL_ID } from "./ai-coach-config.js";
import { AI_COACH_SYSTEM_INSTRUCTION, serializeAiCoachInput } from "./ai-coach-prompt.js";
import { AiCoachProvider } from "./ai-coach-provider.js";

export const GEMINI_TOTAL_DEADLINE_MS = 15_000;
export const GEMINI_MAX_ATTEMPTS = 2;
export const GEMINI_RETRY_DELAY_MS = 500;
export const GEMINI_MIN_RETRY_BUDGET_MS = 1_000;
export const GEMINI_MAX_OUTPUT_TOKENS = 512;

export type GeminiFailureCategory =
  | "timeout"
  | "rate_limited"
  | "provider_unavailable"
  | "authentication"
  | "invalid_provider_output"
  | "unknown";

export type GeminiUsage = { inputTokens?: number; outputTokens?: number; totalTokens?: number };
export type GeminiGenerateContentResult = { text?: string; usage?: GeminiUsage };

export type GeminiGenerateContentRequest = {
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

export interface GeminiGenerateContentClient {
  generateContent(request: GeminiGenerateContentRequest, signal: AbortSignal): Promise<GeminiGenerateContentResult>;
}

export type GeminiHttpOptions = {
  timeout: number;
  retryOptions: { attempts: number; httpStatusCodes: number[] };
  fetch?: HttpOptions["fetch"];
};

export type GeminiUsageRecord = {
  operation: "ai.coach";
  provider: "gemini";
  model: string;
  timestamp: string;
  latencyMs: number;
  success: boolean;
  attempts: number;
  failureCategory?: GeminiFailureCategory;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type GeminiSdkFactory = (apiKey: string, httpOptions: GeminiHttpOptions) => GeminiGenerateContentClient;

export const GEMINI_SDK_HTTP_OPTIONS: GeminiHttpOptions = {
  timeout: GEMINI_TOTAL_DEADLINE_MS,
  // The Coach provider owns the two-attempt policy. Do not let the SDK add retries.
  retryOptions: { attempts: 1, httpStatusCodes: [] },
};

const responseSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    summary: { type: "string" },
    primaryCategory: {
      type: "string",
      enum: ["threat_management", "bounce_strategy", "aim_timing", "positioning", "range_management", "general"],
    },
    primaryAdvice: { type: "string" },
    secondaryAdvice: { type: "string" },
    practiceGoal: { type: "string" },
  },
  required: ["summary", "primaryCategory", "primaryAdvice", "practiceGoal"],
};

export function buildGeminiGenerateContentRequest(request: AiCoachRequest, model: string): GeminiGenerateContentRequest {
  return {
    model,
    contents: serializeAiCoachInput(request),
    config: {
      systemInstruction: AI_COACH_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseJsonSchema: responseSchema,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
    },
  };
}

export function createGeminiSdkFactory(): GeminiSdkFactory {
  return (apiKey, httpOptions) => {
    // This project emits CommonJS while the SDK publishes both module formats.
    // Requiring its declared CommonJS export avoids changing the backend module system.
    const sdkModule = require("@google/genai") as { GoogleGenAI: typeof GoogleGenAIClient };
    const sdk = new sdkModule.GoogleGenAI({ apiKey, httpOptions });
    return {
      generateContent: async (request, signal) => {
        const result = await sdk.models.generateContent({
          model: request.model,
          contents: request.contents,
          config: { ...request.config, abortSignal: signal },
        });
        return {
          text: result.text,
          usage: {
            inputTokens: result.usageMetadata?.promptTokenCount,
            outputTokens: result.usageMetadata?.candidatesTokenCount,
            totalTokens: result.usageMetadata?.totalTokenCount,
          },
        };
      },
    };
  };
}

class GeminiProviderFailure extends Error {
  constructor(readonly category: GeminiFailureCategory, readonly retryable: boolean) {
    super("Gemini Coach request failed.");
    this.name = "GeminiProviderFailure";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getHttpStatus(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  const status = error.status;
  return typeof status === "number" && Number.isInteger(status) ? status : undefined;
}

function getNetworkCode(error: unknown): string | undefined {
  if (!isRecord(error)) return undefined;
  const cause = error.cause;
  if (isRecord(cause) && typeof cause.code === "string") return cause.code;
  return typeof error.code === "string" ? error.code : undefined;
}

const NETWORK_ERROR_CODES = new Set([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "EHOSTUNREACH", "ENETUNREACH",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_SOCKET",
]);

function classifyFailure(error: unknown): GeminiProviderFailure {
  if (error instanceof GeminiProviderFailure) return error;
  const status = getHttpStatus(error);
  if (status === 401 || status === 403) return new GeminiProviderFailure("authentication", false);
  if (status === 429) return new GeminiProviderFailure("rate_limited", true);
  if (status === 408) return new GeminiProviderFailure("timeout", true);
  if (status !== undefined && [500, 502, 503, 504].includes(status)) return new GeminiProviderFailure("provider_unavailable", true);
  const networkCode = getNetworkCode(error);
  if (networkCode && NETWORK_ERROR_CODES.has(networkCode)) {
    return new GeminiProviderFailure("provider_unavailable", true);
  }
  return new GeminiProviderFailure("unknown", false);
}

type ProviderOptions = {
  apiKey?: string;
  model?: string;
  client?: GeminiGenerateContentClient;
  sdkFactory?: GeminiSdkFactory;
  totalDeadlineMs?: number;
  retryDelayMs?: number;
  maxAttempts?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  logger?: (record: GeminiUsageRecord) => void;
};

export class GeminiAiCoachProvider implements AiCoachProvider {
  private readonly client: GeminiGenerateContentClient;
  private readonly model: string;
  private readonly totalDeadlineMs: number;
  private readonly retryDelayMs: number;
  private readonly maxAttempts: number;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly logger: (record: GeminiUsageRecord) => void;

  constructor(options: ProviderOptions) {
    this.model = options.model ?? GEMINI_MODEL_ID;
    this.totalDeadlineMs = options.totalDeadlineMs ?? GEMINI_TOTAL_DEADLINE_MS;
    this.retryDelayMs = options.retryDelayMs ?? GEMINI_RETRY_DELAY_MS;
    this.maxAttempts = options.maxAttempts ?? GEMINI_MAX_ATTEMPTS;
    if (!Number.isFinite(this.totalDeadlineMs) || this.totalDeadlineMs <= 0) {
      throw new Error("Gemini Coach requires a positive total deadline.");
    }
    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts !== GEMINI_MAX_ATTEMPTS) {
      throw new Error("Gemini Coach supports exactly two maximum attempts.");
    }
    this.now = options.now ?? (() => performance.now());
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.logger = options.logger ?? ((record) => console.info(JSON.stringify(record)));

    if (options.client) {
      this.client = options.client;
    } else if (options.apiKey?.trim()) {
      const factory = options.sdkFactory ?? createGeminiSdkFactory();
      this.client = factory(options.apiKey, GEMINI_SDK_HTTP_OPTIONS);
    } else {
      throw new Error("GEMINI_API_KEY is required to create the Gemini Coach provider.");
    }
  }

  async getAdvice(request: AiCoachRequest): Promise<unknown> {
    if (!validateAiCoachRequest(request)) throw new GeminiProviderFailure("unknown", false);

    const startedAt = this.now();
    const deadline = startedAt + this.totalDeadlineMs;
    const geminiRequest = buildGeminiGenerateContentRequest(request, this.model);
    let attempts = 0;

    while (attempts < this.maxAttempts) {
      const remainingMs = deadline - this.now();
      if (remainingMs <= 0) {
        const failure = new GeminiProviderFailure("timeout", false);
        this.logFailure(startedAt, attempts, failure);
        throw failure;
      }

      attempts += 1;
      try {
        const result = await this.callWithinDeadline(geminiRequest, remainingMs);
        let parsed: unknown;
        try {
          if (typeof result.text !== "string") throw new Error("Missing structured output.");
          parsed = JSON.parse(result.text) as unknown;
        } catch {
          throw new GeminiProviderFailure("invalid_provider_output", false);
        }
        if (!validateAiCoachAdvice(parsed)) throw new GeminiProviderFailure("invalid_provider_output", false);

        this.log({
          operation: "ai.coach",
          provider: "gemini",
          model: this.model,
          timestamp: new Date().toISOString(),
          latencyMs: Math.max(0, this.now() - startedAt),
          success: true,
          attempts,
          ...(result.usage?.inputTokens === undefined ? {} : { inputTokens: result.usage.inputTokens }),
          ...(result.usage?.outputTokens === undefined ? {} : { outputTokens: result.usage.outputTokens }),
          ...(result.usage?.totalTokens === undefined ? {} : { totalTokens: result.usage.totalTokens }),
        });
        return parsed;
      } catch (error) {
        const failure = classifyFailure(error);
        const afterFailureMs = deadline - this.now();
        if (failure.retryable && attempts < this.maxAttempts && afterFailureMs > this.retryDelayMs + GEMINI_MIN_RETRY_BUDGET_MS) {
          await this.sleep(this.retryDelayMs);
          if (deadline - this.now() > GEMINI_MIN_RETRY_BUDGET_MS) continue;
          const deadlineFailure = new GeminiProviderFailure("timeout", false);
          this.logFailure(startedAt, attempts, deadlineFailure);
          throw deadlineFailure;
        }
        this.logFailure(startedAt, attempts, failure);
        throw failure;
      }
    }

    const failure = new GeminiProviderFailure("timeout", false);
    this.logFailure(startedAt, attempts, failure);
    throw failure;
  }

  private async callWithinDeadline(request: GeminiGenerateContentRequest, remainingMs: number): Promise<GeminiGenerateContentResult> {
    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        reject(new GeminiProviderFailure("timeout", false));
      }, remainingMs);
    });
    const call = Promise.resolve().then(() => this.client.generateContent(request, controller.signal));
    try {
      return await Promise.race([call, timeout]);
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    }
  }

  private logFailure(startedAt: number, attempts: number, failure: GeminiProviderFailure): void {
    this.log({
      operation: "ai.coach",
      provider: "gemini",
      model: this.model,
      timestamp: new Date().toISOString(),
      latencyMs: Math.max(0, this.now() - startedAt),
      success: false,
      attempts,
      failureCategory: failure.category,
    });
  }

  private log(record: GeminiUsageRecord): void {
    try {
      this.logger(record);
    } catch {
      // Diagnostics must never change the provider result or expose an SDK error.
    }
  }
}
