/// <reference path="../deno-globals.d.ts" />

export type OpenRouterFailureStage = "provider_request" | "provider_response";

export type PromptMessage = {
  role: "system" | "user";
  content: string;
};

type OpenRouterChoice = {
  message?: {
    content?: string | Array<{ type?: string; text?: string }>;
  };
};

type OpenRouterResponse = {
  model?: string;
  choices?: OpenRouterChoice[];
  error?: {
    message?: string;
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

  constructor(stage: OpenRouterFailureStage, message: string) {
    super(message);
    this.stage = stage;
  }
}

export const OPENROUTER_PROVIDER = "openrouter";
export const DEFAULT_PRIMARY_MODEL = "openai/gpt-oss-20b:free";
export const DEFAULT_FALLBACK_MODEL = "qwen/qwen3.6-plus:free";
export const DEFAULT_TERTIARY_MODEL = "qwen/qwen3.6-plus:free";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const ALLOWED_OPENROUTER_MODELS = new Set([
  DEFAULT_PRIMARY_MODEL,
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_TERTIARY_MODEL,
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

      const message =
        error instanceof Error ? error.message : "Unknown provider request error.";
      throw new OpenRouterError("provider_request", message);
    }

    let payload: OpenRouterResponse;
    try {
      payload = (await response.json()) as OpenRouterResponse;
    } catch {
      throw new OpenRouterError(
        "provider_response",
        `OpenRouter returned invalid JSON with status ${response.status}.`,
      );
    }

    if (!response.ok) {
      const details =
        payload.error?.message ??
        `OpenRouter request failed with status ${response.status}.`;
      throw new OpenRouterError("provider_response", details);
    }

    const content = extractOpenRouterContent(payload);
    if (!content) {
      throw new OpenRouterError(
        "provider_response",
        "OpenRouter returned empty content.",
      );
    }

    const usedModel = payload.model?.trim() || models[0];
    if (!ALLOWED_OPENROUTER_MODELS.has(usedModel)) {
      throw new OpenRouterError(
        "provider_response",
        "OpenRouter returned an unsupported model.",
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
