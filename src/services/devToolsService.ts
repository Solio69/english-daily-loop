import { supabase } from "../lib/supabase";

export type DevToolAction =
  | "reset_generation_attempts"
  | "delete_today_reading_completion"
  | "reset_subscriptions";

type DevToolsFunctionSuccess = {
  ok: true;
  data: {
    action: DevToolAction;
    today: string;
    deleted: {
      generationAttempts?: number;
      dailyReadingCompletions?: number;
      completedReadingTexts?: number;
      subscriptions?: number;
    };
  };
};

type DevToolsFunctionError = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

type DevToolsFunctionResponse =
  | DevToolsFunctionSuccess
  | DevToolsFunctionError;

const getTelegramInitData = (): string => {
  const initData = window.Telegram?.WebApp?.initData?.trim();
  if (!initData) {
    throw new Error("Telegram initData не найден.");
  }

  return initData;
};

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
      const payload = (await context.clone().json()) as
        | DevToolsFunctionError
        | null;
      if (payload && "error" in payload && payload.error.message) {
        return payload.error.message;
      }
    } catch {
      return fallback;
    }
  }

  return fallback;
};

export const runDevToolAction = async (
  action: DevToolAction,
): Promise<DevToolsFunctionSuccess["data"]> => {
  const initData = getTelegramInitData();
  const { data, error } = await supabase.functions.invoke("dev-tools", {
    body: { initData, action },
  });

  if (error) {
    throw new Error(
      await getFunctionErrorMessage(error, "Не удалось выполнить dev-действие."),
    );
  }

  const payload = data as DevToolsFunctionResponse | null;
  if (!payload) {
    throw new Error("Пустой ответ от dev-tools.");
  }

  if ("error" in payload) {
    throw new Error(payload.error.message || "Не удалось выполнить dev-действие.");
  }

  return payload.data;
};
