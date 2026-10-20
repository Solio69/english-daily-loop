import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { DevToolAction, DevToolActionOptions } from '../types/devTools'
import { completeReadingText } from '../services/readingService'
import { activateSubscription } from '../services/subscriptionService'
import { saveCurrentUserSettings } from '../services/userService'
import type {
  LessonCurrentStep,
  LessonHomeStatus,
  ReadingHomeStatus,
  ReviewHomeStatus,
} from '../types/homeProgress'
import type { SubscriptionPlanType } from '../types/subscription'
import type { AppUser, SaveUserSettingsInput } from '../types/user'
import { applySavedSettings } from '../utils/userProfile'
import type { ShowToast } from './useToast'

type UseAppUserActionsParams = {
  appUser: AppUser | null
  setAppUser: Dispatch<SetStateAction<AppUser | null>>
  refreshCurrentUser: () => Promise<AppUser>
  navigateHome: () => void
  showToast: ShowToast
}

const getLessonProgress = (
  status: ReadingHomeStatus,
  review: ReviewHomeStatus,
): { status: LessonHomeStatus; currentStep: LessonCurrentStep } => {
  if (status !== 'completed') {
    return {
      status,
      currentStep: 'reading',
    }
  }

  if (review === 'completed') {
    return {
      status: 'completed',
      currentStep: null,
    }
  }

  return {
    status: 'in_progress',
    currentStep: 'vocabulary',
  }
}

export const useAppUserActions = ({
  appUser,
  setAppUser,
  refreshCurrentUser,
  navigateHome,
  showToast,
}: UseAppUserActionsParams) => {
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [activatingPlan, setActivatingPlan] =
    useState<SubscriptionPlanType | null>(null)
  const [runningDevToolAction, setRunningDevToolAction] =
    useState<DevToolAction | null>(null)

  const updateReadingHomeStatus = useCallback(
    (status: ReadingHomeStatus) => {
      setAppUser((currentUser) =>
        currentUser
          ? {
              ...currentUser,
              homeProgress: {
                ...currentUser.homeProgress,
                lesson: getLessonProgress(
                  status,
                  currentUser.homeProgress.review.status,
                ),
                reading: { status },
              },
            }
          : currentUser,
      )
    },
    [setAppUser],
  )

  const updateReviewHomeStatus = useCallback(
    (
      status: ReviewHomeStatus,
      dueCount: number,
      reviewedTodayCount: number,
    ) => {
      setAppUser((currentUser) =>
        currentUser
          ? {
              ...currentUser,
              homeProgress: {
                ...currentUser.homeProgress,
                lesson: getLessonProgress(
                  currentUser.homeProgress.reading.status,
                  status,
                ),
                review: {
                  ...currentUser.homeProgress.review,
                  status,
                  dueCount,
                  reviewedTodayCount,
                },
              },
            }
          : currentUser,
      )
    },
    [setAppUser],
  )

  const handleSaveSettings = useCallback(
    async (settings: SaveUserSettingsInput) => {
      if (!appUser) return

      const wasFirstSetup = !appUser.settingsCompletedAt
      setIsSavingSettings(true)
      try {
        const response = await saveCurrentUserSettings(settings)
        setAppUser((currentUser) =>
          applySavedSettings({
            currentUser,
            requestProfile: appUser,
            response,
          }),
        )
        navigateHome()
        showToast(
          wasFirstSetup
            ? 'Настройки готовы. Можно начинать первый текст.'
            : 'Настройки сохранены.',
          wasFirstSetup ? 'onboarding' : 'success',
        )
      } catch (error) {
        showToast(
          error instanceof Error
            ? error.message
            : 'Не удалось сохранить настройки.',
          'error',
        )
      } finally {
        setIsSavingSettings(false)
      }
    },
    [appUser, navigateHome, setAppUser, showToast],
  )

  const handleActivateSubscription = useCallback(
    async (planType: SubscriptionPlanType) => {
      if (!appUser) return

      setActivatingPlan(planType)
      try {
        const subscription = await activateSubscription(planType)
        setAppUser((currentUser) =>
          currentUser
            ? {
                ...currentUser,
                subscription,
              }
            : currentUser,
        )
        navigateHome()
        showToast(
          appUser.subscription.activeSubscription?.planType === 'monthly' &&
            planType === 'yearly'
            ? 'Годовая подписка запланирована.'
            : 'Подписка активирована.',
          'success',
        )
      } catch (error) {
        showToast(
          error instanceof Error
            ? error.message
            : 'Не удалось оформить подписку.',
          'error',
        )
      } finally {
        setActivatingPlan(null)
      }
    },
    [appUser, navigateHome, setAppUser, showToast],
  )

  const handleRunDevToolAction = useCallback(
    async (action: DevToolAction, options?: DevToolActionOptions) => {
      setRunningDevToolAction(action)
      try {
        const { runDevToolAction } = await import('../services/devToolsService')
        await runDevToolAction(action, options)
        await refreshCurrentUser()
        showToast('Dev-действие выполнено.', 'success')
      } catch (error) {
        showToast(
          error instanceof Error
            ? error.message
            : 'Не удалось выполнить dev-действие.',
          'error',
        )
      } finally {
        setRunningDevToolAction(null)
      }
    },
    [refreshCurrentUser, showToast],
  )

  const handleCompleteReadingText = useCallback(async () => {
    if (!appUser) return

    try {
      const result = await completeReadingText()
      setAppUser((currentUser) =>
        currentUser
          ? {
              ...currentUser,
              streakDays: result.streakDays ?? currentUser.streakDays,
              completedReadingTextCount:
                result.completedReadingTextCount ??
                (currentUser.completedReadingTextCount === null
                  ? null
                  : currentUser.completedReadingTextCount + 1),
              firstTextCompletedAt:
                result.firstTextCompletedAt ?? currentUser.firstTextCompletedAt,
              homeProgress: {
                ...currentUser.homeProgress,
                lesson: getLessonProgress(
                  'completed',
                  currentUser.homeProgress.review.status,
                ),
                reading: { status: 'completed' },
              },
            }
          : currentUser,
      )
      showToast(
        appUser.firstTextCompletedAt
          ? 'Текст на сегодня завершен.'
          : 'Отличный старт. Первый текст завершен.',
        appUser.firstTextCompletedAt ? 'success' : 'onboarding',
      )
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Не удалось сохранить завершение текста.',
        'error',
      )
      throw error
    }
  }, [appUser, setAppUser, showToast])

  return {
    isSavingSettings,
    activatingPlan,
    runningDevToolAction,
    handleSaveSettings,
    handleActivateSubscription,
    handleRunDevToolAction,
    handleCompleteReadingText,
    updateReadingHomeStatus,
    updateReviewHomeStatus,
  }
}
