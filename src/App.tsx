/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { LoadingState } from "./components/LoadingState";
import { Toast, ToastTone } from "./components/Toast";
import type { BottomNavItemId } from "./components/BottomNav";
import { HomeScreen } from "./screens/HomeScreen";
import { MaterialsScreen } from "./screens/MaterialsScreen";
import { ReadingScreen } from "./screens/ReadingScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SubscriptionScreen } from "./screens/SubscriptionScreen";
import { VocabularyScreen } from "./screens/VocabularyScreen";
import { useScreenNavigation } from "./hooks/useScreenNavigation";
import type { DevToolAction } from "./services/devToolsService";
import { completeReadingText } from "./services/readingService";
import { activateSubscription } from "./services/subscriptionService";
import {
  getCurrentAppUser,
  saveCurrentUserSettings,
} from "./services/userService";
import {
  LessonCurrentStep,
  LessonHomeStatus,
  ReadingHomeStatus,
  ReviewHomeStatus,
} from "./types/homeProgress";
import { MaterialsTab } from "./types/materials";
import { SubscriptionPlanType } from "./types/subscription";
import { AppUser, SaveUserSettingsInput } from "./types/user";

type ScreenId =
  | "home"
  | "reading"
  | "vocabulary"
  | "materials"
  | "settings"
  | "subscription";

const getLessonProgress = (
  status: ReadingHomeStatus,
  review: ReviewHomeStatus,
): { status: LessonHomeStatus; currentStep: LessonCurrentStep } => {
  if (status !== "completed") {
    return {
      status,
      currentStep: "reading",
    };
  }

  if (review === "completed") {
    return {
      status: "completed",
      currentStep: null,
    };
  }

  return {
    status: "in_progress",
    currentStep: "vocabulary",
  };
};

