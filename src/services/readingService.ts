import { supabase } from "../lib/supabase";
import { ReadingText } from "../types/reading";

const DEFAULT_READING_TIER = "my_level" as const;

type ReadingTextRow = {
  id: string;
  title: string;
  level: string;
  body: string;
  estimated_minutes: number;
};

type GenerateReadingTextFunctionSuccess = {
  ok: true;
  data: {
    text: ReadingText;
    generation: {
      provider: string;
      model: string;
      fallbackUsed: boolean;
    };
  };
};

type GenerateReadingTextFunctionError = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

type GenerateReadingTextFunctionResponse =
  | GenerateReadingTextFunctionSuccess
  | GenerateReadingTextFunctionError;

const getRandomReadingTextFromRpc = async (): Promise<ReadingText> => {
  const { data, error } = await supabase.rpc("get_random_reading_text", {
    p_tier: DEFAULT_READING_TIER,
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
    source: "db_fallback",
  };
};

const getAiGeneratedReadingText = async (): Promise<ReadingText> => {
  const initData = window.Telegram?.WebApp?.initData?.trim();
  if (!initData) {
    throw new Error("Telegram initData не найден.");
  }

  const { data, error } = await supabase.functions.invoke(
    "generate-reading-text",
    {
      body: { initData },
    },
  );

  if (error) {
    throw new Error("Не удалось обратиться к AI-сервису.");
  }

  const payload = data as GenerateReadingTextFunctionResponse | null;
  if (!payload) {
    throw new Error("Пустой ответ от AI-сервиса.");
  }

  if ("error" in payload) {
    throw new Error(payload.error.message || "Ошибка генерации текста.");
  }

  return {
    ...payload.data.text,
    source: "ai",
    generation: payload.data.generation,
  };
};

export const getRandomReadingText = async (): Promise<ReadingText> => {
  try {
    return await getAiGeneratedReadingText();
  } catch (aiError) {
    console.warn("[readingService] AI generate failed, fallback to RPC", aiError);
    return getRandomReadingTextFromRpc();
  }
};
