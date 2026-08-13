// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
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
import { getMoscowStudyDate } from "../_shared/moscow-study-date.ts";
import { getDailyReadingGenerationLimit } from "../_shared/access.ts";
import { getAppUserByTelegramId } from "../_shared/app.ts";

type ActiveReadingTextRow = {
  user_id: string;
  reading_text_id: string;
  title: string;
  body: string;
  level: string;
  estimated_minutes: number;
  provider: string;
  model: string;
  fallback_used: boolean;
  generated_at: string;
  last_read_paragraph_index: number | null;
};

type VocabularyWordSourceRow = {
  word_id: string;
  word_index: number;
};

type PendingVocabularyWordRow = {
  id: string;
};

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) {
    return corsResponse;
  }

  const requestId = getRequestId(req);

  try {
    assertPostRequest(req);

    const env = getRequiredEnv([
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "TELEGRAM_BOT_TOKEN",
    ]);

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

    const appUser = await getAppUserByTelegramId(
      supabase,
      tgUser.id,
      "[get-reading-state]",
      requestId,
    );
    const studyDate = getMoscowStudyDate();
    const dailyLimit = await getDailyReadingGenerationLimit(
      supabase,
      appUser.id,
      "[get-reading-state]",
    );

    const [
      { count: attemptsCount, error: attemptsError },
      { data: completionRow, error: completionError },
      { data: activeTextRow, error: activeTextError },
    ] = await Promise.all([
      supabase
        .from("reading_generation_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", appUser.id)
        .eq("attempt_date", studyDate),
      supabase
        .from("user_daily_reading_completions")
        .select("id")
        .eq("user_id", appUser.id)
        .eq("completed_date", studyDate)
        .maybeSingle(),
      supabase
        .from("user_active_reading_texts")
        .select(
          "user_id, reading_text_id, title, body, level, estimated_minutes, provider, model, fallback_used, generated_at, last_read_paragraph_index",
        )
        .eq("user_id", appUser.id)
        .maybeSingle(),
    ]);

    if (attemptsError) {
      console.error("[get-reading-state] failed to count attempts", {
        appUserId: appUser.id,
        error: attemptsError.message,
      });
      fail(500, "ATTEMPTS_LOAD_FAILED", "Failed to load generation attempts.");
    }

    if (completionError) {
      console.error("[get-reading-state] failed to load completion", {
        appUserId: appUser.id,
        error: completionError.message,
      });
      fail(500, "COMPLETION_LOAD_FAILED", "Failed to load reading completion.");
    }

    if (activeTextError) {
      console.error("[get-reading-state] failed to load active text", {
        appUserId: appUser.id,
        error: activeTextError.message,
      });
      fail(500, "ACTIVE_TEXT_LOAD_FAILED", "Failed to load active reading text.");
    }

    const usedAttempts = attemptsCount ?? 0;
    let savedWordIndexes: number[] = [];
    let pendingSavedWordIndexes: number[] = [];

    if (activeTextRow) {
      const { data: sourceRows, error: sourceError } = await supabase
        .from("user_vocabulary_word_sources")
        .select("word_id, word_index")
        .eq("user_id", appUser.id)
        .eq(
          "reading_text_id",
          (activeTextRow as ActiveReadingTextRow).reading_text_id,
        );

      if (sourceError) {
        console.error("[get-reading-state] failed to load saved word sources", {
          appUserId: appUser.id,
          readingTextId: (activeTextRow as ActiveReadingTextRow).reading_text_id,
          error: sourceError.message,
        });
        fail(500, "SAVED_WORDS_LOAD_FAILED", "Failed to load saved words.");
      }

      const vocabularySources = (sourceRows ?? []) as VocabularyWordSourceRow[];
      savedWordIndexes = Array.from(
        new Set(
          vocabularySources
            .map((row) => row.word_index)
            .filter((index) => Number.isInteger(index) && index >= 0),
        ),
      ).sort((left, right) => left - right);

      const wordIds = Array.from(
        new Set(
          vocabularySources
            .map((row) => row.word_id)
            .filter((id) => typeof id === "string" && id.length > 0),
        ),
      );

      if (wordIds.length > 0) {
        const { data: pendingWordRows, error: pendingWordsError } = await supabase
          .from("user_vocabulary_words")
          .select("id")
          .eq("user_id", appUser.id)
          .eq("card_status", "pending")
          .in("id", wordIds);

        if (pendingWordsError) {
          console.error("[get-reading-state] failed to load pending saved words", {
            appUserId: appUser.id,
            readingTextId: (activeTextRow as ActiveReadingTextRow).reading_text_id,
            error: pendingWordsError.message,
          });
          fail(500, "SAVED_WORDS_LOAD_FAILED", "Failed to load saved words.");
        }

        const pendingWordIds = new Set(
          ((pendingWordRows ?? []) as PendingVocabularyWordRow[]).map(
            (row) => row.id,
          ),
        );
        pendingSavedWordIndexes = Array.from(
          new Set(
            vocabularySources
              .filter((row) => pendingWordIds.has(row.word_id))
              .map((row) => row.word_index)
              .filter((index) => Number.isInteger(index) && index >= 0),
          ),
        ).sort((left, right) => left - right);
      }
    }

    const activeText = activeTextRow
      ? {
          id: (activeTextRow as ActiveReadingTextRow).reading_text_id,
          title: (activeTextRow as ActiveReadingTextRow).title,
          body: (activeTextRow as ActiveReadingTextRow).body,
          level: (activeTextRow as ActiveReadingTextRow).level,
          estimatedMinutes: (activeTextRow as ActiveReadingTextRow)
            .estimated_minutes,
          lastReadParagraphIndex: (activeTextRow as ActiveReadingTextRow)
            .last_read_paragraph_index,
          savedWordIndexes,
          pendingSavedWordIndexes,
          source: "ai",
          generation: {
            provider: (activeTextRow as ActiveReadingTextRow).provider,
            model: (activeTextRow as ActiveReadingTextRow).model,
            fallbackUsed: (activeTextRow as ActiveReadingTextRow).fallback_used,
          },
        }
      : null;

    return successResponse(200, {
      today: studyDate,
      dailyLimit,
      usedAttempts,
      remainingAttempts: Math.max(dailyLimit - usedAttempts, 0),
      isReadingCompletedToday: Boolean(completionRow),
      activeText,
    });
  } catch (error) {
    if (error instanceof AppError) {
      console.error("[get-reading-state] request failed", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return errorResponse(error.status, error.code, error.message);
    }

    const message =
      error instanceof Error ? error.message : "Unknown reading state error.";
    console.error("[get-reading-state] failed", { message });
    return errorResponse(
      500,
      "READING_STATE_FAILED",
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    );
  }
});
