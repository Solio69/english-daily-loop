import { CircleCheck, Layers } from 'lucide-react'
import React from 'react'
import { SHOW_VOCABULARY_CARD_APPROVAL_FLOW } from '../../constants/vocabularyFeatures'
import {
  approvalWaitingForms,
  getRussianPlural,
  wordWithoutCardForms,
} from '../../utils/vocabularyPlural'

type VocabularyStatusCardsProps = {
  pendingCount: number
  needsApprovalCount: number
}

type VocabularyStatusCardProps = {
  count: number
  icon: React.ReactNode
  actionLabel: string
  activeDescription: string
  readyTitle: string
  readyDescription: string
}

export const VocabularyStatusCards: React.FC<VocabularyStatusCardsProps> = ({
  pendingCount,
  needsApprovalCount,
}) => {
  const isApprovalFlowVisible = SHOW_VOCABULARY_CARD_APPROVAL_FLOW

  return (
    <div
      className={`grid gap-2 ${
        isApprovalFlowVisible ? 'grid-cols-2' : 'grid-cols-1'
      }`}
    >
      <VocabularyStatusCard
        count={pendingCount}
        icon={<Layers className="size-4 shrink-0" />}
        actionLabel="добавить"
        activeDescription={getRussianPlural(pendingCount, wordWithoutCardForms)}
        readyTitle="Все готовы"
        readyDescription="слов без карточек нет"
      />
      {isApprovalFlowVisible ? (
        <VocabularyStatusCard
          count={needsApprovalCount}
          icon={<CircleCheck className="size-4 shrink-0" />}
          actionLabel="подтвердить"
          activeDescription={getRussianPlural(
            needsApprovalCount,
            approvalWaitingForms,
          )}
          readyTitle="Подтверждено"
          readyDescription="карточек на проверку нет"
        />
      ) : null}
    </div>
  )
}

const VocabularyStatusCard: React.FC<VocabularyStatusCardProps> = ({
  count,
  icon,
  actionLabel,
  activeDescription,
  readyTitle,
  readyDescription,
}) => {
  const isEmpty = count === 0
  const toneClass = isEmpty
    ? 'border-[var(--border-strong)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-primary-glow'
    : 'border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] text-[var(--accent-warm)]'

  return (
    <div
      className={[
        'flex min-h-[68px] items-center rounded-[15px] border px-3 py-2',
        toneClass,
      ].join(' ')}
    >
      <div className="min-w-0">
        {isEmpty ? (
          <>
            <div className="flex min-w-0 items-center gap-1.5">
              {icon}
              <span className="truncate font-heading text-sm font-semibold leading-5">
                {readyTitle}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-4 text-[var(--text-secondary)]">
              {readyDescription}
            </p>
          </>
        ) : (
          <>
            <div className="flex min-w-0 items-baseline gap-1.5">
              <span className="relative top-0.5">{icon}</span>
              <span className="font-heading text-xl font-semibold leading-none">
                {count}
              </span>
              <span className="truncate text-[11px] font-semibold leading-4">
                {actionLabel}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-4 text-[var(--text-secondary)]">
              {activeDescription}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
