import { invokeFunction } from "./functionClient";
import { ReadingHistoryPage } from "../types/materials";

export const getReadingHistory = async (
  cursor: string | null = null,
  limit = 10,
): Promise<ReadingHistoryPage> =>
  invokeFunction<ReadingHistoryPage>(
    "get-reading-history",
    { cursor, limit },
    "Не удалось загрузить прочитанные тексты.",
  );
