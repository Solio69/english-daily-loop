import {
  BookText,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import React from 'react'
import { Button } from '../components/Button'
import { InlineStatusCard } from '../components/InlineStatusCard'
import { LoadingState } from '../components/LoadingState'
import { ScreenHeader } from '../components/ScreenHeader'
import { VocabularyDictionaryActionsNotice } from '../components/vocabulary-review/VocabularyDictionaryActionsNotice'
import { VocabularyReviewProgressCard } from '../components/vocabulary-review/VocabularyReviewProgressCard'
import { VocabularyReviewWordCard } from '../components/vocabulary-review/VocabularyReviewWordCard'
import { useVocabularyReview } from '../hooks/useVocabularyReview'
import type { VocabularyReviewStatus } from '../types/vocabulary'
import { getVocabularyReviewProgressPresentation } from '../utils/vocabularyReviewProgress'

type VocabularyScreenProps = {
  onBack: () => void
  onOpenVocabularyMaterials: () => void
  onReviewStatusChange?: (
    status: VocabularyReviewStatus,
    remainingRequiredCount: number,
    reviewedTodayCount: number,
  ) => void
}

export const VocabularyScreen: React.FC<VocabularyScreenProps> = ({
  onBack,
  onOpenVocabularyMaterials,
  onReviewStatusChange,
}) => {
  const {
    reviewState,
    isLoading,
    isSubmitting,
    isReviewStateStale,
    isCardRevealed,
    errorText,
    setIsCardRevealed,
    loadReviewState,
    handleReview,
    handleReviewStateRefresh,
  } = useVocabularyReview({ onReviewStatusChange })

  const { totalCount, reviewedCount, remainingCount, isCompleted } = reviewState
    ? getVocabularyReviewProgressPresentation(reviewState)
    : {
        totalCount: 0,
        reviewedCount: 0,
        remainingCount: 0,
        isCompleted: false,
      }
  const currentCard = reviewState?.currentCard ?? null
  const dictionaryActions = reviewState?.dictionaryActions ?? {
    pendingCount: 0,
    needsApprovalCount: 0,
  }

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
                {errorText ?? 'Не удалось загрузить следующую карточку.'}
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
  )
}
