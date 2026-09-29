import type { GoogleGenAI as GoogleGenAIClient, HttpOptions } from "@google/genai" with { "resolution-mode": "import" };
import { performance } from "node:perf_hooks";
import { AiCoachRequest, validateAiCoachAdvice, validateAiCoachRequest } from "./ai-coach-contract.js";
import { GEMINI_ALLOWED_MODELS, GEMINI_MODEL_ID } from "./ai-coach-config.js";
import { AI_COACH_SYSTEM_INSTRUCTION, serializeAiCoachInput } from "./ai-coach-prompt.js";
import { AiCoachProvider } from "./ai-coach-provider.js";

export const GEMINI_TOTAL_DEADLINE_MS = 15_000;
export const GEMINI_MAX_PROVIDER_CALLS = 3;
export const GEMINI_MAX_ATTEMPTS = 2;
export const GEMINI_MAX_RETRIES_PER_MODEL = 1;
export const GEMINI_RETRY_DELAY_MS = 300;
export const GEMINI_MAX_BACKOFF_MS = 1_500;
export const GEMINI_MIN_ATTEMPT_BUDGET_MS = 1_000;
export const GEMINI_MAX_OUTPUT_TOKENS = 512;
export const GEMINI_MAX_OUTPUT_BYTES = 8 * 1024;

export type AiFailureClass =
  | "timeout" | "network_error" | "rate_limited" | "provider_unavailable" | "provider_server_error"
  | "bad_request" | "unauthorized" | "forbidden" | "model_not_found" | "empty_provider_output"
  | "invalid_json" | "schema_validation_failed" | "semantic_validation_failed" | "safety_refusal"
  | "aborted" | "not_configured" | "unknown_provider_error";
export type GeminiFailureCategory = "timeout" | "rate_limited" | "provider_unavailable" | "authentication" | "invalid_provider_output" | "unknown";
export type AttemptKind = "initial" | "retry" | "repair" | "fallback";
export type ProviderAttempt = {
  operation: "ai.coach";
  provider: "gemini";
  model: string;
  attemptNumber: number;
  attemptKind: AttemptKind;
  status: "success" | "failure";
  failureClass?: AiFailureClass;
  providerStatus?: number;
  latencyMs: number;
  elapsedMs: number;
  remainingMs: number;
};
export type GeminiUsage = { inputTokens?: number; outputTokens?: number; totalTokens?: number };
export type GeminiGenerateContentResult = { text?: string; usage?: GeminiUsage; safetyRefusal?: boolean };
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
export type GeminiHttpOptions = { timeout: number; retryOptions: { attempts: number; httpStatusCodes: number[] }; fetch?: HttpOptions["fetch"] };
export type GeminiUsageRecord = {
  operation: "ai.coach"; provider: "gemini"; model: string; timestamp: string; latencyMs: number;
  success: boolean; attempts: number; fallbackUsed: boolean; repairUsed: boolean;
  attempt?: ProviderAttempt; failureCategory?: GeminiFailureCategory; failureClass?: AiFailureClass;
  inputTokens?: number; outputTokens?: number; totalTokens?: number;
};
export type GeminiSdkFactory = (apiKey: string, httpOptions: GeminiHttpOptions) => GeminiGenerateContentClient;

export const GEMINI_SDK_HTTP_OPTIONS: GeminiHttpOptions = {
  timeout: GEMINI_TOTAL_DEADLINE_MS,
  retryOptions: { attempts: 1, httpStatusCodes: [] },
};

// This schema mirrors the single backend runtime contract: the provider returns AiCoachAdvice,
// while the HTTP API wraps it in { advice } after validation.
const responseSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    summary: { type: "string", minLength: 1, maxLength: 240 },
    primaryCategory: { type: "string", enum: ["threat_management", "bounce_strategy", "aim_timing", "positioning", "range_management", "general"] },
    primaryAdvice: { type: "string", minLength: 1, maxLength: 500 },
    secondaryAdvice: { type: "string", minLength: 1, maxLength: 300 },
    practiceGoal: { type: "string", minLength: 1, maxLength: 180 },
  },
  required: ["summary", "primaryCategory", "primaryAdvice", "practiceGoal"],
  additionalProperties: false,
};

