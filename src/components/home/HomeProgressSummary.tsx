import { Clock, Flame, Target } from 'lucide-react'
import type { ElementType } from 'react'
import type { ReviewHomeStatus } from '../../types/homeProgress'
import type { HomeProgressStepState } from '../../utils/homeProgressPresentation'
import type { ReadingChipState } from '../../utils/homePresentation'

type ProgressStepState = 'done' | 'current' | 'idle'

const STATUS_STYLES: Record<
  HomeProgressStepState,
  { step: ProgressStepState; text: string; label: string }
> = {
  done: { step: 'done', text: 'text-[var(--primary)]', label: 'Готово' },
  not_started: {
    step: 'idle',
    text: 'text-[var(--text-muted)]',
    label: 'Не начато',
  },
  in_progress: {
    step: 'current',
    text: 'text-[var(--accent-warm)]',
    label: 'В процессе',
  },
}

const PROGRESS_STEP_STYLES: Record<ProgressStepState, string> = {
  done: 'border-[var(--border-strong)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-primary-glow',
  current:
    'border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] text-[var(--accent-warm)] shadow-warm-glow',
  idle: 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]',
}

const READING_CHIP_STYLES: Record<ReadingChipState, string> = {
  completed:
    'border-[var(--border-strong)] bg-[var(--primary-soft)] font-semibold text-[var(--primary)] shadow-primary-glow',
  in_progress:
    'border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] font-semibold text-[var(--accent-warm)] shadow-warm-glow',
  idle: 'border-[var(--border)] bg-[var(--surface)] font-medium text-[var(--text-secondary)]',
}

const REVIEW_CHIP_STYLES: Record<ReviewHomeStatus, string> = {
  completed:
    'border-[var(--border-strong)] bg-[var(--primary-soft)] font-semibold text-[var(--primary)] shadow-primary-glow',
  in_progress:
    'border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] font-semibold text-[var(--accent-warm)] shadow-warm-glow',
  not_started:
    'border-[var(--border)] bg-[var(--surface)] font-medium text-[var(--text-secondary)]',
}

const DEFAULT_READING_MINUTES = 3

type ProgressStepProps = {
  icon: ElementType
  label: string
  status: HomeProgressStepState
  statusLabel?: string
}

const ProgressStep = ({
  icon: Icon,
  label,
  status,
  statusLabel,
}: ProgressStepProps) => {
  const style = STATUS_STYLES[status]
  return (
    <div className="min-w-0 text-center">
      <div
        className={`mx-auto grid size-9 place-items-center rounded-full border backdrop-blur-[24px] min-[390px]:size-10 ${PROGRESS_STEP_STYLES[style.step]}`}
      >
        <Icon size={17} strokeWidth={2.3} />
      </div>
      <p className="mt-1.5 truncate font-heading text-base font-semibold text-[var(--text-primary)]">
        {label}
      </p>
      <p className={`mt-0.5 text-sm font-medium leading-5 ${style.text}`}>
        {statusLabel ?? style.label}
      </p>
    </div>
  )
}

type HomeProgressSummaryProps = {
  streakDays: number
  readingProgressStatus: HomeProgressStepState
  readingChipState: ReadingChipState
  readingMinutes: number | null | undefined
  reviewProgress: { state: HomeProgressStepState; label: string }
  reviewStatus: ReviewHomeStatus
  reviewDueCount: number
}

export const HomeProgressSummary = ({
  streakDays,
  readingProgressStatus,
  readingChipState,
  readingMinutes,
  reviewProgress,
  reviewStatus,
  reviewDueCount,
}: HomeProgressSummaryProps) => (
  <section className="glass-card rounded-[20px] p-3">
    <div className="mb-2 flex items-center justify-between gap-3">
      <h2 className="font-heading text-base font-semibold uppercase tracking-[0.11em] text-[var(--primary)]">
        Прогресс за день
      </h2>
      <div className="glass-control flex min-h-8 shrink-0 items-center gap-1.5 rounded-[14px] px-2.5 text-sm font-semibold leading-none text-[var(--accent-warm)] shadow-warm-glow">
        <Flame size={15} />
        {streakDays}
      </div>
    </div>

    <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
      <ProgressStep icon={Clock} label="Текст" status={readingProgressStatus} />
      <div className="mt-4 h-px w-20 bg-[var(--border-strong)] min-[390px]:w-24 min-[480px]:w-20" />
      <ProgressStep
        icon={Target}
        label="Повторение"
        status={reviewProgress.state}
        statusLabel={reviewProgress.label}
      />
    </div>

    <div className="my-2 h-px bg-[var(--border)]" />

    <div className="grid grid-cols-[1fr_5rem_1fr] gap-2 min-[390px]:grid-cols-[1fr_6rem_1fr] min-[480px]:grid-cols-[1fr_5rem_1fr]">
      <span
        className={`mx-auto w-28 rounded-[12px] border px-2 py-1 text-center text-[10px] backdrop-blur-[24px] min-[480px]:w-24 ${READING_CHIP_STYLES[readingChipState]}`}
      >
        {readingMinutes ?? DEFAULT_READING_MINUTES}м Текст
      </span>
      <span
        className={`col-start-3 mx-auto w-28 rounded-[12px] border px-2 py-1 text-center text-[10px] backdrop-blur-[24px] min-[480px]:w-24 ${REVIEW_CHIP_STYLES[reviewStatus]}`}
      >
        {reviewDueCount > 0 ? `${reviewDueCount} слов` : 'Слова'}
      </span>
    </div>
  </section>
)
