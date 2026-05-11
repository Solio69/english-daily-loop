import React from "react";
import { Button } from "../Button";
import { VocabularyWordCard as VocabularyWordCardType } from "../../types/vocabulary";
import { getPartOfSpeechLabel } from "../../utils/vocabularyLabels";

type VocabularyWordCardProps = {
  word: VocabularyWordCardType;
  mode: "approval" | "ready";
  isExpanded: boolean;
  isApproving: boolean;
  onToggle: () => void;
  onApprove: () => void;
};

export const VocabularyWordCard: React.FC<VocabularyWordCardProps> = ({
  word,
  mode,
  isExpanded,
  isApproving,
  onToggle,
  onApprove,
}) => {
  const statusLabel =
    mode === "approval"
      ? "Требует подтверждения"
      : word.status === "learned"
        ? "Изучено"
        : "Не изучено";

  return (
    <article className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {word.word}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {word.translation}
            </p>
          </div>
          <div className="shrink-0 flex flex-wrap justify-end gap-1">
            <span
              className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                mode === "approval"
                  ? "bg-amber-50 text-amber-700 dark:bg-orange-900/20 dark:text-orange-300"
                  : word.status === "learned"
                    ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200"
              }`}
            >
              {statusLabel}
            </span>
            {mode === "ready" && (
              <span className="rounded-full bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700 dark:bg-orange-900/30 dark:text-orange-300">
                Подтверждено
              </span>
            )}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700 px-3 py-2">
              <span className="block text-[10px] uppercase tracking-wide">
                Часть речи
              </span>
              <span className="font-semibold text-gray-800 dark:text-gray-100">
                {getPartOfSpeechLabel(word.partOfSpeech)}
              </span>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700 px-3 py-2">
              <span className="block text-[10px] uppercase tracking-wide">
                Статус
              </span>
              <span className="font-semibold text-gray-800 dark:text-gray-100">
                {statusLabel}
              </span>
            </div>
          </div>

          {word.isVerb && word.verbForms && (
            <div className="rounded-xl border border-gray-100 dark:border-gray-700 p-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                {word.isRegularVerb ? "Правильный глагол" : "Неправильный глагол"}
              </p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="rounded bg-gray-50 dark:bg-gray-700 px-2 py-1 text-center">
                  {word.verbForms.base}
                </span>
                <span className="rounded bg-gray-50 dark:bg-gray-700 px-2 py-1 text-center">
                  {word.verbForms.past}
                </span>
                <span className="rounded bg-gray-50 dark:bg-gray-700 px-2 py-1 text-center">
                  {word.verbForms.pastParticiple}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              Примеры
            </p>
            {word.examples.map((example, index) => (
              <p
                key={`${word.id}-${index}`}
                className="rounded-lg bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
              >
                {example}
              </p>
            ))}
          </div>

          <div className={mode === "approval" ? "grid grid-cols-2 gap-2" : ""}>
            {mode === "approval" ? (
              <Button
                onClick={onApprove}
                disabled={isApproving}
                className="w-full dark:bg-orange-500 dark:hover:bg-orange-600"
              >
                {isApproving ? "Подтверждаем..." : "Подтвердить"}
              </Button>
            ) : null}
            <Button
              disabled
              variant="outline"
              className="w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              Редактировать
            </Button>
          </div>
        </div>
      )}
    </article>
  );
};
