import React from "react";
import { InlineStatusCard } from "../InlineStatusCard";
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
    error,
    prepareError,
    setExpandedWordId,
    prepareCards,
    approveCard,
  } = useVocabularyMaterials(isActive);

  return (
    <section className="space-y-3">
      {isLoading && (
        <LoadingState message="Загружаем словарь..." />
      )}

      {error && (
        <InlineStatusCard
          variant="error"
          title={error.title}
          description={error.message}
        />
      )}

      {!isLoading && vocabularyState && vocabularyWords && (
        <>
          <VocabularySummaryCard
            state={vocabularyState}
            isPreparingCards={isPreparingCards}
            prepareError={prepareError}
            onPrepareCards={prepareCards}
          />

          {vocabularyWords.needsApproval.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-heading text-sm font-semibold text-[var(--text-secondary)]">
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
              <h2 className="font-heading text-sm font-semibold text-[var(--text-secondary)]">
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