export function buildGeminiGenerateContentRequest(request: AiCoachRequest, model: string, repair = false): GeminiGenerateContentRequest {
  const repairInstruction = repair
    ? " Your previous generation could not be accepted by the application contract. Correct it and return only the required JSON structure, with no prose outside the structured response. Do not explain the correction."
    : " Return only the required Coach structure. Do not add prose outside the structured response.";
  return {
    model,
    contents: serializeAiCoachInput(request),
    config: { systemInstruction: AI_COACH_SYSTEM_INSTRUCTION + repairInstruction, responseMimeType: "application/json", responseJsonSchema: responseSchema, maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS },
  };
}

export function createGeminiSdkFactory(): GeminiSdkFactory {
  return (apiKey, httpOptions) => {
    const sdkModule = require("@google/genai") as { GoogleGenAI: typeof GoogleGenAIClient };
    const sdk = new sdkModule.GoogleGenAI({ apiKey, httpOptions });
    return {
      generateContent: async (request, signal) => {
        const result = await sdk.models.generateContent({ model: request.model, contents: request.contents, config: { ...request.config, abortSignal: signal } });
        const candidate = result.candidates?.[0];
        const blockReason = result.promptFeedback?.blockReason;
        return {
          text: result.text,
          safetyRefusal: Boolean(blockReason && String(blockReason) !== "BLOCK_REASON_UNSPECIFIED") || candidate?.finishReason === "SAFETY",
          usage: { inputTokens: result.usageMetadata?.promptTokenCount, outputTokens: result.usageMetadata?.candidatesTokenCount, totalTokens: result.usageMetadata?.totalTokenCount },
        };
      },
    };
  };
}

