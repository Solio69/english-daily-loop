import type { VocabularyCardBatchItem } from './vocabulary.ts'
import type { PreparationRepository } from '../prepare-vocabulary-cards/preparation-repository.ts'

export const CARD_PREPARATION = {
  userId: 'user-1',
  requestId: 'request-12345678',
  apiKey: 'test-key',
  studyDate: '2026-10-20',
  startedAt: 1,
  model: 'test/model',
  attemptId: 'attempt-1',
  dailyLimit: 2,
  usedAttempts: 1,
  remainingAttempts: 1,
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  firstWordId: 'word-id-1',
  secondWordId: 'word-id-2',
  thirdWordId: 'word-id-3',
  firstWord: 'apple',
  secondWord: 'pear',
  thirdWord: 'tree',
  unknownWordId: 'unknown-word',
  level: 'A2',
  providerFailure: 'Provider failed',
  exhaustedCode: 'VOCABULARY_CARD_ATTEMPTS_EXHAUSTED',
  exhaustedStatus: 429,
} as const

export const CARD_PREPARATION_WORDS = [
  { id: CARD_PREPARATION.firstWordId, word: CARD_PREPARATION.firstWord },
  { id: CARD_PREPARATION.secondWordId, word: CARD_PREPARATION.secondWord },
  { id: CARD_PREPARATION.thirdWordId, word: CARD_PREPARATION.thirdWord },
]

export const CARD_PREPARATION_CARD: VocabularyCardBatchItem = {
  id: CARD_PREPARATION.firstWordId,
  word: CARD_PREPARATION.firstWord,
  translation: 'яблоко',
  partOfSpeech: 'noun',
  isVerb: false,
  isRegularVerb: null,
  verbForms: null,
  examples: [
    'I ate an apple today.',
    'The apple is very sweet.',
    'She bought a green apple.',
  ],
  level: CARD_PREPARATION.level,
}

export const createCardPreparationHarness = (
  overrides: Partial<PreparationRepository> = {},
) => {
  const calls = {
    order: [] as string[],
    succeededCounts: null as Record<string, number> | null,
    failedCounts: null as Record<string, number> | null,
  }
  const repository: PreparationRepository = {
    getEnglishLevel: () => {
      calls.order.push('level')
      return Promise.resolve(CARD_PREPARATION.level)
    },
    loadPending: () => {
      calls.order.push('pending')
      return Promise.resolve([...CARD_PREPARATION_WORDS])
    },
    getDailyLimit: () => {
      calls.order.push('limit')
      return Promise.resolve(CARD_PREPARATION.dailyLimit)
    },
    getGenerationState: () => {
      calls.order.push('state')
      return Promise.resolve({
        dailyLimit: CARD_PREPARATION.dailyLimit,
        usedAttempts: CARD_PREPARATION.usedAttempts,
        remainingAttempts: CARD_PREPARATION.remainingAttempts,
      })
    },
    claim: () => {
      calls.order.push('claim')
      return Promise.resolve({
        attemptId: CARD_PREPARATION.attemptId,
        usedAttempts: CARD_PREPARATION.usedAttempts,
        remainingAttempts: CARD_PREPARATION.remainingAttempts,
      })
    },
    updateMetadata: () => {
      calls.order.push('metadata')
      return Promise.resolve()
    },
    markFailed: ({ counts }) => {
      calls.order.push('failed')
      calls.failedCounts = counts ? { ...counts } : null
      return Promise.resolve()
    },
    markSucceeded: ({ counts }) => {
      calls.order.push('succeeded')
      calls.succeededCounts = { ...counts }
      return Promise.resolve()
    },
    saveCard: () => {
      calls.order.push('save')
      return Promise.resolve({
        prepared: true,
        cancelled: false,
        merged: false,
        reactivated: false,
      })
    },
    countPending: () => {
      calls.order.push('countPending')
      return Promise.resolve(CARD_PREPARATION.one)
    },
    countNeedsApproval: () => {
      calls.order.push('countApproval')
      return Promise.resolve(CARD_PREPARATION.zero)
    },
    ...overrides,
  }
  return { repository, calls }
}
