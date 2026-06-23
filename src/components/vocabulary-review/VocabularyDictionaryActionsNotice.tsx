import {
  BookMarked,
  ChevronRight,
  CircleCheck,
  Sparkles,
} from "lucide-react";
import React from "react";

type VocabularyDictionaryActionsNoticeProps = {
  pendingCount: number;
  needsApprovalCount: number;
  onOpen: () => void;
};

export const VocabularyDictionaryActionsNotice: React.FC<
  VocabularyDictionaryActionsNoticeProps
> = ({ pendingCount, needsApprovalCount, onOpen }) => {
  if (pendingCount <= 0 && needsApprovalCount <= 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="glass-card flex w-full items-start gap-3 rounded-[20px] border-[var(--border-strong)] p-3 text-left transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
      aria-label="Открыть словарь для подготовки карточек"
    >
      <div className="mt-0.5 shrink-0 text-[var(--accent-warm)]">
        <BookMarked size={24} strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="font-heading text-base font-semibold leading-5 text-[var(--accent-warm)]">
          Карточки ждут подготовки
        </h2>
        <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
          Открой словарь, чтобы добавить новые слова в повторение
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[var(--border)] pt-2 text-xs font-semibold">
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[var(--accent-warm)]">
              <Sparkles size={14} strokeWidth={2.2} />
              {pendingCount} подготовить
            </span>
          )}
          {pendingCount > 0 && needsApprovalCount > 0 && (
            <span className="text-[var(--text-muted)]">•</span>
          )}
          {needsApprovalCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[var(--primary)]">
              <CircleCheck size={14} strokeWidth={2.2} />
              {needsApprovalCount} подтвердить
            </span>
          )}
        </div>
      </div>
      <ChevronRight
        size={22}
        strokeWidth={2.2}
        className="mt-0.5 shrink-0 text-[var(--accent-warm)]"
      />
    </button>
  );
};
