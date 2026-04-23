import { supabase } from "../lib/supabase";
import {
  SubscriptionPlanType,
  SubscriptionSummary,
} from "../types/subscription";

type FunctionError = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

type ActivateSubscriptionFunctionResponse =
  | {
      ok: true;
      data: {
        subscription: SubscriptionSummary;
      };
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
    throw new Error("Telegram initData не найден. Открой приложение внутри Telegram.");
  }

  return initData;
};

export const activateSubscription = async (
  planType: SubscriptionPlanType,
): Promise<SubscriptionSummary> => {
  const initData = getTelegramInitData();

  const { data, error } = await supabase.functions.invoke(
    "activate-subscription",
    {
      body: { initData, planType },
    },
  );

  if (error) {
    throw new Error(
      await getFunctionErrorMessage(
        error,
        "Не удалось оформить подписку. Попробуй еще раз.",
      ),
    );
  }

  const payload = data as ActivateSubscriptionFunctionResponse | null;
  if (!payload) {
    throw new Error("Пустой ответ от сервера подписки.");
  }

  if ("error" in payload) {
    throw new Error(payload.error.message || "Ошибка оформления подписки.");
  }

  return payload.data.subscription;
};
