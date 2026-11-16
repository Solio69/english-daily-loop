import { BookText } from 'lucide-react'
import React from 'react'
import type { VocabularyState } from '../../types/vocabulary'
import { VocabularyStatusCards } from './VocabularyStatusCards'
import {
  VocabularyPrepareSection,
  type VocabularySummaryCardError,
} from './VocabularyPrepareSection'

type VocabularySummaryCardProps = {
  state: VocabularyState
  isPreparingCards: boolean
  prepareError: VocabularySummaryCardError | null
  onPrepareCards: () => void
}

export const VocabularySummaryCard: React.FC<VocabularySummaryCardProps> = ({
  state,
  isPreparingCards,
  prepareError,
  onPrepareCards,
}) => {
  return (
    <div className="glass-card space-y-4 rounded-[20px] p-4">
      <div className="flex items-start gap-3">
        <div className="glass-control grid size-12 shrink-0 place-items-center rounded-full text-[var(--primary)]">
          <BookText size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-base font-semibold text-[var(--text-primary)]">
            Словарь
          </h2>
          {state.totalCount === 0 ? (
            <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
              Добавленные из текстов слова будут появляться здесь.
            </p>
          ) : null}
        </div>
      </div>

      {state.totalCount > 0 && (
        <VocabularyStatusCards
          pendingCount={state.pendingCount}
          needsApprovalCount={state.needsApprovalCount}
        />
      )}

      {state.pendingCount > 0 ? (
        <VocabularyPrepareSection
          pendingCount={state.pendingCount}
          dailyLimit={state.cardGeneration.dailyLimit}
          remainingAttempts={state.cardGeneration.remainingAttempts}
          isPreparingCards={isPreparingCards}
          prepareError={prepareError}
          onPrepareCards={onPrepareCards}
        />
      ) : null}
    </div>
  )
}
