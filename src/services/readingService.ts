import { supabase } from "../lib/supabase";
import { ReadingMode, ReadingText } from "../types/reading";

type ReadingTextRow = {
  id: string;
  title: string;
  level: string;
  body: string;
  estimated_minutes: number;
};

export const getRandomReadingText = async (
  mode: ReadingMode,
): Promise<ReadingText> => {
  const { data, error } = await supabase.rpc("get_random_reading_text", {
    p_tier: mode,
  });

  if (error) {
    throw new Error("Не удалось загрузить текст. Попробуй еще раз.");
  }

  const row = (Array.isArray(data) ? data[0] : data) as ReadingTextRow | null;
  if (!row) {
    throw new Error("Для выбранного режима тексты не найдены.");
  }

  return {
    id: row.id,
    title: row.title,
    level: row.level,
    body: row.body,
    estimatedMinutes: row.estimated_minutes,
  };
};
