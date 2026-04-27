import { supabase } from "../lib/supabase";
import { ReadingHistoryPage } from "../types/materials";

type FunctionError = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

type ReadingHistoryFunctionResponse =
  | {
      ok: true;
      data: ReadingHistoryPage;
    }
  | FunctionError;

const getFunctionErrorMessage = async (
  error: unknown,
  fallback: string,
): Promise<string> => {
  const context =
    error && typeof error === "object" && "context" in error
      ? (error as { context?: unknown }).context
      : null;

  if (context instanceof Response) {
    try {
      const payload = (await context.clone().json()) as FunctionError | null;
      if (payload && "error" in payload && payload.error.message) {
        return payload.error.message;
      }
    } catch {
      return fallback;
    }
  }

  return fallback;
};

const getTelegramInitData = (): string => {
  const initData = window.Telegram?.WebApp?.initData?.trim();
  if (!initData) {
    throw new Error("Telegram initData не найден.");
  }

  return initData;
};

export const getReadingHistory = async (
  cursor: string | null = null,
  limit = 10,
): Promise<ReadingHistoryPage> => {
  const initData = getTelegramInitData();

  const { data, error } = await supabase.functions.invoke(
    "get-reading-history",
    {
      body: { initData, cursor, limit },
    },
  );

  if (error) {
    throw new Error(
      await getFunctionErrorMessage(
        error,
        "Не удалось загрузить прочитанные тексты.",
      ),
    );
  }

  const payload = data as ReadingHistoryFunctionResponse | null;
  if (!payload) {
    throw new Error("Пустой ответ от сервера материалов.");
  }

  if ("error" in payload) {
    throw new Error(payload.error.message || "Ошибка загрузки материалов.");
  }

  return payload.data;
};
