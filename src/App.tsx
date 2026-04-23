/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { HomeScreen } from './screens/HomeScreen';
import { ExercisesScreen } from './screens/ExercisesScreen';
import { ReadingScreen } from './screens/ReadingScreen';
import { VocabularyScreen } from './screens/VocabularyScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AppUser, SaveUserSettingsInput } from './types/user';
import { getCurrentAppUser, saveCurrentUserSettings } from './services/userService';
import { completeReadingText } from './services/readingService';

type ScreenId = 'home' | 'exercises' | 'reading' | 'vocabulary' | 'settings';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('home');
  const [isGuidedFlow, setIsGuidedFlow] = useState(false);
  const [guidedStep, setGuidedStep] = useState(0); // 0: exercises, 1: reading, 2: vocabulary
  const [isLessonFinished, setIsLessonFinished] = useState(false);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintTone, setHintTone] = useState<'default' | 'onboarding' | 'success'>('default');
  const [streakDays] = useState(0);

  const isSettingsCompleted = Boolean(appUser?.settingsCompletedAt);
  const isFirstTextCompleted = Boolean(appUser?.firstTextCompletedAt);
  const shouldForceSettings = !isSettingsCompleted;
  const shouldForceReading = isSettingsCompleted && !isFirstTextCompleted;

  useEffect(() => {
    const bootstrap = async () => {
      try {
        window.Telegram?.WebApp?.ready?.();
        const user = await getCurrentAppUser();
        setAppUser(user);
        setCurrentScreen('home');
      } catch (error) {
        setHintText(error instanceof Error ? error.message : 'Не удалось загрузить профиль пользователя.');
      } finally {
        setIsBootstrapping(false);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (!hintText) return;
    const timeout = window.setTimeout(() => setHintText(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [hintText]);

  const showHint = (
    message: string,
    tone: 'default' | 'onboarding' | 'success' = 'default',
  ) => {
    setHintText(message);
    setHintTone(tone);
  };

  const handleSaveSettings = async (settings: SaveUserSettingsInput) => {
    if (!appUser) return;

    setIsSavingSettings(true);
    try {
      const updatedUser = await saveCurrentUserSettings(appUser.id, settings);
      setAppUser(updatedUser);
      setCurrentScreen('home');
      showHint('Настройки сохранены. Переходи к тексту.', 'success');
    } catch (error) {
      showHint(error instanceof Error ? error.message : 'Не удалось сохранить настройки.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCompleteFirstText = async () => {
    if (!appUser) return;

    try {
      const result = await completeReadingText();
      setAppUser({
        ...appUser,
        firstTextCompletedAt:
          result.firstTextCompletedAt ?? appUser.firstTextCompletedAt,
      });
      showHint(
        appUser.firstTextCompletedAt
          ? 'Текст на сегодня завершен.'
          : 'Отличный старт. Теперь все разделы доступны.',
      );
    } catch (error) {
      showHint(error instanceof Error ? error.message : 'Не удалось сохранить завершение текста.');
      throw error;
    }
  };

  const startGuidedFlow = () => {
    if (shouldForceSettings) {
      setCurrentScreen('settings');
      return;
    }

    if (shouldForceReading) {
      setCurrentScreen('reading');
      return;
    }

    setIsGuidedFlow(true);
    setGuidedStep(0);
    setCurrentScreen('exercises');
  };

  const nextStep = () => {
    if (guidedStep === 0) {
      setGuidedStep(1);
      setCurrentScreen('reading');
    } else if (guidedStep === 1) {
      setGuidedStep(2);
      setCurrentScreen('vocabulary');
    } else {
      setIsGuidedFlow(false);
      setIsLessonFinished(true);
      setCurrentScreen('home');
    }
  };

  const handleNavChange = (nextScreen: string) => {
    const target = nextScreen as ScreenId;
    if (shouldForceSettings && target !== 'home' && target !== 'settings') {
      showHint('Сначала открой настройки, чтобы начать дневной план.');
      return;
    }
    setCurrentScreen(target);
  };

  const handleDisabledNavClick = () => {
    if (shouldForceSettings) {
      showHint('Открой настройки, чтобы продолжить.', 'onboarding');
      return;
    }
    showHint('Сначала заверши сегодняшний текст.', 'onboarding');
  };

  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors flex items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Загружаем профиль...</p>
      </div>
    );
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return (
          <HomeScreen
            onNavigate={handleNavChange}
            onStartFlow={startGuidedFlow}
            isLessonFinished={isLessonFinished}
            userName={appUser?.firstName}
            streakDays={streakDays}
            isFirstTextCompleted={isFirstTextCompleted}
            isFirstSetup={shouldForceSettings}
          />
        );
      case 'exercises':
        return <ExercisesScreen onBack={() => setCurrentScreen('home')} onNext={isGuidedFlow ? nextStep : undefined} />;
      case 'reading':
        return (
          <ReadingScreen
            onBack={() => setCurrentScreen('home')}
            onNext={isGuidedFlow ? nextStep : undefined}
            onCompleteText={handleCompleteFirstText}
            userLevel={appUser?.settings?.englishLevel ?? null}
            readingMinutes={appUser?.settings?.dailyReadingMinutes ?? null}
          />
        );
      case 'vocabulary':
        return <VocabularyScreen onBack={() => setCurrentScreen('home')} onNext={isGuidedFlow ? nextStep : undefined} />;
      case 'settings':
        return (
          <SettingsScreen
            onBack={() => setCurrentScreen('home')}
            onSave={handleSaveSettings}
            initialSettings={appUser?.settings}
            isSaving={isSavingSettings}
            isFirstSetup={!isSettingsCompleted}
          />
        );
      default:
        return (
          <HomeScreen
            onNavigate={handleNavChange}
            onStartFlow={startGuidedFlow}
            isLessonFinished={isLessonFinished}
            userName={appUser?.firstName}
            streakDays={streakDays}
            isFirstTextCompleted={isFirstTextCompleted}
            isFirstSetup={shouldForceSettings}
          />
        );
    }
  };

  const disabledNavItems = shouldForceSettings
    ? ['home', 'exercises', 'reading', 'vocabulary']
    : shouldForceReading
      ? ['exercises', 'vocabulary']
      : [];
  const showBottomNav = currentScreen !== 'settings' || isSettingsCompleted;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Layout
        activeNav={currentScreen === 'settings' ? 'home' : currentScreen}
        onNavChange={handleNavChange}
        showBottomNav={showBottomNav}
        disabledNavItems={disabledNavItems}
        onDisabledNavClick={handleDisabledNavClick}
      >
        {renderScreen()}
      </Layout>
      {hintText && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm shadow-lg ${
            hintTone === 'onboarding'
              ? 'bg-pink-500 text-white dark:bg-pink-500 dark:text-white'
              : hintTone === 'success'
                ? 'bg-green-500 text-white dark:bg-orange-500 dark:text-white'
              : 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
          }`}
        >
          {hintText}
        </div>
      )}
    </div>
  );
}

