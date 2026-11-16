import { CheckCircle2, Crown, Settings, WalletCards } from 'lucide-react'
import React from 'react'
import { Button } from '../components/Button'
import { ThemeToggle } from '../components/ThemeToggle'
import { HomeMaterialsShortcuts } from '../components/home/HomeMaterialsShortcuts'
import { HomeProgressSummary } from '../components/home/HomeProgressSummary'
import { useHomeVocabularySummary } from '../hooks/useHomeVocabularySummary'
import {
  LessonCurrentStep,
  LessonHomeStatus,
  ReadingHomeStatus,
  ReviewHomeStatus,
} from '../types/homeProgress'
import { MaterialsTab } from '../types/materials'
import { SubscriptionSummary } from '../types/subscription'
import {
  getHomePresentation,
  getVocabularyTile,
} from '../utils/homePresentation'
import { getHomeGreeting } from '../utils/homeGreeting'

type HomeScreenProps = {
  onNavigate: (screen: string) => void
  onOpenLesson: () => void
  onOpenMaterials: (tab: MaterialsTab) => void
  onOpenSubscription?: () => void
  showSubscriptionEntry?: boolean
  userName?: string | null
  streakDays?: number
  lessonStatus?: LessonHomeStatus
  lessonCurrentStep?: LessonCurrentStep
  readingStatus?: ReadingHomeStatus
  reviewStatus?: ReviewHomeStatus
  reviewDueCount?: number
  reviewReviewedTodayCount?: number
  completedReadingTextCount?: number | null
  isFirstSetup?: boolean
  didSessionStartWithoutSettings?: boolean
  subscription?: SubscriptionSummary
  readingMinutes?: number | null
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onOpenLesson,
  onOpenMaterials,
  onOpenSubscription,
  showSubscriptionEntry = false,
  userName,
  streakDays = 0,
  lessonStatus = 'not_started',
  lessonCurrentStep = 'reading',
  readingStatus = 'not_started',
  reviewStatus = 'completed',
  reviewDueCount = 0,
  reviewReviewedTodayCount = 0,
  completedReadingTextCount = null,
  isFirstSetup = false,
  didSessionStartWithoutSettings = false,
  subscription,
  readingMinutes,
}) => {
  const { vocabularyState, isLoading: isVocabularyStateLoading } =
    useHomeVocabularySummary(isFirstSetup)
  const {
    isLessonCompleted,
    readingProgressStatus,
    readingChipState,
    reviewProgress,
    lessonButtonLabel,
    lessonDescriptionLines,
  } = getHomePresentation({
    lessonStatus,
    lessonCurrentStep,
    readingStatus,
    reviewStatus,
    reviewDueCount,
    reviewReviewedTodayCount,
  })
  const isPaid = subscription?.tier === 'paid'
  const SubscriptionIcon = isPaid ? Crown : WalletCards
  const displayName = userName ?? 'Пользователь'
  const greeting = getHomeGreeting(didSessionStartWithoutSettings)
  const isLongDisplayName = displayName.length > 12
  const vocabularyTile = getVocabularyTile({
    state: vocabularyState,
    isLoading: isVocabularyStateLoading,
  })

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
                onClick={() => onNavigate('settings')}
                className={`glass-control relative z-10 grid size-9 shrink-0 place-items-center overflow-visible rounded-full border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] text-[var(--accent-warm)] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-warm)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${
                  isFirstSetup
                    ? 'shadow-warm-glow'
                    : 'shadow-[0_0_20px_rgba(245,158,11,0.18),inset_0_1px_0_rgba(255,255,255,0.18)]'
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
                  ? 'text-[24px] leading-[1.08] min-[390px]:text-[26px] min-[480px]:text-[26px]'
                  : 'text-[28px] leading-none'
              }`}
            >
              {displayName}!
            </h1>
            {showSubscriptionEntry && onOpenSubscription && (
              <button
                type="button"
                onClick={onOpenSubscription}
                className={`glass-control mt-0.5 flex h-9 shrink-0 items-center gap-1.5 rounded-[15px] px-2.5 text-[12px] font-semibold leading-none transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${
                  isPaid ? 'text-[var(--primary)]' : 'text-[var(--accent-warm)]'
                }`}
              >
                <SubscriptionIcon className="shrink-0" size={15} />
                <span>{isPaid ? 'Подписка' : 'Купить'}</span>
              </button>
            )}
          </div>
        </div>

        <HomeProgressSummary
          streakDays={streakDays}
          readingProgressStatus={readingProgressStatus}
          readingChipState={readingChipState}
          readingMinutes={readingMinutes}
          reviewProgress={reviewProgress}
          reviewStatus={reviewStatus}
          reviewDueCount={reviewDueCount}
        />
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
            <Button onClick={() => onNavigate('settings')} className="w-full">
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

          <HomeMaterialsShortcuts
            vocabularyTile={vocabularyTile}
            completedReadingTextCount={completedReadingTextCount}
            onOpenMaterials={onOpenMaterials}
          />
        </>
      )}
    </div>
  )
}
