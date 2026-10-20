/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react'
import { Layout } from './components/Layout'
import { LoadingState } from './components/LoadingState'
import { ProfileLoadError } from './components/ProfileLoadError'
import { Toast } from './components/Toast'
import type { BottomNavItemId } from './components/BottomNav'
import { SHOW_SUBSCRIPTION_FLOW } from './constants/subscriptionFeatures'
import { HomeScreen } from './screens/HomeScreen'
import { MaterialsScreen } from './screens/MaterialsScreen'
import { ReadingScreen } from './screens/ReadingScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SubscriptionScreen } from './screens/SubscriptionScreen'
import { VocabularyScreen } from './screens/VocabularyScreen'
import { useAppUserActions } from './hooks/useAppUserActions'
import { useAppUserProfile } from './hooks/useAppUserProfile'
import { useScreenNavigation } from './hooks/useScreenNavigation'
import { useToast } from './hooks/useToast'
import { clientLogger } from './services/clientLogger'
import { MaterialsTab } from './types/materials'
import { getDisabledNavItems } from './utils/navigationAccess'

type ScreenId =
  'home' | 'reading' | 'vocabulary' | 'materials' | 'settings' | 'subscription'

export default function App() {
  const {
    currentScreen,
    navigateTo,
    navigateBack,
    navigateRoot: navigateHome,
  } = useScreenNavigation<ScreenId>('home')

  const { toastText, toastTone, showToast, hideToast } = useToast()
  const {
    appUser,
    setAppUser,
    isBootstrapping,
    authError,
    didSessionStartWithoutSettings,
    retryBootstrap,
    refreshCurrentUser,
  } = useAppUserProfile({
    onReady: navigateHome,
    showToast,
  })
  const [materialsInitialTab, setMaterialsInitialTab] =
    useState<MaterialsTab>('vocabulary')
  const [continueLessonAfterReading, setContinueLessonAfterReading] =
    useState(false)
  const {
    isSavingSettings,
    activatingPlan,
    runningDevToolAction,
    handleSaveSettings,
    handleActivateSubscription,
    handleRunDevToolAction,
    handleCompleteReadingText,
    updateReadingHomeStatus,
    updateReviewHomeStatus,
  } = useAppUserActions({
    appUser,
    setAppUser,
    refreshCurrentUser,
    navigateHome,
    showToast,
  })

  const isSettingsCompleted = Boolean(appUser?.settingsCompletedAt)
  const streakDays = appUser?.streakDays ?? 0
  const lessonStatus = appUser?.homeProgress.lesson.status ?? 'not_started'
  const lessonCurrentStep =
    appUser?.homeProgress.lesson.currentStep ?? 'reading'
  const readingStatus = appUser?.homeProgress.reading.status ?? 'not_started'
  const reviewStatus = appUser?.homeProgress.review.status ?? 'completed'
  const shouldForceSettings = !isSettingsCompleted
  const showDevTools = appUser?.role === 'admin'

  useEffect(() => {
    clientLogger.info('screen_opened', {
      currentScreen,
      role: appUser?.role ?? null,
    })
  }, [appUser?.role, currentScreen])

  const openLesson = () => {
    if (shouldForceSettings) {
      setContinueLessonAfterReading(false)
      navigateTo('settings')
      return
    }

    const target = lessonCurrentStep === 'vocabulary' ? 'vocabulary' : 'reading'
    setContinueLessonAfterReading(target === 'reading')
    navigateTo(target)
  }

  const openMaterials = (tab: MaterialsTab) => {
    setContinueLessonAfterReading(false)
    setMaterialsInitialTab(tab)
    navigateTo('materials')
  }

  const openSubscription = () => {
    if (SHOW_SUBSCRIPTION_FLOW) {
      navigateTo('subscription')
    }
  }

  const handleNavChange = (nextScreen: string) => {
    setContinueLessonAfterReading(false)
    const target = nextScreen as ScreenId
    if (target === 'subscription' && !SHOW_SUBSCRIPTION_FLOW) {
      navigateTo('home', { root: true })
      return
    }
    if (
      shouldForceSettings &&
      target !== 'home' &&
      target !== 'settings' &&
      target !== 'subscription'
    ) {
      showToast('Открой настройки, чтобы продолжить.', 'onboarding')
      return
    }
    if (target === 'materials') {
      setMaterialsInitialTab('vocabulary')
    }
    navigateTo(target, { root: true })
  }

  const handleReadingBack = () => {
    setContinueLessonAfterReading(false)
    navigateBack()
  }

  const handleContinueLessonAfterReading = () => {
    setContinueLessonAfterReading(false)
    navigateTo('vocabulary', { root: true })
  }

  const handleDisabledNavClick = () => {
    showToast('Открой настройки, чтобы продолжить.', 'onboarding')
  }

  if (
    isBootstrapping ||
    (appUser !== null && didSessionStartWithoutSettings === null)
  ) {
    return <LoadingState message="Загружаем профиль..." fullScreen />
  }

  if (!appUser) {
    return (
      <ProfileLoadError
        message={authError ?? 'Не удалось загрузить профиль пользователя.'}
        onRetry={retryBootstrap}
      />
    )
  }

  const renderHomeScreen = () => (
    <HomeScreen
      onNavigate={handleNavChange}
      onOpenLesson={openLesson}
      onOpenMaterials={openMaterials}
      onOpenSubscription={SHOW_SUBSCRIPTION_FLOW ? openSubscription : undefined}
      showSubscriptionEntry={SHOW_SUBSCRIPTION_FLOW}
      userName={appUser?.firstName}
      streakDays={streakDays}
      lessonStatus={lessonStatus}
      lessonCurrentStep={lessonCurrentStep}
      readingStatus={readingStatus}
      reviewStatus={reviewStatus}
      reviewDueCount={appUser?.homeProgress.review.dueCount ?? 0}
      reviewReviewedTodayCount={
        appUser?.homeProgress.review.reviewedTodayCount ?? 0
      }
      completedReadingTextCount={appUser?.completedReadingTextCount ?? null}
      isFirstSetup={shouldForceSettings}
      didSessionStartWithoutSettings={
        didSessionStartWithoutSettings ?? shouldForceSettings
      }
      subscription={appUser?.subscription}
      readingMinutes={appUser?.settings?.dailyReadingMinutes ?? null}
    />
  )

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return renderHomeScreen()
      case 'reading':
        return (
          <ReadingScreen
            onBack={handleReadingBack}
            onNext={
              continueLessonAfterReading
                ? handleContinueLessonAfterReading
                : undefined
            }
            onCompleteText={handleCompleteReadingText}
            onReadingStatusChange={updateReadingHomeStatus}
            userLevel={appUser?.settings?.englishLevel ?? null}
            readingMinutes={appUser?.settings?.dailyReadingMinutes ?? null}
          />
        )
      case 'vocabulary':
        return (
          <VocabularyScreen
            onBack={navigateBack}
            onOpenVocabularyMaterials={() => openMaterials('vocabulary')}
            onReviewStatusChange={updateReviewHomeStatus}
          />
        )
      case 'materials':
        return (
          <MaterialsScreen
            onBack={navigateBack}
            initialTab={materialsInitialTab}
            onVocabularyReviewStateChange={refreshCurrentUser}
          />
        )
      case 'settings':
        return (
          <SettingsScreen
            onBack={navigateBack}
            onSave={handleSaveSettings}
            initialSettings={appUser?.settings}
            isSaving={isSavingSettings}
            isFirstSetup={!isSettingsCompleted}
            showDevTools={showDevTools}
            runningDevToolAction={runningDevToolAction}
            onRunDevToolAction={handleRunDevToolAction}
            appUser={appUser ?? null}
            currentScreen={currentScreen}
          />
        )
      case 'subscription':
        return SHOW_SUBSCRIPTION_FLOW && appUser ? (
          <SubscriptionScreen
            subscription={appUser.subscription}
            onBack={navigateBack}
            onActivate={handleActivateSubscription}
            activatingPlan={activatingPlan}
          />
        ) : null
      default:
        return renderHomeScreen()
    }
  }

  const disabledNavItems = getDisabledNavItems(isSettingsCompleted)
  const showBottomNav = currentScreen !== 'settings' || isSettingsCompleted
  const activeNav: BottomNavItemId =
    currentScreen === 'settings' || currentScreen === 'subscription'
      ? 'home'
      : currentScreen

  return (
    <div className="min-h-screen bg-[var(--background)] transition-colors">
      <Layout
        activeNav={activeNav}
        onNavChange={handleNavChange}
        showBottomNav={showBottomNav}
        disabledNavItems={disabledNavItems}
        onDisabledNavClick={handleDisabledNavClick}
      >
        {renderScreen()}
      </Layout>
      {toastText && (
        <Toast message={toastText} tone={toastTone} onClose={hideToast} />
      )}
    </div>
  )
}
