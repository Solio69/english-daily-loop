import { BookOpen, Box } from "lucide-react";
import React from "react";
import { VocabularyWordCard } from "../../types/vocabulary";
import { getPartOfSpeechLabel } from "../../utils/vocabularyLabels";

type VocabularyWordDetailsProps = {
  word: VocabularyWordCard;
};

export const VocabularyWordDetails: React.FC<VocabularyWordDetailsProps> = ({
  word,
}) => {
  const formsTitle = word.isRegularVerb
    ? "Правильный глагол"
    : "Неправильный глагол";

  return (
    <>
      <div className="grid grid-cols-1 gap-2.5">
        <section className="glass-control rounded-[16px] p-2.5">
          <div className="flex items-center gap-3">
            <div className="glass-control grid size-10 shrink-0 place-items-center rounded-full text-[var(--primary)]">
              <BookOpen size={20} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[var(--text-muted)]">
                Часть речи
              </p>
              <p className="mt-1 break-words font-heading text-[14px] font-semibold leading-5 text-[var(--text-primary)] min-[390px]:text-[15px]">
                {getPartOfSpeechLabel(word.partOfSpeech)}
              </p>
            </div>
          </div>
        </section>
      </div>

      {word.isVerb && word.verbForms && (
        <section className="glass-control rounded-[16px] border border-[var(--border)] p-3">
          <div className="mb-3 flex items-center gap-2 text-[var(--text-secondary)]">
            <Box size={20} strokeWidth={2.2} className="text-[var(--primary)]" />
            <p className="font-heading text-[15px] font-semibold">
              {formsTitle}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[14px] font-semibold text-[var(--primary)] min-[390px]:text-[15px]">
            <span className="glass-control rounded-[14px] px-2.5 py-2.5 text-center">
              {word.verbForms.base}
            </span>
            <span className="glass-control rounded-[14px] px-2.5 py-2.5 text-center">
              {word.verbForms.past}
            </span>
            <span className="glass-control rounded-[14px] px-2.5 py-2.5 text-center">
              {word.verbForms.pastParticiple}
            </span>
          </div>
        </section>
      )}
    </>
  );
};
