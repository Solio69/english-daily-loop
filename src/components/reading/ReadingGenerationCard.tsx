import { BookOpen, Sparkles } from "lucide-react";
import React from "react";
import { Button } from "../Button";
import { ReadingInfoChips } from "./ReadingInfoChips";

type ReadingGenerationCardProps = {
  userLevel?: string | null;
  remainingAttempts: number;
  dailyLimit: number;
  readingMinutes?: number | null;
  buttonLabel: string;
  disabled: boolean;
  onGenerate: () => void;
};

export const ReadingGenerationCard: React.FC<ReadingGenerationCardProps> = ({
  userLevel,
  remainingAttempts,
  dailyLimit,
  readingMinutes,
  buttonLabel,
  disabled,
  onGenerate,
}) => (
  <section className="glass-card rounded-[20px] p-3">
    <div className="flex items-start gap-3">
      <div className="glass-control grid size-14 shrink-0 place-items-center rounded-full text-[var(--primary)] min-[390px]:size-16">
        <BookOpen className="size-7" />
      </div>
      <p className="font-heading text-[18px] leading-7 text-[var(--text-primary)] min-[390px]:leading-8">
        Сгенерируй текст для чтения и начни сегодняшний урок.
      </p>
    </div>

    <div className="mt-4">
      <ReadingInfoChips
        userLevel={userLevel}
        remainingAttempts={remainingAttempts}
        dailyLimit={dailyLimit}
        readingMinutes={readingMinutes}
      />
    </div>

    <Button
      type="button"
      onClick={onGenerate}
      disabled={disabled}
      className="mt-3 w-full"
    >
      <Sparkles size={17} />
      {buttonLabel}
    </Button>
  </section>
);
