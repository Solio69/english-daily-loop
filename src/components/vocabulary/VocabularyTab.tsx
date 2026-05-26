import { CircleCheckBig, LoaderCircle } from "lucide-react";
import React from "react";
import { Button } from "../Button";
import { InlineStatusCard } from "../InlineStatusCard";
import { LoadingState } from "../LoadingState";
import { useVocabularyMaterials } from "../../hooks/useVocabularyMaterials";
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
              <div className="flex items-center justify-between gap-2">
                <h2 className="min-w-0 font-heading text-sm font-semibold text-[var(--text-secondary)]">
                  Требуют подтверждения
                </h2>
                <Button
                  type="button"
                  onClick={() => setIsApproveAllModalOpen(true)}
                  disabled={isApprovingAllCards || Boolean(approvingWordId)}
                  className="min-h-10 shrink-0 rounded-[18px] px-3 py-2 text-xs"
                >
                  {isApprovingAllCards ? (
                    <LoaderCircle className="size-4 shrink-0 animate-spin" />
                  ) : (
                    <CircleCheckBig className="size-4 shrink-0" />
                  )}
                  <span>
                    {isApprovingAllCards
                      ? "Подтверждаем"
                      : `Все · ${needsApprovalCount}`}
                  </span>
                </Button>
              </div>
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
