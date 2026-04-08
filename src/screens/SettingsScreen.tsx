import { ChevronLeft } from "lucide-react";
import React, { useState } from "react";
import { Button } from "../components/Button";
import { SaveUserSettingsInput, UserSettings } from "../types/user";

type SettingsScreenProps = {
  onBack: () => void;
  onSave: (settings: SaveUserSettingsInput) => Promise<void>;
  initialSettings?: UserSettings | null;
  isSaving?: boolean;
  isFirstSetup?: boolean;
};

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  onSave,
  initialSettings,
  isSaving = false,
  isFirstSetup = false,
}) => {
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
  const [words, setWords] = useState(initialSettings?.dailyReviewWords ?? 5);

  const handleSave = async () => {
    await onSave({
      englishLevel: level,
      dailyExerciseMinutes: time,
      dailyReviewWords: words,
    });
  };

  return (
    <div className="p-4 space-y-8">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm hover:text-gray-700 dark:hover:text-gray-300"
        disabled={isSaving}
      >
        <ChevronLeft size={20} /> Назад
      </button>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Настройки сессии
      </h1>
      {isFirstSetup && (
        <p className="text-sm text-blue-600 dark:text-orange-400">
          Заполни настройки, чтобы начать первый дневной цикл.
        </p>
      )}

      <div className="space-y-6">
        {/* Text Level */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Уровень текста
          </h2>
          <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-full">
            {LEVEL_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setLevel(option)}
                className={`flex-1 py-2 text-sm font-medium rounded-full transition-colors ${
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

        {/* Exercise Time */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Время упражнений
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 15, 20].map((value) => (
              <button
                key={value}
                onClick={() => setTime(value)}
                className={`py-2 text-sm font-medium rounded-xl transition-colors ${
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

        {/* Words to Review */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Слов на повторение
            </h2>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              Настройка MVP
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 15, 20].map((value) => (
              <button
                key={value}
                onClick={() => setWords(value)}
                className={`py-2 text-sm font-medium rounded-xl transition-colors ${
                  words === value
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </section>
      </div>

      <Button
        onClick={handleSave}
        className="w-full rounded-full py-3 text-base dark:bg-orange-500 dark:hover:bg-orange-600"
        disabled={isSaving}
      >
        {isSaving ? "Сохраняем..." : "Сохранить"}
      </Button>
    </div>
  );
};
