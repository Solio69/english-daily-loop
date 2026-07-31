/// <reference path="../deno-globals.d.ts" />

export const getCompletedReadingTextCount = async (
  supabase: { from: (table: string) => any },
  userId: string,
  logPrefix: string,
): Promise<number | null> => {
  try {
    const { count, error } = await supabase
      .from("user_completed_reading_texts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) {
      console.error(`${logPrefix} failed to count completed reading texts`, {
        appUserId: userId,
        error: error.message,
      });
      return null;
    }

    return count ?? 0;
  } catch (error) {
    console.error(`${logPrefix} completed reading count unavailable`, {
      appUserId: userId,
      error: error instanceof Error ? error.message : "Unknown count error.",
    });
    return null;
  }
};