export default function App() {
  const {
    currentScreen,
    navigateTo,
    navigateBack,
    navigateRoot: navigateHome,
  } = useScreenNavigation<ScreenId>("home");
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [materialsInitialTab, setMaterialsInitialTab] =
    useState<MaterialsTab>("vocabulary");
  const [activatingPlan, setActivatingPlan] =
    useState<SubscriptionPlanType | null>(null);
  const [runningDevToolAction, setRunningDevToolAction] =
    useState<DevToolAction | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<ToastTone>("default");

  const isSettingsCompleted = Boolean(appUser?.settingsCompletedAt);
  const isFirstTextCompleted = Boolean(appUser?.firstTextCompletedAt);
  const streakDays = appUser?.streakDays ?? 0;
  const lessonStatus = appUser?.homeProgress.lesson.status ?? "not_started";
  const lessonCurrentStep =
    appUser?.homeProgress.lesson.currentStep ?? "reading";
  const readingStatus = appUser?.homeProgress.reading.status ?? "not_started";
  const reviewStatus = appUser?.homeProgress.review.status ?? "completed";
  const shouldForceSettings = !isSettingsCompleted;
  const shouldForceReading = isSettingsCompleted && !isFirstTextCompleted;
  const showDevTools = import.meta.env.VITE_DEV_TOOLS_ENABLED === "true";

  const showToast = useCallback(
    (message: string, tone: ToastTone = "default") => {
      setToastText(message);
      setToastTone(tone);
    },
    [],
  );

  useEffect(() => {
    const bootstrap = async () => {
      try {
        window.Telegram?.WebApp?.ready?.();
        const user = await getCurrentAppUser();
        setAppUser(user);
        navigateHome();
      } catch (error) {
        showToast(
          error instanceof Error
            ? error.message
            : "Не удалось загрузить профиль пользователя.",
          "error",
        );
      } finally {
        setIsBootstrapping(false);
      }
    };

    bootstrap();
  }, [navigateHome, showToast]);

  useEffect(() => {
    if (!toastText) return;
    const timeout = window.setTimeout(() => setToastText(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [toastText]);

  const updateReadingHomeStatus = useCallback((status: ReadingHomeStatus) => {
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
    );
  }, []);

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
      );
    },
    [],
  );

  const handleSaveSettings = async (settings: SaveUserSettingsInput) => {
    if (!appUser) return;

    const wasFirstSetup = !isSettingsCompleted;
    setIsSavingSettings(true);
    try {
      const updatedUser = await saveCurrentUserSettings(
        appUser.id,
        settings,
        appUser.subscription,
        appUser.homeProgress,
        appUser.streakDays,
      );
      setAppUser(updatedUser);
      navigateHome();
      showToast(
        wasFirstSetup
          ? "Настройки готовы. Можно начинать первый текст."
          : "Настройки сохранены.",
        wasFirstSetup ? "onboarding" : "success",
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить настройки.",
        "error",
      );
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleActivateSubscription = async (planType: SubscriptionPlanType) => {
    if (!appUser) return;

    setActivatingPlan(planType);
    try {
      const subscription = await activateSubscription(planType);
      setAppUser({
        ...appUser,
        subscription,
      });
      navigateHome();
      showToast(
        appUser.subscription.activeSubscription?.planType === "monthly" &&
          planType === "yearly"
          ? "Годовая подписка запланирована."
          : "Подписка активирована.",
        "success",
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Не удалось оформить подписку.",
        "error",
      );
    } finally {
      setActivatingPlan(null);
    }
  };

  const handleRunDevToolAction = async (action: DevToolAction) => {
    setRunningDevToolAction(action);
    try {
      const { runDevToolAction } = await import("./services/devToolsService");
      await runDevToolAction(action);
      const refreshedUser = await getCurrentAppUser();
      setAppUser(refreshedUser);
      showToast("Dev-действие выполнено.", "success");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Не удалось выполнить dev-действие.",
        "error",
      );
    } finally {
      setRunningDevToolAction(null);
    }
  };

  const handleCompleteReadingText = async () => {
    if (!appUser) return;

    try {
      const result = await completeReadingText();
      setAppUser((currentUser) =>
        currentUser
          ? {
              ...currentUser,
              streakDays: result.streakDays,
              firstTextCompletedAt:
                result.firstTextCompletedAt ?? currentUser.firstTextCompletedAt,
              homeProgress: {
                ...currentUser.homeProgress,
                lesson: getLessonProgress(
                  "completed",
                  currentUser.homeProgress.review.status,
                ),
                reading: { status: "completed" },
              },
            }
          : currentUser,
      );
      showToast(
        appUser.firstTextCompletedAt
          ? "Текст на сегодня завершен."
          : "Отличный старт. Теперь все разделы доступны.",
        appUser.firstTextCompletedAt ? "success" : "onboarding",
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить завершение текста.",
        "error",
      );
      throw error;
    }
  };

  const openLesson = () => {
    if (shouldForceSettings) {
      navigateTo("settings");
      return;
    }

    navigateTo(lessonCurrentStep === "vocabulary" ? "vocabulary" : "reading");
  };

  const openMaterials = (tab: MaterialsTab) => {
    setMaterialsInitialTab(tab);
    navigateTo("materials");
  };

  const handleNavChange = (nextScreen: string) => {
    const target = nextScreen as ScreenId;
    if (
      shouldForceSettings &&
      target !== "home" &&
      target !== "settings" &&
      target !== "subscription"
    ) {
      showToast("Открой настройки, чтобы продолжить.", "onboarding");
      return;
    }
    if (target === "materials") {
      setMaterialsInitialTab("vocabulary");
    }
    navigateTo(target, { root: true });
  };

  const handleDisabledNavClick = () => {
    if (shouldForceSettings) {
      showToast("Открой настройки, чтобы продолжить.", "onboarding");
      return;
    }
    showToast("Сначала заверши сегодняшний текст.", "onboarding");
  };

  if (isBootstrapping) {
    return <LoadingState message="Загружаем профиль..." fullScreen />;
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case "home":
        return (
          <HomeScreen
            onNavigate={handleNavChange}
            onOpenLesson={openLesson}
            onOpenMaterials={openMaterials}
            onOpenSubscription={() => navigateTo("subscription")}
            userName={appUser?.firstName}
            streakDays={streakDays}
            lessonStatus={lessonStatus}
            lessonCurrentStep={lessonCurrentStep}
            readingStatus={readingStatus}
            reviewStatus={reviewStatus}
            reviewDueCount={appUser?.homeProgress.review.dueCount ?? 0}
            isFirstSetup={shouldForceSettings}
            subscription={appUser?.subscription}
            readingMinutes={appUser?.settings?.dailyReadingMinutes ?? null}
          />
        );
      case "reading":
        return (
          <ReadingScreen
            onBack={navigateBack}
            onCompleteText={handleCompleteReadingText}
            onReadingStatusChange={updateReadingHomeStatus}
            userLevel={appUser?.settings?.englishLevel ?? null}
            readingMinutes={appUser?.settings?.dailyReadingMinutes ?? null}
          />
        );
      case "vocabulary":
        return (
          <VocabularyScreen
            onBack={navigateBack}
            onOpenVocabularyMaterials={() => openMaterials("vocabulary")}
            onReviewStatusChange={updateReviewHomeStatus}
          />
        );
      case "materials":
        return (
          <MaterialsScreen
            onBack={navigateBack}
            initialTab={materialsInitialTab}
          />
        );
      case "settings":
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
          />
        );
      case "subscription":
        return appUser ? (
          <SubscriptionScreen
            subscription={appUser.subscription}
            onBack={navigateBack}
            onActivate={handleActivateSubscription}
            activatingPlan={activatingPlan}
          />
        ) : null;
      default:
        return (
          <HomeScreen
            onNavigate={handleNavChange}
            onOpenLesson={openLesson}
            onOpenMaterials={openMaterials}
            onOpenSubscription={() => navigateTo("subscription")}
            userName={appUser?.firstName}
            streakDays={streakDays}
            lessonStatus={lessonStatus}
            lessonCurrentStep={lessonCurrentStep}
            readingStatus={readingStatus}
            reviewStatus={reviewStatus}
            reviewDueCount={appUser?.homeProgress.review.dueCount ?? 0}
            isFirstSetup={shouldForceSettings}
            subscription={appUser?.subscription}
            readingMinutes={appUser?.settings?.dailyReadingMinutes ?? null}
          />
        );
    }
  };

  const disabledNavItems: BottomNavItemId[] = shouldForceSettings
    ? ["reading", "vocabulary", "materials"]
    : shouldForceReading
      ? ["vocabulary"]
      : [];
  const showBottomNav = currentScreen !== "settings" || isSettingsCompleted;
  const activeNav: BottomNavItemId =
    currentScreen === "settings" || currentScreen === "subscription"
      ? "home"
      : currentScreen;

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
        <Toast
          message={toastText}
          tone={toastTone}
          onClose={() => setToastText(null)}
        />
      )}
    </div>
  );
}
