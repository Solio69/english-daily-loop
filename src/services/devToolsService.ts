import { invokeFunction } from "./functionClient";

export type DevToolAction =
  | "reset_generation_attempts"
  | "reset_vocabulary_card_attempts"
  | "delete_today_reading_completion"
  | "reset_subscriptions";

type DevToolsResult = {
  action: DevToolAction;
  today: string;
  deleted: {
    generationAttempts?: number;
    vocabularyCardAttempts?: number;
    dailyReadingCompletions?: number;
    completedReadingTexts?: number;
    subscriptions?: number;
  };
};

export const runDevToolAction = async (
  action: DevToolAction,
): Promise<DevToolsResult> =>
  invokeFunction<DevToolsResult>(
    "dev-tools",
    { action },
    "Не удалось выполнить dev-действие.",
  );
