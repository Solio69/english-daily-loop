import React from "react";
import { BookMarked, RotateCcw, Trash2, WalletCards } from "lucide-react";
import type { DevToolAction } from "../services/devToolsService";

type DevToolsPanelProps = {
  runningAction: DevToolAction | null;
  onRunAction: (action: DevToolAction) => void;
};

const ACTIONS: Array<{
  action: DevToolAction;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
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

export const DevToolsPanel: React.FC<DevToolsPanelProps> = ({
  runningAction,
  onRunAction,
}) => (
  <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20">
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
        Dev tools
      </h2>
      <p className="text-xs text-amber-700/80 dark:text-amber-200/80">
        Локальные действия для текущего Telegram-пользователя.
      </p>
    </div>

    <div className="space-y-2">
      {ACTIONS.map(({ action, label, description, icon: Icon }) => {
        const isRunning = runningAction === action;
        const isDisabled = Boolean(runningAction);

        return (
          <button
            key={action}
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
      })}
    </div>
  </section>
);
