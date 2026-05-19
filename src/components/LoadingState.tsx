import { Loader2 } from "lucide-react";
import React from "react";

type LoadingStateProps = {
  message: string;
  fullScreen?: boolean;
  compact?: boolean;
  className?: string;
};

export const LoadingState: React.FC<LoadingStateProps> = ({
  message,
  fullScreen = false,
  compact = false,
  className,
}) => {
  const wrapperClass = fullScreen
    ? "flex min-h-screen items-center justify-center bg-[var(--background)] transition-colors"
    : compact
      ? "flex items-center justify-center"
      : "flex min-h-[320px] items-center justify-center";

  return (
    <div className={`${wrapperClass} ${className ?? ""}`}>
      <div className="glass-control inline-flex items-center justify-center gap-2 rounded-[18px] px-5 py-3 font-heading text-sm font-medium text-[var(--text-secondary)]">
        <Loader2 className="size-4 animate-spin text-[var(--primary)]" />
        <span>{message}</span>
      </div>
    </div>
  );
};
