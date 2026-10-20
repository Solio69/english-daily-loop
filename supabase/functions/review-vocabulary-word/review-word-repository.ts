import type { ServiceClient } from '../_shared/app.ts'
import { fail, HTTP_STATUS } from '../_shared/server.ts'
import {
  isVocabularyReviewStep,
  type VocabularyReviewAction,
  type VocabularyReviewStep,
} from '../_shared/vocabulary-review.ts'
import { REVIEW_WORD_CODE, REVIEW_WORD_ERROR } from './review-word-contract.ts'

const LOG_PREFIX = '[review-vocabulary-word]'
const REVIEW_RPC = 'review_vocabulary_word'

type ReviewResult =
  | {
      ok: true
      reviewDate: string
      wordId: string
      word: string
      status: 'active' | 'learned'
      reviewStep: VocabularyReviewStep | null
      nextReviewDate: string | null
      learnedAt: string | null
      wasRequired: boolean
    }
  | { ok: false; code: string; message: string }

export type ReviewWordRepository = {
  review: (input: {
    userId: string
    wordId: string
    action: VocabularyReviewAction
    reviewDate: string
  }) => Promise<ReviewResult>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string'

const isReviewResult = (value: unknown): value is ReviewResult => {
  if (!isRecord(value) || typeof value.ok !== 'boolean') return false
  if (!value.ok) {
    return typeof value.code === 'string' && typeof value.message === 'string'
  }
  const validStatus = value.status === 'active' || value.status === 'learned'
  return (
    typeof value.reviewDate === 'string' &&
    typeof value.wordId === 'string' &&
    typeof value.word === 'string' &&
    validStatus &&
    (value.reviewStep === null || isVocabularyReviewStep(value.reviewStep)) &&
    isNullableString(value.nextReviewDate) &&
    isNullableString(value.learnedAt) &&
    typeof value.wasRequired === 'boolean'
  )
}

export const createReviewWordRepository = (
  supabase: ServiceClient,
): ReviewWordRepository => ({
  review: async ({ userId, wordId, action, reviewDate }) => {
    const { data, error } = await supabase.rpc(REVIEW_RPC, {
      p_user_id: userId,
      p_word_id: wordId,
      p_action: action,
      p_review_date: reviewDate,
    })
    if (error) {
      console.error(LOG_PREFIX + ' failed to review word', {
        appUserId: userId,
        wordId,
        action,
        error: error.message,
      })
    }
    if (error || !isReviewResult(data)) {
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        REVIEW_WORD_CODE.reviewFailed,
        REVIEW_WORD_ERROR.reviewFailed,
      )
    }
    return data
  },
})
