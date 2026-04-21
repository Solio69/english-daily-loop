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
