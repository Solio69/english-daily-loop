import type { ReviewHomeStatus } from "../types/homeProgress";
import { getRussianPlural } from "./russianPlural";

export type HomeProgressStepState = "done" | "not_started" | "in_progress";

type ReviewProgressPresentationSource = {
  status: ReviewHomeStatus;
  dueCount: number;
  reviewedTodayCount: number;
};

const REVIEW_STATUS_LABELS: Record<ReviewHomeStatus, string> = {
  completed: "Готово",
  in_progress: "В процессе",
  not_started: "Не начато",
};

export const getReviewProgressPresentation = ({
  status,
  dueCount,
  reviewedTodayCount,
}: ReviewProgressPresentationSource): {
  state: HomeProgressStepState;
  label: string;
} => {
  const state: HomeProgressStepState =
    status === "completed"
      ? "done"
      : status === "in_progress"
        ? "in_progress"
        : "not_started";
  const isEmptyCompletedDay =
    status === "completed" && dueCount === 0 && reviewedTodayCount === 0;

  return {
    state,
    label: isEmptyCompletedDay
      ? "Слов на повторение нет"
      : REVIEW_STATUS_LABELS[status],
  };
};

const TEXT_FORMS = ["текст", "текста", "текстов"] as const;

export const getCompletedReadingTextLabel = (count: number | null): string =>
  count === null
    ? "История чтения"
    : `Прочитано: ${count} ${getRussianPlural(count, TEXT_FORMS)}`;
