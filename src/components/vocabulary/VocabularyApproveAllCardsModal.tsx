import { CircleCheckBig, Info, LoaderCircle } from "lucide-react";
import React from "react";
import { Button } from "../Button";

type VocabularyApproveAllCardsModalProps = {
  count: number;
  isApproving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
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
  one: "AI-карточка",
  few: "AI-карточки",
  many: "AI-карточек",
};

export const VocabularyApproveAllCardsModal: React.FC<
  VocabularyApproveAllCardsModalProps
> = ({ count, isApproving, onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4 backdrop-blur-sm">
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="vocabulary-approve-all-cards-title"
      className="glass-card w-full max-w-[430px] rounded-[24px] border-[#b8cbe6] p-4 shadow-[0_18px_48px_rgba(80,103,143,0.18),inset_0_1px_0_rgba(255,255,255,0.78)] [background:linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,255,255,0.68)),rgba(255,255,255,0.82)] dark:border-[var(--border)] dark:shadow-primary-glow dark:[background:linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02)),var(--surface)] min-[480px]:max-w-[390px]"
    >
      <div className="flex items-start gap-3">
        <div className="glass-control grid size-12 shrink-0 place-items-center rounded-full border-[#f7c56b] bg-white/70 text-[var(--accent-warm)] shadow-[0_8px_30px_rgba(245,158,11,0.18),inset_0_1px_0_rgba(255,255,255,0.74)] dark:border-[var(--accent-warm)] dark:bg-[var(--accent-warm-soft)] dark:shadow-warm-glow">
          <CircleCheckBig size={23} strokeWidth={2.3} />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            id="vocabulary-approve-all-cards-title"
            className="font-heading text-base font-semibold leading-6 text-[var(--accent-warm)]"
          >
            Подтвердить все?
          </h2>
          <p className="mt-1 text-sm font-semibold leading-5 text-[var(--text-secondary)]">
            {count} {getRussianPlural(count, aiCardForms)}
          </p>
        </div>
      </div>

      <div className="glass-control mt-4 rounded-[18px] p-3">
        <div className="flex items-start gap-3">
          <div className="glass-control grid size-10 shrink-0 place-items-center rounded-full text-[var(--primary)]">
            <Info size={19} />
          </div>
          <div className="min-w-0">
            <h3 className="font-heading text-sm font-semibold text-[var(--primary)]">
              Перед подтверждением
            </h3>
            <p className="mt-1 text-xs leading-4 text-[var(--text-secondary)]">
              AI может ошибаться. Лучше проверить сложные слова перед
              добавлением.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isApproving}
          className="min-h-12 rounded-[18px] border-[#b8cbe6] bg-white/70 px-3 text-sm shadow-none dark:border-[var(--border)] dark:bg-[var(--surface)]"
        >
          Отменить
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={isApproving}
          className="min-h-12 rounded-[18px] px-3 text-sm"
        >
          {isApproving ? (
            <LoaderCircle className="size-4 shrink-0 animate-spin" />
          ) : (
            <CircleCheckBig className="size-4 shrink-0" />
          )}
          Подтвердить
        </Button>
      </div>
    </section>
  </div>
);
