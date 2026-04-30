import { supabase } from "../lib/supabase";
import {
  CompleteReadingTextResult,
  GenerateReadingTextResult,
  ReadingState,
  ReadingText,
} from "../types/reading";

type GenerateReadingTextFunctionSuccess = {
  ok: true;
  data: {
    text: ReadingText;
    generation: {
      provider: string;
      model: string;
      fallbackUsed: boolean;
      promptVersion?: string;
    };
    dailyLimit: number;
    usedAttempts: number;
    remainingAttempts: number;
  };
};

type FunctionError = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

type GenerateReadingTextFunctionResponse =
  | GenerateReadingTextFunctionSuccess
  | FunctionError;

type ReadingStateFunctionResponse =
  | {
      ok: true;
      data: ReadingState;
    }
  | FunctionError;

type CompleteReadingTextFunctionResponse =
  | {
      ok: true;
      data: CompleteReadingTextResult;
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

export const getReadingState = async (): Promise<ReadingState> => {
  const initData = getTelegramInitData();

  const { data, error } = await supabase.functions.invoke(
    "get-reading-state",
    {
      body: { initData },
    },
  );

  if (error) {
    throw new Error(
      await getFunctionErrorMessage(
        error,
        "Не удалось загрузить состояние чтения.",
      ),
    );
  }

  const payload = data as ReadingStateFunctionResponse | null;
  if (!payload) {
    throw new Error("Пустой ответ от сервера чтения.");
  }

  if ("error" in payload) {
    throw new Error(payload.error.message || "Ошибка загрузки чтения.");
  }

  return payload.data;
};

export const generateReadingText =
  async (): Promise<GenerateReadingTextResult> => {
    const initData = getTelegramInitData();

    const { data, error } = await supabase.functions.invoke(
      "generate-reading-text",
      {
        body: { initData },
      },
    );

    if (error) {
      throw new Error(
        await getFunctionErrorMessage(
          error,
          "Не удалось обратиться к AI-сервису.",
        ),
      );
    }

    const payload = data as GenerateReadingTextFunctionResponse | null;
    if (!payload) {
      throw new Error("Пустой ответ от AI-сервиса.");
    }

    if ("error" in payload) {
      throw new Error(payload.error.message || "Ошибка генерации текста.");
    }

    return {
      text: {
        ...payload.data.text,
        source: "ai",
        generation: payload.data.generation,
      },
      dailyLimit: payload.data.dailyLimit,
      usedAttempts: payload.data.usedAttempts,
      remainingAttempts: payload.data.remainingAttempts,
    };
  };

export const completeReadingText =
  async (): Promise<CompleteReadingTextResult> => {
    const initData = getTelegramInitData();

    const { data, error } = await supabase.functions.invoke(
      "complete-reading-text",
      {
        body: { initData },
      },
    );

    if (error) {
      throw new Error(
        await getFunctionErrorMessage(
          error,
          "Не удалось сохранить завершение текста.",
        ),
      );
    }

    const payload = data as CompleteReadingTextFunctionResponse | null;
    if (!payload) {
      throw new Error("Пустой ответ от сервера чтения.");
    }

    if ("error" in payload) {
      throw new Error(payload.error.message || "Ошибка завершения текста.");
    }

    return payload.data;
  };
