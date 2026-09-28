import type { GoogleGenAI as GoogleGenAIClient } from "@google/genai" with { "resolution-mode": "import" };
import { AiCoachRequest, validateAiCoachAdvice } from "./ai-coach-contract.js";
import { GEMINI_MODEL_ID } from "./ai-coach-config.js";
import { AI_COACH_SYSTEM_INSTRUCTION, serializeAiCoachInput } from "./ai-coach-prompt.js";
import { AiCoachProvider } from "./ai-coach-provider.js";

export const GEMINI_ATTEMPT_TIMEOUT_MS = 7_000;
export const GEMINI_MAX_ATTEMPTS = 2;
export const GEMINI_RETRY_DELAY_MS = 500;
export const GEMINI_MAX_OUTPUT_TOKENS = 512;
export const GEMINI_TEMPERATURE = 0.2;

export type GeminiFailureCategory =
  | "timeout"
  | "rate_limited"
  | "provider_unavailable"
  | "authentication"
  | "invalid_provider_output"
  | "unknown";

export type GeminiUsage = { inputTokens?: number; outputTokens?: number };
export type GeminiInteractionResult = { outputText?: string; usage?: GeminiUsage };

export type GeminiInteractionRequest = {
  model: string;
  input: string;
  system_instruction: string;
  store: false;
  response_format: {
    type: "text";
    mime_type: "application/json";
    schema: Record<string, unknown>;
  };
  generation_config: { temperature: number; max_output_tokens: number };
};

export interface GeminiInteractionsClient {
  create(request: GeminiInteractionRequest, signal: AbortSignal): Promise<GeminiInteractionResult>;
}

export type GeminiHttpOptions = {
  timeout: number;
  retryOptions: { attempts: number; httpStatusCodes: number[] };
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
};

export type GeminiSdkFactory = (apiKey: string, httpOptions: GeminiHttpOptions) => GeminiInteractionsClient;

export const GEMINI_SDK_HTTP_OPTIONS: GeminiHttpOptions = {
  timeout: GEMINI_ATTEMPT_TIMEOUT_MS,
  // The adapter below owns retries. Never combine them with the SDK's default five attempts.
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

export function buildGeminiInteractionRequest(request: AiCoachRequest, model: string): GeminiInteractionRequest {
  return {
    model,
    input: serializeAiCoachInput(request),
    system_instruction: AI_COACH_SYSTEM_INSTRUCTION,
    store: false,
    response_format: { type: "text", mime_type: "application/json", schema: responseSchema },
    generation_config: { temperature: GEMINI_TEMPERATURE, max_output_tokens: GEMINI_MAX_OUTPUT_TOKENS },
  };
}

export function createGeminiSdkFactory(): GeminiSdkFactory {
  return (apiKey, httpOptions) => {
    // This project emits CommonJS while the SDK publishes both module formats.
    // Requiring its declared CommonJS export avoids changing the backend module system.
    const sdkModule = require("@google/genai") as { GoogleGenAI: typeof GoogleGenAIClient };
    const sdk = new sdkModule.GoogleGenAI({ apiKey, httpOptions });
    return {
      create: async (request, signal) => {
        const result = await sdk.interactions.create(request, { signal });
        return {
          outputText: result.output_text,
          usage: {
            inputTokens: result.usage?.total_input_tokens,
            outputTokens: result.usage?.total_output_tokens,
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
  if (!isRecord(error) || !isRecord(error.cause)) return undefined;
  return typeof error.cause.code === "string" ? error.cause.code : undefined;
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
  if (getNetworkCode(error) && NETWORK_ERROR_CODES.has(getNetworkCode(error)!)) {
    return new GeminiProviderFailure("provider_unavailable", true);
  }
  return new GeminiProviderFailure("unknown", false);
}

type ProviderOptions = {
  apiKey?: string;
  model?: string;
  client?: GeminiInteractionsClient;
  sdkFactory?: GeminiSdkFactory;
  timeoutMs?: number;
  retryDelayMs?: number;
  maxAttempts?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  logger?: (record: GeminiUsageRecord) => void;
};

export class GeminiAiCoachProvider implements AiCoachProvider {
  private readonly client: GeminiInteractionsClient;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly maxAttempts: number;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly logger: (record: GeminiUsageRecord) => void;

  constructor(options: ProviderOptions) {
    this.model = options.model ?? GEMINI_MODEL_ID;
    this.timeoutMs = options.timeoutMs ?? GEMINI_ATTEMPT_TIMEOUT_MS;
    this.retryDelayMs = options.retryDelayMs ?? GEMINI_RETRY_DELAY_MS;
    this.maxAttempts = options.maxAttempts ?? GEMINI_MAX_ATTEMPTS;
    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts !== GEMINI_MAX_ATTEMPTS) {
      throw new Error("Gemini Coach supports exactly two maximum attempts.");
    }
    this.now = options.now ?? Date.now;
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
    const startedAt = this.now();
    const geminiRequest = buildGeminiInteractionRequest(request, this.model);
    let attempts = 0;

    while (attempts < this.maxAttempts) {
      attempts += 1;
      try {
        const result = await this.callWithTimeout(geminiRequest);
        let parsed: unknown;
        try {
          if (typeof result.outputText !== "string") throw new Error("Missing structured output.");
          parsed = JSON.parse(result.outputText) as unknown;
        } catch {
          throw new GeminiProviderFailure("invalid_provider_output", false);
        }
        if (!validateAiCoachAdvice(parsed)) throw new GeminiProviderFailure("invalid_provider_output", false);

        this.log({
          operation: "ai.coach",
          provider: "gemini",
          model: this.model,
          timestamp: new Date(this.now()).toISOString(),
          latencyMs: Math.max(0, this.now() - startedAt),
          success: true,
          attempts,
          ...(result.usage?.inputTokens === undefined ? {} : { inputTokens: result.usage.inputTokens }),
          ...(result.usage?.outputTokens === undefined ? {} : { outputTokens: result.usage.outputTokens }),
        });
        return parsed;
      } catch (error) {
        const failure = classifyFailure(error);
        if (failure.retryable && attempts < this.maxAttempts) {
          await this.sleep(this.retryDelayMs);
          continue;
        }
        this.log({
          operation: "ai.coach",
          provider: "gemini",
          model: this.model,
          timestamp: new Date(this.now()).toISOString(),
          latencyMs: Math.max(0, this.now() - startedAt),
          success: false,
          attempts,
          failureCategory: failure.category,
        });
        throw failure;
      }
    }
    throw new GeminiProviderFailure("unknown", false);
  }

  private async callWithTimeout(request: GeminiInteractionRequest): Promise<GeminiInteractionResult> {
    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        reject(new GeminiProviderFailure("timeout", true));
      }, this.timeoutMs);
    });
    const call = Promise.resolve().then(() => this.client.create(request, controller.signal));
    try {
      return await Promise.race([call, timeout]);
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    }
  }

  private log(record: GeminiUsageRecord): void {
    try {
      this.logger(record);
    } catch {
      // Diagnostics must never change the provider result or expose an SDK error.
    }
  }
}
