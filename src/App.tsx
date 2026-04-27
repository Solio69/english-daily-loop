/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { Toast, ToastTone } from "./components/Toast";
import { ExercisesScreen } from "./screens/ExercisesScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { MaterialsScreen } from "./screens/MaterialsScreen";
import { ReadingScreen } from "./screens/ReadingScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SubscriptionScreen } from "./screens/SubscriptionScreen";
import { VocabularyScreen } from "./screens/VocabularyScreen";
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
} from "./types/homeProgress";
import { MaterialsTab } from "./types/materials";
import { SubscriptionPlanType } from "./types/subscription";
import { AppUser, SaveUserSettingsInput } from "./types/user";

type ScreenId =
  | "home"
  | "exercises"
  | "reading"
  | "vocabulary"
  | "materials"
  | "settings"
  | "subscription";

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>("home");
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [materialsInitialTab, setMaterialsInitialTab] =
    useState<MaterialsTab>("texts");
  const [activatingPlan, setActivatingPlan] =
    useState<SubscriptionPlanType | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<ToastTone>("default");

  const isSettingsCompleted = Boolean(appUser?.settingsCompletedAt);
  const isFirstTextCompleted = Boolean(appUser?.firstTextCompletedAt);
  const streakDays = appUser?.streakDays ?? 0;
  const lessonStatus = appUser?.homeProgress.lesson.status ?? "not_started";
  const lessonCurrentStep =
    appUser?.homeProgress.lesson.currentStep ?? "reading";
  const readingStatus = appUser?.homeProgress.reading.status ?? "not_started";
  const shouldForceSettings = !isSettingsCompleted;
  const shouldForceReading = isSettingsCompleted && !isFirstTextCompleted;

  const getLessonProgressFromReadingStatus = (
    status: ReadingHomeStatus,
  ): { status: LessonHomeStatus; currentStep: LessonCurrentStep } => ({
    status,
    currentStep: status === "completed" ? null : "reading",
  });

  useEffect(() => {
    const bootstrap = async () => {
      try {
        window.Telegram?.WebApp?.ready?.();
        const user = await getCurrentAppUser();
        setAppUser(user);
        setCurrentScreen("home");
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
  }, []);

  useEffect(() => {
    if (!toastText) return;
    const timeout = window.setTimeout(() => setToastText(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [toastText]);

  const showToast = (message: string, tone: ToastTone = "default") => {
    setToastText(message);
    setToastTone(tone);
  };

  const updateReadingHomeStatus = (status: ReadingHomeStatus) => {
    const nextLesson = getLessonProgressFromReadingStatus(status);

    setAppUser((currentUser) =>
      currentUser
        ? {
            ...currentUser,
            homeProgress: {
              ...currentUser.homeProgress,
              lesson: nextLesson,
              reading: { status },
            },
          }
        : currentUser,
    );
  };

  const handleSaveSettings = async (settings: SaveUserSettingsInput) => {
    if (!appUser) return;

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
      setCurrentScreen("home");
      showToast("Настройки сохранены. Переходи к тексту.", "success");
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
      setCurrentScreen("home");
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

  const handleCompleteFirstText = async () => {
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
                lesson: getLessonProgressFromReadingStatus("completed"),
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
      setCurrentScreen("settings");
      return;
    }

    setCurrentScreen("reading");
  };

  const openMaterials = (tab: MaterialsTab) => {
    setMaterialsInitialTab(tab);
    setCurrentScreen("materials");
  };

  const handleNavChange = (nextScreen: string) => {
    const target = nextScreen as ScreenId;
    if (
      shouldForceSettings &&
      target !== "home" &&
      target !== "settings" &&
      target !== "subscription"
    ) {
      showToast(
        "Сначала открой настройки, чтобы начать дневной план.",
        "onboarding",
      );
      return;
    }
    setCurrentScreen(target);
  };

  const handleDisabledNavClick = () => {
    if (shouldForceSettings) {
      showToast("Открой настройки, чтобы продолжить.", "onboarding");
      return;
    }
    showToast("Сначала заверши сегодняшний текст.", "onboarding");
  };

  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors flex items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Загружаем профиль...
        </p>
      </div>
    );
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case "home":
        return (
          <HomeScreen
            onNavigate={handleNavChange}
            onOpenLesson={openLesson}
            onOpenMaterials={openMaterials}
            onOpenSubscription={() => setCurrentScreen("subscription")}
            userName={appUser?.firstName}
            streakDays={streakDays}
            lessonStatus={lessonStatus}
            lessonCurrentStep={lessonCurrentStep}
            readingStatus={readingStatus}
            isFirstSetup={shouldForceSettings}
            subscription={appUser?.subscription}
            exerciseMinutes={appUser?.settings?.dailyExerciseMinutes ?? null}
            readingMinutes={appUser?.settings?.dailyReadingMinutes ?? null}
          />
        );
      case "exercises":
        return (
          <ExercisesScreen
            onBack={() => setCurrentScreen("home")}
          />
        );
      case "reading":
        return (
          <ReadingScreen
            onBack={() => setCurrentScreen("home")}
            onCompleteText={handleCompleteFirstText}
            onReadingStatusChange={updateReadingHomeStatus}
            userLevel={appUser?.settings?.englishLevel ?? null}
            readingMinutes={appUser?.settings?.dailyReadingMinutes ?? null}
          />
        );
      case "vocabulary":
        return (
          <VocabularyScreen
            onBack={() => setCurrentScreen("home")}
          />
        );
      case "materials":
        return (
          <MaterialsScreen
            onBack={() => setCurrentScreen("home")}
            initialTab={materialsInitialTab}
          />
        );
      case "settings":
        return (
          <SettingsScreen
            onBack={() => setCurrentScreen("home")}
            onSave={handleSaveSettings}
            initialSettings={appUser?.settings}
            isSaving={isSavingSettings}
            isFirstSetup={!isSettingsCompleted}
          />
        );
      case "subscription":
        return appUser ? (
          <SubscriptionScreen
            subscription={appUser.subscription}
            onBack={() => setCurrentScreen("home")}
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
            onOpenSubscription={() => setCurrentScreen("subscription")}
            userName={appUser?.firstName}
            streakDays={streakDays}
            lessonStatus={lessonStatus}
            lessonCurrentStep={lessonCurrentStep}
            readingStatus={readingStatus}
            isFirstSetup={shouldForceSettings}
            subscription={appUser?.subscription}
            exerciseMinutes={appUser?.settings?.dailyExerciseMinutes ?? null}
            readingMinutes={appUser?.settings?.dailyReadingMinutes ?? null}
          />
        );
    }
  };

  const disabledNavItems = shouldForceSettings
    ? ["home", "exercises", "reading", "vocabulary"]
    : shouldForceReading
      ? ["exercises", "vocabulary"]
      : [];
  const showBottomNav = currentScreen !== "settings" || isSettingsCompleted;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Layout
        activeNav={
          currentScreen === "settings" ||
          currentScreen === "subscription" ||
          currentScreen === "materials"
            ? "home"
            : currentScreen
        }
        onNavChange={handleNavChange}
        showBottomNav={showBottomNav}
        disabledNavItems={disabledNavItems}
        onDisabledNavClick={handleDisabledNavClick}
      >
        {renderScreen()}
      </Layout>
      {toastText && <Toast message={toastText} tone={toastTone} />}
    </div>
  );
}
