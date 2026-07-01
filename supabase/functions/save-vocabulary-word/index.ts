// @ts-nocheck
import {
  AppError,
  DEFAULT_INTERNAL_ERROR_MESSAGE,
  assertPostRequest,
  errorResponse,
  fail,
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
  normalizeVocabularyWord,
  type VocabularyCardStatus,
} from "../_shared/vocabulary.ts";

type ActiveReadingTextRow = {
  reading_text_id: string;
  body: string;
};

type SaveVocabularyWordResult =
  | {
      ok: true;
      action: "created" | "reactivated" | "already_exists";
      wordId: string;
      word: string;
      status: "not_started" | "active" | "learned";
      cardStatus: VocabularyCardStatus;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

const FREE_VOCABULARY_WORDS_LIMIT = 30;
const PAID_VOCABULARY_WORDS_LIMIT = 300;
const ACTIVE_TEXT_UNAVAILABLE_MESSAGE =
  "Текст изменился или уже недоступен. Обнови экран.";

const parseString = (
  value: unknown,
  code: string,
  message: string,
): string => {
  const parsed = typeof value === "string" ? value.trim() : "";
  if (!parsed) {
    fail(400, code, message);
  }

  return parsed;
};

const parseWordIndex = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    fail(400, "INVALID_WORD_INDEX", "wordIndex must be a non-negative integer.");
  }

  return parsed;
};

const getVocabularyLimit = async (
  supabase: ServiceClient,
  userId: string,
): Promise<number> => {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso)
    .limit(1);

  if (error) {
    console.error("[save-vocabulary-word] failed to load subscription", {
      appUserId: userId,
      error: error.message,
    });
    fail(500, "SUBSCRIPTION_LOAD_FAILED", "Failed to load subscription.");
  }

  return (data ?? []).length > 0
    ? PAID_VOCABULARY_WORDS_LIMIT
    : FREE_VOCABULARY_WORDS_LIMIT;
};

const savePendingVocabularyWordWithSource = async (
  supabase: ServiceClient,
  params: {
    userId: string;
    word: string;
    readingTextId: string;
    readingDate: string;
    wordIndex: number;
    originalWord: string;
    vocabularyLimit: number;
  },
): Promise<SaveVocabularyWordResult> => {
  const { data, error } = await supabase.rpc(
    "save_pending_vocabulary_word_with_source",
    {
      p_user_id: params.userId,
      p_word: params.word,
      p_reading_text_id: params.readingTextId,
      p_reading_date: params.readingDate,
      p_word_index: params.wordIndex,
      p_original_word: params.originalWord,
      p_vocabulary_limit: params.vocabularyLimit,
    },
  );

  if (error) {
    console.error("[save-vocabulary-word] failed to save vocabulary word", {
      appUserId: params.userId,
      readingTextId: params.readingTextId,
      wordIndex: params.wordIndex,
      error: error.message,
    });
    fail(
      500,
      "VOCABULARY_SAVE_FAILED",
      "Не удалось проверить словарь. Попробуй еще раз.",
    );
  }

  const result = data as SaveVocabularyWordResult | null;
  if (!result) {
    fail(
      500,
      "VOCABULARY_SAVE_FAILED",
      "Не удалось проверить словарь. Попробуй еще раз.",
    );
  }

  return result;
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
    ]);

    const body = await parseJsonBody<{
      initData?: unknown;
      readingTextId?: unknown;
      word?: unknown;
      wordIndex?: unknown;
    }>(req);
    const tgUser = await getTelegramUserFromBody(
      body,
      env.TELEGRAM_BOT_TOKEN,
    );
    const readingTextId = parseString(
      body?.readingTextId,
      "READING_TEXT_ID_REQUIRED",
      "readingTextId is required.",
    );
    const selectedWordRaw = parseString(
      body?.word,
      "WORD_REQUIRED",
      "word is required.",
    );
    const selectedWord = normalizeVocabularyWord(selectedWordRaw);
    if (!/^[a-z][a-z'-]{0,39}$/.test(selectedWord)) {
      fail(400, "INVALID_WORD", "Selected word is invalid.");
    }

    const wordIndex = parseWordIndex(body?.wordIndex);
    const supabase = createServiceClient(env);
    const appUser = await getAppUserByTelegramId(
      supabase,
      tgUser.id,
      "[save-vocabulary-word]",
    );
    const today = getMoscowDate();

    const { data: activeTextRow, error: activeTextError } = await supabase
      .from("user_active_reading_texts")
      .select("reading_text_id, body")
      .eq("user_id", appUser.id)
      .eq("reading_date", today)
      .maybeSingle();

    if (activeTextError) {
      console.error("[save-vocabulary-word] failed to load active text", {
        appUserId: appUser.id,
        error: activeTextError.message,
      });
      fail(500, "ACTIVE_TEXT_LOAD_FAILED", "Failed to load active reading text.");
    }

    if (!activeTextRow) {
      fail(
        409,
        "NO_ACTIVE_READING_TEXT",
        ACTIVE_TEXT_UNAVAILABLE_MESSAGE,
      );
    }

    const activeText = activeTextRow as ActiveReadingTextRow;
    if (activeText.reading_text_id !== readingTextId) {
      fail(
        409,
        "ACTIVE_TEXT_CHANGED",
        ACTIVE_TEXT_UNAVAILABLE_MESSAGE,
      );
    }

    const tokens = activeText.body.split(/\s+/).filter(Boolean);
    const tokenAtIndex = tokens[wordIndex];
    if (!tokenAtIndex) {
      fail(400, "INVALID_WORD_INDEX", "wordIndex is outside of the active text.");
    }

    const tokenWord = normalizeVocabularyWord(tokenAtIndex);
    if (tokenWord !== selectedWord) {
      fail(400, "WORD_MISMATCH", "Selected word does not match active text.");
    }

    await getUserEnglishLevel(supabase, appUser.id, "[save-vocabulary-word]");
    const vocabularyLimit = await getVocabularyLimit(supabase, appUser.id);

    const finalSave = await savePendingVocabularyWordWithSource(supabase, {
      userId: appUser.id,
      word: selectedWord,
      readingTextId,
      readingDate: today,
      wordIndex,
      originalWord: selectedWord,
      vocabularyLimit,
    });

    if (!finalSave.ok) {
      if (finalSave.code === "VOCABULARY_LIMIT_EXCEEDED") {
        fail(
          429,
          finalSave.code,
          "Лимит словаря исчерпан. Перейди на другой тариф, чтобы добавить больше слов.",
        );
      }

      if (
        finalSave.code === "NO_ACTIVE_READING_TEXT" ||
        finalSave.code === "ACTIVE_TEXT_CHANGED"
      ) {
        fail(
          409,
          finalSave.code,
          ACTIVE_TEXT_UNAVAILABLE_MESSAGE,
        );
      }

      fail(
        500,
        finalSave.code,
        "Не удалось сохранить слово. Попробуй еще раз.",
      );
    }

    return successResponse(200, {
      action: finalSave.action,
      wordId: finalSave.wordId,
      word: finalSave.word,
      originalWord: selectedWord,
      status: finalSave.status,
      cardStatus: finalSave.cardStatus,
      wordIndex,
    });
  } catch (error) {
    if (error instanceof AppError) {
      console.error("[save-vocabulary-word] request failed", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return errorResponse(error.status, error.code, error.message);
    }

    const message =
      error instanceof Error ? error.message : "Unknown vocabulary save error.";
    console.error("[save-vocabulary-word] failed", { message });
    return errorResponse(
      500,
      "VOCABULARY_SAVE_FAILED",
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    );
  }
});
