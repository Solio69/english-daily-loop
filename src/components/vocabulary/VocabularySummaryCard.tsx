import {
  BookText,
  CircleCheck,
  Info,
  Layers,
  LoaderCircle,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import React from "react";
import { InlineStatusCard } from "../InlineStatusCard";
import { VocabularyState } from "../../types/vocabulary";

type VocabularySummaryCardProps = {
  state: VocabularyState;
  isPreparingCards: boolean;
  prepareError: VocabularySummaryCardError | null;
  onPrepareCards: () => void;
};

type VocabularyStatusCardsProps = {
  pendingCount: number;
  needsApprovalCount: number;
};

type VocabularyStatusCardProps = {
  count: number;
  icon: React.ReactNode;
  actionLabel: string;
  activeDescription: string;
  readyTitle: string;
  readyDescription: string;
};

type VocabularyPrepareSectionProps = {
  pendingCount: number;
  dailyLimit: number;
  remainingAttempts: number;
  isPreparingCards: boolean;
  prepareError: VocabularySummaryCardError | null;
  onPrepareCards: () => void;
};

type VocabularySummaryCardError = {
  title: string;
  message: string;
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

const formatRussianCount = (count: number, forms: RussianPluralForms) =>
  `${count} ${getRussianPlural(count, forms)}`;

const cardAttemptForms: RussianPluralForms = {
  one: "попытка",
  few: "попытки",
  many: "попыток",
};

const wordWithoutCardForms: RussianPluralForms = {
  one: "слово без карточки",
  few: "слова без карточек",
  many: "слов без карточек",
};

const approvalWaitingForms: RussianPluralForms = {
  one: "ждет подтверждения",
  few: "ждут подтверждения",
  many: "ждут подтверждения",
};

export const VocabularySummaryCard: React.FC<VocabularySummaryCardProps> = ({
  state,
  isPreparingCards,
  prepareError,
  onPrepareCards,
}) => {
  return (
    <div className="glass-card space-y-4 rounded-[20px] p-4">
      <div className="flex items-start gap-3">
        <div className="glass-control grid size-12 shrink-0 place-items-center rounded-full text-[var(--primary)]">
          <BookText size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-base font-semibold text-[var(--text-primary)]">
            Словарь
          </h2>
          {state.totalCount === 0 ? (
            <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
              Добавленные из текстов слова будут появляться здесь.
            </p>
          ) : null}
        </div>
      </div>

      {state.totalCount > 0 && (
        <VocabularyStatusCards
          pendingCount={state.pendingCount}
          needsApprovalCount={state.needsApprovalCount}
        />
      )}

      {state.pendingCount > 0 ? (
        <VocabularyPrepareSection
          pendingCount={state.pendingCount}
          dailyLimit={state.cardGeneration.dailyLimit}
          remainingAttempts={state.cardGeneration.remainingAttempts}
          isPreparingCards={isPreparingCards}
          prepareError={prepareError}
          onPrepareCards={onPrepareCards}
        />
      ) : null}
    </div>
  );
};

const VocabularyStatusCards: React.FC<VocabularyStatusCardsProps> = ({
  pendingCount,
  needsApprovalCount,
}) => (
  <div className="grid grid-cols-2 gap-2">
    <VocabularyStatusCard
      count={pendingCount}
      icon={<Layers className="size-4 shrink-0" />}
      actionLabel="добавить"
      activeDescription={getRussianPlural(pendingCount, wordWithoutCardForms)}
      readyTitle="Все готовы"
      readyDescription="слов без карточек нет"
    />
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
  </div>
);

const VocabularyStatusCard: React.FC<VocabularyStatusCardProps> = ({
  count,
  icon,
  actionLabel,
  activeDescription,
  readyTitle,
  readyDescription,
}) => {
  const isEmpty = count === 0;
  const toneClass = isEmpty
    ? "border-[var(--border-strong)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-primary-glow"
    : "border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] text-[var(--accent-warm)]";

  return (
    <div
      className={[
        "flex min-h-[68px] items-center rounded-[15px] border px-3 py-2",
        toneClass,
      ].join(" ")}
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
  );
};

const VocabularyPrepareSection: React.FC<VocabularyPrepareSectionProps> = ({
  pendingCount,
  dailyLimit,
  remainingAttempts,
  isPreparingCards,
  prepareError,
  onPrepareCards,
}) => {
  const isLimitExhausted = remainingAttempts <= 0;

  return (
    <div className="space-y-3">
      <div className="glass-control flex min-h-[84px] w-full items-center gap-2 rounded-[18px] border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] p-2 shadow-warm-glow">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <TriangleAlert
            className="mt-0.5 size-[18px] shrink-0 text-[var(--accent-warm)]"
            strokeWidth={2.3}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-5 text-[var(--accent-warm)]">
              {formatRussianCount(pendingCount, wordWithoutCardForms)}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-[var(--text-secondary)]">
              Подготовим перевод и примеры
            </p>
            <p
              className={`mt-1 text-[12px] font-semibold leading-4 ${
                isLimitExhausted
                  ? "text-[var(--accent-coral)]"
                  : "text-[var(--accent-warm)]"
              }`}
            >
              Осталось: {remainingAttempts}/{dailyLimit}{" "}
              {getRussianPlural(remainingAttempts, cardAttemptForms)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onPrepareCards}
          disabled={isPreparingCards || isLimitExhausted}
          className="inline-flex h-11 w-[7.5rem] shrink-0 items-center justify-center gap-2 rounded-[15px] bg-[var(--accent-coral)] px-3 font-heading text-sm font-semibold text-white shadow-coral-glow transition duration-200 hover:brightness-105 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] min-[390px]:w-[8rem]"
        >
          {isPreparingCards ? (
            <LoaderCircle className="size-4 shrink-0 animate-spin" />
          ) : (
            <Sparkles className="size-4 shrink-0" />
          )}
          {isPreparingCards
            ? "Готовим"
            : isLimitExhausted
              ? "Завтра"
              : "Готовить"}
        </button>
      </div>
      {prepareError ? (
        <InlineStatusCard
          variant="error"
          title={prepareError.title}
          description={prepareError.message}
        />
      ) : null}
      <VocabularyGenerationInfo />
    </div>
  );
};

const VocabularyGenerationInfo: React.FC = () => (
  <div className="glass-control rounded-[18px] p-3">
    <div className="flex items-start gap-3">
      <div className="glass-control grid size-10 shrink-0 place-items-center rounded-full text-[var(--primary)]">
        <Info size={19} />
      </div>
      <div className="min-w-0">
        <h3 className="font-heading text-sm font-semibold text-[var(--primary)]">
          Как это работает
        </h3>
        <ul className="mt-2 space-y-1.5 text-xs leading-4 text-[var(--text-secondary)]">
          <li className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
            <span>AI подготовит карточки партиями.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
            <span>После проверки они попадут в подтверждение.</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
);
