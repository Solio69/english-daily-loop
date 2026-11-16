import { useCallback, useState } from 'react'
import type { BottomNavItemId } from '../components/BottomNav'
import { SHOW_SUBSCRIPTION_FLOW } from '../constants/subscriptionFeatures'
import type { LessonCurrentStep } from '../types/homeProgress'
import type { MaterialsTab } from '../types/materials'
import { getDisabledNavItems } from '../utils/navigationAccess'
import type { ShowToast } from './useToast'

export type AppScreen =
  'home' | 'reading' | 'vocabulary' | 'materials' | 'settings' | 'subscription'

type UseAppNavigationParams = {
  currentScreen: AppScreen
  navigateTo: (screen: AppScreen, options?: { root?: boolean }) => void
  navigateBack: () => void
  isSettingsCompleted: boolean
  lessonCurrentStep: LessonCurrentStep
  showToast: ShowToast
}

const SETTINGS_REQUIRED_MESSAGE = 'Открой настройки, чтобы продолжить.'

export const useAppNavigation = ({
  currentScreen,
  navigateTo,
  navigateBack,
  isSettingsCompleted,
  lessonCurrentStep,
  showToast,
}: UseAppNavigationParams) => {
  const [materialsInitialTab, setMaterialsInitialTab] =
    useState<MaterialsTab>('vocabulary')
  const [continueLessonAfterReading, setContinueLessonAfterReading] =
    useState(false)
  const shouldForceSettings = !isSettingsCompleted

  const openLesson = useCallback(() => {
    if (shouldForceSettings) {
      setContinueLessonAfterReading(false)
      navigateTo('settings')
      return
    }

    const target = lessonCurrentStep === 'vocabulary' ? 'vocabulary' : 'reading'
    setContinueLessonAfterReading(target === 'reading')
    navigateTo(target)
  }, [lessonCurrentStep, navigateTo, shouldForceSettings])

  const openMaterials = useCallback(
    (tab: MaterialsTab) => {
      if (shouldForceSettings) {
        showToast(SETTINGS_REQUIRED_MESSAGE, 'onboarding')
        return
      }
      setContinueLessonAfterReading(false)
      setMaterialsInitialTab(tab)
      navigateTo('materials')
    },
    [navigateTo, shouldForceSettings, showToast],
  )

  const openSubscription = useCallback(() => {
    if (SHOW_SUBSCRIPTION_FLOW) navigateTo('subscription')
  }, [navigateTo])

  const handleNavChange = useCallback(
    (nextScreen: string) => {
      setContinueLessonAfterReading(false)
      const target = nextScreen as AppScreen
      if (target === 'subscription' && !SHOW_SUBSCRIPTION_FLOW) {
        navigateTo('home', { root: true })
        return
      }
      const needsSettings =
        shouldForceSettings &&
        target !== 'home' &&
        target !== 'settings' &&
        target !== 'subscription'
      if (needsSettings) {
        showToast(SETTINGS_REQUIRED_MESSAGE, 'onboarding')
        return
      }
      if (target === 'materials') setMaterialsInitialTab('vocabulary')
      navigateTo(target, { root: true })
    },
    [navigateTo, shouldForceSettings, showToast],
  )

  const handleReadingBack = useCallback(() => {
    setContinueLessonAfterReading(false)
    navigateBack()
  }, [navigateBack])

  const handleContinueLessonAfterReading = useCallback(() => {
    setContinueLessonAfterReading(false)
    navigateTo('vocabulary', { root: true })
  }, [navigateTo])

  const handleDisabledNavClick = useCallback(() => {
    showToast(SETTINGS_REQUIRED_MESSAGE, 'onboarding')
  }, [showToast])

  const disabledNavItems = getDisabledNavItems(isSettingsCompleted)
  const showBottomNav = currentScreen !== 'settings' || isSettingsCompleted
  const activeNav: BottomNavItemId =
    currentScreen === 'settings' || currentScreen === 'subscription'
      ? 'home'
      : currentScreen

  return {
    materialsInitialTab,
    continueLessonAfterReading,
    shouldForceSettings,
    openLesson,
    openMaterials,
    openSubscription,
    handleNavChange,
    handleReadingBack,
    handleContinueLessonAfterReading,
    handleDisabledNavClick,
    disabledNavItems,
    showBottomNav,
    activeNav,
  }
}
