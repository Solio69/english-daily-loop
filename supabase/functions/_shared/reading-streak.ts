/// <reference path="../deno-globals.d.ts" />

import { fail } from "./server.ts";

const MOSCOW_TIME_ZONE = "Europe/Moscow";

export const getMoscowDate = (date = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: MOSCOW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
};

const parseDateToUtc = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const formatUtcDate = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getPreviousDate = (value: string): string => {
  const date = parseDateToUtc(value);
  date.setUTCDate(date.getUTCDate() - 1);
  return formatUtcDate(date);
};

export const calculateReadingCompletionStreak = (
  today: string,
  completedDates: string[],
): number => {
  const dates = Array.from(new Set(completedDates))
    .filter((date) => date <= today)
    .sort((a, b) => b.localeCompare(a));
  let streakDays = 0;
  let expectedDate = today;

  for (const completedDate of dates) {
    if (completedDate !== expectedDate) {
      break;
    }

    streakDays += 1;
    expectedDate = getPreviousDate(expectedDate);
  }

  return streakDays;
};

export const getReadingCompletionStreak = async (
  supabase: { from: (table: string) => any },
  userId: string,
  today: string,
  logPrefix: string,
): Promise<number> => {
  const { data: completionRows, error: completionError } = await supabase
    .from("user_daily_reading_completions")
    .select("completed_date")
    .eq("user_id", userId)
    .lte("completed_date", today)
    .order("completed_date", { ascending: false });

  if (completionError) {
    console.error(`${logPrefix} failed to load streak`, {
      appUserId: userId,
      error: completionError.message,
    });
    fail(500, "STREAK_LOAD_FAILED", "Failed to calculate reading streak.");
  }

  return calculateReadingCompletionStreak(
    today,
    (completionRows ?? []).map(
      (row: { completed_date: string }) => row.completed_date,
    ),
  );
};
