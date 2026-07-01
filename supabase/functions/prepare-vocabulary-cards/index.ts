// @ts-nocheck
import {
  AppError,
  DEFAULT_INTERNAL_ERROR_MESSAGE,
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
  createServiceClient,
  getAppUserByTelegramId,
  getUserEnglishLevel,
  type ServiceClient,
} from "../_shared/app.ts";
import { getMoscowDate } from "../_shared/moscow-date.ts";
import {
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_PRIMARY_MODEL,
  DEFAULT_TERTIARY_MODEL,
  VOCABULARY_CARD_PROMPT_VERSION,
  generateVocabularyCardsBatch,
  getOpenRouterModelChain,
  type VocabularyCardBatchItem,
} from "./ai-pipeline.ts";
import { saveGeneratedCard } from "./card-persistence.ts";
import {
  claimVocabularyCardGenerationAttempt,
  getDailyVocabularyCardGenerationLimit,
  getVocabularyCardGenerationState,
  markVocabularyCardAttemptFailed,
  markVocabularyCardAttemptSucceeded,
  updateVocabularyCardAttemptMetadata,
  type VocabularyCardAttemptCounts,
  type VocabularyCardGenerationState,
} from "../_shared/vocabulary-card-generation.ts";

type PendingWordRow = {
  id: string;
  word: string;
};

const BATCH_SIZE = 5;
const LOG_PREFIX = "[prepare-vocabulary-cards]";

const getRemainingPendingCount = async (
  supabase: ServiceClient,
  userId: string,
): Promise<number> => {
  const { count, error } = await supabase
    .from("user_vocabulary_words")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("card_status", "pending");

  if (error) {
    console.error("[prepare-vocabulary-cards] failed to count remaining words", {
      appUserId: userId,
      error: error.message,
    });
    fail(500, "VOCABULARY_COUNT_FAILED", "Failed to count pending words.");
  }

  return count ?? 0;
};

const getNeedsApprovalCount = async (
  supabase: ServiceClient,
  userId: string,
): Promise<number> => {
  const { count, error } = await supabase
    .from("user_vocabulary_words")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("card_status", "needs_approval");

  if (error) {
    console.error("[prepare-vocabulary-cards] failed to count approval words", {
      appUserId: userId,
      error: error.message,
    });
    fail(500, "VOCABULARY_COUNT_FAILED", "Failed to count approval words.");
  }

  return count ?? 0;
};

