import { User, Lesson, ReadingText, VocabularyItem } from '../types';

export const mockUser: User = {
  id: 'u1',
  name: 'Alex',
  level: 'A1',
  streak: 5,
  readingMinutes: 45,
  wordsInStudy: 30,
};

export const mockLessons: Lesson[] = [
  { id: 'l1', title: 'To Be', level: 'A1', grammarFocus: 'Basic verbs', completed: true },
  { id: 'l2', title: 'Basic Statements', level: 'A1', grammarFocus: 'Sentence structure', completed: false },
  { id: 'l3', title: 'Present Simple', level: 'A2', grammarFocus: 'Daily routines', completed: false },
];

export const mockReadingTexts: ReadingText[] = [
  { id: 'r1', title: 'My Day', level: 'A1', body: 'I wake up at 7 am. I drink coffee. I go to work.', lessonId: 'l1' },
];

export const mockVocabulary: VocabularyItem[] = [
  { id: 'v1', word: 'student', translation: 'студент', example: 'I am a student.', lessonId: 'l1', dueAt: new Date() },
  { id: 'v2', word: 'friend', translation: 'друг', example: 'He is my friend.', lessonId: 'l1', dueAt: new Date() },
];
