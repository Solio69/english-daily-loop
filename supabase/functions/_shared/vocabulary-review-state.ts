/// <reference path="../deno-globals.d.ts" />

import type { ServiceClient } from './app.ts'
import { fail } from './server.ts'
import {
  isVocabularyReviewStep,
  type VocabularyReviewStatus,
  type VocabularyReviewStep,
} from './vocabulary-review.ts'

export type VocabularyReviewWordRow = {
  id: string
  word: string
  translation: string
  part_of_speech: string
  is_verb: boolean
  is_regular_verb: boolean | null
  verb_forms: {
    base?: string
    past?: string
    pastParticiple?: string
  } | null
  examples: string[]
  status: VocabularyReviewStatus
  card_status: 'ready'
  review_step: VocabularyReviewStep | null
  next_review_date: string | null
  last_reviewed_at: string | null
  review_count: number
  created_at: string
  updated_at: string
}

export type VocabularyReviewSnapshot = {
  reviewDate: string
  status: 'not_started' | 'in_progress' | 'completed'
  totalReadyCount: number
  requiredTotalCount: number
  reviewedTodayCount: number
  remainingRequiredCount: number
  newAvailableCount: number
  extraAvailableCount: number
  displayTotalCount: number
  displayReviewedCount: number
  displayRemainingCount: number
  completedAt: string | null
  dictionaryActions: {
    pendingCount: number
    needsApprovalCount: number
  }
  currentCard: VocabularyReviewWordRow | null
  currentCardIsOptional: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonnegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string'

const isReviewStatus = (value: unknown): value is VocabularyReviewStatus =>
  value === 'not_started' || value === 'active' || value === 'learned'

const isReviewWordRow = (value: unknown): value is VocabularyReviewWordRow =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.word === 'string' &&
  typeof value.translation === 'string' &&
  typeof value.part_of_speech === 'string' &&
  typeof value.is_verb === 'boolean' &&
  (value.is_regular_verb === null ||
    typeof value.is_regular_verb === 'boolean') &&
  (value.verb_forms === null || isRecord(value.verb_forms)) &&
  Array.isArray(value.examples) &&
  value.examples.every((example) => typeof example === 'string') &&
  isReviewStatus(value.status) &&
  value.card_status === 'ready' &&
  (value.review_step === null || isVocabularyReviewStep(value.review_step)) &&
  isNullableString(value.next_review_date) &&
  isNullableString(value.last_reviewed_at) &&
  isNonnegativeInteger(value.review_count) &&
  typeof value.created_at === 'string' &&
  typeof value.updated_at === 'string'

const isReviewSnapshot = (
  value: unknown,
): value is VocabularyReviewSnapshot => {
  if (!isRecord(value) || !isRecord(value.dictionaryActions)) return false
  const counts = [
    value.totalReadyCount,
    value.requiredTotalCount,
    value.reviewedTodayCount,
    value.remainingRequiredCount,
    value.newAvailableCount,
    value.extraAvailableCount,
    value.displayTotalCount,
    value.displayReviewedCount,
    value.displayRemainingCount,
    value.dictionaryActions.pendingCount,
    value.dictionaryActions.needsApprovalCount,
  ]
  const validStatus =
    value.status === 'not_started' ||
    value.status === 'in_progress' ||
    value.status === 'completed'
  return (
    typeof value.reviewDate === 'string' &&
    validStatus &&
    counts.every(isNonnegativeInteger) &&
    isNullableString(value.completedAt) &&
    (value.currentCard === null || isReviewWordRow(value.currentCard)) &&
    typeof value.currentCardIsOptional === 'boolean'
  )
}

export const loadVocabularyReviewSnapshot = async (
  supabase: ServiceClient,
  userId: string,
  reviewDate: string,
  logPrefix: string,
): Promise<VocabularyReviewSnapshot> => {
  const { data, error } = await supabase.rpc(
    'get_or_create_vocabulary_review_state',
    {
      p_user_id: userId,
      p_review_date: reviewDate,
    },
  )

  if (error) {
    console.error(`${logPrefix} failed to load vocabulary review snapshot`, {
      appUserId: userId,
      reviewDate,
      error: error.message,
    })
    fail(
      500,
      'VOCABULARY_REVIEW_STATE_LOAD_FAILED',
      'Failed to load vocabulary review state.',
    )
  }

  if (!isReviewSnapshot(data)) {
    console.error(
      `${logPrefix} received an invalid vocabulary review snapshot`,
      {
        appUserId: userId,
        reviewDate,
      },
    )
    fail(
      500,
      'VOCABULARY_REVIEW_STATE_INVALID',
      'Vocabulary review state is invalid.',
    )
  }

  return data
}
