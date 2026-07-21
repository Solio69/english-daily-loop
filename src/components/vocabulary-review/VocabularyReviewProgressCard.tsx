import { Flame, Target } from "lucide-react";
import React from "react";
import { getRussianPlural } from "../../utils/russianPlural";

type VocabularyReviewProgressCardProps = {
  totalCount: number;
  reviewedCount: number;
  remainingCount: number;
  isCompleted: boolean;
};

const WORD_FORMS = ["слово", "слова", "слов"] as const;

const getProgressPercent = (reviewedCount: number, totalCount: number) =>
  totalCount > 0
    ? Math.min(100, Math.round((reviewedCount / totalCount) * 100))
    : 0;

export const VocabularyReviewProgressCard: React.FC<
  VocabularyReviewProgressCardProps
> = ({ totalCount, reviewedCount, remainingCount, isCompleted }) => {
  const progressPercent = getProgressPercent(reviewedCount, totalCount);

  return (
    <section className="glass-card rounded-[20px] border-[var(--accent-warm)] p-3 shadow-warm-glow">
      <div className="flex items-center gap-3">
        <div className="glass-control grid size-16 shrink-0 place-items-center rounded-full border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] text-[var(--accent-warm)] shadow-warm-glow">
          <Flame
            size={30}
            strokeWidth={2.2}
            fill={isCompleted ? "currentColor" : "none"}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-semibold leading-6 text-[var(--accent-warm)]">
            Повторение
          </h2>
          {!isCompleted && (
            <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
              Сегодня нужно повторить {totalCount}{" "}
              {getRussianPlural(totalCount, WORD_FORMS)}
            </p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface)]">
              <div
                className="h-full rounded-full bg-[var(--accent-warm)] transition-[width]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="min-w-[52px] text-right font-heading text-sm font-semibold text-[var(--accent-warm)]">
              {reviewedCount} / {totalCount}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 divide-x divide-[var(--border)] rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-2 py-2 backdrop-blur-[24px]">
        <div className="flex items-center justify-center gap-2 px-2">
          <Target size={19} strokeWidth={2.2} className="text-[var(--primary)]" />
          <div>
            <p className="font-heading text-base font-semibold leading-5 text-[var(--text-primary)]">
              {totalCount}
            </p>
            <p className="text-xs leading-4 text-[var(--text-muted)]">Всего</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 px-2">
          <Flame
            size={19}
            strokeWidth={2.2}
            className="text-[var(--accent-warm)]"
          />
          <div>
            <p className="font-heading text-base font-semibold leading-5 text-[var(--text-primary)]">
              {remainingCount}
            </p>
            <p className="text-xs leading-4 text-[var(--text-muted)]">Осталось</p>
          </div>
        </div>
      </div>
    </section>
  );
};
