/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react'
import { Layout } from './components/Layout'
import { LoadingState } from './components/LoadingState'
import { ProfileLoadError } from './components/ProfileLoadError'
import { Toast } from './components/Toast'
import { SHOW_SUBSCRIPTION_FLOW } from './constants/subscriptionFeatures'
import { HomeScreen } from './screens/HomeScreen'
import { MaterialsScreen } from './screens/MaterialsScreen'
import { ReadingScreen } from './screens/ReadingScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SubscriptionScreen } from './screens/SubscriptionScreen'
import { VocabularyScreen } from './screens/VocabularyScreen'
import { useAppUserActions } from './hooks/useAppUserActions'
import { useAppNavigation } from './hooks/useAppNavigation'
import type { AppScreen } from './hooks/useAppNavigation'
import { useAppUserProfile } from './hooks/useAppUserProfile'
import { useScreenNavigation } from './hooks/useScreenNavigation'
import { useToast } from './hooks/useToast'
import { clientLogger } from './services/clientLogger'

export default function App() {
  const {
    currentScreen,
    navigateTo,
    navigateBack,
    navigateRoot: navigateHome,
  } = useScreenNavigation<AppScreen>('home')

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
  const showDevTools = appUser?.role === 'admin'
  const {
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
  } = useAppNavigation({
    currentScreen,
    navigateTo,
    navigateBack,
    isSettingsCompleted,
    lessonCurrentStep,
    showToast,
  })

  useEffect(() => {
    clientLogger.info('screen_opened', {
      currentScreen,
      role: appUser?.role ?? null,
    })
  }, [appUser?.role, currentScreen])

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
