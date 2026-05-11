import { invokeFunction } from "./functionClient";
import {
  ApproveVocabularyCardResult,
  PrepareVocabularyCardsResult,
  SaveVocabularyWordResult,
  VocabularyState,
  VocabularyWordsPage,
} from "../types/vocabulary";

export const saveVocabularyWord = async ({
  readingTextId,
  word,
  wordIndex,
}: {
  readingTextId: string;
  word: string;
  wordIndex: number;
}): Promise<SaveVocabularyWordResult> =>
  invokeFunction<SaveVocabularyWordResult>(
    "save-vocabulary-word",
    { readingTextId, word, wordIndex },
    "Не удалось сохранить слово. Попробуй еще раз.",
  );

export const getVocabularyState = async (): Promise<VocabularyState> =>
  invokeFunction<VocabularyState>(
    "get-vocabulary-state",
    {},
    "Не удалось загрузить состояние словаря.",
  );

export const prepareVocabularyCards =
  async (): Promise<PrepareVocabularyCardsResult> =>
    invokeFunction<PrepareVocabularyCardsResult>(
      "prepare-vocabulary-cards",
      {},
      "Не удалось подготовить карточки слов.",
    );

export const getVocabularyWords = async (): Promise<VocabularyWordsPage> =>
  invokeFunction<VocabularyWordsPage>(
    "get-vocabulary-words",
    {},
    "Не удалось загрузить карточки словаря.",
  );

export const approveVocabularyCard = async (
  wordId: string,
): Promise<ApproveVocabularyCardResult> =>
  invokeFunction<ApproveVocabularyCardResult>(
    "approve-vocabulary-card",
    { wordId },
    "Не удалось подтвердить карточку.",
  );
