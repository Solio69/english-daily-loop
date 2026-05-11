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
import {
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_PRIMARY_MODEL,
  DEFAULT_TERTIARY_MODEL,
  generateVocabularyCardsBatch,
  getOpenRouterModelChain,
  type VocabularyCardBatchItem,
} from "./ai-pipeline.ts";

type PendingWordRow = {
  id: string;
  word: string;
};

const BATCH_SIZE = 5;
const CARD_ERROR_MESSAGE =
  "Не удалось подготовить карточки. Попробуй еще раз позже.";

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

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) {
    return corsResponse;
  }

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
    if (words.length === 0) {
      return successResponse(200, {
        preparedCount: 0,
        failedCount: 0,
        remainingPendingCount: 0,
        needsApprovalCount: 0,
      });
    }

    let cardsById = new Map<string, VocabularyCardBatchItem>();
    try {
      const generated = await generateVocabularyCardsBatch({
        apiKey: env.OPENROUTER_API_KEY,
        models,
        words,
        level: englishLevel,
      });
      cardsById = new Map(generated.cards.map((card) => [card.id, card]));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown vocabulary card error.";
      console.error("[prepare-vocabulary-cards] batch generation failed", {
        appUserId: appUser.id,
        wordIds: words.map((word) => word.id),
        error: message,
      });
      fail(502, "VOCABULARY_CARDS_GENERATION_FAILED", CARD_ERROR_MESSAGE);
    }

    let preparedCount = 0;
    let failedCount = 0;

    for (const word of words) {
      const card = cardsById.get(word.id);
      if (!card) {
        failedCount += 1;
        continue;
      }

      const { error: updateError } = await supabase
        .from("user_vocabulary_words")
        .update({
          word: card.word,
          translation: card.translation,
          part_of_speech: card.partOfSpeech,
          is_verb: card.isVerb,
          is_regular_verb: card.isRegularVerb,
          verb_forms: card.verbForms,
          examples: card.examples,
          card_status: "needs_approval",
        })
        .eq("id", word.id)
        .eq("user_id", appUser.id)
        .eq("card_status", "pending");

      if (updateError) {
        failedCount += 1;
        console.error("[prepare-vocabulary-cards] failed to save card", {
          appUserId: appUser.id,
          wordId: word.id,
          error: updateError.message,
        });
        continue;
      }

      preparedCount += 1;
    }

    const remainingPendingCount = await getRemainingPendingCount(
      supabase,
      appUser.id,
    );
    const { count: needsApprovalCount, error: approvalCountError } = await supabase
      .from("user_vocabulary_words")
      .select("id", { count: "exact", head: true })
      .eq("user_id", appUser.id)
      .eq("card_status", "needs_approval");

    if (approvalCountError) {
      console.error("[prepare-vocabulary-cards] failed to count approval words", {
        appUserId: appUser.id,
        error: approvalCountError.message,
      });
      fail(500, "VOCABULARY_COUNT_FAILED", "Failed to count approval words.");
    }

    return successResponse(200, {
      preparedCount,
      failedCount,
      remainingPendingCount,
      needsApprovalCount: needsApprovalCount ?? 0,
    });
  } catch (error) {
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
