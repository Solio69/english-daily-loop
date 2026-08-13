import React, { useMemo } from "react";
import { ReadingText } from "../../types/reading";
import type { ReadingWordAction } from "../../utils/readingWordAction";
import { parseReadingText } from "../../utils/readingText";
import { Button } from "../Button";

type WordFeedback = {
  tone: "success" | "error";
  message: string;
} | null;

type ReadingTextCardProps = {
  text: ReadingText;
  selectedWord: ReadingWordAction | null;
  savedWords: Set<number>;
  mutatingWordIndex: number | null;
  wordFeedback: WordFeedback;
  onWordClick: (word: string, index: number) => void;
  onAddWord: () => void;
  onDeleteWord: () => void;
  onCancelWord: () => void;
  onParagraphRef?: (
    paragraphIndex: number,
    element: HTMLParagraphElement | null,
  ) => void;
};

const getModelLabel = (model?: string): string | null => {
  if (!model) return null;
  const modelName = model.split("/").pop()?.replace(":free", "");
  return modelName || model;
};

export const ReadingTextCard: React.FC<ReadingTextCardProps> = ({
  text,
  selectedWord,
  savedWords,
  mutatingWordIndex,
  wordFeedback,
  onWordClick,
  onAddWord,
  onDeleteWord,
  onCancelWord,
  onParagraphRef,
}) => {
  const paragraphs = useMemo(() => parseReadingText(text.body), [text.body]);

  return (
    <section className="glass-card space-y-4 rounded-[20px] p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading text-[18px] font-semibold leading-6 text-[var(--text-primary)]">
          {text.title}
        </h3>
        {text.source && (
          <span
            className={`glass-control shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${
              text.source === "ai"
                ? "text-[var(--primary)]"
                : "text-[var(--accent-warm)]"
            }`}
            title={
              text.source === "ai"
                ? text.generation?.model
                  ? `AI: ${text.generation.model}`
                  : "AI"
                : "DB fallback"
            }
          >
            {text.source === "ai"
              ? `AI${getModelLabel(text.generation?.model) ? ` · ${getModelLabel(text.generation?.model)}` : ""}`
              : "DB"}
          </span>
        )}
      </div>

      <div className="space-y-3 text-[19px] leading-8 text-[var(--text-primary)]">
        {paragraphs.map((paragraph, paragraphIndex) => (
          <p
            key={paragraphIndex}
            ref={(element) => {
              onParagraphRef?.(paragraphIndex, element);
            }}
            data-reading-paragraph-index={paragraphIndex}
          >
            {paragraph.parts.map((part, partIndex) => {
              const wordIndex = part.wordIndex;
              const normalizedWord = part.normalizedWord;

              if (wordIndex === null) {
                return <React.Fragment key={partIndex}>{part.value}</React.Fragment>;
              }

              const isSelectable = Boolean(normalizedWord);
              const isSelected = selectedWord?.index === wordIndex;
              const isSaved = savedWords.has(wordIndex);
              const isMutating = mutatingWordIndex === wordIndex;
              const isRemoveAction =
                isSelected && selectedWord?.mode === "remove";

              return (
                <React.Fragment key={partIndex}>
                  <span
                    onClick={() =>
                      isSelectable &&
                      onWordClick(normalizedWord, wordIndex)
                    }
                    className={`rounded px-0.5 transition-colors ${
                      isSelectable ? "cursor-pointer" : ""
                    } ${
                      isSelected
                        ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                        : isSaved
                          ? "bg-[var(--accent-warm-soft)] text-[var(--accent-warm)]"
                          : isMutating
                            ? "bg-[var(--accent-warm-soft)]"
                            : isSelectable
                              ? "hover:bg-[var(--primary-soft)]"
                              : ""
                    }`}
                  >
                    {part.value}
                  </span>
                  {isSelected && (
                    <span className="glass-card my-3 block rounded-[18px] p-3 text-base leading-normal">
                      <span className="block text-center text-sm font-semibold text-[var(--text-primary)]">
                        {isRemoveAction
                          ? "Удалить слово из очереди на генерацию карточки?"
                          : "Добавить в словарь?"}
                      </span>
                      {wordFeedback && (
                        <span
                          className={`mt-2 block rounded-lg border px-2 py-1.5 text-xs leading-4 ${
                            wordFeedback.tone === "success"
                              ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                              : "border-[var(--accent-coral)] bg-[rgba(255,107,97,0.12)] text-[var(--accent-coral)]"
                          }`}
                        >
                          {wordFeedback.message}
                        </span>
                      )}
                      <span className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                          onClick={
                            isRemoveAction ? onDeleteWord : onAddWord
                          }
                          disabled={mutatingWordIndex !== null}
                          className="w-full min-w-0 whitespace-nowrap px-2 py-2 text-[13px]"
                        >
                          {isMutating
                            ? isRemoveAction
                              ? "Удаляем..."
                              : "Сохраняем..."
                            : isRemoveAction
                              ? "Удалить"
                              : "Добавить"}
                        </Button>
                        <Button
                          onClick={onCancelWord}
                          variant="outline"
                          disabled={mutatingWordIndex !== null}
                          className="w-full min-w-0 whitespace-nowrap px-2 py-2 text-[13px]"
                        >
                          Отмена
                        </Button>
                      </span>
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </p>
        ))}
      </div>
    </section>
  );
};
