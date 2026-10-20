import React from 'react'
import { InlineStatusCard } from '../InlineStatusCard'
import { LoadingState } from '../LoadingState'
import { useVocabularyMaterials } from '../../hooks/useVocabularyMaterials'
import { SHOW_VOCABULARY_CARD_APPROVAL_FLOW } from '../../constants/vocabularyFeatures'
import { VocabularyApproveAllAction } from './VocabularyApproveAllAction'
import { VocabularyApproveAllCardsModal } from './VocabularyApproveAllCardsModal'
import { VocabularyReadyWords } from './VocabularyReadyWords'
import { VocabularySummaryCard } from './VocabularySummaryCard'
import { VocabularyWordCard } from './VocabularyWordCard'

type VocabularyTabProps = {
  isActive: boolean
  onVocabularyReviewStateChange?: () => Promise<unknown>
}

export const VocabularyTab: React.FC<VocabularyTabProps> = ({
  isActive,
  onVocabularyReviewStateChange,
}) => {
  const [isApproveAllModalOpen, setIsApproveAllModalOpen] =
    React.useState(false)
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
  } = useVocabularyMaterials(isActive, onVocabularyReviewStateChange)

  const needsApprovalCount = vocabularyWords?.needsApproval.length ?? 0
  const isApprovalFlowVisible = SHOW_VOCABULARY_CARD_APPROVAL_FLOW

  const handleConfirmApproveAll = async () => {
    setIsApproveAllModalOpen(false)
    await approveAllCards()
  }

  return (
    <section className="space-y-3">
      {isLoading && <LoadingState message="Загружаем словарь..." />}

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

          {isApprovalFlowVisible && vocabularyWords.needsApproval.length > 0 ? (
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
                    if (isApprovingAllCards) return
                    setExpandedWordId(
                      expandedWordId === word.id ? null : word.id,
                    )
                  }}
                  onApprove={() => approveCard(word.id)}
                  isToggleDisabled={isApprovingAllCards}
                />
              ))}
            </section>
          ) : null}

          <VocabularyReadyWords
            words={vocabularyWords.ready}
            expandedWordId={expandedWordId}
            setExpandedWordId={setExpandedWordId}
          />
        </>
      )}

      {isApprovalFlowVisible && isApproveAllModalOpen ? (
        <VocabularyApproveAllCardsModal
          count={needsApprovalCount}
          isApproving={isApprovingAllCards}
          onCancel={() => setIsApproveAllModalOpen(false)}
          onConfirm={handleConfirmApproveAll}
        />
      ) : null}
    </section>
  )
}
