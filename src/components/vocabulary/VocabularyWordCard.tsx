import React, { useRef } from "react";
import { useScrollIntoViewOnExpand } from "../../hooks/useScrollIntoViewOnExpand";
import { VocabularyWordCard as VocabularyWordCardType } from "../../types/vocabulary";
import { getVocabularyHighlightTokens } from "../../utils/vocabularyText";
import { VocabularyWordActions } from "./VocabularyWordActions";
import { VocabularyWordDetails } from "./VocabularyWordDetails";
import { VocabularyWordExamples } from "./VocabularyWordExamples";
import { VocabularyWordSummary } from "./VocabularyWordSummary";

type VocabularyWordCardProps = {
  word: VocabularyWordCardType;
  mode: "approval" | "ready";
  isExpanded: boolean;
  isApproving: boolean;
  isToggleDisabled?: boolean;
  onToggle: () => void;
  onApprove: () => void;
};

export const VocabularyWordCard: React.FC<VocabularyWordCardProps> = ({
  word,
  mode,
  isExpanded,
  isApproving,
  isToggleDisabled = false,
  onToggle,
  onApprove,
}) => {
  const articleRef = useRef<HTMLElement | null>(null);
  const statusLabel =
    mode === "approval"
      ? "Требует подтверждения"
      : word.status === "learned"
        ? "Изучено"
        : "Не изучено";
  const isApprovalMode = mode === "approval";
  const highlightTokens = getVocabularyHighlightTokens(word);

  useScrollIntoViewOnExpand(isExpanded, articleRef);

  return (
    <article
      ref={articleRef}
      className="glass-card overflow-hidden rounded-[20px]"
    >
      <VocabularyWordSummary
        word={word}
        mode={mode}
        isExpanded={isExpanded}
        statusLabel={statusLabel}
        isToggleDisabled={isToggleDisabled}
        onToggle={onToggle}
      />

      {isExpanded && (
        <div className="space-y-4 px-4 pb-4">
          <VocabularyWordDetails word={word} />
          <VocabularyWordExamples
            examples={word.examples}
            highlightTokens={highlightTokens}
          />
          <VocabularyWordActions
            isApprovalMode={isApprovalMode}
            isApproving={isApproving}
            onApprove={onApprove}
          />
        </div>
      )}
    </article>
  );
};
