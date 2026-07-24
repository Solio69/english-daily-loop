// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
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
import { getMoscowStudyDate } from "../_shared/moscow-study-date.ts";
import { assertAdminRole } from "../_shared/access.ts";

type DevToolAction =
  | "reset_generation_attempts"
  | "reset_vocabulary_card_attempts"
  | "reset_vocabulary_review_progress"
  | "make_vocabulary_reviews_due_today"
  | "complete_today_vocabulary_reviews_at_step"
  | "clear_today_vocabulary_review_completion"
  | "delete_today_reading_completion"
  | "reset_subscriptions";

type VocabularyReviewStep =
  | "1_day"
  | "3_days"
  | "7_days"
  | "14_days"
  | "1_month"
  | "2_months"
  | "3_months"
  | "4_months"
  | "5_months"
  | "6_months";

type UserRow = {
  id: string;
  telegram_user_id: number;
};

// TODO: Keep DB-changing dev actions behind both the server env gate and admin role.
const parseAction = (value: unknown): DevToolAction => {
  if (
    value === "reset_generation_attempts" ||
    value === "reset_vocabulary_card_attempts" ||
    value === "reset_vocabulary_review_progress" ||
    value === "make_vocabulary_reviews_due_today" ||
    value === "complete_today_vocabulary_reviews_at_step" ||
    value === "clear_today_vocabulary_review_completion" ||
    value === "delete_today_reading_completion" ||
    value === "reset_subscriptions"
  ) {
    return value;
  }

  fail(400, "INVALID_DEV_TOOL_ACTION", "Dev tool action is invalid.");
};

const parseReviewStep = (value: unknown): VocabularyReviewStep => {
  if (
    value === "1_day" ||
    value === "3_days" ||
    value === "7_days" ||
    value === "14_days" ||
    value === "1_month" ||
    value === "2_months" ||
    value === "3_months" ||
    value === "4_months" ||
    value === "5_months" ||
    value === "6_months"
  ) {
    return value;
  }

  fail(400, "INVALID_REVIEW_STEP", "Review step is invalid.");
};

const getAppUser = async (
  supabase: ReturnType<typeof createClient>,
  telegramUserId: number,
): Promise<UserRow> => {
  const { data, error } = await supabase
    .from("users")
    .select("id, telegram_user_id")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();

  if (error) {
    console.error("[dev-tools] failed to load user", {
      telegramUserId,
      error: error.message,
    });
    fail(500, "USER_FIND_FAILED", "Failed to load user profile.");
  }

  if (!data) {
    fail(
      404,
      "USER_NOT_FOUND",
      "User profile was not found. Complete Telegram auth first.",
    );
  }

  return data as UserRow;
};

const resetGenerationAttempts = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  today: string,
) => {
  const { count, error } = await supabase
    .from("reading_generation_attempts")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("attempt_date", today);

  if (error) {
    console.error("[dev-tools] failed to reset generation attempts", {
      userId,
      today,
      error: error.message,
    });
    fail(500, "DEV_TOOL_ACTION_FAILED", "Failed to reset generation attempts.");
  }

  return { generationAttempts: count ?? 0 };
};

const resetVocabularyCardAttempts = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  today: string,
) => {
  const { count, error } = await supabase
    .from("vocabulary_card_generation_attempts")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("attempt_date", today);

  if (error) {
    console.error("[dev-tools] failed to reset vocabulary card attempts", {
      userId,
      today,
      error: error.message,
    });
    fail(
      500,
      "DEV_TOOL_ACTION_FAILED",
      "Failed to reset vocabulary card attempts.",
    );
  }

  return { vocabularyCardAttempts: count ?? 0 };
};

const resetVocabularyReviewProgress = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
) => {
  const { count, error } = await supabase
    .from("user_vocabulary_words")
    .update(
      {
        status: "not_started",
        review_step: null,
        next_review_date: null,
        last_reviewed_at: null,
        review_count: 0,
        forgot_count: 0,
        same_step_count: 0,
        next_step_count: 0,
        jump_step_count: 0,
        learned_at: null,
      },
      { count: "exact" },
    )
    .eq("user_id", userId)
    .eq("card_status", "ready");

  if (error) {
    console.error("[dev-tools] failed to reset vocabulary review progress", {
      userId,
      error: error.message,
    });
    fail(
      500,
      "DEV_TOOL_ACTION_FAILED",
      "Failed to reset vocabulary review progress.",
    );
  }

  return { vocabularyReviewWords: count ?? 0 };
};

const makeVocabularyReviewsDueToday = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  today: string,
) => {
  const { count, error } = await supabase
    .from("user_vocabulary_words")
    .update({ next_review_date: today }, { count: "exact" })
    .eq("user_id", userId)
    .eq("card_status", "ready")
    .eq("status", "active");

  if (error) {
    console.error("[dev-tools] failed to make vocabulary reviews due today", {
      userId,
      today,
      error: error.message,
    });
    fail(
      500,
      "DEV_TOOL_ACTION_FAILED",
      "Failed to make vocabulary reviews due today.",
    );
  }

  return { vocabularyReviewsDueToday: count ?? 0 };
};

const clearTodayVocabularyReviewCompletion = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  today: string,
) => {
  const { count, error } = await supabase
    .from("user_daily_vocabulary_review_completions")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("review_date", today);

  if (error) {
    console.error("[dev-tools] failed to clear vocabulary review completion", {
      userId,
      today,
      error: error.message,
    });
    fail(
      500,
      "DEV_TOOL_ACTION_FAILED",
      "Failed to clear vocabulary review completion.",
    );
  }

  return { dailyVocabularyReviewCompletions: count ?? 0 };
};

