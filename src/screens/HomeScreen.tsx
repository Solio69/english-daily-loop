import {
  CheckCircle2,
  Clock,
  Crown,
  Flame,
  BookOpen,
  BookText,
  Settings,
  Target,
  WalletCards,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { ThemeToggle } from "../components/ThemeToggle";
import { getVocabularyState } from "../services/vocabularyService";
import {
  LessonCurrentStep,
  LessonHomeStatus,
  ReadingHomeStatus,
} from "../types/homeProgress";
import { MaterialsTab } from "../types/materials";
import { SubscriptionSummary } from "../types/subscription";
import { VocabularyState } from "../types/vocabulary";

type HomeScreenProps = {
  onNavigate: (screen: string) => void;
  onOpenLesson: () => void;
  onOpenMaterials: (tab: MaterialsTab) => void;
  onOpenSubscription: () => void;
  userName?: string | null;
  streakDays?: number;
  lessonStatus?: LessonHomeStatus;
  lessonCurrentStep?: LessonCurrentStep;
  readingStatus?: ReadingHomeStatus;
  isFirstSetup?: boolean;
  subscription?: SubscriptionSummary;
  exerciseMinutes?: number | null;
  readingMinutes?: number | null;
};

type StatusState = "done" | "not_started" | "in_progress";

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
  in_progress: {
    icon: "bg-orange-50 dark:bg-orange-900/20 text-orange-500 dark:text-orange-300",
    text: "text-orange-500 dark:text-orange-300",
    label: "В процессе",
  },
};

