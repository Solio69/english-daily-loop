// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { getMoscowDate } from "../_shared/moscow-date.ts";
import { getPostReadingCompletionMetrics } from "../_shared/reading-completion-metrics.ts";
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

type UserRow = {
  id: string;
};

type CompleteDailyReadingTextResult =
  | {
      ok: true;
      completedDate: string;
      firstTextCompletedAt: string;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

const completeDailyReadingText = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  completedDate: string,
): Promise<Extract<CompleteDailyReadingTextResult, { ok: true }>> => {
  const { data, error } = await supabase.rpc("complete_daily_reading_text", {
    p_user_id: userId,
    p_completed_date: completedDate,
  });

  if (error) {
    console.error("[complete-reading-text] failed to complete text transaction", {
      appUserId: userId,
      completedDate,
      error: error.message,
    });
    fail(500, "READING_COMPLETION_TRANSACTION_FAILED", "Failed to complete reading text.");
  }

  const result = data as CompleteDailyReadingTextResult | null;
  if (!result) {
    fail(500, "READING_COMPLETION_TRANSACTION_FAILED", "Empty completion result.");
  }

  if (!result.ok) {
    fail(
      result.code === "NO_ACTIVE_READING_TEXT" ? 409 : 500,
      result.code,
      result.message,
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
      .select("id")
      .eq("telegram_user_id", tgUser.id)
      .maybeSingle();

    if (userError) {
      console.error("[complete-reading-text] failed to load user", {
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
    const completion = await completeDailyReadingText(supabase, appUser.id, today);

    const { streakDays, completedReadingTextCount } =
      await getPostReadingCompletionMetrics(
        supabase,
        appUser.id,
        today,
        "[complete-reading-text]",
      );

    return successResponse(200, {
      completedDate: completion.completedDate,
      firstTextCompletedAt: completion.firstTextCompletedAt,
      isReadingCompletedToday: true,
      streakDays,
      completedReadingTextCount,
    });
  } catch (error) {
    if (error instanceof AppError) {
      console.error("[complete-reading-text] request failed", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return errorResponse(error.status, error.code, error.message);
    }

    const message =
      error instanceof Error ? error.message : "Unknown completion error.";
    console.error("[complete-reading-text] failed", { message });
    return errorResponse(
      500,
      "READING_COMPLETION_FAILED",
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    );
  }
});
