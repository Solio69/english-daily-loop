import {
  AppError,
  DEFAULT_INTERNAL_ERROR_MESSAGE,
  assertPostRequest,
  errorResponse,
  fail,
  getRequiredEnv,
  getRequestId,
  getTelegramUserFromBody,
  handleCorsPreflight,
  parseJsonBody,
  successResponse,
} from "../_shared/server.ts";
import {
  createServiceClient,
  getAppUserByTelegramId,
  type ServiceClient,
} from "../_shared/app.ts";

type ActiveReadingTextRow = {
  reading_text_id: string;
};

type DeletePendingVocabularyWordResult =
  | {
      ok: true;
      removedWordIndexes: number[];
      removedSourceCount: number;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

const LOG_PREFIX = "[delete-pending-vocabulary-word]";
const ACTIVE_TEXT_UNAVAILABLE_MESSAGE =
  "Текст изменился или уже недоступен. Обнови экран.";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parseReadingTextId = (value: unknown): string => {
  const parsed = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(parsed)) {
    fail(400, "INVALID_READING_TEXT_ID", "readingTextId must be a valid UUID.");
  }

  return parsed;
};

const parseWordIndex = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    fail(400, "INVALID_WORD_INDEX", "wordIndex must be a non-negative integer.");
  }

  return value;
};

const deletePendingVocabularyWord = async (
  supabase: ServiceClient,
  params: {
    userId: string;
    readingTextId: string;
    wordIndex: number;
  },
): Promise<DeletePendingVocabularyWordResult> => {
  const { data, error } = await supabase.rpc(
    "delete_pending_vocabulary_word_with_sources",
    {
      p_user_id: params.userId,
      p_reading_text_id: params.readingTextId,
      p_word_index: params.wordIndex,
    },
  );

  if (error) {
    console.error(`${LOG_PREFIX} RPC failed`, {
      appUserId: params.userId,
      readingTextId: params.readingTextId,
      wordIndex: params.wordIndex,
      error: error.message,
    });
    fail(
      500,
      "VOCABULARY_DELETE_FAILED",
      "Не удалось удалить слово. Попробуй еще раз.",
    );
  }

  const result = data as DeletePendingVocabularyWordResult | null;
  if (!result) {
    fail(
      500,
      "VOCABULARY_DELETE_FAILED",
      "Не удалось удалить слово. Попробуй еще раз.",
    );
  }

  return result;
};

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) {
    return corsResponse;
  }

  const requestId = getRequestId(req);
  const requestStartedAt = Date.now();

  try {
    assertPostRequest(req);

    const env = getRequiredEnv([
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "TELEGRAM_BOT_TOKEN",
    ]);
    const body = await parseJsonBody<{
      initData?: unknown;
      readingTextId?: unknown;
      wordIndex?: unknown;
    }>(req);
    const tgUser = await getTelegramUserFromBody(
      body,
      env.TELEGRAM_BOT_TOKEN,
    );
    const readingTextId = parseReadingTextId(body?.readingTextId);
    const wordIndex = parseWordIndex(body?.wordIndex);
    const supabase = createServiceClient(env);
    const appUser = await getAppUserByTelegramId(
      supabase,
      tgUser.id,
      LOG_PREFIX,
      requestId,
    );

    const { data: activeTextRow, error: activeTextError } = await supabase
      .from("user_active_reading_texts")
      .select("reading_text_id")
      .eq("user_id", appUser.id)
      .maybeSingle();

    if (activeTextError) {
      console.error(`${LOG_PREFIX} failed to load active text`, {
        appUserId: appUser.id,
        error: activeTextError.message,
      });
      fail(500, "ACTIVE_TEXT_LOAD_FAILED", DEFAULT_INTERNAL_ERROR_MESSAGE);
    }

    if (
      !activeTextRow ||
      (activeTextRow as ActiveReadingTextRow).reading_text_id !== readingTextId
    ) {
      fail(409, "ACTIVE_TEXT_CHANGED", ACTIVE_TEXT_UNAVAILABLE_MESSAGE);
    }

    const result = await deletePendingVocabularyWord(supabase, {
      userId: appUser.id,
      readingTextId,
      wordIndex,
    });

    if (!result.ok) {
      if (result.code === "VOCABULARY_CARD_ALREADY_PREPARED") {
        fail(
          409,
          result.code,
          "Карточка уже подготовлена — удалить слово здесь нельзя.",
        );
      }

      if (result.code === "ACTIVE_TEXT_CHANGED") {
        fail(409, result.code, ACTIVE_TEXT_UNAVAILABLE_MESSAGE);
      }

      if (result.code === "VOCABULARY_SOURCE_NOT_FOUND") {
        fail(
          409,
          result.code,
          "Слово уже удалено или состояние текста изменилось. Обнови экран.",
        );
      }

      if (result.code === "INVALID_DELETE_INPUT") {
        fail(400, result.code, "Не удалось определить выбранное слово.");
      }

      fail(
        500,
        result.code,
        "Не удалось удалить слово. Попробуй еще раз.",
      );
    }

    console.info(`${LOG_PREFIX} pending word deleted`, {
      requestId,
      appUserId: appUser.id,
      removedSourceCount: result.removedSourceCount,
      removedCurrentTextIndexCount: result.removedWordIndexes.length,
      durationMs: Date.now() - requestStartedAt,
    });

    return successResponse(
      200,
      {
        removedWordIndexes: result.removedWordIndexes,
        removedSourceCount: result.removedSourceCount,
      },
      requestId,
    );
  } catch (error) {
    if (error instanceof AppError) {
      console.error(`${LOG_PREFIX} request failed`, {
        requestId,
        status: error.status,
        code: error.code,
        message: error.message,
        durationMs: Date.now() - requestStartedAt,
      });
      return errorResponse(
        error.status,
        error.code,
        error.message,
        requestId,
      );
    }

    const message =
      error instanceof Error ? error.message : "Unknown vocabulary delete error.";
    console.error(`${LOG_PREFIX} failed`, {
      requestId,
      message,
      durationMs: Date.now() - requestStartedAt,
    });
    return errorResponse(
      500,
      "VOCABULARY_DELETE_FAILED",
      DEFAULT_INTERNAL_ERROR_MESSAGE,
      requestId,
    );
  }
});
