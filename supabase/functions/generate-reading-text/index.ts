// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import {
  AppError,
  assertPostRequest,
  errorResponse,
  fail,
  getOptionalEnv,
  getRequiredEnv,
  getTelegramUserFromBody,
  handleCorsPreflight,
  parseJsonBody,
  successResponse,
} from "../_shared/server.ts";

type EnglishLevel = "A1" | "A2" | "B1" | "B2";
type ReadingMinutes = 3 | 5 | 10 | 15;
type UserRow = {
  id: string;
  telegram_user_id: number;
};
type UserSettingsRow = {
  english_level: EnglishLevel;
  daily_reading_minutes: number;
};

type UserReadingSettings = {
  appUser: UserRow;
  appUserId: string;
  englishLevel: EnglishLevel;
  dailyReadingMinutes: ReadingMinutes;
};

type ReadingGenerationConfig = {
  wordMin: number;
  wordMax: number;
  validationWordMin: number;
  validationWordMax: number;
  maxTokens: number;
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

type ClaimGenerationAttemptResult =
  | {
      ok: true;
      attemptId: string;
      usedAttempts: number;
      remainingAttempts: number;
    }
  | {
      ok: false;
      code: string;
      message: string;
      usedAttempts: number;
      remainingAttempts: number;
    };

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_PRIMARY_MODEL = "openai/gpt-oss-20b:free";
const DEFAULT_FALLBACK_MODEL = "google/gemma-3-12b-it:free";
const DEFAULT_TERTIARY_MODEL = "qwen/qwen3.6-plus:free";
const MODEL_TIMEOUT_MS = 45_000;
const AI_ERROR_MESSAGE =
  "Не удалось сгенерировать текст. Попробуй еще раз позже.";
const FREE_DAILY_GENERATION_LIMIT = 3;
const PAID_DAILY_GENERATION_LIMIT = 10;
const MOSCOW_TIME_ZONE = "Europe/Moscow";
const READING_CONFIG_BY_MINUTES: Record<
  ReadingMinutes,
  Omit<ReadingGenerationConfig, "validationWordMin" | "validationWordMax">
> = {
  3: { wordMin: 120, wordMax: 180, maxTokens: 450 },
  5: { wordMin: 220, wordMax: 320, maxTokens: 750 },
  10: { wordMin: 450, wordMax: 650, maxTokens: 1300 },
  15: { wordMin: 700, wordMax: 950, maxTokens: 1900 },
};

const parseEnglishLevel = (value: unknown): EnglishLevel => {
  if (value === "A1" || value === "A2" || value === "B1" || value === "B2") {
    return value;
  }
  fail(
    500,
    "INVALID_ENGLISH_LEVEL",
    "User english level has an unsupported value.",
  );
};

const parseReadingMinutes = (value: unknown): ReadingMinutes => {
  if (value === 3 || value === 5 || value === 10 || value === 15) {
    return value;
  }
  fail(
    500,
    "INVALID_READING_MINUTES",
    "User reading minutes has an unsupported value.",
  );
};

const getReadingGenerationConfig = (
  readingMinutes: ReadingMinutes,
): ReadingGenerationConfig => {
  const config = READING_CONFIG_BY_MINUTES[readingMinutes];
  return {
    ...config,
    validationWordMin: Math.floor(config.wordMin * 0.8),
    validationWordMax: Math.ceil(config.wordMax * 1.2),
  };
};

const normalizeModelList = (...values: string[]): string[] =>
  Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));

const excludeModel = (models: string[], modelToExclude: string): string[] => {
  const filtered = models.filter((model) => model !== modelToExclude);
  return filtered.length === models.length ? models.slice(1) : filtered;
};

const getMoscowDate = (): string => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: MOSCOW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
};

const getDailyGenerationLimit = async (
  supabase: ReturnType<typeof createClient>,
  user: UserRow,
): Promise<number> => {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso)
    .limit(1);

  if (error) {
    console.error("[generate-reading-text] failed to load subscription", {
      appUserId: user.id,
      error: error.message,
    });
    fail(500, "SUBSCRIPTION_LOAD_FAILED", "Failed to load subscription.");
  }

  return (data ?? []).length > 0
    ? PAID_DAILY_GENERATION_LIMIT
    : FREE_DAILY_GENERATION_LIMIT;
};

