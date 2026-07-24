import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { CurrentRelease } from "../../constants/currentRelease";
import { formatReleaseDate } from "../../utils/releasePresentation";

type ReleaseNotesModalProps = {
  release: CurrentRelease;
  onClose: () => void;
};

const RELEASE_NOTES_TITLE_ID = "release-notes-title";
const FOCUSABLE_ELEMENT_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({
  release,
  onClose,
}) => {
  const modalRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const modal = modalRef.current;
      if (!modal) {
        return;
      }

      const focusableElements = Array.from(
        modal.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENT_SELECTOR),
      ).filter(
        (element) =>
          element.tabIndex >= 0 &&
          element.getAttribute("aria-hidden") !== "true",
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        modal.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      const focusIsOutsideModal = !modal.contains(activeElement);

      if (
        event.shiftKey &&
        (activeElement === firstElement || focusIsOutsideModal)
      ) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === lastElement || focusIsOutsideModal)
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/60 px-4 py-[calc(env(safe-area-inset-top)+16px)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={RELEASE_NOTES_TITLE_ID}
    >
      <section
        ref={modalRef}
        tabIndex={-1}
        className="glass-card glass-modal flex max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-32px)] w-full max-w-[360px] flex-col overflow-hidden rounded-[24px] p-4 shadow-soft"
      >
        <div className="flex shrink-0 items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2
              id={RELEASE_NOTES_TITLE_ID}
              className="font-heading text-lg font-semibold leading-6 text-[var(--text-primary)]"
            >
              Что нового
            </h2>
            <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
              Версия {release.version}
            </p>
            <p className="text-xs leading-4 text-[var(--text-muted)]">
              {formatReleaseDate(release.releasedAt)}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition duration-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
            aria-label="Закрыть"
          >
            <X size={20} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 min-h-0 overflow-y-auto overscroll-contain pr-1">
          <ul className="space-y-3 pl-5 text-sm leading-5 text-[var(--text-primary)]">
            {release.items.map((item) => (
              <li key={item} className="list-disc marker:text-[var(--primary)]">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
};
