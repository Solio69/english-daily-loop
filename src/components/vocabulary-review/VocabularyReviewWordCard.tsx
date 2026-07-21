import { Eye, Loader2, LockKeyhole } from "lucide-react";
import React, { useRef } from "react";
import { useScrollIntoViewOnExpand } from "../../hooks/useScrollIntoViewOnExpand";
import {
  VocabularyReviewAction,
  VocabularyReviewCard,
} from "../../types/vocabulary";
import { getVocabularyHighlightTokens } from "../../utils/vocabularyText";
import { Button } from "../Button";
import { VocabularyWordDetails } from "../vocabulary/VocabularyWordDetails";
import { VocabularyWordExamples } from "../vocabulary/VocabularyWordExamples";

type VocabularyReviewWordCardProps = {
  card: VocabularyReviewCard;
  isRevealed: boolean;
  isSubmitting: boolean;
  onReveal: () => void;
  onReview: (action: VocabularyReviewAction) => void;
};

const LOCKED_SECTION_LABELS = ["перевод", "формы", "примеры"] as const;

export const VocabularyReviewWordCard: React.FC<
  VocabularyReviewWordCardProps
> = ({ card, isRevealed, isSubmitting, onReveal, onReview }) => {
  const articleRef = useRef<HTMLElement | null>(null);
  const highlightTokens = getVocabularyHighlightTokens(card);
  const statusLabel =
    card.status === "active" ? "В повторении" : "Не изучено";

  useScrollIntoViewOnExpand(isRevealed, articleRef, {
    topOffset: 16,
    bottomOffset: 120,
  });

  if (!isRevealed) {
    return (
      <article
        ref={articleRef}
        className="glass-card space-y-4 rounded-[20px] p-4"
      >
        <h2 className="font-heading text-[32px] font-bold leading-none text-[var(--text-primary)]">
          {card.word}
        </h2>

        <p className="text-sm leading-5 text-[var(--text-secondary)]">
          Открой перевод и выбери следующий интервал.
        </p>

        <div className="grid grid-cols-3 gap-2">
          {LOCKED_SECTION_LABELS.map((label) => (
            <div
              key={label}
              className="glass-control flex min-h-10 items-center justify-center gap-1.5 rounded-[14px] px-2 text-[12px] font-semibold text-[var(--text-muted)]"
            >
              {label === "перевод" ? (
                <Eye size={14} strokeWidth={2.2} />
              ) : (
                <LockKeyhole size={14} strokeWidth={2.2} />
              )}
              <span className="truncate">{label}</span>
            </div>
          ))}
        </div>

        <Button onClick={onReveal} className="min-h-[56px] w-full">
          Показать перевод
        </Button>
      </article>
    );
  }

  return (
    <article
      ref={articleRef}
      aria-busy={isSubmitting}
      className="glass-card glass-card-warm relative overflow-hidden rounded-[20px]"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading text-[28px] font-bold leading-8 text-[var(--text-primary)]">
              {card.word}
            </h2>
            <p className="mt-1 text-base leading-6 text-[var(--text-secondary)]">
              {card.translation}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-2.5 py-1 text-[11px] font-semibold leading-none text-[var(--text-secondary)]">
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="space-y-4 px-4 pb-4">
        <VocabularyWordDetails word={card} />
        <VocabularyWordExamples
          examples={card.examples}
          highlightTokens={highlightTokens}
          highlightTone="warm"
        />
        <div className="grid grid-cols-4 gap-2">
          {card.actions.map((option) => (
            <button
              key={option.action}
              type="button"
              disabled={isSubmitting}
              onClick={() => onReview(option.action)}
              className="min-h-[58px] rounded-[18px] border border-[var(--primary)] bg-[var(--surface)] px-2 font-heading text-sm font-semibold leading-5 text-[var(--primary)] shadow-primary-glow transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] dark:border-[var(--accent-warm)] dark:text-[var(--accent-warm)] dark:shadow-warm-glow"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {isSubmitting && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-10 grid place-items-center rounded-[inherit] bg-[var(--surface-strong)] backdrop-blur-sm"
        >
          <Loader2 className="size-8 animate-spin text-[var(--accent-warm)]" />
          <span className="sr-only">Загружаем следующую карточку</span>
        </div>
      )}
    </article>
  );
};
