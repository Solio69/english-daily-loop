import React from "react";
import { InlineStatusCard } from "../InlineStatusCard";
import { LoadingState } from "../LoadingState";
import { useVocabularyMaterials } from "../../hooks/useVocabularyMaterials";
import { VocabularyApproveAllAction } from "./VocabularyApproveAllAction";
import { VocabularyApproveAllCardsModal } from "./VocabularyApproveAllCardsModal";
import { VocabularySummaryCard } from "./VocabularySummaryCard";
import { VocabularyWordCard } from "./VocabularyWordCard";

type VocabularyTabProps = {
  isActive: boolean;
};

export const VocabularyTab: React.FC<VocabularyTabProps> = ({ isActive }) => {
  const [isApproveAllModalOpen, setIsApproveAllModalOpen] =
    React.useState(false);
  const {
    vocabularyState,
    vocabularyWords,
    isLoading,
    isPreparingCards,
    approvingWordId,
    isApprovingAllCards,
    expandedWordId,
    error,
    prepareError,
    approveAllError,
    setExpandedWordId,
    prepareCards,
    approveCard,
    approveAllCards,
  } = useVocabularyMaterials(isActive);

  const needsApprovalCount = vocabularyWords?.needsApproval.length ?? 0;

  const handleConfirmApproveAll = async () => {
    setIsApproveAllModalOpen(false);
    await approveAllCards();
  };

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
              <VocabularyApproveAllAction
                count={needsApprovalCount}
                isApproving={isApprovingAllCards}
                isDisabled={isApprovingAllCards || Boolean(approvingWordId)}
                onApproveAll={() => setIsApproveAllModalOpen(true)}
              />
              {approveAllError ? (
                <InlineStatusCard
                  variant="error"
                  title={approveAllError.title}
                  description={approveAllError.message}
                />
              ) : null}
              {vocabularyWords.needsApproval.map((word) => (
                <VocabularyWordCard
                  key={word.id}
                  word={word}
                  mode="approval"
                  isExpanded={expandedWordId === word.id}
                  isApproving={
                    isApprovingAllCards || approvingWordId === word.id
                  }
                  onToggle={() => {
                    if (isApprovingAllCards) return;
                    setExpandedWordId(
                      expandedWordId === word.id ? null : word.id,
                    );
                  }}
                  onApprove={() => approveCard(word.id)}
                  isToggleDisabled={isApprovingAllCards}
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

      {isApproveAllModalOpen ? (
        <VocabularyApproveAllCardsModal
          count={needsApprovalCount}
          isApproving={isApprovingAllCards}
          onCancel={() => setIsApproveAllModalOpen(false)}
          onConfirm={handleConfirmApproveAll}
        />
      ) : null}
    </section>
  );
};