const completeTodayVocabularyReviewsAtStep = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  today: string,
  reviewStep: VocabularyReviewStep,
) => {
  const { data, error } = await supabase.rpc(
    "dev_complete_vocabulary_reviews_at_step",
    {
      p_user_id: userId,
      p_review_date: today,
      p_review_step: reviewStep,
    },
  );

  if (error) {
    console.error("[dev-tools] failed to complete vocabulary reviews at step", {
      userId,
      today,
      reviewStep,
      error: error.message,
    });
    fail(
      500,
      "DEV_TOOL_ACTION_FAILED",
      "Failed to complete vocabulary reviews at selected step.",
    );
  }

  const result = data as
    | {
        ok: true;
        reviewDate: string;
        reviewStep: VocabularyReviewStep;
        nextReviewDate: string;
        processedCount: number;
        reviewedTodayCount: number;
      }
    | {
        ok: false;
        code: string;
        message: string;
      }
    | null;

  if (!result) {
    fail(
      500,
      "DEV_TOOL_ACTION_FAILED",
      "Failed to complete vocabulary reviews at selected step.",
    );
  }

  if (!result.ok) {
    fail(400, result.code, result.message);
  }

  return {
    vocabularyReviewsCompletedAtStep: result.processedCount,
    vocabularyReviewsCompletedToday: result.reviewedTodayCount,
    reviewStep: result.reviewStep,
    nextReviewDate: result.nextReviewDate,
  };
};

const deleteTodayReadingCompletions = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  today: string,
) => {
  const { count: completedTextsCount, error: completedTextsError } =
    await supabase
      .from("user_completed_reading_texts")
      .delete({ count: "exact" })
      .eq("user_id", userId)
      .eq("completed_date", today);

  if (completedTextsError) {
    console.error("[dev-tools] failed to delete completed reading texts", {
      userId,
      today,
      error: completedTextsError.message,
    });
    fail(500, "DEV_TOOL_ACTION_FAILED", "Failed to delete completed texts.");
  }

  const { count: completionsCount, error: completionsError } = await supabase
    .from("user_daily_reading_completions")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("completed_date", today);

  if (completionsError) {
    console.error("[dev-tools] failed to delete daily reading completion", {
      userId,
      today,
      error: completionsError.message,
    });
    fail(500, "DEV_TOOL_ACTION_FAILED", "Failed to delete reading completion.");
  }

  return {
    dailyReadingCompletions: completionsCount ?? 0,
    completedReadingTexts: completedTextsCount ?? 0,
  };
};

const resetSubscriptions = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
) => {
  const { count, error } = await supabase
    .from("user_subscriptions")
    .delete({ count: "exact" })
    .eq("user_id", userId);

  if (error) {
    console.error("[dev-tools] failed to reset subscriptions", {
      userId,
      error: error.message,
    });
    fail(500, "DEV_TOOL_ACTION_FAILED", "Failed to reset subscriptions.");
  }

  return { subscriptions: count ?? 0 };
};

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) {
    return corsResponse;
  }

  try {
    assertPostRequest(req);

    const devToolsEnabled = getOptionalEnv("DEV_TOOLS_ENABLED") === "true";
    if (!devToolsEnabled) {
      fail(403, "DEV_TOOLS_DISABLED", "Dev tools are disabled.");
    }

    const env = getRequiredEnv([
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "TELEGRAM_BOT_TOKEN",
    ]);

    const body = await parseJsonBody<{
      initData?: unknown;
      action?: unknown;
      reviewStep?: unknown;
    }>(req);

    const action = parseAction(body?.action);
    const reviewStep =
      action === "complete_today_vocabulary_reviews_at_step"
        ? parseReviewStep(body?.reviewStep)
        : null;
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
    const appUser = await getAppUser(supabase, tgUser.id);
    await assertAdminRole(supabase, appUser.id, "[dev-tools]");
    const studyDate = getMoscowStudyDate();

    const changes =
      action === "reset_generation_attempts"
        ? await resetGenerationAttempts(supabase, appUser.id, studyDate)
        : action === "reset_vocabulary_card_attempts"
          ? await resetVocabularyCardAttempts(supabase, appUser.id, studyDate)
        : action === "reset_vocabulary_review_progress"
          ? await resetVocabularyReviewProgress(supabase, appUser.id)
        : action === "make_vocabulary_reviews_due_today"
          ? await makeVocabularyReviewsDueToday(
              supabase,
              appUser.id,
              studyDate,
            )
        : action === "complete_today_vocabulary_reviews_at_step"
          ? await completeTodayVocabularyReviewsAtStep(
              supabase,
              appUser.id,
              studyDate,
              reviewStep,
            )
        : action === "clear_today_vocabulary_review_completion"
          ? await clearTodayVocabularyReviewCompletion(
              supabase,
              appUser.id,
              studyDate,
            )
        : action === "delete_today_reading_completion"
          ? await deleteTodayReadingCompletions(
              supabase,
              appUser.id,
              studyDate,
            )
          : await resetSubscriptions(supabase, appUser.id);

    return successResponse(200, {
      action,
      today: studyDate,
      changes,
    });
  } catch (error) {
    if (error instanceof AppError) {
      console.error("[dev-tools] request failed", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return errorResponse(error.status, error.code, error.message);
    }

    const message =
      error instanceof Error ? error.message : "Unknown dev tools error.";
    console.error("[dev-tools] failed", { message });
    return errorResponse(
      500,
      "DEV_TOOLS_FAILED",
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    );
  }
});