const getVocabularyTileText = (
  state: VocabularyState | null,
  isLoading: boolean,
): { text: string; isAttention: boolean } => {
  if (isLoading) {
    return { text: "Проверяем словарь", isAttention: false };
  }

  if (!state) {
    return { text: "Словарь доступен", isAttention: false };
  }

  if (state.pendingCount > 0 && state.needsApprovalCount > 0) {
    return {
      text: `Добавить: ${state.pendingCount} Подтвердить: ${state.needsApprovalCount}`,
      isAttention: true,
    };
  }

  if (state.pendingCount > 0) {
    return { text: `Добавить: ${state.pendingCount}`, isAttention: true };
  }

  if (state.needsApprovalCount > 0) {
    return {
      text: `Подтвердить: ${state.needsApprovalCount}`,
      isAttention: true,
    };
  }

  return { text: `В словаре: ${state.readyCount}`, isAttention: false };
};

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onOpenLesson,
  onOpenMaterials,
  onOpenSubscription,
  userName,
  streakDays = 0,
  lessonStatus = "not_started",
  lessonCurrentStep = "reading",
  readingStatus = "not_started",
  isFirstSetup = false,
  subscription,
  exerciseMinutes,
  readingMinutes,
}) => {
  const [vocabularyState, setVocabularyState] =
    useState<VocabularyState | null>(null);
  const [isVocabularyStateLoading, setIsVocabularyStateLoading] =
    useState(false);

  const isLessonCompleted = lessonStatus === "completed";
  const exerciseStatus: StatusState = isFirstSetup
    ? "not_started"
    : isLessonCompleted
      ? "done"
      : "not_started";
  const readingProgressStatus: StatusState =
    readingStatus === "completed"
      ? "done"
      : readingStatus === "in_progress"
        ? "in_progress"
        : "not_started";
  const isPaid = subscription?.tier === "paid";
  const SubscriptionIcon = isPaid ? Crown : WalletCards;
  const lessonButtonLabel =
    lessonStatus === "in_progress" ? "Продолжить" : "Начать";
  const lessonDescription = isLessonCompleted
    ? "Сегодняшний урок завершен."
    : lessonCurrentStep === "reading"
      ? lessonStatus === "in_progress"
        ? "Урок начат. Вернись, чтобы закончить чтение."
        : "Начни урок с чтения текста."
      : lessonStatus === "in_progress"
        ? "Урок начат. Продолжай следующий шаг."
        : "Начни сегодняшний урок.";
  const reviewStatus: StatusState = isFirstSetup
    ? "not_started"
    : isLessonCompleted
      ? "done"
      : "not_started";
  const vocabularyTile = getVocabularyTileText(
    vocabularyState,
    isVocabularyStateLoading,
  );

  useEffect(() => {
    if (isFirstSetup) {
      setVocabularyState(null);
      return;
    }

    let isMounted = true;

    const loadVocabularyState = async () => {
      setIsVocabularyStateLoading(true);
      try {
        const state = await getVocabularyState();
        if (isMounted) {
          setVocabularyState(state);
        }
      } catch {
        if (isMounted) {
          setVocabularyState(null);
        }
      } finally {
        if (isMounted) {
          setIsVocabularyStateLoading(false);
        }
      }
    };

    loadVocabularyState();

    return () => {
      isMounted = false;
    };
  }, [isFirstSetup]);

  return (
    <div className="px-4 py-3 space-y-4">
      <header className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              С возвращением,
            </p>
            <h1 className="text-[26px] leading-8 font-bold text-gray-900 dark:text-white">
              {userName ?? "Пользователь"}!
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSubscription}
              className={`h-8 rounded-full px-3 flex items-center gap-1.5 text-sm font-semibold transition-colors ${
                isPaid
                  ? "bg-green-50 text-green-600 dark:bg-orange-900/25 dark:text-orange-300"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              <SubscriptionIcon size={16} />
              <span>{isPaid ? "Подписка" : "Купить"}</span>
            </button>
            <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-3 py-1.5 rounded-full text-sm font-semibold">
              <Flame size={16} />
              {streakDays}
            </div>
            <ThemeToggle />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-3.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center gap-3 mb-3">
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

          <div className="flex justify-between mb-3">
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
                className={`p-1.5 rounded-full ${STATUS_STYLES[readingProgressStatus].icon}`}
              >
                <Clock size={14} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-200">
                  Текст
                </p>
                <p
                  className={`text-[10px] ${STATUS_STYLES[readingProgressStatus].text}`}
                >
                  {STATUS_STYLES[readingProgressStatus].label}
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

          <div className="flex gap-1.5 pt-2.5 border-t border-gray-50 dark:border-gray-700">
            <span className="px-2 py-0.5 bg-gray-50 dark:bg-gray-700 rounded text-[10px] text-gray-500 dark:text-gray-400">
              {exerciseMinutes ?? 5}м Упр
            </span>
            <span className="px-2 py-0.5 bg-gray-50 dark:bg-gray-700 rounded text-[10px] text-gray-500 dark:text-gray-400">
              {readingMinutes ?? 3}м Текст
            </span>
            <span className="px-2 py-0.5 bg-gray-50 dark:bg-gray-700 rounded text-[10px] text-gray-500 dark:text-gray-400">
              30 слов
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
        <>
          <section className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              План на сегодня
            </h2>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-base text-gray-900 dark:text-white">
                  Урок на сегодня
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {lessonDescription}
                </p>
              </div>
              {isLessonCompleted ? (
                <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full text-xs font-medium">
                  <CheckCircle2 size={14} />
                  <span>Завершено</span>
                </div>
              ) : (
                <Button
                  onClick={onOpenLesson}
                  className="shrink-0 rounded-full px-4 py-1.5 text-sm dark:bg-orange-500 dark:hover:bg-orange-600"
                >
                  {lessonButtonLabel}
                </Button>
              )}
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Мои материалы
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenMaterials("texts")}
                  className="rounded-xl bg-gray-50 dark:bg-gray-700/70 p-2.5 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                    <BookOpen size={16} className="text-green-500 dark:text-orange-300" />
                    <span className="text-sm font-semibold">Тексты</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    История чтения
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenMaterials("vocabulary")}
                  className="rounded-xl bg-gray-50 dark:bg-gray-700/70 p-2.5 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                    <BookText size={16} className="text-green-500 dark:text-orange-300" />
                    <span className="text-sm font-semibold">Словарь</span>
                  </div>
                  <p
                    className={`mt-1 text-xs ${
                      vocabularyTile.isAttention
                        ? "font-semibold text-orange-500 dark:text-orange-300"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {vocabularyTile.text}
                  </p>
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