export class GeminiProviderFailure extends Error {
  constructor(readonly failureClass: AiFailureClass, readonly providerStatus?: number, readonly retryAfterMs?: number) {
    super("Gemini Coach request failed.");
    this.name = "GeminiProviderFailure";
  }
  get category(): GeminiFailureCategory {
    if (["empty_provider_output", "invalid_json", "schema_validation_failed", "semantic_validation_failed"].includes(this.failureClass)) return "invalid_provider_output";
    if (this.failureClass === "timeout") return "timeout";
    if (this.failureClass === "rate_limited") return "rate_limited";
    if (["provider_unavailable", "provider_server_error", "network_error"].includes(this.failureClass)) return "provider_unavailable";
    if (["unauthorized", "forbidden"].includes(this.failureClass)) return "authentication";
    return "unknown";
  }
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function getHttpStatus(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  const status = error.status ?? error.statusCode;
  return typeof status === "number" && Number.isInteger(status) ? status : undefined;
}
function getRetryAfter(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  const headers = error.headers;
  const value = isRecord(headers) && typeof headers.get === "function" ? (headers.get as (this: unknown, name: string) => unknown).call(headers, "retry-after") :
    isRecord(headers) ? headers["retry-after"] : undefined;
  if (typeof value !== "string") return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}
function getNetworkCode(error: unknown): string | undefined {
  if (!isRecord(error)) return undefined;
  const cause = error.cause;
  if (isRecord(cause) && typeof cause.code === "string") return cause.code;
  return typeof error.code === "string" ? error.code : undefined;
}
const NETWORK_ERROR_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "EHOSTUNREACH", "ENETUNREACH", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_SOCKET"]);
export function classifyGeminiFailure(error: unknown): GeminiProviderFailure {
  if (error instanceof GeminiProviderFailure) return error;
  if (error instanceof Error && error.name === "AbortError") return new GeminiProviderFailure("aborted");
  const status = getHttpStatus(error);
  if (status === 400) return new GeminiProviderFailure("bad_request", status);
  if (status === 401) return new GeminiProviderFailure("unauthorized", status);
  if (status === 403) return new GeminiProviderFailure("forbidden", status);
  if (status === 404) {
    const message = isRecord(error) && typeof error.message === "string" ? error.message.toLowerCase() : "";
    const code = isRecord(error) && typeof error.code === "string" ? error.code.toLowerCase() : "";
    return /model.{0,30}(not found|does not exist|unsupported)/.test(message) || code === "model_not_found"
      ? new GeminiProviderFailure("model_not_found", status)
      : new GeminiProviderFailure("unknown_provider_error", status);
  }
  if (status === 408) return new GeminiProviderFailure("timeout", status, getRetryAfter(error));
  if (status === 429) return new GeminiProviderFailure("rate_limited", status, getRetryAfter(error));
  if (status !== undefined && status >= 500 && status <= 599) return new GeminiProviderFailure(status === 503 ? "provider_unavailable" : "provider_server_error", status, getRetryAfter(error));
  const code = getNetworkCode(error);
  if (code && NETWORK_ERROR_CODES.has(code)) return new GeminiProviderFailure("network_error");
  return new GeminiProviderFailure("unknown_provider_error", status);
}
function isTransient(failure: GeminiProviderFailure): boolean {
  return ["network_error", "rate_limited", "provider_unavailable", "provider_server_error", "timeout"].includes(failure.failureClass);
}
function isOutputFailure(failure: GeminiProviderFailure): boolean {
  return ["empty_provider_output", "invalid_json", "schema_validation_failed", "semantic_validation_failed"].includes(failure.failureClass);
}
function publicFailureCategory(failure: GeminiProviderFailure): GeminiFailureCategory { return failure.category; }

type ProviderOptions = {
  apiKey?: string; model?: string; modelChain?: string[]; client?: GeminiGenerateContentClient; clientFactory?: (model: string) => GeminiGenerateContentClient;
  allowCandidateAsInitialModelForDiagnostic?: boolean;
  sdkFactory?: GeminiSdkFactory; totalDeadlineMs?: number; retryDelayMs?: number; maxProviderCalls?: number;
  now?: () => number; sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>; random?: () => number; minimumAttemptBudgetMs?: number;
  logger?: (record: GeminiUsageRecord) => void;
};

export class GeminiAiCoachProvider implements AiCoachProvider {
  private readonly clients = new Map<string, GeminiGenerateContentClient>();
  private readonly modelChain: string[];
  private readonly totalDeadlineMs: number;
  private readonly retryDelayMs: number;
  private readonly maxProviderCalls: number;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  private readonly random: () => number;
  private readonly minimumAttemptBudgetMs: number;
  private readonly logger: (record: GeminiUsageRecord) => void;
  private readonly clientFactory?: (model: string) => GeminiGenerateContentClient;

