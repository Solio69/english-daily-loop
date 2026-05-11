import { useCallback, useEffect, useState } from "react";
import {
  approveVocabularyCard,
  getVocabularyState,
  getVocabularyWords,
  prepareVocabularyCards,
} from "../services/vocabularyService";
import { VocabularyState, VocabularyWordsPage } from "../types/vocabulary";

type UseVocabularyMaterialsResult = {
  vocabularyState: VocabularyState | null;
  vocabularyWords: VocabularyWordsPage | null;
  isLoading: boolean;
  isPreparingCards: boolean;
  approvingWordId: string | null;
  expandedWordId: string | null;
  errorText: string | null;
  setExpandedWordId: (wordId: string | null) => void;
  prepareCards: () => Promise<void>;
  approveCard: (wordId: string) => Promise<void>;
};

export const useVocabularyMaterials = (
  isEnabled: boolean,
): UseVocabularyMaterialsResult => {
  const [vocabularyState, setVocabularyState] =
    useState<VocabularyState | null>(null);
  const [vocabularyWords, setVocabularyWords] =
    useState<VocabularyWordsPage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreparingCards, setIsPreparingCards] = useState(false);
  const [approvingWordId, setApprovingWordId] = useState<string | null>(null);
  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const refreshVocabularyData = useCallback(async () => {
    const [state, words] = await Promise.all([
      getVocabularyState(),
      getVocabularyWords(),
    ]);
    setVocabularyState(state);
    setVocabularyWords(words);
  }, []);

  useEffect(() => {
    if (!isEnabled) return;

    let isMounted = true;

    const loadVocabulary = async () => {
      setIsLoading(true);
      setErrorText(null);

      try {
        const [state, words] = await Promise.all([
          getVocabularyState(),
          getVocabularyWords(),
        ]);
        if (!isMounted) return;

        setVocabularyState(state);
        setVocabularyWords(words);
      } catch (error) {
        if (!isMounted) return;
        setErrorText(
          error instanceof Error
            ? error.message
            : "Не удалось загрузить словарь.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadVocabulary();

    return () => {
      isMounted = false;
    };
  }, [isEnabled]);

  const prepareCards = async () => {
    if (isPreparingCards) return;

    setIsPreparingCards(true);
    setErrorText(null);

    try {
      await prepareVocabularyCards();
      await refreshVocabularyData();
    } catch {
      try {
        await refreshVocabularyData();
      } catch (refreshError) {
        setErrorText(
          refreshError instanceof Error
            ? refreshError.message
            : "Не удалось обновить состояние словаря.",
        );
      }
    } finally {
      setIsPreparingCards(false);
    }
  };

  const approveCard = async (wordId: string) => {
    if (approvingWordId) return;

    setApprovingWordId(wordId);
    setErrorText(null);

    try {
      await approveVocabularyCard(wordId);
      await refreshVocabularyData();
      setExpandedWordId(null);
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : "Не удалось подтвердить карточку.",
      );
    } finally {
      setApprovingWordId(null);
    }
  };

  return {
    vocabularyState,
    vocabularyWords,
    isLoading,
    isPreparingCards,
    approvingWordId,
    expandedWordId,
    errorText,
    setExpandedWordId,
    prepareCards,
    approveCard,
  };
};
