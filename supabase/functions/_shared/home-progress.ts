/// <reference path="../deno-globals.d.ts" />

import type { ServiceClient } from "./app.ts";
import { getMoscowDate } from "./moscow-date.ts";
import { fail } from "./server.ts";
import { loadVocabularyReviewSnapshot } from "./vocabulary-review-state.ts";

type ReadingHomeStatus = "not_started" | "in_progress" | "completed";
type ReviewHomeStatus = "not_started" | "in_progress" | "completed";

export const getHomeProgress = async (
  supabase: ServiceClient,
  userId: string,
  logPrefix: string,
) => {
  const today = getMoscowDate();
  const [
    { data: readingCompletionRows, error: readingCompletionError },
    { data: activeTextRow, error: activeTextError },
    reviewSnapshot,
  ] = await Promise.all([
    supabase
      .from("user_daily_reading_completions")
      .select("user_id")
      .eq("user_id", userId)
      .eq("completed_date", today)
      .limit(1),
    supabase
      .from("user_active_reading_texts")
      .select("user_id")
      .eq("user_id", userId)
      .eq("reading_date", today)
      .maybeSingle(),
    loadVocabularyReviewSnapshot(supabase, userId, today, logPrefix),
  ]);

  if (readingCompletionError || activeTextError) {
    console.error(`${logPrefix} failed to load home progress`, {
      appUserId: userId,
      readingCompletionError: readingCompletionError?.message,
      activeTextError: activeTextError?.message,
    });
    fail(500, "HOME_PROGRESS_LOAD_FAILED", "Failed to load home progress.");
  }

  const readingStatus: ReadingHomeStatus =
    (readingCompletionRows?.length ?? 0) > 0
      ? "completed"
      : activeTextRow
        ? "in_progress"
        : "not_started";
  const reviewStatus: ReviewHomeStatus = reviewSnapshot.status;
  const lessonStatus =
    readingStatus !== "completed"
      ? readingStatus
      : reviewStatus === "completed"
        ? "completed"
        : "in_progress";
  const lessonCurrentStep =
    readingStatus !== "completed"
      ? "reading"
      : reviewStatus === "completed"
        ? null
        : "vocabulary";

  return {
    lesson: {
      status: lessonStatus,
      currentStep: lessonCurrentStep,
    },
    reading: {
      status: readingStatus,
    },
    review: {
      status: reviewStatus,
      dueCount: reviewSnapshot.remainingRequiredCount,
      reviewedTodayCount: reviewSnapshot.reviewedTodayCount,
    },
  };
};
