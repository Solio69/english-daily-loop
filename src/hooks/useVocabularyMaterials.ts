import { useCallback, useEffect, useState } from "react";
import {
  approveVocabularyCards,
  approveVocabularyCard,
  getVocabularyState,
  getVocabularyWords,
  prepareVocabularyCards,
} from "../services/vocabularyService";
import { VocabularyState, VocabularyWordsPage } from "../types/vocabulary";

type VocabularyMaterialsError = {
  title: string;
  message: string;
};

type UseVocabularyMaterialsResult = {
  vocabularyState: VocabularyState | null;
  vocabularyWords: VocabularyWordsPage | null;
  isLoading: boolean;
  isPreparingCards: boolean;
  approvingWordId: string | null;
  isApprovingAllCards: boolean;
  expandedWordId: string | null;
  error: VocabularyMaterialsError | null;
  prepareError: VocabularyMaterialsError | null;
  approveAllError: VocabularyMaterialsError | null;
  setExpandedWordId: (wordId: string | null) => void;
  prepareCards: () => Promise<void>;
  approveCard: (wordId: string) => Promise<void>;
  approveAllCards: () => Promise<void>;
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
  const [isApprovingAllCards, setIsApprovingAllCards] = useState(false);
  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);
  const [error, setError] = useState<VocabularyMaterialsError | null>(null);
  const [prepareError, setPrepareError] =
    useState<VocabularyMaterialsError | null>(null);
  const [approveAllError, setApproveAllError] =
    useState<VocabularyMaterialsError | null>(null);

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
      setError(null);
      setPrepareError(null);
      setApproveAllError(null);

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
        setError({
          title: "Не удалось обновить словарь",
          message:
            error instanceof Error
              ? error.message
              : "Не удалось загрузить словарь.",
        });
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
    if (isPreparingCards || isApprovingAllCards) return;

    setIsPreparingCards(true);
    setError(null);
    setPrepareError(null);
    setApproveAllError(null);

    try {
      const result = await prepareVocabularyCards();
      await refreshVocabularyData();

      if (result.preparedCount === 0 && result.failedCount > 0) {
        setPrepareError({
          title: "Не удалось подготовить карточки",
          message: "Попробуй еще раз позже.",
        });
      }
    } catch (error) {
      try {
        await refreshVocabularyData();
      } catch (refreshError) {
        setError({
          title: "Не удалось обновить словарь",
          message:
            refreshError instanceof Error
              ? refreshError.message
              : "Не удалось обновить состояние словаря.",
        });
        setPrepareError(null);
        return;
      }

      setPrepareError({
        title: "Не удалось подготовить карточки",
        message: "Попробуй еще раз позже.",
      });
    } finally {
      setIsPreparingCards(false);
    }
  };

  const approveCard = async (wordId: string) => {
    if (approvingWordId || isApprovingAllCards) return;

    setApprovingWordId(wordId);
    setError(null);
    setPrepareError(null);
    setApproveAllError(null);

    try {
      await approveVocabularyCard(wordId);
      await refreshVocabularyData();
      setExpandedWordId(null);
    } catch (error) {
      setError({
        title: "Не удалось обновить словарь",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось подтвердить карточку.",
      });
    } finally {
      setApprovingWordId(null);
    }
  };

  const approveAllCards = async () => {
    if (approvingWordId || isApprovingAllCards) return;

    setIsApprovingAllCards(true);
    setError(null);
    setPrepareError(null);
    setApproveAllError(null);

    try {
      await approveVocabularyCards();
      await refreshVocabularyData();
      setExpandedWordId(null);
    } catch (error) {
      setApproveAllError({
        title: "Не удалось обновить словарь",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось подтвердить карточки.",
      });
    } finally {
      setIsApprovingAllCards(false);
    }
  };

  return {
    vocabularyState,
    vocabularyWords,
    isLoading,
    isPreparingCards,
    approvingWordId,
    isApprovingAllCards,
    expandedWordId,
    error,
    prepareError,
    approveAllError,
    setExpandedWordId,
    prepareCards,
    approveCard,
    approveAllCards,
  };
};