  constructor(options: ProviderOptions) {
    this.modelChain = [...(options.modelChain ?? [options.model ?? GEMINI_MODEL_ID])];
    if (this.modelChain.length < 1 || this.modelChain.length > 2 || (!options.allowCandidateAsInitialModelForDiagnostic && this.modelChain[0] !== GEMINI_MODEL_ID)) throw new Error("Gemini Coach model chain must start with the primary model and contain at most one fallback.");
    if (this.modelChain.some((model) => !(GEMINI_ALLOWED_MODELS as readonly string[]).includes(model)) || new Set(this.modelChain).size !== this.modelChain.length) throw new Error("Gemini Coach model chain contains an unapproved model.");
    this.totalDeadlineMs = options.totalDeadlineMs ?? GEMINI_TOTAL_DEADLINE_MS;
    this.retryDelayMs = options.retryDelayMs ?? GEMINI_RETRY_DELAY_MS;
    this.maxProviderCalls = options.maxProviderCalls ?? GEMINI_MAX_PROVIDER_CALLS;
    if (!Number.isFinite(this.totalDeadlineMs) || this.totalDeadlineMs <= 0 || this.maxProviderCalls !== GEMINI_MAX_PROVIDER_CALLS) throw new Error("Gemini Coach requires a valid shared deadline and three-call maximum.");
    this.now = options.now ?? (() => performance.now());
    this.sleep = options.sleep ?? sleepWithAbort;
    this.random = options.random ?? Math.random;
    this.minimumAttemptBudgetMs = options.minimumAttemptBudgetMs ?? GEMINI_MIN_ATTEMPT_BUDGET_MS;
    this.logger = options.logger ?? ((record) => console.info(JSON.stringify(record)));
    this.clientFactory = options.clientFactory;
    if (options.client) this.clients.set(this.modelChain[0], options.client);
    else if (options.apiKey?.trim()) {
      const factory = options.sdkFactory ?? createGeminiSdkFactory();
      for (const model of this.modelChain) this.clients.set(model, factory(options.apiKey, GEMINI_SDK_HTTP_OPTIONS));
    } else if (!this.clientFactory) throw new Error("GEMINI_API_KEY is required to create the Gemini Coach provider.");
  }

  async getAdvice(request: AiCoachRequest, signal?: AbortSignal): Promise<unknown> {
    if (!validateAiCoachRequest(request)) throw new GeminiProviderFailure("bad_request");
    const startedAt = this.now();
    const deadline = startedAt + this.totalDeadlineMs;
    const attempts: ProviderAttempt[] = [];
    let calls = 0, repairUsed = false, fallbackUsed = false;
    let finalFailure: GeminiProviderFailure | undefined;
    let finalModel = this.modelChain[0];
    let currentModelIndex = 0;
    let primaryRetryUsed = false;
    let outputRepairUsed = false;

    while (calls < this.maxProviderCalls) {
      if (signal?.aborted) throw this.finishFailure(startedAt, attempts, finalModel, fallbackUsed, repairUsed, new GeminiProviderFailure("aborted"));
      const remaining = deadline - this.now();
      if (remaining < this.minimumAttemptBudgetMs) break;
      const model = this.modelChain[currentModelIndex];
      if (!model) break;
      finalModel = model;
      const kind: AttemptKind = calls === 0 ? "initial" : outputRepairUsed && !repairUsed ? "repair" : currentModelIndex > 0 && calls === (primaryRetryUsed ? 2 : 1) ? "fallback" : "retry";
      if (kind === "repair") repairUsed = true;
      if (kind === "fallback") fallbackUsed = true;
      calls += 1;
      const attemptStarted = this.now();
      try {
        const result = await this.callWithinDeadline(buildGeminiGenerateContentRequest(request, model, kind === "repair"), deadline, signal, model);
        if (result.safetyRefusal) throw new GeminiProviderFailure("safety_refusal");
        if (typeof result.text !== "string" || result.text.trim().length === 0) throw new GeminiProviderFailure("empty_provider_output");
        if (Buffer.byteLength(result.text, "utf8") > GEMINI_MAX_OUTPUT_BYTES) throw new GeminiProviderFailure("schema_validation_failed");
        let parsed: unknown;
        try { parsed = JSON.parse(result.text) as unknown; } catch { throw new GeminiProviderFailure("invalid_json"); }
        if (!isAdviceShape(parsed)) throw new GeminiProviderFailure("schema_validation_failed");
        if (!validateAiCoachAdvice(parsed)) throw new GeminiProviderFailure("semantic_validation_failed");
        if (this.now() >= deadline) throw new GeminiProviderFailure("timeout");
        this.recordAttempt(attempts, startedAt, model, calls, kind, "success", attemptStarted, undefined, fallbackUsed, repairUsed);
        this.logSummary(startedAt, attempts, model, fallbackUsed, repairUsed, true, undefined, result.usage);
        return parsed;
      } catch (error) {
        const failure = classifyGeminiFailure(error);
        this.recordAttempt(attempts, startedAt, model, calls, kind, "failure", attemptStarted, failure, fallbackUsed, repairUsed);
        finalFailure = failure;
        if (signal?.aborted || failure.failureClass === "aborted") break;

        if (isOutputFailure(failure)) {
          if (!outputRepairUsed && calls < this.maxProviderCalls && deadline - this.now() >= this.minimumAttemptBudgetMs) {
            outputRepairUsed = true;
            continue;
          }
          break;
        }
        // Only actual model availability/transient failures may advance to an explicitly configured fallback.
        if (currentModelIndex === 0 && this.modelChain.length > 1 && failure.failureClass === "model_not_found") {
          if (deadline - this.now() >= this.minimumAttemptBudgetMs && calls < this.maxProviderCalls) { currentModelIndex = 1; continue; }
          break;
        }
        if (currentModelIndex === 0 && this.modelChain.length > 1 && failure.failureClass === "timeout") {
          // A timeout has consumed useful budget. Preserve the remaining budget for fallback instead of replaying primary.
          if (deadline - this.now() >= this.minimumAttemptBudgetMs && calls < this.maxProviderCalls) { currentModelIndex = 1; continue; }
          break;
        }
        if (isTransient(failure) && failure.failureClass !== "timeout" && currentModelIndex === 0 && !primaryRetryUsed && calls < this.maxProviderCalls) {
          const delay = this.computeBackoff(calls - 1, failure.retryAfterMs, deadline - this.now());
          if (delay !== undefined && deadline - this.now() - delay >= this.minimumAttemptBudgetMs) {
            primaryRetryUsed = true;
            try { await this.sleep(delay, signal); } catch { finalFailure = new GeminiProviderFailure("aborted"); break; }
            continue;
          }
        }
        if (currentModelIndex === 0 && this.modelChain.length > 1 && isTransient(failure) && deadline - this.now() >= this.minimumAttemptBudgetMs && calls < this.maxProviderCalls) {
          currentModelIndex = 1;
          continue;
        }
        break;
      }
    }
    throw this.finishFailure(startedAt, attempts, finalModel, fallbackUsed, repairUsed, finalFailure ?? new GeminiProviderFailure("timeout"));
  }

