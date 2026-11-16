import type { ServiceClient } from "./app.ts";
import { fail } from "./server.ts";
import type {
  ParsedDevToolInput,
  VocabularyReviewStep,
} from "./dev-tools-contract.ts";

const resetGenerationAttempts = async (
  supabase: ServiceClient,
  userId: string,
  today: string,
) => {
  const { count, error } = await supabase
    .from("reading_generation_attempts")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("attempt_date", today);

  if (error) {
    console.error("[dev-tools] failed to reset generation attempts");
    fail(500, "DEV_TOOL_ACTION_FAILED", "Failed to reset generation attempts.");
  }

  return { generationAttempts: count ?? 0 };
};

const resetVocabularyCardAttempts = async (
  supabase: ServiceClient,
  userId: string,
  today: string,
) => {
  const { count, error } = await supabase
    .from("vocabulary_card_generation_attempts")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("attempt_date", today);

  if (error) {
    console.error("[dev-tools] failed to reset vocabulary card attempts");
    fail(
      500,
      "DEV_TOOL_ACTION_FAILED",
      "Failed to reset vocabulary card attempts.",
    );
  }

  return { vocabularyCardAttempts: count ?? 0 };
};

const resetVocabularyReviewProgress = async (
  supabase: ServiceClient,
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
    console.error("[dev-tools] failed to reset vocabulary review progress");
    fail(
      500,
      "DEV_TOOL_ACTION_FAILED",
      "Failed to reset vocabulary review progress.",
    );
  }

  return { vocabularyReviewWords: count ?? 0 };
};

const makeVocabularyReviewsDueToday = async (
  supabase: ServiceClient,
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
    console.error("[dev-tools] failed to make vocabulary reviews due today");
    fail(
      500,
      "DEV_TOOL_ACTION_FAILED",
      "Failed to make vocabulary reviews due today.",
    );
  }

  return { vocabularyReviewsDueToday: count ?? 0 };
};

const clearTodayVocabularyReviewCompletion = async (
  supabase: ServiceClient,
  userId: string,
  today: string,
) => {
  const { count, error } = await supabase
    .from("user_daily_vocabulary_review_completions")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("review_date", today);

  if (error) {
    console.error("[dev-tools] failed to clear vocabulary review completion");
    fail(
      500,
      "DEV_TOOL_ACTION_FAILED",
      "Failed to clear vocabulary review completion.",
    );
  }

  return { dailyVocabularyReviewCompletions: count ?? 0 };
};

const completeTodayVocabularyReviewsAtStep = async (
  supabase: ServiceClient,
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
    console.error("[dev-tools] failed to complete vocabulary reviews at step");
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
    fail(400, "INVALID_REVIEW_STEP", "Review step is invalid.");
  }

  return {
    vocabularyReviewsCompletedAtStep: result.processedCount,
    vocabularyReviewsCompletedToday: result.reviewedTodayCount,
    reviewStep: result.reviewStep,
    nextReviewDate: result.nextReviewDate,
  };
};

const deleteTodayReadingCompletions = async (
  supabase: ServiceClient,
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
    console.error("[dev-tools] failed to delete completed reading texts");
    fail(500, "DEV_TOOL_ACTION_FAILED", "Failed to delete completed texts.");
  }

  const { count: completionsCount, error: completionsError } = await supabase
    .from("user_daily_reading_completions")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("completed_date", today);

  if (completionsError) {
    console.error("[dev-tools] failed to delete daily reading completion");
    fail(500, "DEV_TOOL_ACTION_FAILED", "Failed to delete reading completion.");
  }

  return {
    dailyReadingCompletions: completionsCount ?? 0,
    completedReadingTexts: completedTextsCount ?? 0,
  };
};

const resetSubscriptions = async (
  supabase: ServiceClient,
  userId: string,
) => {
  const { count, error } = await supabase
    .from("user_subscriptions")
    .delete({ count: "exact" })
    .eq("user_id", userId);

  if (error) {
    console.error("[dev-tools] failed to reset subscriptions");
    fail(500, "DEV_TOOL_ACTION_FAILED", "Failed to reset subscriptions.");
  }

  return { subscriptions: count ?? 0 };
};

export const executeDevToolAction = (
  supabase: ServiceClient,
  userId: string,
  studyDate: string,
  input: ParsedDevToolInput,
) => {
  switch (input.action) {
    case "reset_generation_attempts":
      return resetGenerationAttempts(supabase, userId, studyDate);
    case "reset_vocabulary_card_attempts":
      return resetVocabularyCardAttempts(supabase, userId, studyDate);
    case "reset_vocabulary_review_progress":
      return resetVocabularyReviewProgress(supabase, userId);
    case "make_vocabulary_reviews_due_today":
      return makeVocabularyReviewsDueToday(supabase, userId, studyDate);
    case "complete_today_vocabulary_reviews_at_step":
      return completeTodayVocabularyReviewsAtStep(
        supabase,
        userId,
        studyDate,
        input.reviewStep,
      );
    case "clear_today_vocabulary_review_completion":
      return clearTodayVocabularyReviewCompletion(supabase, userId, studyDate);
    case "delete_today_reading_completion":
      return deleteTodayReadingCompletions(supabase, userId, studyDate);
    case "reset_subscriptions":
      return resetSubscriptions(supabase, userId);
  }
};
