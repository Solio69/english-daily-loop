import { VocabularyReviewStep } from "../types/vocabulary";

const MOSCOW_TIME_ZONE = "Europe/Moscow";

const REVIEW_STEP_LABELS: Record<VocabularyReviewStep, string> = {
  "1_day": "1 день",
  "3_days": "3 дня",
  "7_days": "7 дней",
  "14_days": "14 дней",
  "1_month": "1 месяц",
  "2_months": "2 месяца",
  "3_months": "3 месяца",
  "4_months": "4 месяца",
  "5_months": "5 месяцев",
  "6_months": "6 месяцев",
};

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  timeZone: MOSCOW_TIME_ZONE,
});

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const getReviewStepLabel = (step: VocabularyReviewStep): string =>
  REVIEW_STEP_LABELS[step];

export const formatReviewDate = (value: string): string | null => {
  const normalizedValue = DATE_ONLY_PATTERN.test(value)
    ? `${value}T12:00:00Z`
    : value;
  const date = new Date(normalizedValue);

  return Number.isNaN(date.getTime()) ? null : SHORT_DATE_FORMATTER.format(date);
};
