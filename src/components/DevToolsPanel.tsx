import React from "react";
import {
  BookMarked,
  CalendarClock,
  CheckCheck,
  ChevronDown,
  RotateCcw,
  Trash2,
  WalletCards,
} from "lucide-react";
import type {
  DevToolAction,
  DevToolActionOptions,
} from "../services/devToolsService";
import type { VocabularyReviewStep } from "../types/vocabulary";
import { getReviewStepLabel } from "../utils/vocabularyReviewPresentation";

type DevToolsPanelProps = {
  runningAction: DevToolAction | null;
  onRunAction: (action: DevToolAction, options?: DevToolActionOptions) => void;
};

type SimpleDevToolAction = Exclude<
  DevToolAction,
  "complete_today_vocabulary_reviews_at_step"
>;

type DevToolIcon = React.ComponentType<{
  size?: number;
  className?: string;
}>;

// TODO: Keep DB-changing actions behind DEV_TOOLS_ENABLED and admin role.
const ACTIONS: Array<{
  action: SimpleDevToolAction;
  label: string;
  description: string;
  icon: DevToolIcon;
}> = [
  {
    action: "reset_generation_attempts",
    label: "Сброс текстов",
    description: "Обнуляет попытки генерации текстов за сегодня.",
    icon: RotateCcw,
  },
  {
    action: "reset_vocabulary_card_attempts",
    label: "Сброс AI-карточек",
    description: "Обнуляет попытки генерации карточек словаря за сегодня.",
    icon: BookMarked,
  },
  {
    action: "reset_vocabulary_review_progress",
    label: "Сброс повторения",
    description: "Возвращает готовые слова в начало алгоритма.",
    icon: RotateCcw,
  },
  {
    action: "make_vocabulary_reviews_due_today",
    label: "Слова на сегодня",
    description: "Делает активные карточки доступными сегодня.",
    icon: CalendarClock,
  },
  {
    action: "clear_today_vocabulary_review_completion",
    label: "Открыть повторение",
    description: "Удаляет отметку завершения повторения за сегодня.",
    icon: Trash2,
  },
  {
    action: "delete_today_reading_completion",
    label: "Удалить прочитанное",
    description: "Удаляет прогресс дня и все тексты за сегодня.",
    icon: Trash2,
  },
  {
    action: "reset_subscriptions",
    label: "Сброс подписок",
    description: "Удаляет активные и будущие подписки.",
    icon: WalletCards,
  },
];

const REVIEW_STEP_OPTIONS: VocabularyReviewStep[] = [
  "1_day",
  "3_days",
  "7_days",
  "14_days",
  "1_month",
  "2_months",
  "3_months",
  "4_months",
  "5_months",
  "6_months",
];

const DEV_TOOLS_PANEL_ID = "dev-tools-panel-actions";

type DevToolsHeaderProps = {
  isExpanded: boolean;
  runningAction: DevToolAction | null;
  panelId: string;
  onToggle: () => void;
};

const DevToolsHeader: React.FC<DevToolsHeaderProps> = ({
  isExpanded,
  runningAction,
  panelId,
  onToggle,
}) => (
  <button
    type="button"
    aria-expanded={isExpanded}
    aria-controls={panelId}
    onClick={onToggle}
    className="flex w-full items-center justify-between gap-3 rounded-xl text-left transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-50 dark:focus-visible:ring-offset-gray-950"
  >
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-amber-800 dark:text-amber-200">
        Dev tools
      </span>
      <span className="mt-0.5 block text-xs text-amber-700/80 dark:text-amber-200/80">
        {runningAction
          ? "Выполняем локальное действие..."
          : "Локальные действия для текущего Telegram-пользователя."}
      </span>
    </span>
    <ChevronDown
      size={18}
      className={`shrink-0 text-amber-700 transition-transform dark:text-amber-200 ${
        isExpanded ? "rotate-180" : ""
      }`}
      aria-hidden="true"
    />
  </button>
);

type VocabularyReviewBatchActionProps = {
  runningAction: DevToolAction | null;
  onRunAction: (action: DevToolAction, options?: DevToolActionOptions) => void;
};

const VocabularyReviewBatchAction: React.FC<VocabularyReviewBatchActionProps> = ({
  runningAction,
  onRunAction,
}) => (
  <div className="mb-2 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800">
    <div className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200">
        <CheckCheck size={16} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900 dark:text-white">
          {runningAction === "complete_today_vocabulary_reviews_at_step"
            ? "Выполняем..."
            : "Повторить все слова"}
        </span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">
          Переносит сегодняшнюю очередь на выбранный шаг.
        </span>
      </span>
    </div>

    <div className="mt-3 grid grid-cols-2 gap-2">
      {REVIEW_STEP_OPTIONS.map((reviewStep) => (
        <button
          key={reviewStep}
          type="button"
          onClick={() =>
            onRunAction("complete_today_vocabulary_reviews_at_step", {
              reviewStep,
            })
          }
          disabled={Boolean(runningAction)}
          className="min-h-9 rounded-xl border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-900/50 dark:bg-amber-900/30 dark:text-amber-100 dark:hover:bg-amber-900/50"
        >
          {getReviewStepLabel(reviewStep)}
        </button>
      ))}
    </div>
  </div>
);

type SimpleDevToolButtonProps = {
  action: SimpleDevToolAction;
  label: string;
  description: string;
  icon: DevToolIcon;
  runningAction: DevToolAction | null;
  onRunAction: (action: DevToolAction, options?: DevToolActionOptions) => void;
};

const SimpleDevToolButton: React.FC<SimpleDevToolButtonProps> = ({
  action,
  label,
  description,
  icon: Icon,
  runningAction,
  onRunAction,
}) => {
  const isRunning = runningAction === action;
  const isDisabled = Boolean(runningAction);

  return (
    <button
      type="button"
      onClick={() => onRunAction(action)}
      disabled={isDisabled}
      className="flex w-full items-center gap-3 rounded-xl bg-white px-3 py-2 text-left shadow-sm transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-800 dark:hover:bg-gray-700"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-gray-900 dark:text-white">
          {isRunning ? "Выполняем..." : label}
        </span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">
          {description}
        </span>
      </span>
    </button>
  );
};

export const DevToolsPanel: React.FC<DevToolsPanelProps> = ({
  runningAction,
  onRunAction,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const toggleExpanded = () => setIsExpanded((current) => !current);

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20">
      <DevToolsHeader
        isExpanded={isExpanded}
        runningAction={runningAction}
        panelId={DEV_TOOLS_PANEL_ID}
        onToggle={toggleExpanded}
      />

      {isExpanded ? (
        <div id={DEV_TOOLS_PANEL_ID} className="mt-3">
          <VocabularyReviewBatchAction
            runningAction={runningAction}
            onRunAction={onRunAction}
          />

          <div className="space-y-2">
            {ACTIONS.map((action) => (
              <SimpleDevToolButton
                key={action.action}
                {...action}
                runningAction={runningAction}
                onRunAction={onRunAction}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
};
