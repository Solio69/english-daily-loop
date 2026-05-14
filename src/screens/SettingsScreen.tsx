import { ChevronLeft } from "lucide-react";
import React, { Suspense, lazy, useState } from "react";
import { Button } from "../components/Button";
import type { DevToolAction } from "../services/devToolsService";
import { SaveUserSettingsInput, UserSettings } from "../types/user";

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
  onRunDevToolAction?: (action: DevToolAction) => void;
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
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="glass-control grid size-9 shrink-0 place-items-center rounded-full text-[var(--primary)] transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
          disabled={isSaving}
          aria-label="Назад"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="font-heading text-base font-semibold uppercase tracking-[0.11em] text-[var(--primary)]">
            Настройки
          </h1>
        </div>
      </header>

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
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                Загружаем dev tools...
              </div>
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
