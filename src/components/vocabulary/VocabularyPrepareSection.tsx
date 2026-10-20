import { Info, LoaderCircle, Sparkles, TriangleAlert } from 'lucide-react'
import React from 'react'
import {
  cardAttemptForms,
  formatRussianCount,
  getRussianPlural,
  wordWithoutCardForms,
} from '../../utils/vocabularyPlural'
import { InlineStatusCard } from '../InlineStatusCard'

export type VocabularySummaryCardError = {
  title: string
  message: string
}

type VocabularyPrepareSectionProps = {
  pendingCount: number
  dailyLimit: number
  remainingAttempts: number
  isPreparingCards: boolean
  prepareError: VocabularySummaryCardError | null
  onPrepareCards: () => void
}

export const VocabularyPrepareSection: React.FC<
  VocabularyPrepareSectionProps
> = ({
  pendingCount,
  dailyLimit,
  remainingAttempts,
  isPreparingCards,
  prepareError,
  onPrepareCards,
}) => {
  const isLimitExhausted = remainingAttempts <= 0

  return (
    <div className="space-y-3">
      <div className="glass-control flex min-h-[84px] w-full items-center gap-2 rounded-[18px] border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] p-2 shadow-warm-glow">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <TriangleAlert
            className="mt-0.5 size-[18px] shrink-0 text-[var(--accent-warm)]"
            strokeWidth={2.3}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-5 text-[var(--accent-warm)]">
              {formatRussianCount(pendingCount, wordWithoutCardForms)}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-[var(--text-secondary)]">
              Подготовим перевод и примеры
            </p>
            <p
              className={`mt-1 text-[12px] font-semibold leading-4 ${
                isLimitExhausted
                  ? 'text-[var(--accent-coral)]'
                  : 'text-[var(--accent-warm)]'
              }`}
            >
              Осталось: {remainingAttempts}/{dailyLimit}{' '}
              {getRussianPlural(remainingAttempts, cardAttemptForms)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onPrepareCards}
          disabled={isPreparingCards || isLimitExhausted}
          className="inline-flex h-11 w-[7.5rem] shrink-0 items-center justify-center gap-2 rounded-[15px] bg-[var(--accent-coral)] px-3 font-heading text-sm font-semibold text-white shadow-coral-glow transition duration-200 hover:brightness-105 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] min-[390px]:w-[8rem]"
        >
          {isPreparingCards ? (
            <LoaderCircle className="size-4 shrink-0 animate-spin" />
          ) : (
            <Sparkles className="size-4 shrink-0" />
          )}
          {isPreparingCards
            ? 'Готовим'
            : isLimitExhausted
              ? 'Завтра'
              : 'Готовить'}
        </button>
      </div>
      {prepareError ? (
        <InlineStatusCard
          variant="error"
          title={prepareError.title}
          description={prepareError.message}
        />
      ) : null}
      <VocabularyGenerationInfo />
    </div>
  )
}

const VocabularyGenerationInfo: React.FC = () => (
  <div className="glass-control rounded-[18px] p-3">
    <div className="flex items-start gap-3">
      <div className="glass-control grid size-10 shrink-0 place-items-center rounded-full text-[var(--primary)]">
        <Info size={19} />
      </div>
      <div className="min-w-0">
        <h3 className="font-heading text-sm font-semibold text-[var(--primary)]">
          Как это работает
        </h3>
        <ul className="mt-2 space-y-1.5 text-xs leading-4 text-[var(--text-secondary)]">
          <li className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
            <span>AI подготовит карточки партиями.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
            <span>Готовые карточки сразу попадут в словарь и повторение.</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
)
