import type {
  GenerateReadingTextResult,
  ReadingState,
  ReadingText,
} from '../../src/types/reading'

export const READING_SCREEN_CASE = {
  date: '2026-10-20',
  textId: 'reading-screen-text',
  title: 'A Short Test Story',
  body: 'Hello world. This is a reading text.',
  level: 'A2',
  minutes: 3,
  provider: 'openrouter',
  model: 'test-model',
  promptVersion: 'reading-text-v2',
  source: 'ai',
  dailyLimit: 10,
  usedAttempts: 1,
  remainingAttempts: 9,
  newRemainingAttempts: 8,
  stateReadsAfterRecovery: 2,
  word: 'Hello',
  wordIndex: 0,
  cardStatus: 'pending',
  changedStatus: 'in_progress',
  completedStatus: 'completed',
  generateButton: 'Сгенерировать текст',
  completeButton: 'Завершить текст',
  addButton: 'Добавить',
  deleteButton: 'Удалить',
  errorTitle: 'Не удалось сгенерировать текст',
  networkError: 'Сеть недоступна',
  invalidStateMessage: 'Не удалось загрузить состояние чтения.',
  invalidGenerationMessage: 'Не удалось обратиться к AI-сервису.',
} as const

export const ACTIVE_READING_TEXT: ReadingText = {
  id: READING_SCREEN_CASE.textId,
  title: READING_SCREEN_CASE.title,
  body: READING_SCREEN_CASE.body,
  level: READING_SCREEN_CASE.level,
  estimatedMinutes: READING_SCREEN_CASE.minutes,
  lastReadParagraphIndex: null,
  savedWordIndexes: [],
  pendingSavedWordIndexes: [],
  source: READING_SCREEN_CASE.source,
  generation: {
    provider: READING_SCREEN_CASE.provider,
    model: READING_SCREEN_CASE.model,
    fallbackUsed: false,
    promptVersion: READING_SCREEN_CASE.promptVersion,
  },
}

export const EMPTY_READING_STATE: ReadingState = {
  today: READING_SCREEN_CASE.date,
  dailyLimit: READING_SCREEN_CASE.dailyLimit,
  usedAttempts: READING_SCREEN_CASE.usedAttempts,
  remainingAttempts: READING_SCREEN_CASE.remainingAttempts,
  isReadingCompletedToday: false,
  activeText: null,
}

export const ACTIVE_READING_STATE: ReadingState = {
  ...EMPTY_READING_STATE,
  activeText: ACTIVE_READING_TEXT,
}

export const GENERATED_READING_RESULT: GenerateReadingTextResult = {
  text: ACTIVE_READING_TEXT,
  dailyLimit: READING_SCREEN_CASE.dailyLimit,
  usedAttempts: READING_SCREEN_CASE.usedAttempts,
  remainingAttempts: READING_SCREEN_CASE.newRemainingAttempts,
}

export const GENERATION_API_PAYLOAD = {
  text: ACTIVE_READING_TEXT,
  generation: ACTIVE_READING_TEXT.generation,
  dailyLimit: READING_SCREEN_CASE.dailyLimit,
  usedAttempts: READING_SCREEN_CASE.usedAttempts,
  remainingAttempts: READING_SCREEN_CASE.newRemainingAttempts,
}

export const INVALID_READING_STATE = { ...EMPTY_READING_STATE, activeText: {} }
export const INVALID_GENERATION_PAYLOAD = {
  ...GENERATION_API_PAYLOAD,
  text: {},
}

export const SAVED_WORD_RESULT = {
  wordIndex: READING_SCREEN_CASE.wordIndex,
  cardStatus: READING_SCREEN_CASE.cardStatus,
}

export const DELETED_WORD_RESULT = {
  removedWordIndexes: [READING_SCREEN_CASE.wordIndex],
}
