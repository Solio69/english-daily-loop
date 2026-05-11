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
import {
  AiGenerationError,
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_PRIMARY_MODEL,
  DEFAULT_TERTIARY_MODEL,
  OPENROUTER_PROVIDER,
  READING_TEXT_PROMPT_VERSION,
  generateReadingTextWithOpenRouter,
  getOpenRouterModelChain,
  type AiFailureStage,
  type EnglishLevel,
  type ReadingGenerationConfig,
  type ReadingMinutes,
} from "./ai-pipeline.ts";

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

type AttemptMetadata = {
  promptVersion: string;
  modelChain: string[];
  targetLevel: EnglishLevel;
  readingMinutes: ReadingMinutes;
  targetWordMin: number;
  targetWordMax: number;
  validationWordMin: number;
  validationWordMax: number;
  maxTokens: number;
  fallbackUsed: boolean | null;
  outputWordCount: number | null;
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

const sanitizeAttemptErrorMessage = (message: string): string =>
  message
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);

const getFailureStage = (error: unknown): AiFailureStage => {
  if (error instanceof AiGenerationError) {
    return error.stage;
  }

  if (error instanceof AppError && error.code === "ACTIVE_TEXT_SAVE_FAILED") {
    return "db_save";
  }

  return "unknown";
};

const buildAttemptMetadata = (
  models: string[],
  targetLevel: EnglishLevel,
  readingMinutes: ReadingMinutes,
  config: ReadingGenerationConfig,
): AttemptMetadata => ({
  promptVersion: READING_TEXT_PROMPT_VERSION,
  modelChain: models,
  targetLevel,
  readingMinutes,
  targetWordMin: config.wordMin,
  targetWordMax: config.wordMax,
  validationWordMin: config.validationWordMin,
  validationWordMax: config.validationWordMax,
  maxTokens: config.maxTokens,
  fallbackUsed: null,
  outputWordCount: null,
});

const toAttemptUpdatePayload = (
  metadata: AttemptMetadata,
): Record<string, unknown> => ({
  prompt_version: metadata.promptVersion,
  model_chain: metadata.modelChain,
  target_level: metadata.targetLevel,
  reading_minutes: metadata.readingMinutes,
  target_word_min: metadata.targetWordMin,
  target_word_max: metadata.targetWordMax,
  validation_word_min: metadata.validationWordMin,
  validation_word_max: metadata.validationWordMax,
  max_tokens: metadata.maxTokens,
  fallback_used: metadata.fallbackUsed,
  output_word_count: metadata.outputWordCount,
});

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
      p_provider: OPENROUTER_PROVIDER,
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

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) {
    return corsResponse;
  }

  const requestStartedAt = Date.now();
  let startedAttempt:
    | { supabase: ReturnType<typeof createClient>; attemptId: string }
    | null = null;
  let attemptMetadata: AttemptMetadata | null = null;

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
    let models: string[];
    try {
      models = getOpenRouterModelChain(
        primaryModel,
        fallbackModel,
        tertiaryModel,
      );
    } catch (error) {
      console.error("[generate-reading-text] invalid model configuration", {
        error: error instanceof Error ? error.message : "Unknown model error.",
      });
      fail(
        500,
        "AI_MODEL_CONFIG_INVALID",
        "Server AI model config is not allowed.",
      );
    }

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
    attemptMetadata = buildAttemptMetadata(
      models,
      targetLevel,
      settings.dailyReadingMinutes,
      config,
    );

    console.log("[generate-reading-text] start", {
      telegramUserId: tgUser.id,
      appUserId: settings.appUserId,
      attemptId: startedAttempt.attemptId,
      promptVersion: READING_TEXT_PROMPT_VERSION,
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

    const { error: metadataUpdateError } = await supabase
      .from("reading_generation_attempts")
      .update(toAttemptUpdatePayload(attemptMetadata))
      .eq("id", startedAttempt.attemptId);

    if (metadataUpdateError) {
      console.error("[generate-reading-text] failed to update attempt metadata", {
        appUserId: settings.appUserId,
        attemptId: startedAttempt.attemptId,
        error: metadataUpdateError.message,
      });
    }

    const generated = await generateReadingTextWithOpenRouter({
      apiKey: env.OPENROUTER_API_KEY,
      models,
      targetLevel,
      readingMinutes: settings.dailyReadingMinutes,
      config,
    });

    const fallbackUsed = generated.usedModel !== models[0];
    attemptMetadata.fallbackUsed = fallbackUsed;
    attemptMetadata.outputWordCount = generated.validation.wordCount;
    const readingTextId = crypto.randomUUID();

    const { error: activeTextError } = await supabase
      .from("user_active_reading_texts")
      .upsert(
        {
          user_id: settings.appUserId,
          reading_text_id: readingTextId,
          title: generated.title,
          body: generated.body,
          level: generated.level,
          estimated_minutes: generated.estimatedMinutes,
          provider: OPENROUTER_PROVIDER,
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
        ...toAttemptUpdatePayload(attemptMetadata),
        status: "succeeded",
        provider: OPENROUTER_PROVIDER,
        model: generated.usedModel,
        duration_ms: Date.now() - requestStartedAt,
        failure_stage: null,
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
        id: readingTextId,
        title: generated.title,
        body: generated.body,
        level: generated.level,
        estimatedMinutes: generated.estimatedMinutes,
      },
      generation: {
        provider: OPENROUTER_PROVIDER,
        model: generated.usedModel,
        fallbackUsed,
        promptVersion: generated.promptVersion,
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
      const failureStage = getFailureStage(error);
      const { error: updateError } = await startedAttempt.supabase
        .from("reading_generation_attempts")
        .update({
          ...(attemptMetadata ? toAttemptUpdatePayload(attemptMetadata) : {}),
          status: "failed",
          duration_ms: Date.now() - requestStartedAt,
          failure_stage: failureStage,
          error_code: code,
          error_message: sanitizeAttemptErrorMessage(message),
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
