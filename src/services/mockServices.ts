import { mockUser, mockLessons, mockExercises, mockReadingTexts, mockVocabulary } from '../data/mockData';
import { User, Lesson, Exercise, ReadingText, VocabularyItem } from '../types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getMockDailyPlan = async (): Promise<{ lesson: Lesson, exercises: Exercise[] }> => {
  await delay(500);
  return { lesson: mockLessons[1], exercises: mockExercises };
};

export const getMockExercisesForLesson = async (lessonId: string): Promise<Exercise[]> => {
  await delay(800);
  return mockExercises.filter(e => e.lessonId === lessonId);
};

export const checkMockExerciseAnswer = async (exerciseId: string, answer: string): Promise<boolean> => {
  await delay(300);
  const exercise = mockExercises.find(e => e.id === exerciseId);
  return exercise?.correctAnswer.toLowerCase() === answer.toLowerCase();
};

export const getMockReadingText = async (level: string): Promise<ReadingText> => {
  await delay(1000);
  return mockReadingTexts[0];
};

export const saveMockVocabularyItem = async (item: VocabularyItem): Promise<void> => {
  await delay(200);
  console.log('Word saved:', item);
};

export const getMockReviewQueue = async (): Promise<VocabularyItem[]> => {
  await delay(600);
  return mockVocabulary;
};
