// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
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
import { getMoscowDate } from "../_shared/moscow-date.ts";

type UserRow = {
  id: string;
  telegram_user_id: number;
};

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
};

type VocabularyWordSourceRow = {
  word_index: number;
};

const FREE_DAILY_GENERATION_LIMIT = 3;
const PAID_DAILY_GENERATION_LIMIT = 10;

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
    console.error("[get-reading-state] failed to load subscription", {
      appUserId: user.id,
      error: error.message,
    });
    fail(500, "SUBSCRIPTION_LOAD_FAILED", "Failed to load subscription.");
  }

  return (data ?? []).length > 0
    ? PAID_DAILY_GENERATION_LIMIT
    : FREE_DAILY_GENERATION_LIMIT;
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

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id, telegram_user_id")
      .eq("telegram_user_id", tgUser.id)
      .maybeSingle();

    if (userError) {
      console.error("[get-reading-state] failed to load user", {
        telegramUserId: tgUser.id,
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
    const today = getMoscowDate();
    const dailyLimit = await getDailyGenerationLimit(supabase, appUser);

    const [
      { count: attemptsCount, error: attemptsError },
      { data: completionRow, error: completionError },
      { data: activeTextRow, error: activeTextError },
    ] = await Promise.all([
      supabase
        .from("reading_generation_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", appUser.id)
        .eq("attempt_date", today),
      supabase
        .from("user_daily_reading_completions")
        .select("id")
        .eq("user_id", appUser.id)
        .eq("completed_date", today)
        .maybeSingle(),
      supabase
        .from("user_active_reading_texts")
        .select(
          "user_id, reading_text_id, title, body, level, estimated_minutes, provider, model, fallback_used, generated_at",
        )
        .eq("user_id", appUser.id)
        .eq("reading_date", today)
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

    if (activeTextRow) {
      const { data: sourceRows, error: sourceError } = await supabase
        .from("user_vocabulary_word_sources")
        .select("word_index")
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

      savedWordIndexes = Array.from(
        new Set(
          ((sourceRows ?? []) as VocabularyWordSourceRow[])
            .map((row) => row.word_index)
            .filter((index) => Number.isInteger(index) && index >= 0),
        ),
      );
    }

    const activeText = activeTextRow
      ? {
          id: (activeTextRow as ActiveReadingTextRow).reading_text_id,
          title: (activeTextRow as ActiveReadingTextRow).title,
          body: (activeTextRow as ActiveReadingTextRow).body,
          level: (activeTextRow as ActiveReadingTextRow).level,
          estimatedMinutes: (activeTextRow as ActiveReadingTextRow)
            .estimated_minutes,
          savedWordIndexes,
          source: "ai",
          generation: {
            provider: (activeTextRow as ActiveReadingTextRow).provider,
            model: (activeTextRow as ActiveReadingTextRow).model,
            fallbackUsed: (activeTextRow as ActiveReadingTextRow).fallback_used,
          },
        }
      : null;

    return successResponse(200, {
      today,
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
