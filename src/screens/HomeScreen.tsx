import { CheckCircle2, Clock, Flame, Settings, Target } from "lucide-react";
import React from "react";
import { Button } from "../components/Button";
import { ThemeToggle } from "../components/ThemeToggle";

type HomeScreenProps = {
  onNavigate: (screen: string) => void;
  onStartFlow: () => void;
  isLessonFinished: boolean;
  userName?: string | null;
  streakDays?: number;
  isFirstTextCompleted?: boolean;
  isFirstSetup?: boolean;
};

type StatusState = "done" | "not_started";

const STATUS_STYLES: Record<
  StatusState,
  { icon: string; text: string; label: string }
> = {
  done: {
    icon: "bg-green-50 dark:bg-green-900/20 text-green-600",
    text: "text-green-500",
    label: "Готово",
  },
  not_started: {
    icon: "bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-gray-500",
    text: "text-gray-400 dark:text-gray-500",
    label: "Не начато",
  },
};

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onStartFlow,
  isLessonFinished,
  userName,
  streakDays = 0,
  isFirstTextCompleted = false,
  isFirstSetup = false,
}) => {
  const exerciseStatus: StatusState = isFirstSetup
    ? "not_started"
    : isLessonFinished
      ? "done"
      : "not_started";
  const readingStatus: StatusState = isFirstTextCompleted
    ? "done"
    : "not_started";
  const reviewStatus: StatusState = isFirstSetup
    ? "not_started"
    : isLessonFinished
      ? "done"
      : "not_started";

  return (
    <div className="p-4 space-y-8">
      <header className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              С возвращением,
            </p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {userName ?? "Пользователь"}!
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {!isFirstSetup && (
              <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-3 py-1.5 rounded-full text-sm font-semibold">
                <Flame size={16} />
                {streakDays}
              </div>
            )}
            <ThemeToggle />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Прогресс за день
            </h2>
            <button
              onClick={() => onNavigate("settings")}
              className={`relative h-7 w-7 rounded-full flex items-center justify-center transition-colors ${
                isFirstSetup
                  ? "text-pink-600 dark:text-pink-300 bg-pink-50 dark:bg-pink-900/20"
                  : "text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400"
              }`}
            >
              {isFirstSetup && (
                <span className="absolute inset-0 rounded-full animate-ping bg-pink-400/40 dark:bg-pink-400/40" />
              )}
              <span className="relative z-10">
                <Settings size={14} />
              </span>
            </button>
          </div>

          <div className="flex justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className={`p-1.5 rounded-full ${STATUS_STYLES[exerciseStatus].icon}`}
              >
                <CheckCircle2 size={14} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-200">
                  Упражнения
                </p>
                <p
                  className={`text-[10px] ${STATUS_STYLES[exerciseStatus].text}`}
                >
                  {STATUS_STYLES[exerciseStatus].label}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`p-1.5 rounded-full ${STATUS_STYLES[readingStatus].icon}`}
              >
                <Clock size={14} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-200">
                  Текст
                </p>
                <p
                  className={`text-[10px] ${STATUS_STYLES[readingStatus].text}`}
                >
                  {STATUS_STYLES[readingStatus].label}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`p-1.5 rounded-full ${STATUS_STYLES[reviewStatus].icon}`}
              >
                <Target size={14} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-200">
                  Повторение
                </p>
                <p
                  className={`text-[10px] ${STATUS_STYLES[reviewStatus].text}`}
                >
                  {STATUS_STYLES[reviewStatus].label}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-1.5 pt-3 border-t border-gray-50 dark:border-gray-700">
            <span className="px-2 py-0.5 bg-gray-50 dark:bg-gray-700 rounded text-[10px] text-gray-500 dark:text-gray-400">
              5м Упр
            </span>
            <span className="px-2 py-0.5 bg-gray-50 dark:bg-gray-700 rounded text-[10px] text-gray-500 dark:text-gray-400">
              3м Текст
            </span>
            <span className="px-2 py-0.5 bg-gray-50 dark:bg-gray-700 rounded text-[10px] text-gray-500 dark:text-gray-400">
              10 слов
            </span>
          </div>
        </div>
      </header>

      {isFirstSetup ? (
        <section className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-blue-200 dark:border-orange-900/40">
          <h2 className="text-xs font-bold text-blue-500 dark:text-orange-400 uppercase tracking-wider mb-2">
            Перед первым уроком
          </h2>
          <div className="space-y-2.5">
            <p className="font-bold text-base leading-snug text-gray-900 dark:text-white">
              Заполни настройки перед стартом.
            </p>
            <p className="text-sm leading-snug text-gray-500 dark:text-gray-400">
              Выбери уровень и параметры сессии в настройках, после этого
              откроется ежедневный учебный цикл.
            </p>
            <Button
              onClick={() => onNavigate("settings")}
              className="rounded-full px-4 py-1.5 text-base bg-pink-500 hover:bg-pink-600 dark:bg-pink-500 dark:hover:bg-pink-600"
            >
              Открыть настройки
            </Button>
          </div>
        </section>
      ) : (
        <section className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
            План на сегодня
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-lg text-gray-900 dark:text-white">
                {isLessonFinished
                  ? "Урок 2: завершен"
                  : "Урок 2: базовые утверждения"}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isLessonFinished
                  ? "Отличная работа сегодня!"
                  : "Фокус: структура предложения"}
              </p>
            </div>
            {isLessonFinished ? (
              <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full text-xs font-medium">
                <CheckCircle2 size={14} />
                <span>Завершено</span>
              </div>
            ) : (
              <Button
                onClick={onStartFlow}
                className="rounded-full px-5 dark:bg-orange-500 dark:hover:bg-orange-600"
              >
                Продолжить
              </Button>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
