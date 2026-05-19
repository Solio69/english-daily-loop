import { BookOpen, Clock, Sparkles } from "lucide-react";
import React from "react";

type ReadingInfoChipsProps = {
  userLevel?: string | null;
  remainingAttempts: number;
  dailyLimit: number;
  readingMinutes?: number | null;
};

export const ReadingInfoChips: React.FC<ReadingInfoChipsProps> = ({
  userLevel,
  remainingAttempts,
  dailyLimit,
  readingMinutes,
}) => (
  <div className="grid grid-cols-3 gap-2">
    <div className="glass-control flex min-w-0 items-center justify-center gap-1.5 rounded-[16px] px-2 py-2">
      <BookOpen size={15} className="shrink-0 text-[var(--primary)]" />
      <span className="whitespace-nowrap text-[12px] font-semibold text-[var(--primary)]">
        {userLevel ?? "—"}
      </span>
    </div>
    <div className="glass-control flex min-w-0 items-center justify-center gap-1.5 rounded-[16px] px-2 py-2">
      <Sparkles size={15} className="shrink-0 text-[var(--primary)]" />
      <span className="whitespace-nowrap text-[12px] font-semibold text-[var(--primary)]">
        {remainingAttempts}/{dailyLimit}
      </span>
    </div>
    <div className="glass-control flex min-w-0 items-center justify-center gap-1.5 rounded-[16px] px-2 py-2">
      <Clock size={15} className="shrink-0 text-[var(--primary)]" />
      <span className="whitespace-nowrap text-[12px] font-semibold text-[var(--primary)]">
        {readingMinutes ? `${readingMinutes} мин` : "—"}
      </span>
    </div>
  </div>
);
