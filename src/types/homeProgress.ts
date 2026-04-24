export type ReadingHomeStatus =
  | "not_started"
  | "in_progress"
  | "completed";

export type HomeProgress = {
  reading: {
    status: ReadingHomeStatus;
  };
};
