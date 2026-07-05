import { CircleCheckBig, PencilLine } from "lucide-react";
import React from "react";
import { SHOW_VOCABULARY_CARD_EDIT_ACTION } from "../../constants/vocabularyFeatures";
import { Button } from "../Button";

type VocabularyWordActionsProps = {
  isApprovalMode: boolean;
  isApproving: boolean;
  onApprove: () => void;
};

export const VocabularyWordActions: React.FC<VocabularyWordActionsProps> = ({
  isApprovalMode,
  isApproving,
  onApprove,
}) => {
  const isEditActionVisible = SHOW_VOCABULARY_CARD_EDIT_ACTION;

  if (!isApprovalMode && !isEditActionVisible) {
    return null;
  }

  return (
    <div
      className={
        isApprovalMode && isEditActionVisible
          ? "grid grid-cols-2 gap-2"
          : "grid grid-cols-1"
      }
    >
      {isApprovalMode ? (
        <Button
          onClick={onApprove}
          disabled={isApproving}
          className="w-full min-h-[52px] rounded-[22px] px-4 text-[14px] shadow-coral-glow min-[390px]:text-[15px]"
        >
          <CircleCheckBig size={20} strokeWidth={2.2} className="shrink-0" />
          {isApproving ? "Подтверждаем..." : "Подтвердить"}
        </Button>
      ) : null}
      {isEditActionVisible ? (
        <Button
          disabled
          variant="secondary"
          className="w-full min-h-[52px] rounded-[22px] border-[var(--border-strong)] bg-[var(--surface-strong)] px-4 text-[14px] text-[var(--primary)] shadow-none disabled:cursor-not-allowed disabled:opacity-100 min-[390px]:text-[15px] dark:bg-[var(--surface)]"
        >
          <PencilLine size={20} strokeWidth={2.2} className="shrink-0" />
          Редактировать
        </Button>
      ) : null}
    </div>
  );
};
