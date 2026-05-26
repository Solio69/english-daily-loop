import { CircleCheckBig, LoaderCircle, X } from "lucide-react";
import React from "react";
import { Button } from "../Button";

type VocabularyApproveAllCardsModalProps = {
  count: number;
  isApproving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export const VocabularyApproveAllCardsModal: React.FC<
  VocabularyApproveAllCardsModalProps
> = ({ count, isApproving, onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4 backdrop-blur-sm">
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="vocabulary-approve-all-cards-title"
      className="glass-card w-full max-w-[430px] rounded-[24px] p-4 shadow-primary-glow min-[480px]:max-w-[390px]"
    >
      <div className="flex items-start gap-3">
        <div className="glass-control grid size-12 shrink-0 place-items-center rounded-full text-[var(--accent-warm)]">
          <CircleCheckBig size={22} strokeWidth={2.3} />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            id="vocabulary-approve-all-cards-title"
            className="font-heading text-base font-semibold leading-6 text-[var(--text-primary)]"
          >
            Подтвердить все карточки?
          </h2>
          <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
            {count} AI-карточек попадут в словарь без ручной проверки. Если
            хочешь проверить перевод и примеры, лучше открыть карточки по одной.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={isApproving}
          aria-label="Закрыть окно подтверждения"
          className="glass-control grid size-9 shrink-0 place-items-center rounded-full text-[var(--text-muted)] transition hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isApproving}
          className="min-h-12 rounded-[18px] px-3 text-sm"
        >
          Проверить вручную
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
