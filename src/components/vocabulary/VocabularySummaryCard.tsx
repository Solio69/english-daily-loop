import { BookText, ChevronRight, TriangleAlert } from "lucide-react";
import React from "react";
import { VocabularyState } from "../../types/vocabulary";

type VocabularySummaryCardProps = {
  state: VocabularyState;
  isPreparingCards: boolean;
  onPrepareCards: () => void;
};

export const VocabularySummaryCard: React.FC<VocabularySummaryCardProps> = ({
  state,
  isPreparingCards,
  onPrepareCards,
}) => {
  const hasWork = state.pendingCount > 0 || state.needsApprovalCount > 0;

  return (
    <div className="glass-card space-y-4 rounded-[20px] p-4">
      <div className="flex items-start gap-3">
        <div className="glass-control grid size-12 shrink-0 place-items-center rounded-full text-[var(--primary)]">
          <BookText size={22} />
        </div>
        <div className="min-w-0">
          <h2 className="font-heading text-base font-semibold text-[var(--text-primary)]">
            Словарь
          </h2>
          {state.totalCount === 0 ? (
            <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
              Добавленные из текстов слова будут появляться здесь.
            </p>
          ) : (
            <div className="mt-1 space-y-1 text-sm leading-5 text-[var(--text-secondary)]">
              <p>Всего слов: {state.totalCount}</p>
              <p>Подтвердить: {state.needsApprovalCount}</p>
              <p>В словаре: {state.readyCount}</p>
            </div>
          )}
        </div>
      </div>

      {hasWork ? (
        <div className="space-y-3">
          {state.pendingCount > 0 && (
            <button
              type="button"
              onClick={onPrepareCards}
              disabled={isPreparingCards}
              className="glass-control flex w-full items-center gap-3 rounded-[18px] border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] px-3 py-3 text-left text-[var(--accent-warm)] shadow-warm-glow transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-warm)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
            >
              <TriangleAlert size={18} strokeWidth={2.3} />
              <span className="min-w-0 flex-1 text-sm font-semibold leading-5">
                {isPreparingCards
                  ? "Готовим карточки..."
                  : `${state.pendingCount} слов ждут подготовки карточек`}
              </span>
              <ChevronRight size={18} strokeWidth={2.3} />
            </button>
          )}
          {state.needsApprovalCount > 0 && (
            <div className="flex items-center gap-2 px-1 text-sm leading-5 text-[var(--text-secondary)]">
              <span className="size-2 shrink-0 rounded-full bg-[var(--accent-warm)]" />
              <span>{state.needsApprovalCount} карточек ждут подтверждения</span>
            </div>
          )}
        </div>
      ) : state.totalCount > 0 ? (
        <div className="rounded-[16px] border border-[var(--border-strong)] bg-[var(--primary-soft)] px-3 py-2 text-sm leading-5 text-[var(--primary)] shadow-primary-glow">
          Все добавленные слова уже подготовлены.
        </div>
      ) : null}
    </div>
  );
};
