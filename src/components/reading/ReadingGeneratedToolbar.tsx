import { Sparkles } from "lucide-react";
import React from "react";
import { Button } from "../Button";
import { ReadingInfoChips } from "./ReadingInfoChips";

type ReadingGeneratedToolbarProps = {
  userLevel?: string | null;
  remainingAttempts: number;
  dailyLimit: number;
  readingMinutes?: number | null;
  buttonLabel: string;
  disabled: boolean;
  onGenerate: () => void;
};

export const ReadingGeneratedToolbar: React.FC<ReadingGeneratedToolbarProps> = ({
  userLevel,
  remainingAttempts,
  dailyLimit,
  readingMinutes,
  buttonLabel,
  disabled,
  onGenerate,
}) => (
  <section className="glass-card rounded-[20px] p-3">
    <ReadingInfoChips
      userLevel={userLevel}
      remainingAttempts={remainingAttempts}
      dailyLimit={dailyLimit}
      readingMinutes={readingMinutes}
    />

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
