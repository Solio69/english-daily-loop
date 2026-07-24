import { invokeFunction } from "./functionClient";
import {
  CompleteReadingTextResult,
  GenerateReadingTextResult,
  ReadingState,
  ReadingText,
  SaveReadingPositionResult,
} from "../types/reading";

type GenerateReadingTextPayload = {
  text: ReadingText;
  generation: {
    provider: string;
    model: string;
    fallbackUsed: boolean;
    promptVersion?: string;
  };
  dailyLimit: number;
  usedAttempts: number;
  remainingAttempts: number;
};

export const getReadingState = async (): Promise<ReadingState> =>
  invokeFunction<ReadingState>(
    "get-reading-state",
    {},
    "Не удалось загрузить состояние чтения.",
  );

export const generateReadingText =
  async (): Promise<GenerateReadingTextResult> => {
    const payload = await invokeFunction<GenerateReadingTextPayload>(
      "generate-reading-text",
      {},
      "Не удалось обратиться к AI-сервису.",
    );

    return {
      text: {
        ...payload.text,
        source: "ai",
        generation: payload.generation,
      },
      dailyLimit: payload.dailyLimit,
      usedAttempts: payload.usedAttempts,
      remainingAttempts: payload.remainingAttempts,
    };
  };

export const completeReadingText =
  async (): Promise<CompleteReadingTextResult> =>
    invokeFunction<CompleteReadingTextResult>(
      "complete-reading-text",
      {},
      "Не удалось сохранить завершение текста.",
    );

export const saveReadingPosition = async (
  readingTextId: string,
  paragraphIndex: number | null,
): Promise<SaveReadingPositionResult> =>
  invokeFunction<SaveReadingPositionResult>(
    "save-reading-position",
    { readingTextId, paragraphIndex },
    paragraphIndex === null
      ? "Не удалось сбросить позицию чтения."
      : "Не удалось сохранить позицию чтения.",
  );