  private client(model: string): GeminiGenerateContentClient {
    const existing = this.clients.get(model);
    if (existing) return existing;
    if (this.clientFactory) { const created = this.clientFactory(model); this.clients.set(model, created); return created; }
    throw new GeminiProviderFailure("not_configured");
  }
  private computeBackoff(retryIndex: number, retryAfterMs: number | undefined, remainingMs: number): number | undefined {
    const exponential = Math.min(GEMINI_MAX_BACKOFF_MS, this.retryDelayMs * (2 ** retryIndex));
    const jitter = Math.floor(this.random() * Math.max(1, Math.min(250, exponential * 0.25)));
    const desired = Math.min(GEMINI_MAX_BACKOFF_MS, Math.max(exponential + jitter, retryAfterMs ?? 0));
    return desired < remainingMs ? desired : undefined;
  }
  private async callWithinDeadline(request: GeminiGenerateContentRequest, deadline: number, parentSignal: AbortSignal | undefined, model: string): Promise<GeminiGenerateContentResult> {
    const remainingMs = deadline - this.now();
    if (remainingMs <= 0) throw new GeminiProviderFailure("timeout");
    const controller = new AbortController();
    let rejectAbort!: (reason: GeminiProviderFailure) => void;
    const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
    const onParentAbort = () => { controller.abort(); rejectAbort(new GeminiProviderFailure("aborted")); };
    if (parentSignal?.aborted) onParentAbort();
    else parentSignal?.addEventListener("abort", onParentAbort, { once: true });
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => { controller.abort(); reject(new GeminiProviderFailure("timeout")); }, remainingMs);
    });
    const call = Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new GeminiProviderFailure("aborted");
      if (this.now() >= deadline) throw new GeminiProviderFailure("timeout");
      return this.client(model).generateContent(request, controller.signal);
    });
    try { return await Promise.race([call, timeout, aborted]); }
    finally { if (timeoutHandle !== undefined) clearTimeout(timeoutHandle); parentSignal?.removeEventListener("abort", onParentAbort); }
  }
  private recordAttempt(attempts: ProviderAttempt[], startedAt: number, model: string, number: number, kind: AttemptKind, status: "success" | "failure", attemptStarted: number, failure?: GeminiProviderFailure, fallbackUsed = false, repairUsed = false): void {
    const elapsedMs = Math.max(0, this.now() - startedAt);
    const record: ProviderAttempt = { operation: "ai.coach", provider: "gemini", model, attemptNumber: number, attemptKind: kind, status, ...(failure ? { failureClass: failure.failureClass, ...(failure.providerStatus === undefined ? {} : { providerStatus: failure.providerStatus }) } : {}), latencyMs: Math.max(0, this.now() - attemptStarted), elapsedMs, remainingMs: Math.max(0, this.totalDeadlineMs - elapsedMs) };
    attempts.push(record);
    this.log({ ...this.baseLog(startedAt, attempts, model, fallbackUsed, repairUsed), success: status === "success", attempt: record, ...(failure ? { failureCategory: publicFailureCategory(failure), failureClass: failure.failureClass } : {}) });
  }
  private baseLog(startedAt: number, attempts: ProviderAttempt[], model: string, fallbackUsed: boolean, repairUsed: boolean) {
    return { operation: "ai.coach" as const, provider: "gemini" as const, model, timestamp: new Date().toISOString(), latencyMs: Math.max(0, this.now() - startedAt), attempts: attempts.length, fallbackUsed, repairUsed };
  }
  private logSummary(startedAt: number, attempts: ProviderAttempt[], model: string, fallbackUsed: boolean, repairUsed: boolean, success: boolean, failure?: GeminiProviderFailure, usage?: GeminiUsage): void {
    this.log({ ...this.baseLog(startedAt, attempts, model, fallbackUsed, repairUsed), success, ...(failure ? { failureCategory: failure.category, failureClass: failure.failureClass } : {}), ...(usage?.inputTokens === undefined ? {} : { inputTokens: usage.inputTokens }), ...(usage?.outputTokens === undefined ? {} : { outputTokens: usage.outputTokens }), ...(usage?.totalTokens === undefined ? {} : { totalTokens: usage.totalTokens }) });
  }
  private finishFailure(startedAt: number, attempts: ProviderAttempt[], model: string, fallbackUsed: boolean, repairUsed: boolean, failure: GeminiProviderFailure): GeminiProviderFailure {
    this.logSummary(startedAt, attempts, model, fallbackUsed, repairUsed, false, failure);
    return failure;
  }
  private log(record: GeminiUsageRecord): void { try { this.logger(record); } catch { /* diagnostics must not change provider behavior */ } }
}

function isAdviceShape(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const keys = ["summary", "primaryCategory", "primaryAdvice", "secondaryAdvice", "practiceGoal"];
  if (Object.keys(value).some((key) => !keys.includes(key))) return false;
  const text = (candidate: unknown, max: number) => typeof candidate === "string" && candidate.trim().length > 0 && candidate.length <= max;
  return text(value.summary, 240) && typeof value.primaryCategory === "string" && ["threat_management", "bounce_strategy", "aim_timing", "positioning", "range_management", "general"].includes(value.primaryCategory)
    && text(value.primaryAdvice, 500) && text(value.practiceGoal, 180) && (!("secondaryAdvice" in value) || text(value.secondaryAdvice, 300));
}
async function sleepWithAbort(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new Error("aborted");
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, milliseconds);
    const onAbort = () => { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); reject(new Error("aborted")); };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
