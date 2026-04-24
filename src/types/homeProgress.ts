export type ReadingHomeStatus =
  | "not_started"
  | "in_progress"
  | "completed";

export type LessonHomeStatus =
  | "not_started"
  | "in_progress"
  | "completed";

export type LessonCurrentStep = "reading" | "exercises" | "vocabulary" | null;

export type HomeProgress = {
  lesson: {
    status: LessonHomeStatus;
    currentStep: LessonCurrentStep;
  };
  reading: {
    status: ReadingHomeStatus;
  };
};
