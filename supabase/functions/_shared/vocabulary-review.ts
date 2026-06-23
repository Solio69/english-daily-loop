/// <reference path="../deno-globals.d.ts" />

export type VocabularyReviewStatus = "not_started" | "active" | "learned";

export type VocabularyReviewStep =
  | "1_day"
  | "3_days"
  | "7_days"
  | "14_days"
  | "1_month"
  | "2_months"
  | "3_months"
  | "4_months"
  | "5_months"
  | "6_months";

export type VocabularyReviewAction =
  | "forgot"
  | "same_step"
  | "next_step"
  | "jump_step";

export type VocabularyReviewActionOption = {
  action: VocabularyReviewAction;
  label: string;
};

export const MOSCOW_TIME_ZONE = "Europe/Moscow";

const REVIEW_STEPS: Array<{ step: VocabularyReviewStep; label: string }> = [
  { step: "1_day", label: "1 день" },
  { step: "3_days", label: "3 дня" },
  { step: "7_days", label: "7 дней" },
  { step: "14_days", label: "14 дней" },
  { step: "1_month", label: "1 месяц" },
  { step: "2_months", label: "2 месяца" },
  { step: "3_months", label: "3 месяца" },
  { step: "4_months", label: "4 месяца" },
  { step: "5_months", label: "5 месяцев" },
  { step: "6_months", label: "6 месяцев" },
];

const getStepIndex = (step: VocabularyReviewStep | null): number => {
  if (!step) return 0;
  const index = REVIEW_STEPS.findIndex((item) => item.step === step);
  return index >= 0 ? index : 0;
};

const getOptionLabel = (index: number): string =>
  REVIEW_STEPS[index]?.label ?? "изучено";

export const getMoscowDate = (): string => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: MOSCOW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
};

export const getReviewActionOptions = (
  status: VocabularyReviewStatus,
  reviewStep: VocabularyReviewStep | null,
): VocabularyReviewActionOption[] => {
  const currentIndex = status === "active" ? getStepIndex(reviewStep) : 0;

  return [
    { action: "forgot", label: "Не помню" },
    { action: "same_step", label: getOptionLabel(currentIndex) },
    { action: "next_step", label: getOptionLabel(currentIndex + 1) },
    { action: "jump_step", label: getOptionLabel(currentIndex + 2) },
  ];
};
