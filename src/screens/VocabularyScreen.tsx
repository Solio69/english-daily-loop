import {
  BookText,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { InlineStatusCard } from "../components/InlineStatusCard";
import { LoadingState } from "../components/LoadingState";
import { ScreenHeader } from "../components/ScreenHeader";
import { VocabularyDictionaryActionsNotice } from "../components/vocabulary-review/VocabularyDictionaryActionsNotice";
import { VocabularyReviewProgressCard } from "../components/vocabulary-review/VocabularyReviewProgressCard";
import { VocabularyReviewWordCard } from "../components/vocabulary-review/VocabularyReviewWordCard";
import {
  getVocabularyReviewState,
  reviewVocabularyWord,
} from "../services/vocabularyService";
import {
  VocabularyReviewAction,
  VocabularyReviewState,
  VocabularyReviewStatus,
} from "../types/vocabulary";
import { getVocabularyReviewProgressPresentation } from "../utils/vocabularyReviewProgress";

type VocabularyScreenProps = {
  onBack: () => void;
  onOpenVocabularyMaterials: () => void;
  onReviewStatusChange?: (
    status: VocabularyReviewStatus,
    remainingRequiredCount: number,
    reviewedTodayCount: number,
  ) => void;
};

export const VocabularyScreen: React.FC<VocabularyScreenProps> = ({
  onBack,
  onOpenVocabularyMaterials,
  onReviewStatusChange,
}) => {
  const [reviewState, setReviewState] = useState<VocabularyReviewState | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [isReviewStateStale, setIsReviewStateStale] = useState(false);
  const [isCardRevealed, setIsCardRevealed] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const applyReviewState = useCallback(
    (state: VocabularyReviewState) => {
      setReviewState(state);
      onReviewStatusChange?.(
        state.status,
        state.remainingRequiredCount,
        state.reviewedTodayCount,
      );
    },
    [onReviewStatusChange],
  );

  const loadReviewState = useCallback(async () => {
    setErrorText(null);
    const state = await getVocabularyReviewState();
    applyReviewState(state);
    setIsReviewStateStale(false);
  }, [applyReviewState]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const state = await getVocabularyReviewState();
        if (!isMounted) return;
        applyReviewState(state);
      } catch (error) {
        if (!isMounted) return;
        setErrorText(
          error instanceof Error
            ? error.message
            : "Не удалось загрузить повторение слов.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [applyReviewState]);

  const handleReview = async (action: VocabularyReviewAction) => {
    const currentCard = reviewState?.currentCard;
    if (!currentCard || isSubmittingRef.current) return;

    let isReviewSaved = false;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      await reviewVocabularyWord(currentCard.id, action);
      isReviewSaved = true;
      await loadReviewState();
      setIsCardRevealed(false);
    } catch (error) {
      if (isReviewSaved) {
        setIsReviewStateStale(true);
        setIsCardRevealed(false);
        setErrorText(
          "Ответ сохранён, но не удалось загрузить следующую карточку.",
        );
      } else {
        setErrorText(
          error instanceof Error ? error.message : "Не удалось сохранить ответ.",
        );
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleReviewStateRefresh = async () => {
    if (isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await loadReviewState();
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить следующую карточку.",
      );
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const { totalCount, reviewedCount, remainingCount, isCompleted } = reviewState
    ? getVocabularyReviewProgressPresentation(reviewState)
    : {
        totalCount: 0,
        reviewedCount: 0,
        remainingCount: 0,
        isCompleted: false,
      };
  const currentCard = reviewState?.currentCard ?? null;
  const dictionaryActions = reviewState?.dictionaryActions ?? {
    pendingCount: 0,
    needsApprovalCount: 0,
  };

  return (
    <div className="mx-auto w-full max-w-[430px] space-y-3 px-3.5 pb-6 pt-3 min-[390px]:px-4 min-[480px]:max-w-[390px] min-[480px]:px-3">
      <ScreenHeader title="Слова" onBack={onBack} />

      {isLoading ? (
        <LoadingState message="Загружаем повторение..." />
      ) : errorText && !reviewState ? (
        <InlineStatusCard
          variant="error"
          title="Не удалось загрузить слова"
          description={errorText}
        />
      ) : reviewState ? (
        <>
          <VocabularyReviewProgressCard
            totalCount={totalCount}
            reviewedCount={reviewedCount}
            remainingCount={remainingCount}
            isCompleted={isCompleted}
          />

          <VocabularyDictionaryActionsNotice
            pendingCount={dictionaryActions.pendingCount}
            needsApprovalCount={dictionaryActions.needsApprovalCount}
            onOpen={onOpenVocabularyMaterials}
          />

          {errorText && !isReviewStateStale && (
            <InlineStatusCard
              variant="error"
              title="Не удалось сохранить ответ"
              description={errorText}
            />
          )}

          {isReviewStateStale ? (
            <section
              aria-live="polite"
              className="glass-card rounded-[20px] p-5 text-center"
            >
              <div className="glass-control mx-auto mb-3 grid size-14 place-items-center rounded-full text-[var(--primary)]">
                <RefreshCw size={28} />
              </div>
              <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
                Ответ сохранён
              </h2>
              <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                {errorText ?? "Не удалось загрузить следующую карточку."}
              </p>
              <Button
                variant="secondary"
                onClick={handleReviewStateRefresh}
                disabled={isSubmitting}
                className="mt-4 w-full"
              >
                {isSubmitting ? (
                  <Loader2 className="size-[18px] animate-spin" />
                ) : (
                  <RefreshCw size={18} />
                )}
                Загрузить следующую карточку
              </Button>
            </section>
          ) : currentCard ? (
            <VocabularyReviewWordCard
              card={currentCard}
              isRevealed={isCardRevealed}
              isSubmitting={isSubmitting}
              onReveal={() => setIsCardRevealed(true)}
              onReview={handleReview}
            />
          ) : reviewState.totalReadyCount === 0 ? (
            <section className="glass-card rounded-[20px] p-6 text-center">
              <div className="glass-control mx-auto mb-3 grid size-14 place-items-center rounded-full text-[var(--primary)]">
                <BookText size={28} />
              </div>
              <h2 className="font-heading text-base font-semibold text-[var(--text-primary)]">
                Слов для повторения пока нет
              </h2>
              <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                Добавляй слова из текстов и готовь карточки в материалах.
              </p>
            </section>
          ) : (
            <section className="glass-card rounded-[20px] p-5 text-center">
              <div className="glass-control mx-auto mb-3 grid size-14 place-items-center rounded-full border-[var(--border-strong)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-primary-glow">
                <CheckCircle2 size={28} />
              </div>
              <h2 className="font-heading text-lg font-semibold text-[var(--primary)]">
                Повторение готово
              </h2>
              <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                План на сегодня завершен.
              </p>
              <Button
                variant="secondary"
                onClick={loadReviewState}
                className="mt-4 w-full"
              >
                <Sparkles size={18} />
                Проверить новые слова
              </Button>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
};
