import { BookText } from "lucide-react";
import React from "react";
import { Button } from "../Button";
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
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-green-50 text-green-600 dark:bg-orange-900/20 dark:text-orange-300 flex items-center justify-center">
          <BookText size={22} />
        </div>
        <div className="min-w-0">
          <h2 className="font-bold text-gray-900 dark:text-white">Словарь</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {state.totalCount === 0
              ? "Добавленные из текстов слова будут появляться здесь."
              : `Всего слов: ${state.totalCount}. На подтверждении: ${state.needsApprovalCount}. В словаре: ${state.readyCount}.`}
          </p>
        </div>
      </div>

      {hasWork ? (
        <div className="space-y-3">
          {state.pendingCount > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
              {state.pendingCount} слов ждут подготовки карточек.
            </div>
          )}
          {state.needsApprovalCount > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-orange-900/40 dark:bg-orange-900/20 dark:text-orange-200">
              {state.needsApprovalCount} карточек ждут подтверждения.
            </div>
          )}
          {state.pendingCount > 0 && (
            <Button
              onClick={onPrepareCards}
              disabled={isPreparingCards}
              className="w-full dark:bg-orange-500 dark:hover:bg-orange-600"
            >
              {isPreparingCards
                ? "Готовим карточки..."
                : "Подготовить карточки"}
            </Button>
          )}
        </div>
      ) : state.totalCount > 0 ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300">
          Все добавленные слова уже подготовлены.
        </div>
      ) : null}
    </div>
  );
};
