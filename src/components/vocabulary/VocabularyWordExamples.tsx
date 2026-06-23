import { MessageCircleMore } from "lucide-react";
import React from "react";
import { getHighlightedTextParts } from "../../utils/vocabularyText";

type VocabularyWordExamplesProps = {
  examples: string[];
  highlightTokens: string[];
  highlightTone?: "primary" | "warm";
};

export const VocabularyWordExamples: React.FC<VocabularyWordExamplesProps> = ({
  examples,
  highlightTokens,
  highlightTone = "primary",
}) => (
  <section className="space-y-3">
    <div className="flex items-center gap-2 text-[var(--text-secondary)]">
      <MessageCircleMore
        size={20}
        strokeWidth={2.2}
        className="text-[var(--primary)]"
      />
      <p className="font-heading text-[15px] font-semibold">Примеры</p>
    </div>

    {examples.map((example, exampleIndex) => (
      <div
        key={`${example}-${exampleIndex}`}
        className="glass-control flex items-center gap-3 rounded-[16px] px-3 py-2.5 text-[14px] leading-6 text-[var(--text-secondary)] min-[390px]:text-[15px]"
      >
        <span className="size-2.5 shrink-0 rounded-full bg-[var(--primary)]" />
        <span className="h-5 w-px shrink-0 bg-[var(--border)]" />
        <p className="min-w-0">
          {getHighlightedTextParts(example, highlightTokens).map(
            (part, partIndex) =>
              part.isHighlighted ? (
                <span
                  key={`${part.text}-${partIndex}`}
                  className={`font-semibold ${
                    highlightTone === "warm"
                      ? "text-[var(--accent-warm)]"
                      : "text-[var(--primary)]"
                  }`}
                >
                  {part.text}
                </span>
              ) : (
                <React.Fragment key={`${part.text}-${partIndex}`}>
                  {part.text}
                </React.Fragment>
              ),
          )}
        </p>
      </div>
    ))}
  </section>
);
