export type ReadingSource = "ai" | "db_fallback";

export type ReadingText = {
  id: string;
  title: string;
  level: string;
  body: string;
  estimatedMinutes: number;
  source?: ReadingSource;
  generation?: {
    provider: string;
    model: string;
    fallbackUsed: boolean;
  };
};

export type ReadingState = {
  today: string;
  dailyLimit: number;
  usedAttempts: number;
  remainingAttempts: number;
  isReadingCompletedToday: boolean;
  activeText: ReadingText | null;
};

export type GenerateReadingTextResult = {
  text: ReadingText;
  dailyLimit: number;
  usedAttempts: number;
  remainingAttempts: number;
};

export type CompleteReadingTextResult = {
  completedDate: string;
  firstTextCompletedAt: string | null;
  isReadingCompletedToday: boolean;
};
