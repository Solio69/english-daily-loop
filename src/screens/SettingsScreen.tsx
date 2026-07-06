import React, { Suspense, lazy, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "../components/Button";
import { LoadingState } from "../components/LoadingState";
import { ScreenHeader } from "../components/ScreenHeader";
import type {
  DevToolAction,
  DevToolActionOptions,
} from "../services/devToolsService";
import { SaveUserSettingsInput, UserSettings } from "../types/user";
import {
  getTelegramProfileUrl,
  openTelegramLink,
} from "../utils/telegramLinks";

const DevToolsPanel = lazy(() =>
  import("../components/DevToolsPanel").then((module) => ({
    default: module.DevToolsPanel,
  })),
);

type SettingsScreenProps = {
  onBack: () => void;
  onSave: (settings: SaveUserSettingsInput) => Promise<void>;
  initialSettings?: UserSettings | null;
  isSaving?: boolean;
  isFirstSetup?: boolean;
  showDevTools?: boolean;
  runningDevToolAction?: DevToolAction | null;
  onRunDevToolAction?: (
    action: DevToolAction,
    options?: DevToolActionOptions,
  ) => void;
};

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  onSave,
  initialSettings,
  isSaving = false,
  isFirstSetup = false,
  showDevTools = false,
  runningDevToolAction = null,
  onRunDevToolAction,
}) => {
  const shouldUseStickySave = !isFirstSetup;
  const optionButtonClass =
    "min-h-11 rounded-[16px] px-3 font-heading text-sm font-semibold transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";
  const inactiveOptionClass =
    "glass-control text-[var(--text-secondary)] hover:border-[var(--border-strong)]";
  const activeOptionClass =
    "border border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] text-[var(--accent-warm)] shadow-warm-glow";
  const LEVEL_OPTIONS: UserSettings["englishLevel"][] = [
    "A1",
    "A2",
    "B1",
    "B2",
  ];
  const READING_TIME_OPTIONS = [3, 5, 10, 15];
  const [level, setLevel] = useState<UserSettings["englishLevel"]>(
    initialSettings?.englishLevel ?? "A1",
  );
  const [readingTime, setReadingTime] = useState(
    initialSettings?.dailyReadingMinutes ?? 3,
  );
  const feedbackTelegramUrl = getTelegramProfileUrl(
    import.meta.env.VITE_FEEDBACK_TELEGRAM_USERNAME,
  );

  const handleSave = async () => {
    await onSave({
      englishLevel: level,
      dailyReadingMinutes: readingTime,
    });
  };

  return (
    <div
      className={`mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col px-3.5 pt-3 min-[390px]:px-4 min-[480px]:max-w-[390px] min-[480px]:px-3 ${
        shouldUseStickySave ? "pb-28" : "pb-4"
      }`}
    >
      <ScreenHeader title="Настройки" onBack={onBack} disabled={isSaving} />

      {isFirstSetup && (
        <section className="glass-card mt-3 rounded-[20px] p-3">
          <p className="font-heading text-base font-semibold leading-5 text-[var(--accent-warm)]">
            Заполни настройки, чтобы начать первый дневной цикл.
          </p>
          <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
            Мы подберем длину и сложность текста под твой ежедневный ритм.
          </p>
        </section>
      )}

      <div className="space-y-3 pt-3">
        {showDevTools && onRunDevToolAction && (
          <Suspense
            fallback={
              <LoadingState
                message="Загружаем dev tools..."
                compact
                className="py-3"
              />
            }
          >
            <DevToolsPanel
              runningAction={runningDevToolAction}
              onRunAction={onRunDevToolAction}
            />
          </Suspense>
        )}

        <section className="glass-card rounded-[20px] p-3">
          <h2 className="mb-2 font-heading text-base font-semibold uppercase tracking-[0.11em] text-[var(--primary)]">
            Уровень текста
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {LEVEL_OPTIONS.map((option) => (
              <button
                type="button"
                key={option}
                onClick={() => setLevel(option)}
                disabled={isSaving}
                className={`${optionButtonClass} ${
                  level === option
                    ? activeOptionClass
                    : inactiveOptionClass
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </section>

        <section className="glass-card rounded-[20px] p-3">
          <h2 className="mb-2 font-heading text-base font-semibold uppercase tracking-[0.11em] text-[var(--primary)]">
            Время чтения
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {READING_TIME_OPTIONS.map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => setReadingTime(value)}
                disabled={isSaving}
                className={`${optionButtonClass} ${
                  readingTime === value
                    ? activeOptionClass
                    : inactiveOptionClass
                }`}
              >
                {value}м
              </button>
            ))}
          </div>
        </section>

        {feedbackTelegramUrl ? (
          <section className="flex items-center justify-center gap-2 pt-1 text-sm">
            <span className="font-medium text-[var(--text-muted)]">
              Есть вопрос?
            </span>
            <button
              type="button"
              onClick={() => openTelegramLink(feedbackTelegramUrl)}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-1.5 rounded-[10px] px-1.5 py-1 font-heading text-sm font-semibold text-[var(--accent-warm)] transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-warm)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
            >
              Написать разработчику
              <ExternalLink size={16} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </section>
        ) : null}
      </div>

      <div className="mt-auto pt-6">
        <Button
          onClick={handleSave}
          className="w-full"
          disabled={isSaving}
        >
          {isSaving ? "Сохраняем..." : "Сохранить"}
        </Button>
      </div>
    </div>
  );
};
