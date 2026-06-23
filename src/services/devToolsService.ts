import { invokeFunction } from "./functionClient";

export type DevToolAction =
  | "reset_generation_attempts"
  | "reset_vocabulary_card_attempts"
  | "reset_vocabulary_review_progress"
  | "make_vocabulary_reviews_due_today"
  | "clear_today_vocabulary_review_completion"
  | "delete_today_reading_completion"
  | "reset_subscriptions";

type DevToolsResult = {
  action: DevToolAction;
  today: string;
  deleted: {
    generationAttempts?: number;
    vocabularyCardAttempts?: number;
    vocabularyReviewWords?: number;
    vocabularyReviewsDueToday?: number;
    dailyVocabularyReviewCompletions?: number;
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
