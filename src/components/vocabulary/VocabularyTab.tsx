import { Loader2 } from "lucide-react";
import React from "react";
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
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400 dark:text-gray-500">
          <Loader2 size={30} className="animate-spin" />
          <p>Загружаем словарь...</p>
        </div>
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
