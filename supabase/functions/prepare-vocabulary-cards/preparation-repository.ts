import { getUserEnglishLevel, type ServiceClient } from '../_shared/app.ts'
import { fail, HTTP_STATUS } from '../_shared/server.ts'
import type {
  EnglishLevel,
  VocabularyCardBatchItem,
} from '../_shared/vocabulary.ts'
import {
  claimVocabularyCardGenerationAttempt,
  getDailyVocabularyCardGenerationLimit,
  getVocabularyCardGenerationState,
  markVocabularyCardAttemptFailed,
  markVocabularyCardAttemptSucceeded,
  updateVocabularyCardAttemptMetadata,
  type ClaimedVocabularyCardGenerationAttempt,
  type VocabularyCardAttemptCounts,
  type VocabularyCardGenerationState,
} from '../_shared/vocabulary-card-generation.ts'
import { VOCABULARY_CARD_PROMPT_VERSION } from './card-prompt.ts'
import { saveGeneratedCard, type CardSaveResult } from './card-persistence.ts'

const LOG_PREFIX = '[prepare-vocabulary-cards]'
const WORDS_TABLE = 'user_vocabulary_words'
const USER_ID_COLUMN = 'user_id'
const CARD_STATUS_COLUMN = 'card_status'
const PENDING_STATUS = 'pending'
const APPROVAL_STATUS = 'needs_approval'
const BATCH_SIZE = 5
const ZERO = 0

export type PendingWordRow = { id: string; word: string }

export type PreparationRepository = {
  getEnglishLevel: (userId: string) => Promise<EnglishLevel>
  loadPending: (userId: string) => Promise<PendingWordRow[]>
  getDailyLimit: (userId: string) => Promise<number>
  getGenerationState: (input: {
    userId: string
    studyDate: string
  }) => Promise<VocabularyCardGenerationState>
  claim: (input: {
    userId: string
    studyDate: string
    dailyLimit: number
    requestedCount: number
  }) => Promise<ClaimedVocabularyCardGenerationAttempt>
  updateMetadata: (input: {
    attemptId: string
    userId: string
    models: string[]
  }) => Promise<void>
  markFailed: (input: {
    attemptId: string
    userId: string
    models?: string[]
    counts?: VocabularyCardAttemptCounts
    durationMs: number
    errorCode: string
    errorMessage: string
  }) => Promise<void>
  markSucceeded: (input: {
    attemptId: string
    userId: string
    model: string | null
    models: string[]
    counts: VocabularyCardAttemptCounts
    durationMs: number
  }) => Promise<void>
  saveCard: (input: {
    userId: string
    pendingWordId: string
    card: VocabularyCardBatchItem
  }) => Promise<CardSaveResult>
  countPending: (userId: string) => Promise<number>
  countNeedsApproval: (userId: string) => Promise<number>
}

const isPendingWord = (value: unknown): value is PendingWordRow =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  typeof value.id === 'string' &&
  'word' in value &&
  typeof value.word === 'string'

export const createPreparationRepository = (
  supabase: ServiceClient,
): PreparationRepository => ({
  getEnglishLevel: (userId) =>
    getUserEnglishLevel(supabase, userId, LOG_PREFIX),
  loadPending: async (userId) => {
    const { data, error } = await supabase
      .from(WORDS_TABLE)
      .select('id, word')
      .eq(USER_ID_COLUMN, userId)
      .eq(CARD_STATUS_COLUMN, PENDING_STATUS)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE)
    if (error) {
      console.error(LOG_PREFIX + ' failed to load pending words', {
        appUserId: userId,
        error: error.message,
      })
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'PENDING_WORDS_LOAD_FAILED',
        'Failed to load pending words.',
      )
    }
    const rows = data ?? []
    if (!Array.isArray(rows) || !rows.every(isPendingWord)) {
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'PENDING_WORDS_LOAD_FAILED',
        'Failed to load pending words.',
      )
    }
    return rows
  },
  getDailyLimit: (userId) =>
    getDailyVocabularyCardGenerationLimit(supabase, userId, LOG_PREFIX),
  getGenerationState: ({ userId, studyDate }) =>
    getVocabularyCardGenerationState(supabase, userId, studyDate, LOG_PREFIX),
  claim: ({ userId, studyDate, dailyLimit, requestedCount }) =>
    claimVocabularyCardGenerationAttempt(
      supabase,
      userId,
      studyDate,
      dailyLimit,
      requestedCount,
      LOG_PREFIX,
    ),
  updateMetadata: ({ attemptId, userId, models }) =>
    updateVocabularyCardAttemptMetadata({
      supabase,
      attemptId,
      userId,
      promptVersion: VOCABULARY_CARD_PROMPT_VERSION,
      modelChain: models,
      logPrefix: LOG_PREFIX,
    }),
  markFailed: ({
    attemptId,
    userId,
    models,
    counts,
    durationMs,
    errorCode,
    errorMessage,
  }) =>
    markVocabularyCardAttemptFailed({
      supabase,
      attemptId,
      userId,
      promptVersion: VOCABULARY_CARD_PROMPT_VERSION,
      modelChain: models,
      counts,
      durationMs,
      errorCode,
      errorMessage,
      logPrefix: LOG_PREFIX,
    }),
  markSucceeded: ({ attemptId, userId, model, models, counts, durationMs }) =>
    markVocabularyCardAttemptSucceeded({
      supabase,
      attemptId,
      userId,
      model,
      promptVersion: VOCABULARY_CARD_PROMPT_VERSION,
      modelChain: models,
      counts,
      durationMs,
      logPrefix: LOG_PREFIX,
    }),
  saveCard: ({ userId, pendingWordId, card }) =>
    saveGeneratedCard({ supabase, userId, pendingWordId, card }),
  countPending: async (userId) => {
    const { count, error } = await supabase
      .from(WORDS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq(USER_ID_COLUMN, userId)
      .eq(CARD_STATUS_COLUMN, PENDING_STATUS)
    if (error) {
      console.error(LOG_PREFIX + ' failed to count remaining words', {
        appUserId: userId,
        error: error.message,
      })
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'VOCABULARY_COUNT_FAILED',
        'Failed to count pending words.',
      )
    }
    return count ?? ZERO
  },
  countNeedsApproval: async (userId) => {
    const { count, error } = await supabase
      .from(WORDS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq(USER_ID_COLUMN, userId)
      .eq(CARD_STATUS_COLUMN, APPROVAL_STATUS)
    if (error) {
      console.error(LOG_PREFIX + ' failed to count approval words', {
        appUserId: userId,
        error: error.message,
      })
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'VOCABULARY_COUNT_FAILED',
        'Failed to count approval words.',
      )
    }
    return count ?? ZERO
  },
})
