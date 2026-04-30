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
  const optionButtonClass = "h-12 text-sm font-medium transition-colors";
  const LEVEL_OPTIONS: UserSettings["englishLevel"][] = [
    "A1",
    "A2",
    "B1",
    "B2",
  ];
  const [level, setLevel] = useState<UserSettings["englishLevel"]>(
    initialSettings?.englishLevel ?? "A1",
  );
  const [time, setTime] = useState(initialSettings?.dailyExerciseMinutes ?? 5);
  const [readingTime, setReadingTime] = useState(
    initialSettings?.dailyReadingMinutes ?? 3,
  );

  const handleSave = async () => {
    await onSave({
      englishLevel: level,
      dailyExerciseMinutes: time,
      dailyReadingMinutes: readingTime,
    });
  };

  return (
    <div
      className={`flex min-h-screen flex-col p-4 ${
        shouldUseStickySave ? "pb-24" : "pb-4"
      }`}
    >
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm hover:text-gray-700 dark:hover:text-gray-300"
        disabled={isSaving}
      >
        <ChevronLeft size={20} /> Назад
      </button>

      <h1 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
        Настройки сессии
      </h1>
      {isFirstSetup && (
        <p className="text-sm text-pink-500 dark:text-pink-500">
          Заполни настройки, чтобы начать первый дневной цикл.
        </p>
      )}

      <div className="space-y-5 pt-6">
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

        <section>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Уровень текста
          </h2>
          <div className="-mx-0.5 flex bg-gray-100 dark:bg-gray-800 rounded-full">
            {LEVEL_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setLevel(option)}
                className={`flex-1 rounded-full ${optionButtonClass} ${
                  level === option
                    ? "bg-green-500 text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Время чтения
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {[3, 5, 10, 15].map((value) => (
              <button
                key={value}
                onClick={() => setReadingTime(value)}
                className={`rounded-xl ${optionButtonClass} ${
                  readingTime === value
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                }`}
              >
                {value}m
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Время упражнений
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 15, 20].map((value) => (
              <button
                key={value}
                onClick={() => setTime(value)}
                className={`rounded-xl ${optionButtonClass} ${
                  time === value
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                }`}
              >
                {value}m
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-auto pt-6">
        <Button
          onClick={handleSave}
          className="w-full rounded-full py-3 text-base dark:bg-orange-500 dark:hover:bg-orange-600"
          disabled={isSaving}
        >
          {isSaving ? "Сохраняем..." : "Сохранить"}
        </Button>
      </div>
    </div>
  );
};
