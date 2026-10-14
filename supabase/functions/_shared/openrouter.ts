/// <reference path="../deno-globals.d.ts" />

export type OpenRouterFailureStage = "provider_request" | "provider_response";

export type PromptMessage = {
  role: "system" | "user";
  content: string;
};

type OpenRouterChoice = {
  finish_reason?: string | null;
  native_finish_reason?: string | null;
  message?: {
    content?: string | Array<{ type?: string; text?: string }>;
  };
};

type OpenRouterResponse = {
  model?: string;
  choices?: OpenRouterChoice[];
  error?: {
    code?: string | number;
    message?: string;
  };
  usage?: {
    completion_tokens?: number;
    completion_tokens_details?: {
      reasoning_tokens?: number;
    };
  };
};

type RequestOpenRouterParams = {
  apiKey: string;
  models: string[];
  messages: PromptMessage[];
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
};

export class OpenRouterError extends Error {
  stage: OpenRouterFailureStage;
  retryableContent: boolean;
  model: string | null;
  finishReason: string | null;
  completionTokens: number | null;
  reasoningTokens: number | null;
  providerStatus: number | null;
  providerErrorCode: string | null;

  constructor(
    stage: OpenRouterFailureStage,
    message: string,
    metadata: {
      model?: string | null;
      finishReason?: string | null;
      completionTokens?: number | null;
      reasoningTokens?: number | null;
      providerStatus?: number | null;
      providerErrorCode?: string | number | null;
      retryableContent?: boolean;
    } = {},
  ) {
    super(message);
    this.stage = stage;
    this.retryableContent = metadata.retryableContent ?? false;
    this.model = metadata.model ?? null;
    this.finishReason = metadata.finishReason === "stop" ||
        metadata.finishReason === "length" ||
        metadata.finishReason === "content_filter"
      ? metadata.finishReason
      : null;
    this.completionTokens = metadata.completionTokens ?? null;
    this.reasoningTokens = metadata.reasoningTokens ?? null;
    this.providerStatus = metadata.providerStatus ?? null;
    const providerCode = String(metadata.providerErrorCode ?? "");
    this.providerErrorCode = /^[a-zA-Z0-9_]{1,40}$/.test(providerCode)
      ? providerCode
      : null;
  }
}

export const getOpenRouterErrorLogMetadata = (error: unknown) => ({
  providerModel: error instanceof OpenRouterError ? error.model : null,
  finishReason: error instanceof OpenRouterError ? error.finishReason : null,
  completionTokens:
    error instanceof OpenRouterError ? error.completionTokens : null,
  reasoningTokens:
    error instanceof OpenRouterError ? error.reasoningTokens : null,
  providerStatus:
    error instanceof OpenRouterError ? error.providerStatus : null,
  providerErrorCode:
    error instanceof OpenRouterError ? error.providerErrorCode : null,
});

export const getFailedOpenRouterModel = (
  error: unknown,
  remainingModels: string[],
): string => {
  if (error instanceof OpenRouterError && error.model) {
    return error.model;
  }

  return remainingModels[0];
};

export const OPENROUTER_PROVIDER = "openrouter";
export const DEFAULT_PRIMARY_MODEL = "openai/gpt-oss-20b:free";
export const DEFAULT_FALLBACK_MODEL =
  "qwen/qwen3-next-80b-a3b-instruct:free";
export const DEFAULT_TERTIARY_MODEL = "google/gemma-4-26b-a4b-it:free";
export const DEFAULT_READING_MODEL_CHAIN = [
  DEFAULT_FALLBACK_MODEL,
  "nvidia/nemotron-nano-9b-v2:free",
  "google/gemma-4-31b-it:free",
  DEFAULT_TERTIARY_MODEL,
  DEFAULT_PRIMARY_MODEL,
];

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const ALLOWED_OPENROUTER_MODELS = new Set([
  DEFAULT_PRIMARY_MODEL,
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_TERTIARY_MODEL,
  ...DEFAULT_READING_MODEL_CHAIN,
]);

