import type {
  PrepareVocabularyCardsResult,
  VocabularyReviewState,
  VocabularyState,
  VocabularyWordsPage,
} from '../../src/types/vocabulary'

export const VOCABULARY_CLIENT = {
  wordId: 'f1100000-0000-4000-8000-000000000001',
  word: 'apple',
  translation: 'яблоко',
  example: 'An apple grows.',
  date: '2026-10-20',
  timestamp: '2026-10-20T10:00:00Z',
  reviewButton: '3 дня',
  reviewAction: 'next_step',
  revealButton: 'Показать перевод',
  retryButton: 'Загрузить следующую карточку',
  savedHeading: 'Ответ сохранён',
  prepareButton: 'Готовить',
  emptyHeading: 'Слов для повторения пока нет',
  completeHeading: 'Повторение готово',
  dictionaryHeading: 'Словарь',
  approvalHeading: 'Требуют подтверждения',
  homeNav: 'Главная',
  materialsNav: 'Материалы',
  reviewNav: 'Слова',
  networkError: 'Сеть недоступна',
  invalidResponse: 'Некорректный ответ сервера.',
  one: 1,
  zero: 0,
  two: 2,
  three: 3,
  dailyLimit: 10,
} as const

export const VOCABULARY_E2E = {
  themes: ['light', 'dark'] as const,
  paths: {
    readingHistory: '/functions/v1/get-reading-history',
    vocabularyState: '/functions/v1/get-vocabulary-state',
    vocabularyWords: '/functions/v1/get-vocabulary-words',
    prepareCards: '/functions/v1/prepare-vocabulary-cards',
    reviewState: '/functions/v1/get-vocabulary-review-state',
    reviewWord: '/functions/v1/review-vocabulary-word',
  },
  settings: {
    englishLevel: 'A2',
    dailyReadingMinutes: VOCABULARY_CLIENT.three,
  },
  progressStatus: 'in_progress',
  optionsMethod: 'OPTIONS',
  javascriptContentType: 'text/javascript',
  jsonContentType: 'application/json',
  successStatus: 200,
  optionsStatus: 204,
  emptyBody: '',
  mobileWidth: 390,
  emptyHistory: { items: [], nextCursor: null },
  reviewResult: {
    reviewDate: VOCABULARY_CLIENT.date,
    wordId: VOCABULARY_CLIENT.wordId,
    word: VOCABULARY_CLIENT.word,
    status: 'active',
    reviewStep: '3_days',
    nextReviewDate: VOCABULARY_CLIENT.date,
    learnedAt: null,
    wasRequired: true,
  },
} as const

export const VOCABULARY_REVIEW_STATE: VocabularyReviewState = {
  reviewDate: VOCABULARY_CLIENT.date,
  status: 'in_progress',
  totalReadyCount: VOCABULARY_CLIENT.one,
  requiredTotalCount: VOCABULARY_CLIENT.one,
  reviewedTodayCount: VOCABULARY_CLIENT.zero,
  remainingRequiredCount: VOCABULARY_CLIENT.one,
  newAvailableCount: VOCABULARY_CLIENT.one,
  extraAvailableCount: VOCABULARY_CLIENT.zero,
  displayTotalCount: VOCABULARY_CLIENT.one,
  displayReviewedCount: VOCABULARY_CLIENT.zero,
  displayRemainingCount: VOCABULARY_CLIENT.one,
  completedAt: null,
  dictionaryActions: {
    pendingCount: VOCABULARY_CLIENT.zero,
    needsApprovalCount: VOCABULARY_CLIENT.zero,
  },
  currentCard: {
    id: VOCABULARY_CLIENT.wordId,
    word: VOCABULARY_CLIENT.word,
    translation: VOCABULARY_CLIENT.translation,
    partOfSpeech: 'noun',
    isVerb: false,
    isRegularVerb: null,
    verbForms: null,
    examples: [VOCABULARY_CLIENT.example],
    status: 'active',
    cardStatus: 'ready',
    reviewStep: '1_day',
    nextReviewDate: VOCABULARY_CLIENT.date,
    lastReviewedAt: VOCABULARY_CLIENT.timestamp,
    createdAt: VOCABULARY_CLIENT.timestamp,
    updatedAt: VOCABULARY_CLIENT.timestamp,
    reviewCount: VOCABULARY_CLIENT.one,
    isOptional: false,
    actions: [
      { action: 'forgot', label: 'Не помню' },
      { action: 'same_step', label: '1 день' },
      { action: 'next_step', label: VOCABULARY_CLIENT.reviewButton },
      { action: 'jump_step', label: '7 дней' },
    ],
  },
}

export const VOCABULARY_EMPTY_REVIEW_STATE: VocabularyReviewState = {
  ...VOCABULARY_REVIEW_STATE,
  status: 'completed',
  totalReadyCount: VOCABULARY_CLIENT.zero,
  requiredTotalCount: VOCABULARY_CLIENT.zero,
  remainingRequiredCount: VOCABULARY_CLIENT.zero,
  newAvailableCount: VOCABULARY_CLIENT.zero,
  displayTotalCount: VOCABULARY_CLIENT.zero,
  displayRemainingCount: VOCABULARY_CLIENT.zero,
  completedAt: VOCABULARY_CLIENT.timestamp,
  currentCard: null,
}

export const VOCABULARY_STATE: VocabularyState = {
  pendingCount: VOCABULARY_CLIENT.one,
  needsApprovalCount: VOCABULARY_CLIENT.zero,
  readyCount: VOCABULARY_CLIENT.zero,
  totalCount: VOCABULARY_CLIENT.one,
  cardGeneration: {
    dailyLimit: VOCABULARY_CLIENT.dailyLimit,
    usedAttempts: VOCABULARY_CLIENT.zero,
    remainingAttempts: VOCABULARY_CLIENT.dailyLimit,
  },
}

export const VOCABULARY_WORDS: VocabularyWordsPage = {
  needsApproval: [],
  ready: [],
}

export const VOCABULARY_PREPARED: PrepareVocabularyCardsResult = {
  preparedCount: VOCABULARY_CLIENT.one,
  failedCount: VOCABULARY_CLIENT.zero,
  mergedCount: VOCABULARY_CLIENT.zero,
  reactivatedCount: VOCABULARY_CLIENT.zero,
  remainingPendingCount: VOCABULARY_CLIENT.zero,
  needsApprovalCount: VOCABULARY_CLIENT.zero,
  dailyLimit: VOCABULARY_CLIENT.dailyLimit,
  usedAttempts: VOCABULARY_CLIENT.one,
  remainingAttempts: VOCABULARY_CLIENT.dailyLimit - VOCABULARY_CLIENT.one,
}

export const INVALID_VOCABULARY_STATE = {
  ...VOCABULARY_STATE,
  pendingCount: null,
}

export const INVALID_VOCABULARY_REVIEW_STATE = {
  ...VOCABULARY_REVIEW_STATE,
  currentCard: { ...VOCABULARY_REVIEW_STATE.currentCard, actions: null },
}

export const VOCABULARY_APPROVAL_STATE = {
  ...VOCABULARY_STATE,
  needsApprovalCount: VOCABULARY_CLIENT.one,
}

export const VOCABULARY_APPROVAL_WORDS = {
  needsApproval: [VOCABULARY_REVIEW_STATE.currentCard],
  ready: [],
}
