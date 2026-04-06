/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { HomeScreen } from './screens/HomeScreen';
import { ExercisesScreen } from './screens/ExercisesScreen';
import { ReadingScreen } from './screens/ReadingScreen';
import { VocabularyScreen } from './screens/VocabularyScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [isGuidedFlow, setIsGuidedFlow] = useState(false);
  const [guidedStep, setGuidedStep] = useState(0); // 0: exercises, 1: reading, 2: vocabulary
  const [isLessonFinished, setIsLessonFinished] = useState(false);

  const startGuidedFlow = () => {
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

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return <HomeScreen onNavigate={setCurrentScreen} onStartFlow={startGuidedFlow} isLessonFinished={isLessonFinished} />;
      case 'exercises':
        return <ExercisesScreen onBack={() => setCurrentScreen('home')} onNext={isGuidedFlow ? nextStep : undefined} />;
      case 'reading':
        return <ReadingScreen onBack={() => setCurrentScreen('home')} onNext={isGuidedFlow ? nextStep : undefined} />;
      case 'vocabulary':
        return <VocabularyScreen onBack={() => setCurrentScreen('home')} onNext={isGuidedFlow ? nextStep : undefined} />;
      case 'settings':
        return <SettingsScreen onBack={() => setCurrentScreen('home')} />;
      default:
        return <HomeScreen onNavigate={setCurrentScreen} onStartFlow={startGuidedFlow} isLessonFinished={isLessonFinished} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Layout activeNav={currentScreen === 'settings' ? 'home' : currentScreen} onNavChange={setCurrentScreen}>
        {renderScreen()}
      </Layout>
    </div>
  );
}
