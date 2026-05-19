import { ChevronLeft } from "lucide-react";
import React from "react";

type ScreenHeaderProps = {
  title: string;
  onBack: () => void;
  disabled?: boolean;
  className?: string;
};

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  onBack,
  disabled = false,
  className,
}) => (
  <header className={`flex items-center gap-3 ${className ?? ""}`}>
    <button
      type="button"
      onClick={onBack}
      className="glass-control grid size-9 shrink-0 place-items-center rounded-full text-[var(--primary)] transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
      disabled={disabled}
      aria-label="Назад"
    >
      <ChevronLeft size={20} />
    </button>
    <h1 className="font-heading text-base font-semibold uppercase tracking-[0.11em] text-[var(--primary)]">
      {title}
    </h1>
  </header>
);
