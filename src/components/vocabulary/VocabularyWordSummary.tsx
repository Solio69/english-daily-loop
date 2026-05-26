import { ChevronDown, ChevronRight } from "lucide-react";
import React from "react";
import { VocabularyWordCard } from "../../types/vocabulary";

type VocabularyWordSummaryProps = {
  word: VocabularyWordCard;
  mode: "approval" | "ready";
  isExpanded: boolean;
  statusLabel: string;
  isToggleDisabled?: boolean;
  onToggle: () => void;
};

export const VocabularyWordSummary: React.FC<VocabularyWordSummaryProps> = ({
  word,
  mode,
  isExpanded,
  statusLabel,
  isToggleDisabled = false,
  onToggle,
}) => {
  const StatusChevron = isExpanded ? ChevronDown : ChevronRight;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isToggleDisabled}
      className="w-full p-4 text-left disabled:cursor-wait"
      aria-expanded={isExpanded}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-[18px] font-semibold leading-6 text-[var(--text-primary)]">
            {word.word}
          </h3>
          <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
            {word.translation}
          </p>
        </div>

        <div
          className={`flex shrink-0 gap-2 ${
            mode === "ready" ? "self-center items-center" : "items-start"
          }`}
        >
          <div
            className={`flex items-end gap-1 ${
              mode === "ready"
                ? "flex-row justify-end"
                : "flex-col justify-center"
            }`}
          >
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-semibold leading-none min-[390px]:text-[11px] ${
                mode === "approval"
                  ? "border border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] text-[var(--accent-warm)]"
                  : word.status === "learned"
                    ? "border border-[var(--border-strong)] bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text-secondary)]"
              }`}
            >
              {statusLabel}
            </span>
            {mode === "approval" ? (
              <span className="rounded-full border border-[var(--border-strong)] bg-[var(--primary-soft)] px-2 py-1 text-[10px] font-semibold leading-none text-[var(--primary)] min-[390px]:text-[11px]">
                AI карточка
              </span>
            ) : null}
          </div>
          <span className="text-[var(--text-muted)]">
            <StatusChevron size={18} strokeWidth={2.3} />
          </span>
        </div>
      </div>
    </button>
  );
};
