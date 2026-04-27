export type MaterialsTab = "texts" | "vocabulary";

export type CompletedReadingText = {
  id: string;
  completedDate: string;
  completedAt: string;
  title: string;
  body: string;
  level: string;
  estimatedMinutes: number;
  generation: {
    provider: string;
    model: string;
    fallbackUsed: boolean;
  };
};

export type ReadingHistoryPage = {
  items: CompletedReadingText[];
  nextCursor: string | null;
};
