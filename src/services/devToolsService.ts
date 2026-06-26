import { invokeFunction } from "./functionClient";
import type { VocabularyReviewStep } from "../types/vocabulary";

export type DevToolAction =
  | "reset_generation_attempts"
  | "reset_vocabulary_card_attempts"
  | "reset_vocabulary_review_progress"
  | "make_vocabulary_reviews_due_today"
  | "complete_today_vocabulary_reviews_at_step"
  | "clear_today_vocabulary_review_completion"
  | "delete_today_reading_completion"
  | "reset_subscriptions";

export type DevToolActionOptions = {
  reviewStep?: VocabularyReviewStep;
};

type DevToolsResult = {
  action: DevToolAction;
  today: string;
  changes: {
    generationAttempts?: number;
    vocabularyCardAttempts?: number;
    vocabularyReviewWords?: number;
    vocabularyReviewsDueToday?: number;
    vocabularyReviewsCompletedAtStep?: number;
    vocabularyReviewsCompletedToday?: number;
    reviewStep?: VocabularyReviewStep;
    nextReviewDate?: string;
    dailyVocabularyReviewCompletions?: number;
    dailyReadingCompletions?: number;
    completedReadingTexts?: number;
    subscriptions?: number;
  };
};

export const runDevToolAction = async (
  action: DevToolAction,
  options: DevToolActionOptions = {},
): Promise<DevToolsResult> =>
  invokeFunction<DevToolsResult>(
    "dev-tools",
    { action, ...options },
    "Не удалось выполнить dev-действие.",
  );
