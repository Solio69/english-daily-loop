import React, { useState } from "react";
import { Bug, SendHorizontal, X } from "lucide-react";
import { submitSupportReport } from "../../services/supportService";
import type { AppUser } from "../../types/user";

type SupportReportCardProps = {
  disabled?: boolean;
  appUser: AppUser | null;
  currentScreen: string;
};

export const SupportReportCard: React.FC<SupportReportCardProps> = ({
  disabled = false,
  appUser,
  currentScreen,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const openDialog = () => {
    setMessage(null);
    setReportId(null);
    setErrorMessage(null);
    setIsOpen(true);
  };

  const closeDialog = () => {
    if (isSubmitting) return;
    setIsOpen(false);
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    const trimmedComment = comment.trim();
    if (!trimmedComment) {
      setErrorMessage("Опиши, что пошло не так.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await submitSupportReport({
        comment: trimmedComment,
        currentScreen,
        appUser,
      });
      setComment("");
      setReportId(result.reportId);
      setMessage("Отчет отправлен. Спасибо!");
      setIsOpen(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось отправить отчет.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section className="glass-card rounded-[18px] p-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-[var(--accent-warm-soft)] text-[var(--accent-warm)]">
            <Bug size={18} strokeWidth={2.2} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-sm font-semibold leading-5 text-[var(--text-primary)]">
              Отчет об ошибке
            </h2>
            <p className="mt-0.5 text-xs leading-4 text-[var(--text-secondary)]">
              Приложи описание и последние события
            </p>
          </div>
          <button
            type="button"
            onClick={openDialog}
            disabled={disabled}
            className="inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-[14px] border border-[var(--accent-warm)] px-2.5 font-heading text-xs font-semibold text-[var(--accent-warm)] transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-warm)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
          >
            <SendHorizontal size={14} strokeWidth={2.2} aria-hidden="true" />
            Отправить
          </button>
        </div>
        {message ? (
          <div className="mt-2 space-y-1">
            <p className="text-sm font-medium text-[var(--primary)]">
              {message}
            </p>
            {reportId ? (
              <p className="break-all font-mono text-[11px] leading-4 text-[var(--text-muted)]">
                ID отчета: {reportId}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-report-title"
        >
          <section className="glass-card glass-modal w-full max-w-[360px] rounded-[24px] p-4 shadow-soft">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--accent-warm-soft)] text-[var(--accent-warm)]">
                <Bug size={20} strokeWidth={2.2} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2
                  id="support-report-title"
                  className="font-heading text-lg font-semibold leading-6 text-[var(--text-primary)]"
                >
                  Отчет об ошибке
                </h2>
                <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                  Последние события будут приложены
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                disabled={isSubmitting}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition duration-200 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                aria-label="Закрыть"
              >
                <X size={20} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>

            <textarea
              value={comment}
              onChange={(event) => {
                setComment(event.target.value);
                setErrorMessage(null);
              }}
              disabled={isSubmitting}
              maxLength={1000}
              placeholder="Опиши, что пошло не так"
              className="mt-4 min-h-28 w-full resize-none rounded-[18px] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-3 text-sm leading-5 text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] disabled:opacity-60"
            />

            <p className="mt-2 text-xs leading-4 text-[var(--text-muted)]">
              Отправим технический отчет без токенов и полного текста.
            </p>

            {errorMessage ? (
              <p className="mt-3 whitespace-pre-line text-sm font-medium text-[var(--accent-coral)]">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[22px] bg-[var(--accent-coral)] px-5 py-3 font-heading text-sm font-semibold text-white shadow-coral-glow transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
            >
              <SendHorizontal size={17} strokeWidth={2.2} aria-hidden="true" />
              {isSubmitting ? "Отправляем..." : "Отправить отчет"}
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
};
