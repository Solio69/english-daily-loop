import { CircleCheckBig, LoaderCircle, TriangleAlert } from "lucide-react";
import React from "react";

type VocabularyApproveAllActionProps = {
  count: number;
  isApproving: boolean;
  isDisabled: boolean;
  onApproveAll: () => void;
};

type RussianPluralForms = {
  one: string;
  few: string;
  many: string;
};

const getRussianPlural = (
  count: number,
  { one, few, many }: RussianPluralForms,
) => {
  const value = Math.abs(count);
  const lastTwoDigits = value % 100;
  const lastDigit = value % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return many;
  if (lastDigit === 1) return one;
  if (lastDigit >= 2 && lastDigit <= 4) return few;
  return many;
};

const aiCardForms: RussianPluralForms = {
  one: "AI-карточку",
  few: "AI-карточки",
  many: "AI-карточек",
};

export const VocabularyApproveAllAction: React.FC<
  VocabularyApproveAllActionProps
> = ({ count, isApproving, isDisabled, onApproveAll }) => (
  <div className="glass-control flex min-h-[88px] w-full items-center gap-2 rounded-[18px] border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] p-2 shadow-warm-glow">
    <div className="flex min-w-0 flex-1 items-start gap-2.5">
      <TriangleAlert
        className="mt-0.5 size-[18px] shrink-0 text-[var(--accent-warm)]"
        strokeWidth={2.3}
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-5 text-[var(--accent-warm)]">
          Подтвердить все {count} {getRussianPlural(count, aiCardForms)}
        </p>
        <p className="mt-0.5 line-clamp-3 text-xs leading-4 text-[var(--text-secondary)]">
          AI может ошибаться. Проверь карточки перед добавлением.
        </p>
      </div>
    </div>
    <button
      type="button"
      onClick={onApproveAll}
      disabled={isDisabled}
      aria-label="Подтвердить все AI-карточки"
      className="inline-flex h-11 w-[8.25rem] shrink-0 items-center justify-center gap-2 rounded-[15px] bg-[var(--accent-coral)] px-3 font-heading text-xs font-semibold text-white shadow-coral-glow transition duration-200 hover:brightness-105 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] min-[390px]:w-[9rem] min-[390px]:text-sm"
    >
      {isApproving ? (
        <LoaderCircle className="size-4 shrink-0 animate-spin" />
      ) : (
        <CircleCheckBig className="size-4 shrink-0" />
      )}
      <span>Подтвердить</span>
    </button>
  </div>
);
