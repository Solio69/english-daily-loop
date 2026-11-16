import { fail } from "./server.ts";

export const DEV_TOOL_ACTIONS = [
  "reset_generation_attempts",
  "reset_vocabulary_card_attempts",
  "reset_vocabulary_review_progress",
  "make_vocabulary_reviews_due_today",
  "complete_today_vocabulary_reviews_at_step",
  "clear_today_vocabulary_review_completion",
  "delete_today_reading_completion",
  "reset_subscriptions",
] as const;

export type DevToolAction = (typeof DEV_TOOL_ACTIONS)[number];

export const VOCABULARY_REVIEW_STEPS = [
  "1_day",
  "3_days",
  "7_days",
  "14_days",
  "1_month",
  "2_months",
  "3_months",
  "4_months",
  "5_months",
  "6_months",
] as const;

export type VocabularyReviewStep = (typeof VOCABULARY_REVIEW_STEPS)[number];

export type ParsedDevToolInput =
  | {
    action: "complete_today_vocabulary_reviews_at_step";
    reviewStep: VocabularyReviewStep;
  }
  | {
    action: Exclude<DevToolAction, "complete_today_vocabulary_reviews_at_step">;
    reviewStep: null;
  };

const isDevToolAction = (value: unknown): value is DevToolAction =>
  typeof value === "string" &&
  DEV_TOOL_ACTIONS.some((action) => action === value);

const isReviewStep = (value: unknown): value is VocabularyReviewStep =>
  typeof value === "string" &&
  VOCABULARY_REVIEW_STEPS.some((step) => step === value);

export const parseDevToolInput = (body: {
  action?: unknown;
  reviewStep?: unknown;
}): ParsedDevToolInput => {
  if (!isDevToolAction(body.action)) {
    fail(400, "INVALID_DEV_TOOL_ACTION", "Dev tool action is invalid.");
  }

  if (body.action === "complete_today_vocabulary_reviews_at_step") {
    if (!isReviewStep(body.reviewStep)) {
      fail(400, "INVALID_REVIEW_STEP", "Review step is invalid.");
    }
    return { action: body.action, reviewStep: body.reviewStep };
  }

  return { action: body.action, reviewStep: null };
};