const buildPrepareResult = ({
  counts,
  remainingPendingCount,
  needsApprovalCount,
  generationState,
}: {
  counts: Omit<VocabularyCardAttemptCounts, "requestedCount">;
  remainingPendingCount: number;
  needsApprovalCount: number;
  generationState: VocabularyCardGenerationState;
}) => ({
  preparedCount: counts.preparedCount,
  failedCount: counts.failedCount,
  mergedCount: counts.mergedCount,
  reactivatedCount: counts.reactivatedCount,
  remainingPendingCount,
  needsApprovalCount,
  dailyLimit: generationState.dailyLimit,
  usedAttempts: generationState.usedAttempts,
  remainingAttempts: generationState.remainingAttempts,
});

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) {
    return corsResponse;
  }

  const requestStartedAt = Date.now();
  let startedAttempt:
    | { supabase: ServiceClient; attemptId: string; userId: string }
    | null = null;
  let attemptStats: VocabularyCardAttemptCounts | null = null;

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
      console.error("[prepare-vocabulary-cards] invalid model configuration", {
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
    const appUser = await getAppUserByTelegramId(
      supabase,
      tgUser.id,
      "[prepare-vocabulary-cards]",
    );
    const englishLevel = await getUserEnglishLevel(
      supabase,
      appUser.id,
      "[prepare-vocabulary-cards]",
    );

    const { data: pendingRows, error: pendingError } = await supabase
      .from("user_vocabulary_words")
      .select("id, word")
      .eq("user_id", appUser.id)
      .eq("card_status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (pendingError) {
      console.error("[prepare-vocabulary-cards] failed to load pending words", {
        appUserId: appUser.id,
        error: pendingError.message,
      });
      fail(500, "PENDING_WORDS_LOAD_FAILED", "Failed to load pending words.");
    }

    const words = (pendingRows ?? []) as PendingWordRow[];
    const today = getMoscowDate();
    const dailyLimit = await getDailyVocabularyCardGenerationLimit(
      supabase,
      appUser.id,
      LOG_PREFIX,
    );

    if (words.length === 0) {
      const generationState = await getVocabularyCardGenerationState(
        supabase,
        appUser.id,
        today,
        LOG_PREFIX,
      );

      return successResponse(200, buildPrepareResult({
        counts: {
          preparedCount: 0,
          failedCount: 0,
          mergedCount: 0,
          reactivatedCount: 0,
        },
        remainingPendingCount: 0,
        needsApprovalCount: 0,
        generationState,
      }));
    }

    const claimedAttempt = await claimVocabularyCardGenerationAttempt(
      supabase,
      appUser.id,
      today,
      dailyLimit,
      words.length,
      LOG_PREFIX,
    );
    const generationState: VocabularyCardGenerationState = {
      dailyLimit,
      usedAttempts: claimedAttempt.usedAttempts,
      remainingAttempts: claimedAttempt.remainingAttempts,
    };
    startedAttempt = {
      supabase,
      attemptId: claimedAttempt.attemptId,
      userId: appUser.id,
    };
    attemptStats = {
      requestedCount: words.length,
      preparedCount: 0,
      failedCount: words.length,
      mergedCount: 0,
      reactivatedCount: 0,
    };

    await updateVocabularyCardAttemptMetadata({
      supabase,
      attemptId: startedAttempt.attemptId,
      userId: appUser.id,
      promptVersion: VOCABULARY_CARD_PROMPT_VERSION,
      modelChain: models,
      logPrefix: LOG_PREFIX,
    });

    let cardsById = new Map<string, VocabularyCardBatchItem>();
    let usedModel: string | null = null;
    try {
      const generated = await generateVocabularyCardsBatch({
        apiKey: env.OPENROUTER_API_KEY,
        models,
        words,
        level: englishLevel,
      });
      cardsById = new Map(generated.cards.map((card) => [card.id, card]));
      usedModel = generated.usedModel;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown vocabulary card error.";
      console.error("[prepare-vocabulary-cards] batch generation failed", {
        appUserId: appUser.id,
        wordIds: words.map((word) => word.id),
        error: message,
      });

      const failedCount = words.length;
      attemptStats.failedCount = failedCount;

      await markVocabularyCardAttemptFailed({
        supabase,
        attemptId: startedAttempt.attemptId,
        userId: appUser.id,
        promptVersion: VOCABULARY_CARD_PROMPT_VERSION,
        modelChain: models,
        counts: attemptStats,
        durationMs: Date.now() - requestStartedAt,
        errorCode: "VOCABULARY_CARDS_GENERATION_FAILED",
        errorMessage: message,
        logPrefix: LOG_PREFIX,
      });

      const remainingPendingCount = await getRemainingPendingCount(
        supabase,
        appUser.id,
      );
      const needsApprovalCount = await getNeedsApprovalCount(supabase, appUser.id);

      return successResponse(200, buildPrepareResult({
        counts: {
          preparedCount: 0,
          failedCount,
          mergedCount: 0,
          reactivatedCount: 0,
        },
        remainingPendingCount,
        needsApprovalCount,
        generationState,
      }));
    }

    let preparedCount = 0;
    let failedCount = 0;
    let mergedCount = 0;
    let reactivatedCount = 0;

    for (const word of words) {
      const card = cardsById.get(word.id);
      if (!card) {
        failedCount += 1;
        continue;
      }

      const saveResult = await saveGeneratedCard(
        supabase,
        appUser.id,
        word.id,
        card,
      );

      if (!saveResult.prepared) {
        failedCount += 1;
        continue;
      }

      preparedCount += 1;
      if (saveResult.merged) mergedCount += 1;
      if (saveResult.reactivated) reactivatedCount += 1;
    }

    attemptStats.preparedCount = preparedCount;
    attemptStats.failedCount = failedCount;
    attemptStats.mergedCount = mergedCount;
    attemptStats.reactivatedCount = reactivatedCount;

    const remainingPendingCount = await getRemainingPendingCount(
      supabase,
      appUser.id,
    );
    const needsApprovalCount = await getNeedsApprovalCount(supabase, appUser.id);

    await markVocabularyCardAttemptSucceeded({
      supabase,
      attemptId: startedAttempt.attemptId,
      userId: appUser.id,
      model: usedModel,
      promptVersion: VOCABULARY_CARD_PROMPT_VERSION,
      modelChain: models,
      counts: attemptStats,
      durationMs: Date.now() - requestStartedAt,
      logPrefix: LOG_PREFIX,
    });

    console.info("[prepare-vocabulary-cards] batch preparation completed", {
      appUserId: appUser.id,
      attemptId: startedAttempt.attemptId,
      requestedCount: words.length,
      generatedValidCount: cardsById.size,
      preparedCount,
      failedCount,
      mergedCount,
      reactivatedCount,
      remainingPendingCount,
      needsApprovalCount,
      dailyLimit,
      usedAttempts: generationState.usedAttempts,
      remainingAttempts: generationState.remainingAttempts,
    });

    return successResponse(200, buildPrepareResult({
      counts: {
        preparedCount,
        failedCount,
        mergedCount,
        reactivatedCount,
      },
      remainingPendingCount,
      needsApprovalCount,
      generationState,
    }));
  } catch (error) {
    if (startedAttempt) {
      const code =
        error instanceof AppError ? error.code : "VOCABULARY_PREPARE_FAILED";
      const message =
        error instanceof Error ? error.message : "Unknown vocabulary prepare error.";
      await markVocabularyCardAttemptFailed({
        supabase: startedAttempt.supabase,
        attemptId: startedAttempt.attemptId,
        userId: startedAttempt.userId,
        promptVersion: VOCABULARY_CARD_PROMPT_VERSION,
        counts: attemptStats ?? undefined,
        durationMs: Date.now() - requestStartedAt,
        errorCode: code,
        errorMessage: message,
        logPrefix: LOG_PREFIX,
      });
    }

    if (error instanceof AppError) {
      console.error("[prepare-vocabulary-cards] request failed", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return errorResponse(error.status, error.code, error.message);
    }

    const message =
      error instanceof Error ? error.message : "Unknown vocabulary prepare error.";
    console.error("[prepare-vocabulary-cards] failed", { message });
    return errorResponse(
      500,
      "VOCABULARY_PREPARE_FAILED",
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    );
  }
});
