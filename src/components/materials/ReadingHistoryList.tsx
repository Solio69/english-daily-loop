import { BookOpen, Clock } from 'lucide-react'
import { Button } from '../Button'
import { InlineStatusCard } from '../InlineStatusCard'
import { LoadingState } from '../LoadingState'
import type { CompletedReadingText } from '../../types/materials'
import {
  formatCompletedDateTime,
  getModelLabel,
} from '../../utils/materialsPresentation'

type ReadingHistoryListProps = {
  texts: CompletedReadingText[]
  expandedTextIds: Set<string>
  isLoading: boolean
  isLoadingMore: boolean
  errorText: string | null
  nextCursor: string | null
  onToggleExpanded: (id: string) => void
  onLoadMore: () => void
}

export const ReadingHistoryList = ({
  texts,
  expandedTextIds,
  isLoading,
  isLoadingMore,
  errorText,
  nextCursor,
  onToggleExpanded,
  onLoadMore,
}: ReadingHistoryListProps) => (
  <section className="space-y-3">
    {isLoading && <LoadingState message="Загружаем тексты..." />}

    {errorText && (
      <InlineStatusCard
        variant="error"
        title="Не удалось загрузить материалы"
        description={errorText}
      />
    )}

    {!isLoading && !errorText && texts.length === 0 && (
      <div className="glass-card rounded-[20px] p-6 text-center">
        <div className="glass-control mx-auto mb-3 grid size-14 place-items-center rounded-full text-[var(--primary)]">
          <BookOpen size={28} />
        </div>
        <h2 className="font-heading text-base font-semibold text-[var(--text-primary)]">
          Прочитанных текстов пока нет
        </h2>
        <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
          Завершенные тексты будут появляться здесь.
        </p>
      </div>
    )}

    {texts.map((text) => {
      const isExpanded = expandedTextIds.has(text.id)
      return (
        <article key={text.id} className="glass-card rounded-[20px] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-5 text-[var(--text-muted)]">
                {formatCompletedDateTime(text.completedAt)}
              </p>
              <h2 className="mt-1 font-heading text-[20px] font-semibold leading-6 text-[var(--text-primary)]">
                {text.title}
              </h2>
            </div>
            <div className="glass-control flex shrink-0 items-center gap-1 rounded-full border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] px-2.5 py-1 text-[12px] font-semibold text-[var(--accent-warm)] shadow-warm-glow">
              <Clock size={14} strokeWidth={2.4} />
              {text.estimatedMinutes}м
            </div>
          </div>

          <p
            className="mt-3 overflow-hidden whitespace-pre-line text-[15px] leading-6 text-[var(--text-secondary)]"
            style={
              isExpanded
                ? undefined
                : {
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }
            }
          >
            {text.body}
          </p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-[var(--text-muted)]">
              <span className="rounded-[10px] bg-[var(--surface-strong)] px-2.5 py-1">
                {text.level}
              </span>
              <span className="truncate rounded-[10px] bg-[var(--surface-strong)] px-2.5 py-1">
                {getModelLabel(text.generation.model)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onToggleExpanded(text.id)}
              className="shrink-0 text-[13px] font-semibold text-[var(--accent-warm)] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-warm)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
              aria-expanded={isExpanded}
            >
              {isExpanded ? 'Свернуть' : 'Показать полностью'}
            </button>
          </div>
        </article>
      )
    })}

    {nextCursor && (
      <Button
        variant="outline"
        onClick={onLoadMore}
        disabled={isLoadingMore}
        className="w-full"
      >
        {isLoadingMore ? 'Загружаем...' : 'Показать еще'}
      </Button>
    )}
  </section>
)
