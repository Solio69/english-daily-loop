import React from "react";
import { LoadingState } from "../LoadingState";
import { useVocabularyMaterials } from "../../hooks/useVocabularyMaterials";
import { VocabularySummaryCard } from "./VocabularySummaryCard";
import { VocabularyWordCard } from "./VocabularyWordCard";

type VocabularyTabProps = {
  isActive: boolean;
};

export const VocabularyTab: React.FC<VocabularyTabProps> = ({ isActive }) => {
  const {
    vocabularyState,
    vocabularyWords,
    isLoading,
    isPreparingCards,
    approvingWordId,
    expandedWordId,
    errorText,
    setExpandedWordId,
    prepareCards,
    approveCard,
  } = useVocabularyMaterials(isActive);

  return (
    <section className="space-y-3">
      {isLoading && (
        <LoadingState message="Загружаем словарь..." />
      )}

      {errorText && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {errorText}
        </div>
      )}

      {!isLoading && vocabularyState && vocabularyWords && (
        <>
          <VocabularySummaryCard
            state={vocabularyState}
            isPreparingCards={isPreparingCards}
            onPrepareCards={prepareCards}
          />

          {vocabularyWords.needsApproval.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Требуют подтверждения
              </h2>
              {vocabularyWords.needsApproval.map((word) => (
                <VocabularyWordCard
                  key={word.id}
                  word={word}
                  mode="approval"
                  isExpanded={expandedWordId === word.id}
                  isApproving={approvingWordId === word.id}
                  onToggle={() =>
                    setExpandedWordId(expandedWordId === word.id ? null : word.id)
                  }
                  onApprove={() => approveCard(word.id)}
                />
              ))}
            </section>
          )}

          {vocabularyWords.ready.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Словарь
              </h2>
              {vocabularyWords.ready.map((word) => (
                <VocabularyWordCard
                  key={word.id}
                  word={word}
                  mode="ready"
                  isExpanded={expandedWordId === word.id}
                  isApproving={false}
                  onToggle={() =>
                    setExpandedWordId(expandedWordId === word.id ? null : word.id)
                  }
                  onApprove={() => undefined}
                />
              ))}
            </section>
          )}
        </>
      )}
    </section>
  );
};