const claimGenerationAttempt = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  attemptDate: string,
  dailyLimit: number,
): Promise<Extract<ClaimGenerationAttemptResult, { ok: true }>> => {
  const { data, error } = await supabase.rpc(
    "claim_reading_generation_attempt",
    {
      p_user_id: userId,
      p_attempt_date: attemptDate,
      p_daily_limit: dailyLimit,
      p_provider: "openrouter",
    },
  );

  if (error) {
    console.error("[generate-reading-text] failed to claim attempt", {
      appUserId: userId,
      attemptDate,
      error: error.message,
    });
    fail(500, "ATTEMPT_CLAIM_FAILED", "Failed to save generation attempt.");
  }

  const result = data as ClaimGenerationAttemptResult | null;
  if (!result) {
    fail(500, "ATTEMPT_CLAIM_FAILED", "Empty attempt claim result.");
  }

  if (!result.ok) {
    fail(
      result.code === "GENERATION_ATTEMPTS_EXHAUSTED" ? 429 : 500,
      result.code,
      result.message,
    );
  }

  return result;
};

const stripCodeFence = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
};

const getUserReadingSettingsFromDb = async (
  supabase: ReturnType<typeof createClient>,
  telegramUserId: number,
): Promise<UserReadingSettings> => {
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id, telegram_user_id")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();

  if (userError) {
    console.error("[generate-reading-text] failed to load user", {
      telegramUserId,
      error: userError.message,
    });
    fail(500, "USER_FIND_FAILED", "Failed to load user profile.");
  }

  if (!userRow) {
    fail(
      404,
      "USER_NOT_FOUND",
      "User profile was not found. Complete Telegram auth first.",
    );
  }

  const appUser = userRow as UserRow;
  const { data: settingsRow, error: settingsError } = await supabase
    .from("user_settings")
    .select("english_level, daily_reading_minutes")
    .eq("user_id", appUser.id)
    .maybeSingle();

  if (settingsError) {
    console.error("[generate-reading-text] failed to load user settings", {
      appUserId: appUser.id,
      error: settingsError.message,
    });
    fail(500, "SETTINGS_LOAD_FAILED", "Failed to load user settings.");
  }

  if (!settingsRow) {
    fail(409, "SETTINGS_NOT_COMPLETED", "User settings are not completed yet.");
  }

  const settings = settingsRow as UserSettingsRow;
  return {
    appUser,
    appUserId: appUser.id,
    englishLevel: parseEnglishLevel(settings.english_level),
    dailyReadingMinutes: parseReadingMinutes(settings.daily_reading_minutes),
  };
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

const buildPrompt = (
  targetLevel: EnglishLevel,
  readingMinutes: ReadingMinutes,
  config: ReadingGenerationConfig,
): string => `You are an English teacher.
Create one reading text for level ${targetLevel} and a ${readingMinutes}-minute reading session.

Rules:
- output only valid JSON
- no markdown, no code fences
- title must be 3-8 words
- body must be ${config.wordMin}-${config.wordMax} words, simple and natural for level ${targetLevel}
- estimatedMinutes must be exactly ${readingMinutes}
- level must be exactly "${targetLevel}"

JSON schema:
{
  "title": "string",
  "body": "string",
  "estimatedMinutes": ${readingMinutes},
  "level": "${targetLevel}"
}`;

const parseGeneratedJson = (
  raw: string,
  targetLevel: EnglishLevel,
  readingMinutes: ReadingMinutes,
  config: ReadingGenerationConfig,
): { title: string; body: string; estimatedMinutes: number; level: string } => {
  const parsed = JSON.parse(stripCodeFence(raw)) as {
    title?: unknown;
    body?: unknown;
    estimatedMinutes?: unknown;
    level?: unknown;
  };

  if (typeof parsed.title !== "string" || !parsed.title.trim()) {
    throw new Error("Generated JSON has invalid title.");
  }
  if (typeof parsed.body !== "string") {
    throw new Error("Generated JSON has invalid body.");
  }

  const wordCount = parsed.body.trim().split(/\s+/).filter(Boolean).length;
  if (
    wordCount < config.validationWordMin ||
    wordCount > config.validationWordMax
  ) {
    throw new Error(
      `Generated body has ${wordCount} words, expected ${config.validationWordMin}-${config.validationWordMax}.`,
    );
  }

  return {
    title: parsed.title.trim(),
    body: parsed.body.trim(),
    estimatedMinutes: readingMinutes,
    level: targetLevel,
  };
};

const requestOpenRouter = async (
  models: string[],
  prompt: string,
  apiKey: string,
  maxTokens: number,
): Promise<{ content: string; usedModel: string }> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

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
          temperature: 0.7,
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
        }),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "AbortError" ||
          error.message.includes("signal has been aborted"))
      ) {
        throw new Error(
          "AI-модели не ответили вовремя. Попробуй еще раз чуть позже.",
        );
      }

      throw error;
    }

    const payload = (await response.json()) as OpenRouterResponse;
    if (!response.ok) {
      const details =
        payload.error?.message ??
        `OpenRouter request failed with status ${response.status}.`;
      throw new Error(details);
    }

    const content = extractOpenRouterContent(payload);
    if (!content) {
      throw new Error("OpenRouter returned empty content.");
    }

    return {
      content,
      usedModel: payload.model?.trim() || models[0],
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

const generateWithFallback = async (
  models: string[],
  prompt: string,
  apiKey: string,
  targetLevel: EnglishLevel,
  readingMinutes: ReadingMinutes,
  config: ReadingGenerationConfig,
) => {
  let remainingModels = [...models];
  let lastErrorMessage = "Unknown generation error.";

  while (remainingModels.length > 0) {
    let routed: { content: string; usedModel: string };

    try {
      routed = await requestOpenRouter(
        remainingModels,
        prompt,
        apiKey,
        config.maxTokens,
      );
    } catch (error) {
      lastErrorMessage =
        error instanceof Error ? error.message : "Unknown generation error.";
      console.error("[generate-reading-text] model routing failed", {
        models: remainingModels,
        error: lastErrorMessage,
      });
      throw new Error(lastErrorMessage);
    }

    try {
      const generated = parseGeneratedJson(
        routed.content,
        targetLevel,
        readingMinutes,
        config,
      );
      return {
        ...generated,
        usedModel: routed.usedModel,
      };
    } catch (error) {
      lastErrorMessage =
        error instanceof Error ? error.message : "Unknown generation error.";
      console.error("[generate-reading-text] generated content validation failed", {
        usedModel: routed.usedModel,
        candidateModels: remainingModels,
        error: lastErrorMessage,
      });
      remainingModels = excludeModel(remainingModels, routed.usedModel);
    }
  }

  throw new Error(lastErrorMessage);
};

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) {
    return corsResponse;
  }

  let startedAttempt:
    | { supabase: ReturnType<typeof createClient>; attemptId: string }
    | null = null;

  try {
    assertPostRequest(req);

    const env = getRequiredEnv([
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "TELEGRAM_BOT_TOKEN",
      "OPENROUTER_API_KEY",
    ]);
    const primaryModel =
      getOptionalEnv("OPENROUTER_MODEL_PRIMARY") || DEFAULT_PRIMARY_MODEL;
    const fallbackModel =
      getOptionalEnv("OPENROUTER_MODEL_FALLBACK") || DEFAULT_FALLBACK_MODEL;
    const tertiaryModel =
      getOptionalEnv("OPENROUTER_MODEL_TERTIARY") || DEFAULT_TERTIARY_MODEL;

    const body = await parseJsonBody<{ initData?: unknown }>(req);

    const tgUser = await getTelegramUserFromBody(
      body,
      env.TELEGRAM_BOT_TOKEN,
    );
    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false },
      },
    );
    const settings = await getUserReadingSettingsFromDb(supabase, tgUser.id);
    const today = getMoscowDate();
    const dailyLimit = await getDailyGenerationLimit(
      supabase,
      settings.appUser,
    );

    const { data: completionRow, error: completionError } = await supabase
      .from("user_daily_reading_completions")
      .select("id")
      .eq("user_id", settings.appUserId)
      .eq("completed_date", today)
      .maybeSingle();

    if (completionError) {
      console.error("[generate-reading-text] failed to load completion", {
        appUserId: settings.appUserId,
        error: completionError.message,
      });
      fail(500, "COMPLETION_LOAD_FAILED", "Failed to load reading completion.");
    }

    if (completionRow) {
      fail(
        409,
        "DAILY_READING_ALREADY_COMPLETED",
        "Текст на сегодня уже прочитан.",
      );
    }

    const claimedAttempt = await claimGenerationAttempt(
      supabase,
      settings.appUserId,
      today,
      dailyLimit,
    );

    startedAttempt = {
      supabase,
      attemptId: claimedAttempt.attemptId,
    };

    const targetLevel = settings.englishLevel;
    const config = getReadingGenerationConfig(settings.dailyReadingMinutes);
    const prompt = buildPrompt(
      targetLevel,
      settings.dailyReadingMinutes,
      config,
    );
    const models = normalizeModelList(
      primaryModel,
      fallbackModel,
      tertiaryModel,
    );

    console.log("[generate-reading-text] start", {
      telegramUserId: tgUser.id,
      appUserId: settings.appUserId,
      attemptId: startedAttempt.attemptId,
      attemptDate: today,
      usedAttempts: claimedAttempt.usedAttempts,
      remainingAttempts: claimedAttempt.remainingAttempts,
      dailyLimit,
      baseLevel: settings.englishLevel,
      dailyReadingMinutes: settings.dailyReadingMinutes,
      targetLevel,
      targetWords: `${config.wordMin}-${config.wordMax}`,
      validationWords: `${config.validationWordMin}-${config.validationWordMax}`,
      maxTokens: config.maxTokens,
      models,
    });

    const generated = await generateWithFallback(
      models,
      prompt,
      env.OPENROUTER_API_KEY,
      targetLevel,
      settings.dailyReadingMinutes,
      config,
    );

    const fallbackUsed = generated.usedModel !== models[0];
    const { error: activeTextError } = await supabase
      .from("user_active_reading_texts")
      .upsert(
        {
          user_id: settings.appUserId,
          title: generated.title,
          body: generated.body,
          level: generated.level,
          estimated_minutes: generated.estimatedMinutes,
          provider: "openrouter",
          model: generated.usedModel,
          fallback_used: fallbackUsed,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (activeTextError) {
      console.error("[generate-reading-text] failed to save active text", {
        appUserId: settings.appUserId,
        attemptId: startedAttempt.attemptId,
        error: activeTextError.message,
      });
      fail(500, "ACTIVE_TEXT_SAVE_FAILED", "Failed to save generated text.");
    }

    const { error: attemptUpdateError } = await supabase
      .from("reading_generation_attempts")
      .update({
        status: "succeeded",
        provider: "openrouter",
        model: generated.usedModel,
        error_code: null,
        error_message: null,
      })
      .eq("id", startedAttempt.attemptId);

    if (attemptUpdateError) {
      console.error("[generate-reading-text] failed to update attempt", {
        appUserId: settings.appUserId,
        attemptId: startedAttempt.attemptId,
        error: attemptUpdateError.message,
      });
    }

    return successResponse(200, {
      text: {
        id: `active-${settings.appUserId}`,
        title: generated.title,
        body: generated.body,
        level: generated.level,
        estimatedMinutes: generated.estimatedMinutes,
      },
      generation: {
        provider: "openrouter",
        model: generated.usedModel,
        fallbackUsed,
      },
      dailyLimit,
      usedAttempts: claimedAttempt.usedAttempts,
      remainingAttempts: claimedAttempt.remainingAttempts,
    });
  } catch (error) {
    if (startedAttempt) {
      const code =
        error instanceof AppError ? error.code : "TEXT_GENERATION_FAILED";
      const message =
        error instanceof Error ? error.message : "Unknown generation error.";
      const { error: updateError } = await startedAttempt.supabase
        .from("reading_generation_attempts")
        .update({
          status: "failed",
          error_code: code,
          error_message: message,
        })
        .eq("id", startedAttempt.attemptId);

      if (updateError) {
        console.error("[generate-reading-text] failed to mark attempt failed", {
          attemptId: startedAttempt.attemptId,
          error: updateError.message,
        });
      }
    }

    if (error instanceof AppError) {
      console.error("[generate-reading-text] request failed", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return errorResponse(error.status, error.code, error.message);
    }

    const message =
      error instanceof Error ? error.message : "Unknown generation error.";
    console.error("[generate-reading-text] failed", { message });
    return errorResponse(502, "TEXT_GENERATION_FAILED", AI_ERROR_MESSAGE);
  }
});
