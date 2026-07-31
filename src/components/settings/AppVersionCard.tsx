import { ChevronRight, Info } from "lucide-react";
import { forwardRef } from "react";
import { releaseMetadata } from "../../config/releaseMetadata";

type AppVersionCardProps = {
  disabled?: boolean;
  onOpen: () => void;
};

export const AppVersionCard = forwardRef<
  HTMLButtonElement,
  AppVersionCardProps
>(({ disabled = false, onOpen }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onOpen}
    disabled={disabled}
    aria-label={`Открыть описание версии ${releaseMetadata.appVersion}`}
    className="glass-card flex w-full items-center gap-2.5 rounded-[18px] p-2.5 text-left transition duration-200 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-[var(--primary-soft)] text-[var(--primary)]">
      <Info size={18} strokeWidth={2.2} aria-hidden="true" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block font-heading text-sm font-semibold leading-5 text-[var(--text-primary)]">
        Версия приложения
      </span>
      <span className="mt-0.5 block text-xs leading-4 text-[var(--text-secondary)]">
        {releaseMetadata.appVersion}
      </span>
    </span>
    <span className="inline-flex shrink-0 items-center gap-1 font-heading text-xs font-semibold text-[var(--accent-warm)]">
      Что нового
      <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
    </span>
  </button>
));

AppVersionCard.displayName = "AppVersionCard";
