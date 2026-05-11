import { supabase } from "../lib/supabase";

export type FunctionError = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

type FunctionSuccess<TData> = {
  ok: true;
  data: TData;
};

type FunctionResponse<TData> = FunctionSuccess<TData> | FunctionError;

export const getFunctionErrorMessage = async (
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

export const getTelegramInitData = (): string => {
  const initData = window.Telegram?.WebApp?.initData?.trim();
  if (!initData) {
    throw new Error("Telegram initData не найден.");
  }

  return initData;
};

export const invokeFunction = async <TData>(
  functionName: string,
  body: Record<string, unknown>,
  fallbackMessage: string,
): Promise<TData> => {
  const initData = getTelegramInitData();
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { initData, ...body },
  });

  if (error) {
    throw new Error(await getFunctionErrorMessage(error, fallbackMessage));
  }

  const payload = data as FunctionResponse<TData> | null;
  if (!payload) {
    throw new Error("Пустой ответ от сервера.");
  }

  if ("error" in payload) {
    throw new Error(payload.error.message || fallbackMessage);
  }

  return payload.data;
};
