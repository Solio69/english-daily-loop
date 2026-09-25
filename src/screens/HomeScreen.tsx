import {
  BookOpen,
  CheckCircle2,
  Clock,
  Crown,
  Flame,
  NotebookTabs,
  Settings,
  Target,
  WalletCards,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { ThemeToggle } from "../components/ThemeToggle";
import { SHOW_VOCABULARY_CARD_APPROVAL_FLOW } from "../constants/vocabularyFeatures";
import { getVocabularyState } from "../services/vocabularyService";
import {
  LessonCurrentStep,
  LessonHomeStatus,
  ReadingHomeStatus,
  ReviewHomeStatus,
} from "../types/homeProgress";
import { MaterialsTab } from "../types/materials";
import { SubscriptionSummary } from "../types/subscription";
import { VocabularyState } from "../types/vocabulary";
import {
  getCompletedReadingTextLabel,
  getReviewProgressPresentation,
  type HomeProgressStepState,
} from "../utils/homeProgressPresentation";
import { getHomeGreeting } from "../utils/homeGreeting";
import { getRussianPlural } from "../utils/russianPlural";

type HomeScreenProps = {
  onNavigate: (screen: string) => void;
  onOpenLesson: () => void;
  onOpenMaterials: (tab: MaterialsTab) => void;
  onOpenSubscription?: () => void;
  showSubscriptionEntry?: boolean;
  userName?: string | null;
  streakDays?: number;
  lessonStatus?: LessonHomeStatus;
  lessonCurrentStep?: LessonCurrentStep;
  readingStatus?: ReadingHomeStatus;
  reviewStatus?: ReviewHomeStatus;
  reviewDueCount?: number;
  reviewReviewedTodayCount?: number;
  completedReadingTextCount?: number | null;
  isFirstSetup?: boolean;
  didSessionStartWithoutSettings?: boolean;
  subscription?: SubscriptionSummary;
  readingMinutes?: number | null;
};

type ProgressStepState = "done" | "current" | "idle";
type ReadingChipState = "completed" | "in_progress" | "idle";

const STATUS_STYLES: Record<
  HomeProgressStepState,
  { step: ProgressStepState; text: string; label: string }
> = {
  done: {
    step: "done",
    text: "text-[var(--primary)]",
    label: "Готово",
  },
  not_started: {
    step: "idle",
    text: "text-[var(--text-muted)]",
    label: "Не начато",
  },
  in_progress: {
    step: "current",
    text: "text-[var(--accent-warm)]",
    label: "В процессе",
  },
};

const PROGRESS_STEP_STYLES: Record<ProgressStepState, string> = {
  done: "border-[var(--border-strong)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-primary-glow",
  current:
    "border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] text-[var(--accent-warm)] shadow-warm-glow",
  idle: "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]",
};

const READING_CHIP_STYLES: Record<ReadingChipState, string> = {
  completed:
    "border-[var(--border-strong)] bg-[var(--primary-soft)] font-semibold text-[var(--primary)] shadow-primary-glow",
  in_progress:
    "border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] font-semibold text-[var(--accent-warm)] shadow-warm-glow",
  idle:
    "border-[var(--border)] bg-[var(--surface)] font-medium text-[var(--text-secondary)]",
};

type ProgressStepProps = {
  icon: React.ElementType;
  label: string;
  status: HomeProgressStepState;
  statusLabel?: string;
};

const ProgressStep: React.FC<ProgressStepProps> = ({
  icon: Icon,
  label,
  status,
  statusLabel,
}) => {
  const style = STATUS_STYLES[status];

  return (
    <div className="min-w-0 text-center">
      <div
        className={`mx-auto grid size-9 place-items-center rounded-full border backdrop-blur-[24px] min-[390px]:size-10 ${PROGRESS_STEP_STYLES[style.step]}`}
      >
        <Icon size={17} strokeWidth={2.3} />
      </div>
      <p className="mt-1.5 truncate font-heading text-base font-semibold text-[var(--text-primary)]">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm font-medium leading-5 ${style.text}`}
      >
        {statusLabel ?? style.label}
      </p>
    </div>
  );
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

  const needsApprovalCount = SHOW_VOCABULARY_CARD_APPROVAL_FLOW
    ? state.needsApprovalCount
    : 0;

  if (state.pendingCount > 0 && needsApprovalCount > 0) {
    return {
      text: `Добавить: ${state.pendingCount} Подтвердить: ${needsApprovalCount}`,
      isAttention: true,
    };
  }

  if (state.pendingCount > 0) {
    return { text: `Добавить: ${state.pendingCount}`, isAttention: true };
  }

  if (needsApprovalCount > 0) {
    return {
      text: `Подтвердить: ${needsApprovalCount}`,
      isAttention: true,
    };
  }

  return { text: `В словаре: ${state.readyCount}`, isAttention: false };
};

const splitVocabularyTileText = (text: string): string[] =>
  SHOW_VOCABULARY_CARD_APPROVAL_FLOW && text.includes(" Подтвердить")
    ? text.replace(" Подтвердить", "\nПодтвердить").split("\n")
    : [text];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onOpenLesson,
  onOpenMaterials,
  onOpenSubscription,
  showSubscriptionEntry = false,
  userName,
  streakDays = 0,
  lessonStatus = "not_started",
  lessonCurrentStep = "reading",
  readingStatus = "not_started",
  reviewStatus = "completed",
  reviewDueCount = 0,
  reviewReviewedTodayCount = 0,
  completedReadingTextCount = null,
  isFirstSetup = false,
  didSessionStartWithoutSettings = false,
  subscription,
  readingMinutes,
}) => {
  const [vocabularyState, setVocabularyState] =
    useState<VocabularyState | null>(null);
  const [isVocabularyStateLoading, setIsVocabularyStateLoading] =
    useState(false);

  const isLessonCompleted = lessonStatus === "completed";
  const readingProgressStatus: HomeProgressStepState =
    readingStatus === "completed"
      ? "done"
      : readingStatus === "in_progress"
        ? "in_progress"
        : "not_started";
  const readingChipState: ReadingChipState =
    readingStatus === "completed"
      ? "completed"
      : readingStatus === "in_progress"
        ? "in_progress"
        : "idle";
  const reviewProgress = getReviewProgressPresentation({
    status: reviewStatus,
    dueCount: reviewDueCount,
    reviewedTodayCount: reviewReviewedTodayCount,
  });
  const isPaid = subscription?.tier === "paid";
  const SubscriptionIcon = isPaid ? Crown : WalletCards;
  const displayName = userName ?? "Пользователь";
  const greeting = getHomeGreeting(didSessionStartWithoutSettings);
  const isLongDisplayName = displayName.length > 12;
  const lessonButtonLabel =
    lessonStatus === "in_progress" ? "Продолжить" : "Начать";
  const lessonDescription = isLessonCompleted
    ? "Сегодняшний урок завершен."
    : lessonCurrentStep === "reading"
      ? lessonStatus === "in_progress"
        ? "Урок начат. Вернись, чтобы закончить чтение."
        : "Начни урок с чтения текста."
      : reviewDueCount > 0
        ? `Осталось повторить ${reviewDueCount} ${getRussianPlural(reviewDueCount, ["слово", "слова", "слов"])}.`
        : "Повтори слова, чтобы закрыть урок.";
  const vocabularyTile = getVocabularyTileText(
    vocabularyState,
    isVocabularyStateLoading,
  );
  const lessonDescriptionLines = lessonDescription.includes(". ")
    ? lessonDescription
        .split(". ")
        .map((line, index, lines) =>
          index < lines.length - 1 ? `${line}.` : line,
        )
    : [lessonDescription];
  const vocabularyTileLines = splitVocabularyTileText(vocabularyTile.text);

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
    <div className="mx-auto w-full max-w-[430px] space-y-3 px-3.5 pb-3 pt-3 min-[390px]:px-4 min-[480px]:max-w-[390px] min-[480px]:px-3">
      <header className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 text-[16px] font-medium leading-tight text-[var(--primary)] min-[390px]:text-[17px] min-[480px]:text-[16px]">
              {greeting}
            </p>

            <div className="flex shrink-0 items-center justify-end gap-1.5">
              <ThemeToggle />
              <button
                type="button"
                aria-label="Открыть настройки"
                onClick={() => onNavigate("settings")}
                className={`glass-control relative z-10 grid size-9 shrink-0 place-items-center overflow-visible rounded-full border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] text-[var(--accent-warm)] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-warm)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${
                  isFirstSetup
                    ? "shadow-warm-glow"
                    : "shadow-[0_0_20px_rgba(245,158,11,0.18),inset_0_1px_0_rgba(255,255,255,0.18)]"
                }`}
              >
                {isFirstSetup && (
                  <span
                    aria-hidden="true"
                    className="onboarding-settings-wave pointer-events-none absolute inset-0 rounded-full"
                  />
                )}
                <Settings className="relative z-10" size={18} />
              </button>
            </div>
          </div>

          <div className="flex items-start justify-between gap-3">
            <h1
              className={`min-w-0 flex-1 py-1 font-heading font-bold text-[var(--text-primary)] [overflow-wrap:anywhere] ${
                isLongDisplayName
                  ? "text-[24px] leading-[1.08] min-[390px]:text-[26px] min-[480px]:text-[26px]"
                  : "text-[28px] leading-none"
              }`}
            >
              {displayName}!
            </h1>
            {showSubscriptionEntry && onOpenSubscription && (
              <button
                type="button"
                onClick={onOpenSubscription}
                className={`glass-control mt-0.5 flex h-9 shrink-0 items-center gap-1.5 rounded-[15px] px-2.5 text-[12px] font-semibold leading-none transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${
                  isPaid ? "text-[var(--primary)]" : "text-[var(--accent-warm)]"
                }`}
              >
                <SubscriptionIcon className="shrink-0" size={15} />
                <span>{isPaid ? "Подписка" : "Купить"}</span>
              </button>
            )}
          </div>
        </div>

        <section className="glass-card rounded-[20px] p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-heading text-base font-semibold uppercase tracking-[0.11em] text-[var(--primary)]">
              Прогресс за день
            </h2>
            <div className="glass-control flex min-h-8 shrink-0 items-center gap-1.5 rounded-[14px] px-2.5 text-sm font-semibold leading-none text-[var(--accent-warm)] shadow-warm-glow">
              <Flame size={15} />
              {streakDays}
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
            <ProgressStep
              icon={Clock}
              label="Текст"
              status={readingProgressStatus}
            />
            <div className="mt-4 h-px w-20 bg-[var(--border-strong)] min-[390px]:w-24 min-[480px]:w-20" />
            <ProgressStep
              icon={Target}
              label="Повторение"
              status={reviewProgress.state}
              statusLabel={reviewProgress.label}
            />
          </div>

          <div className="my-2 h-px bg-[var(--border)]" />

          <div className="grid grid-cols-[1fr_5rem_1fr] gap-2 min-[390px]:grid-cols-[1fr_6rem_1fr] min-[480px]:grid-cols-[1fr_5rem_1fr]">
            <span
              className={`mx-auto w-28 rounded-[12px] border px-2 py-1 text-center text-[10px] backdrop-blur-[24px] min-[480px]:w-24 ${READING_CHIP_STYLES[readingChipState]}`}
            >
              {readingMinutes ?? 3}м Текст
            </span>
            <span
              className={`col-start-3 mx-auto w-28 rounded-[12px] border px-2 py-1 text-center text-[10px] backdrop-blur-[24px] min-[480px]:w-24 ${
                reviewStatus === "completed"
                  ? "border-[var(--border-strong)] bg-[var(--primary-soft)] font-semibold text-[var(--primary)] shadow-primary-glow"
                  : reviewStatus === "in_progress"
                    ? "border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] font-semibold text-[var(--accent-warm)] shadow-warm-glow"
                    : "border-[var(--border)] bg-[var(--surface)] font-medium text-[var(--text-secondary)]"
              }`}
            >
              {reviewDueCount > 0 ? `${reviewDueCount} слов` : "Слова"}
            </span>
          </div>
        </section>
      </header>

      {isFirstSetup ? (
        <section className="glass-card rounded-[20px] p-3">
          <h2 className="mb-2 font-heading text-base font-semibold uppercase tracking-[0.11em] text-[var(--primary)]">
            Перед первым уроком
          </h2>
          <div className="space-y-2">
            <p className="font-heading text-base font-semibold leading-5 text-[var(--accent-warm)]">
              Заполни настройки перед стартом.
            </p>
            <p className="text-sm leading-5 text-[var(--text-secondary)]">
              Выбери уровень и параметры сессии в настройках, после этого
              откроется ежедневный учебный цикл.
            </p>
            <Button
              onClick={() => onNavigate("settings")}
              className="w-full"
            >
              Открыть настройки
            </Button>
          </div>
        </section>
      ) : (
        <>
          <section className="glass-card rounded-[20px] p-3">
            <h2 className="mb-2 font-heading text-base font-semibold uppercase tracking-[0.11em] text-[var(--primary)]">
              План на сегодня
            </h2>
            <div className="flex flex-row items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm leading-5 text-[var(--text-secondary)]">
                  {lessonDescriptionLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </p>
              </div>
              {isLessonCompleted ? (
                <div className="glass-control flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-[16px] px-3 text-sm font-semibold leading-5 text-[var(--primary)] shadow-primary-glow">
                  <CheckCircle2 size={15} />
                  <span>Завершено</span>
                </div>
              ) : (
                <Button
                  onClick={onOpenLesson}
                  className="min-h-9 w-auto shrink-0 px-4 py-2 text-xs min-[390px]:min-w-[104px] min-[480px]:min-w-[96px]"
                >
                  {lessonButtonLabel}
                </Button>
              )}
            </div>
          </section>

          <section className="glass-card rounded-[20px] p-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-heading text-base font-semibold uppercase tracking-[0.11em] text-[var(--primary)]">
                    Мои материалы
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenMaterials("vocabulary")}
                  className="grid h-[108px] grid-rows-[44px_40px] content-start rounded-[16px] border border-[var(--border)] bg-[var(--surface-strong)] p-2.5 text-left backdrop-blur-[24px] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                >
                  <div className="flex h-11 items-center gap-2 text-[var(--text-primary)]">
                    <span className="glass-control grid size-10 shrink-0 place-items-center rounded-full text-[var(--primary)]">
                      <NotebookTabs size={20} />
                    </span>
                    <span className="font-heading text-base font-semibold">
                      Словарь
                    </span>
                  </div>
                  <p
                    className={`mt-1.5 h-10 overflow-hidden text-sm leading-5 ${
                      vocabularyTile.isAttention
                        ? "font-semibold text-[var(--accent-warm)]"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {vocabularyTileLines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenMaterials("texts")}
                  className="grid h-[108px] grid-rows-[44px_40px] content-start rounded-[16px] border border-[var(--border)] bg-[var(--surface-strong)] p-2.5 text-left backdrop-blur-[24px] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                >
                  <div className="flex h-11 items-center gap-2 text-[var(--text-primary)]">
                    <span className="glass-control grid size-10 shrink-0 place-items-center rounded-full text-[var(--primary)]">
                      <BookOpen className="-translate-y-px" size={20} />
                    </span>
                    <span className="font-heading text-base font-semibold">
                      Тексты
                    </span>
                  </div>
                  <p className="mt-1.5 h-10 overflow-hidden text-sm leading-5 text-[var(--text-secondary)]">
                    {getCompletedReadingTextLabel(completedReadingTextCount)}
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
