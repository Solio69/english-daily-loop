/// <reference path="../deno-globals.d.ts" />

import type { ServiceClient } from "./app.ts";
import { getCompletedReadingTextCount } from "./reading-history.ts";
import { getReadingCompletionStreak } from "./reading-streak.ts";

type ReadingCompletionMetrics = {
  streakDays: number | null;
  completedReadingTextCount: number | null;
};

const getErrorMessage = (reason: unknown): string =>
  reason instanceof Error ? reason.message : "Unknown metric error.";

export const getPostReadingCompletionMetrics = async (
  supabase: ServiceClient,
  userId: string,
  today: string,
  logPrefix: string,
): Promise<ReadingCompletionMetrics> => {
  const [streakResult, countResult] = await Promise.allSettled([
    getReadingCompletionStreak(supabase, userId, today, logPrefix),
    getCompletedReadingTextCount(supabase, userId, logPrefix),
  ]);

  if (streakResult.status === "rejected") {
    console.error(`${logPrefix} streak unavailable after completion`, {
      appUserId: userId,
      error: getErrorMessage(streakResult.reason),
    });
  }

  if (countResult.status === "rejected") {
    console.error(`${logPrefix} history count unavailable after completion`, {
      appUserId: userId,
      error: getErrorMessage(countResult.reason),
    });
  }

  return {
    streakDays:
      streakResult.status === "fulfilled" ? streakResult.value : null,
    completedReadingTextCount:
      countResult.status === "fulfilled" ? countResult.value : null,
  };
};
