import { createServiceClient, getAppUserByTelegramId, type ServiceClient } from "../_shared/app.ts";
import {
  AppError,
  HTTP_STATUS,
  assertPostRequest,
  errorResponse,
  fail,
  getOptionalEnv,
  getRequiredEnv,
  getRequestId,
  getTelegramUserFromBody,
  handleCorsPreflight,
  parseJsonBody,
  successResponse,
} from "../_shared/server.ts";
import { getMoscowStudyDate } from "../_shared/moscow-study-date.ts";
import { getDailyReadingGenerationLimit } from "../_shared/access.ts";
import {
  buildSafeAiDiagnostics,
  sanitizeDiagnosticMessage,
} from "../_shared/ai-diagnostics.ts";
import { getConfiguredOpenRouterModelChain } from "../_shared/openrouter.ts";
import {
  AiGenerationError,
  OPENROUTER_PROVIDER,
  READING_TEXT_PROMPT_VERSION,
  generateReadingTextWithOpenRouter,
  type AiFailureStage,
  type EnglishLevel,
  type ReadingGenerationConfig,
  type ReadingMinutes,
} from "./ai-pipeline.ts";

type UserSettingsRow = {
  english_level: EnglishLevel;
  daily_reading_minutes: number;
};

type UserReadingSettings = {
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
      isDuplicate: boolean;
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
const DUPLICATE_RESULT_WAIT_MS = 95_000;
const DUPLICATE_STATUS_POLL_MS = 2_000;
const FINISH_RPC_MAX_ATTEMPTS = 2;
const READING_GENERATION_RPC = {
  CLAIM: "claim_reading_generation_request",
  FINISH: "finish_reading_generation_request",
} as const;
const READING_GENERATION_TABLE = {
  ATTEMPTS: "reading_generation_attempts",
  ACTIVE_TEXTS: "user_active_reading_texts",
} as const;
const READING_GENERATION_COLUMN = {
  ID: "id",
  USER_ID: "user_id",
  READING_TEXT_ID: "reading_text_id",
  STATUS: "status",
} as const;
const ATTEMPT_RESULT_COLUMNS =
  "status, reading_text_id, model, fallback_used, prompt_version";
const ACTIVE_TEXT_RESULT_COLUMNS =
  "reading_text_id, title, body, level, estimated_minutes, last_read_paragraph_index";
const DUPLICATE_RESULT_ERROR = {
  ATTEMPT_LOOKUP: {
    code: "ATTEMPT_LOOKUP_FAILED",
    message: "Failed to load generation attempt.",
  },
  ACTIVE_TEXT_LOOKUP: {
    code: "ACTIVE_TEXT_LOOKUP_FAILED",
    message: "Failed to load generated text.",
  },
  SUPERSEDED: {
    code: "GENERATION_RESULT_SUPERSEDED",
    message: "A newer reading text is active.",
  },
  PROCESSING: {
    code: "GENERATION_STILL_PROCESSING",
    message: "Generation is still processing.",
  },
} as const;
const TEXT_GENERATION_FAILED_CODE = "TEXT_GENERATION_FAILED";
const LOG_FINISH_FAILED = "[generate-reading-text] failed to finish attempt";
const ATTEMPT_STATUS_SUCCEEDED = "succeeded";
const ATTEMPT_STATUS_FAILED = "failed";
const ATTEMPT_STATUS_STARTED = "started";
const READING_CONFIG_BY_MINUTES: Record<
  ReadingMinutes,
  Omit<ReadingGenerationConfig, "validationWordMin" | "validationWordMax">
> = {
  3: { wordMin: 120, wordMax: 180, maxTokens: 700 },
  5: { wordMin: 220, wordMax: 320, maxTokens: 1050 },
  10: { wordMin: 450, wordMax: 650, maxTokens: 1800 },
  15: { wordMin: 700, wordMax: 950, maxTokens: 2600 },
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

const buildReadingAiDiagnostics = ({
  requestId,
  error,
  failureStage,
  attemptMetadata,
  durationMs,
}: {
  requestId: string;
  error: unknown;
  failureStage: AiFailureStage;
  attemptMetadata: AttemptMetadata | null;
  durationMs: number;
}) => buildSafeAiDiagnostics({
  functionName: "generate-reading-text",
  requestId,
  promptVersion: attemptMetadata?.promptVersion ?? READING_TEXT_PROMPT_VERSION,
  modelChain: attemptMetadata?.modelChain ?? null,
  stage: failureStage,
  durationMs,
  metadata:
    error instanceof AiGenerationError
      ? {
          model: error.model,
          finishReason: error.finishReason,
          completionTokens: error.completionTokens,
          reasoningTokens: error.reasoningTokens,
          providerStatus: error.providerStatus,
          providerErrorCode: error.providerErrorCode,
        }
      : null,
  details: {
    targetLevel: attemptMetadata?.targetLevel ?? null,
    readingMinutes: attemptMetadata?.readingMinutes ?? null,
    targetWordMin: attemptMetadata?.targetWordMin ?? null,
    targetWordMax: attemptMetadata?.targetWordMax ?? null,
    validationWordMin: attemptMetadata?.validationWordMin ?? null,
    validationWordMax: attemptMetadata?.validationWordMax ?? null,
    outputWordCount: attemptMetadata?.outputWordCount ?? null,
  },
});

const claimGenerationAttempt = async (
  supabase: ServiceClient,
  userId: string,
  attemptDate: string,
  dailyLimit: number,
  requestId: string,
): Promise<Extract<ClaimGenerationAttemptResult, { ok: true }>> => {
  const { data, error } = await supabase.rpc(
    READING_GENERATION_RPC.CLAIM,
    {
      p_user_id: userId,
      p_attempt_date: attemptDate,
      p_daily_limit: dailyLimit,
      p_request_id: requestId,
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

const waitForExistingGeneration = async ({
  supabase,
  userId,
  attemptId,
  dailyLimit,
  usedAttempts,
  remainingAttempts,
  requestId,
}: {
  supabase: ServiceClient;
  userId: string;
  attemptId: string;
  dailyLimit: number;
  usedAttempts: number;
  remainingAttempts: number;
  requestId: string;
}): Promise<Response> => {
  const deadline = Date.now() + DUPLICATE_RESULT_WAIT_MS;

  while (true) {
    const { data: attempt, error: attemptError } = await supabase
      .from(READING_GENERATION_TABLE.ATTEMPTS)
      .select(ATTEMPT_RESULT_COLUMNS)
      .eq(READING_GENERATION_COLUMN.ID, attemptId)
      .eq(READING_GENERATION_COLUMN.USER_ID, userId)
      .single();

    if (attemptError || !attempt) {
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        DUPLICATE_RESULT_ERROR.ATTEMPT_LOOKUP.code,
        DUPLICATE_RESULT_ERROR.ATTEMPT_LOOKUP.message,
      );
    }

    if (attempt.status === ATTEMPT_STATUS_SUCCEEDED) {
      const { data: activeText, error: activeTextError } = await supabase
        .from(READING_GENERATION_TABLE.ACTIVE_TEXTS)
        .select(ACTIVE_TEXT_RESULT_COLUMNS)
        .eq(READING_GENERATION_COLUMN.USER_ID, userId)
        .eq(READING_GENERATION_COLUMN.READING_TEXT_ID, attempt.reading_text_id)
        .maybeSingle();

      if (activeTextError) {
        fail(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          DUPLICATE_RESULT_ERROR.ACTIVE_TEXT_LOOKUP.code,
          DUPLICATE_RESULT_ERROR.ACTIVE_TEXT_LOOKUP.message,
        );
      }
      if (!activeText) {
        fail(
          HTTP_STATUS.CONFLICT,
          DUPLICATE_RESULT_ERROR.SUPERSEDED.code,
          DUPLICATE_RESULT_ERROR.SUPERSEDED.message,
        );
      }

      return successResponse(
        HTTP_STATUS.OK,
        {
          text: {
            id: activeText.reading_text_id,
            title: activeText.title,
            body: activeText.body,
            level: activeText.level,
            estimatedMinutes: activeText.estimated_minutes,
            lastReadParagraphIndex: activeText.last_read_paragraph_index,
          },
          generation: {
            provider: OPENROUTER_PROVIDER,
            model: attempt.model,
            fallbackUsed: attempt.fallback_used,
            promptVersion: attempt.prompt_version,
          },
          dailyLimit,
          usedAttempts,
          remainingAttempts,
        },
        requestId,
      );
    }

    if (attempt.status === ATTEMPT_STATUS_FAILED) {
      fail(HTTP_STATUS.BAD_GATEWAY, TEXT_GENERATION_FAILED_CODE, AI_ERROR_MESSAGE);
    }
    if (Date.now() >= deadline) {
      fail(
        HTTP_STATUS.GATEWAY_TIMEOUT,
        DUPLICATE_RESULT_ERROR.PROCESSING.code,
        DUPLICATE_RESULT_ERROR.PROCESSING.message,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, DUPLICATE_STATUS_POLL_MS));
  }
};

const getUserReadingSettingsFromDb = async (
  supabase: ServiceClient,
  telegramUserId: number,
  requestId: string,
): Promise<UserReadingSettings> => {
  const appUser = await getAppUserByTelegramId(
    supabase,
    telegramUserId,
    "[generate-reading-text]",
    requestId,
  );
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
  const requestId = getRequestId(req);
  let startedAttempt:
    | { supabase: ServiceClient; attemptId: string }
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
    let models: string[];
    try {
      models = getConfiguredOpenRouterModelChain(getOptionalEnv);
    } catch (error) {
      console.error("[generate-reading-text] invalid model configuration", {
        requestId,
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
    const supabase = createServiceClient(env);
    const settings = await getUserReadingSettingsFromDb(
      supabase,
      tgUser.id,
      requestId,
    );
    const studyDate = getMoscowStudyDate();
    const dailyLimit = await getDailyReadingGenerationLimit(
      supabase,
      settings.appUserId,
      "[generate-reading-text]",
    );

    const claimedAttempt = await claimGenerationAttempt(
      supabase,
      settings.appUserId,
      studyDate,
      dailyLimit,
      requestId,
    );

    if (claimedAttempt.isDuplicate) {
      return await waitForExistingGeneration({
        supabase,
        userId: settings.appUserId,
        attemptId: claimedAttempt.attemptId,
        dailyLimit,
        usedAttempts: claimedAttempt.usedAttempts,
        remainingAttempts: claimedAttempt.remainingAttempts,
        requestId,
      });
    }

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
      requestId,
      appUserId: settings.appUserId,
      attemptId: startedAttempt.attemptId,
      promptVersion: READING_TEXT_PROMPT_VERSION,
      studyDate,
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

    const finishArgs = {
      p_user_id: settings.appUserId,
      p_attempt_id: startedAttempt.attemptId,
      p_reading_text_id: readingTextId,
      p_title: generated.title,
      p_body: generated.body,
      p_level: generated.level,
      p_estimated_minutes: generated.estimatedMinutes,
      p_provider: OPENROUTER_PROVIDER,
      p_model: generated.usedModel,
      p_fallback_used: fallbackUsed,
      p_reading_date: studyDate,
      p_output_word_count: generated.validation.wordCount,
      p_duration_ms: Date.now() - requestStartedAt,
    };
    let finishError = null;
    for (let attempt = 0; attempt < FINISH_RPC_MAX_ATTEMPTS; attempt += 1) {
      const result = await supabase.rpc(READING_GENERATION_RPC.FINISH, finishArgs);
      finishError = result.error;
      if (!finishError) break;
    }

    if (finishError) {
      console.error(LOG_FINISH_FAILED, {
        appUserId: settings.appUserId,
        attemptId: startedAttempt.attemptId,
        error: finishError.message,
      });
      fail(500, "ACTIVE_TEXT_SAVE_FAILED", "Failed to save generated text.");
    }

    return successResponse(
      200,
      {
        text: {
          id: readingTextId,
          title: generated.title,
          body: generated.body,
          level: generated.level,
          estimatedMinutes: generated.estimatedMinutes,
          lastReadParagraphIndex: null,
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
      },
      requestId,
    );
  } catch (error) {
    if (startedAttempt) {
      const code =
        error instanceof AppError ? error.code : TEXT_GENERATION_FAILED_CODE;
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
          error_message: sanitizeDiagnosticMessage(message),
        })
        .eq("id", startedAttempt.attemptId)
        .eq(READING_GENERATION_COLUMN.STATUS, ATTEMPT_STATUS_STARTED);

      if (updateError) {
        console.error("[generate-reading-text] failed to mark attempt failed", {
          requestId,
          attemptId: startedAttempt.attemptId,
          error: updateError.message,
        });
      }
    }

    const failureStage = getFailureStage(error);
    const diagnostics = buildReadingAiDiagnostics({
      requestId,
      error,
      failureStage,
      attemptMetadata,
      durationMs: Date.now() - requestStartedAt,
    });

    if (error instanceof AppError) {
      console.error("[generate-reading-text] request failed", {
        requestId,
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return errorResponse(
        error.status,
        error.code,
        error.message,
        requestId,
        diagnostics,
      );
    }

    const message =
      error instanceof Error ? error.message : "Unknown generation error.";
    console.error("[generate-reading-text] failed", { requestId, message });
    return errorResponse(
      502,
      TEXT_GENERATION_FAILED_CODE,
      AI_ERROR_MESSAGE,
      requestId,
      diagnostics,
    );
  }
});
