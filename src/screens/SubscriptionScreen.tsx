import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Crown,
  Sparkles,
  WalletCards,
} from "lucide-react";
import React from "react";
import { Button } from "../components/Button";
import { SubscriptionPlanType, SubscriptionSummary } from "../types/subscription";

type SubscriptionScreenProps = {
  subscription: SubscriptionSummary;
  onBack: () => void;
  onActivate: (planType: SubscriptionPlanType) => void;
  activatingPlan: SubscriptionPlanType | null;
};

const MOSCOW_DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const PLAN_LABELS: Record<SubscriptionPlanType, string> = {
  monthly: "на месяц",
  yearly: "на год",
};

const formatMoscowDate = (value: string): string =>
  MOSCOW_DATE_FORMATTER.format(new Date(value));

export const SubscriptionScreen: React.FC<SubscriptionScreenProps> = ({
  subscription,
  onBack,
  onActivate,
  activatingPlan,
}) => {
  const active = subscription.activeSubscription;
  const scheduled = subscription.scheduledSubscription;
  const isPaid = subscription.tier === "paid";
  const canBuyMonthly = !active;
  const canBuyYearly = !active || active.planType === "monthly";
  const showYearlyAction = canBuyYearly && !scheduled;
  const activeTitle = active
    ? `Подписка ${PLAN_LABELS[active.planType]}`
    : "Бесплатный доступ";

  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm hover:text-gray-700 dark:hover:text-gray-300"
          aria-label="Назад"
        >
          <ChevronLeft size={20} /> Назад
        </button>
        <div className="text-right">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            {isPaid ? "Daily Loop Plus" : "Daily Loop Free"}
          </h1>
        </div>
      </header>

      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Текущий статус
            </p>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
              {activeTitle}
            </h2>
          </div>
          <div
            className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${
              isPaid
                ? "bg-green-50 text-green-600 dark:bg-orange-900/25 dark:text-orange-300"
                : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            {isPaid ? <Crown size={20} /> : <WalletCards size={20} />}
          </div>
        </div>

        {active && (
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <CalendarDays size={15} className="text-green-500 shrink-0" />
            <span>До {formatMoscowDate(active.endsAt)} по Москве</span>
          </div>
        )}

        {scheduled && (
          <div className="rounded-xl bg-green-50 text-green-700 dark:bg-orange-900/20 dark:text-orange-200 px-3 py-2 text-xs">
            Годовая начнется {formatMoscowDate(scheduled.startsAt)}.
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm space-y-3">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Что входит
        </h2>

        <div className="grid gap-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 shrink-0 rounded-full bg-green-50 text-green-600 dark:bg-orange-900/25 dark:text-orange-300 flex items-center justify-center">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white">
                10 генераций текста в день
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isPaid ? "Доступно в текущей подписке." : "В free-доступе сейчас 3."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-8 w-8 shrink-0 rounded-full bg-green-50 text-green-600 dark:bg-orange-900/25 dark:text-orange-300 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white">
                Словарь до 300 слов
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isPaid ? "Доступно в текущей подписке." : "В free-доступе лимит 30 слов."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {(canBuyMonthly || showYearlyAction) && (
        <section className="space-y-2">
          {canBuyMonthly && (
            <Button
              onClick={() => onActivate("monthly")}
              disabled={Boolean(activatingPlan)}
              className="w-full flex items-center justify-between rounded-2xl py-2.5 dark:bg-orange-500 dark:hover:bg-orange-600"
            >
              <span>Оформить на месяц</span>
              <span className="font-bold">
                {activatingPlan === "monthly" ? "..." : "0 ₽"}
              </span>
            </Button>
          )}

          {showYearlyAction && (
            <Button
              onClick={() => onActivate("yearly")}
              disabled={Boolean(activatingPlan)}
              variant={canBuyMonthly ? "outline" : "primary"}
              className={`w-full flex items-center justify-between rounded-2xl py-2.5 ${
                canBuyMonthly
                  ? "dark:border-orange-500 dark:text-orange-300 dark:hover:bg-orange-900/20"
                  : "dark:bg-orange-500 dark:hover:bg-orange-600"
              }`}
            >
              <span>
                {active?.planType === "monthly"
                  ? "Перейти на годовую"
                  : "Оформить на год"}
              </span>
              <span className="font-bold">
                {activatingPlan === "yearly" ? "..." : "0 ₽"}
              </span>
            </Button>
          )}
        </section>
      )}
    </div>
  );
};
