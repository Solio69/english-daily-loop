export interface User {
  id: string;
  name: string;
  level: 'A1' | 'A2' | 'B1';
  streak: number;
  exercisesCompleted: number;
  readingMinutes: number;
  wordsInStudy: number;
}

export interface Lesson {
  id: string;
  title: string;
  level: 'A1' | 'A2' | 'B1';
  grammarFocus: string;
  completed: boolean;
}

export interface Exercise {
  id: string;
  lessonId: string;
  type: 'shuffle' | 'translate';
  prompt: string;
  correctAnswer: string;
  options?: string[];
}

export interface ReadingText {
  id: string;
  title: string;
  level: 'A1' | 'A2' | 'B1';
  body: string;
  lessonId: string;
}

export interface VocabularyItem {
  id: string;
  word: string;
  translation: string;
  example: string;
  lessonId: string;
  dueAt: Date;
}