export const getOpenRouterModelChain = (...values: string[]): string[] => {
  const models = Array.from(
    new Set(values.map((item) => item.trim()).filter(Boolean)),
  );

  const unsupportedModels = models.filter(
    (model) => !ALLOWED_OPENROUTER_MODELS.has(model),
  );

  if (unsupportedModels.length > 0) {
    throw new Error(`Unsupported OpenRouter model: ${unsupportedModels[0]}`);
  }

  if (models.length === 0) {
    throw new Error("OpenRouter model chain is empty.");
  }

  return models;
};

export const excludeModel = (
  models: string[],
  modelToExclude: string,
): string[] => {
  const filtered = models.filter((model) => model !== modelToExclude);
  return filtered.length === models.length ? models.slice(1) : filtered;
};

const extractOpenRouterContent = (
  payload: OpenRouterResponse,
): string | null => {
  const choice = payload.choices?.[0];
  const content = choice?.message?.content;
  if (!content) return null;

  if (typeof content === "string") {
    return content;
  }

  const joined = content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();

  return joined || null;
};

export const requestOpenRouter = async ({
  apiKey,
  models,
  messages,
  maxTokens,
  temperature,
  timeoutMs,
}: RequestOpenRouterParams): Promise<{ content: string; usedModel: string }> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(OPENROUTER_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          models,
          temperature,
          max_tokens: maxTokens,
          reasoning: { effort: "low", exclude: true },
          response_format: { type: "json_object" },
          messages,
        }),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "AbortError" ||
          error.message.includes("signal has been aborted"))
      ) {
        throw new OpenRouterError(
          "provider_request",
          "AI-модели не ответили вовремя. Попробуй еще раз чуть позже.",
        );
      }

      throw new OpenRouterError(
        "provider_request",
        "Не удалось связаться с AI-сервисом. Попробуй еще раз позже.",
      );
    }

    let payload: OpenRouterResponse;
    try {
      payload = (await response.json()) as OpenRouterResponse;
    } catch {
      throw new OpenRouterError(
        "provider_response",
        `OpenRouter returned invalid JSON with status ${response.status}.`,
        { providerStatus: response.status },
      );
    }
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      throw new OpenRouterError(
        "provider_response",
        "OpenRouter returned an invalid response object.",
        { providerStatus: response.status },
      );
    }

    if (!response.ok) {
      throw new OpenRouterError("provider_response", "AI-сервис временно недоступен. Попробуй еще раз позже.", {
        providerStatus: response.status,
        providerErrorCode: payload.error?.code ?? null,
      });
    }
    if (payload.error) {
      throw new OpenRouterError(
        "provider_response",
        "AI-сервис временно недоступен. Попробуй еще раз позже.",
        {
          providerStatus: response.status,
          providerErrorCode: payload.error.code ?? null,
        },
      );
    }

    const usedModel = payload.model?.trim() || models[0];
    if (!ALLOWED_OPENROUTER_MODELS.has(usedModel)) {
      throw new OpenRouterError(
        "provider_response",
        "OpenRouter returned an unsupported model.",
        { model: null },
      );
    }

    const choice = payload.choices?.[0];
    const responseMetadata = {
      model: usedModel,
      finishReason:
        choice?.finish_reason ?? choice?.native_finish_reason ?? null,
      completionTokens: payload.usage?.completion_tokens ?? null,
      reasoningTokens:
        payload.usage?.completion_tokens_details?.reasoning_tokens ?? null,
    };
    const content = extractOpenRouterContent(payload);
    if (!content) {
      throw new OpenRouterError(
        "provider_response",
        "OpenRouter returned empty content.",
        { ...responseMetadata, retryableContent: true },
      );
    }

    return {
      content,
      usedModel,
    };
  } finally {
    clearTimeout(timeoutId);
  }
};
