export type ReadingHomeStatus =
  | "not_started"
  | "in_progress"
  | "completed";

export type LessonHomeStatus =
  | "not_started"
  | "in_progress"
  | "completed";

export type LessonCurrentStep = "reading" | "vocabulary" | null;
export type ReviewHomeStatus =
  | "not_started"
  | "in_progress"
  | "completed";

export type HomeProgress = {
  lesson: {
    status: LessonHomeStatus;
    currentStep: LessonCurrentStep;
  };
  reading: {
    status: ReadingHomeStatus;
  };
  review: {
    status: ReviewHomeStatus;
    dueCount: number;
    reviewedTodayCount: number;
  };
};
