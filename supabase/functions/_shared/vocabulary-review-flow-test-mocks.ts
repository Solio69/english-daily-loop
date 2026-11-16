import type { ReviewStateRepository } from '../get-vocabulary-review-state/review-state-repository.ts'
import type { ReviewWordRepository } from '../review-vocabulary-word/review-word-repository.ts'
import type {
  VocabularyReviewSnapshot,
  VocabularyReviewWordRow,
} from './vocabulary-review-state.ts'

export const REVIEW_FLOW = {
  userId: 'review-user-1',
  wordId: 'review-word-1',
  word: 'apple',
  reviewDate: '2026-10-20',
  nextReviewDate: '2026-10-21',
  createdAt: '2026-10-20T06:00:00Z',
  partOfSpeech: 'noun',
  translation: 'яблоко',
  example: 'An apple grows.',
  expectedNotFoundStatus: 404,
  expectedConflictStatus: 409,
  expectedBadRequestStatus: 400,
  expectedServerErrorStatus: 500,
  requiredTotal: 2,
  optionalTotal: 1,
  one: 1,
  zero: 0,
  noCalls: 0,
  oneCall: 1,
  callIncrement: 1,
  missingWordCode: 'VOCABULARY_WORD_NOT_FOUND',
  notReadyCode: 'VOCABULARY_CARD_NOT_READY',
  malformedCode: 'VOCABULARY_REVIEW_STATE_INVALID',
  malformedReviewCode: 'VOCABULARY_REVIEW_FAILED',
  invalidActionCode: 'INVALID_REVIEW_ACTION',
  requiredWordCode: 'WORD_ID_REQUIRED',
  emptyWordId: ' ',
  badAction: 'skip',
} as const

export const reviewCard: VocabularyReviewWordRow = {
  id: REVIEW_FLOW.wordId,
  word: REVIEW_FLOW.word,
  translation: REVIEW_FLOW.translation,
  part_of_speech: REVIEW_FLOW.partOfSpeech,
  is_verb: false,
  is_regular_verb: null,
  verb_forms: null,
  examples: [REVIEW_FLOW.example],
  status: 'active',
  card_status: 'ready',
  review_step: '1_day',
  next_review_date: REVIEW_FLOW.nextReviewDate,
  last_reviewed_at: REVIEW_FLOW.createdAt,
  review_count: REVIEW_FLOW.one,
  created_at: REVIEW_FLOW.createdAt,
  updated_at: REVIEW_FLOW.createdAt,
}

export const reviewSnapshot: VocabularyReviewSnapshot = {
  reviewDate: REVIEW_FLOW.reviewDate,
  status: 'in_progress',
  totalReadyCount: REVIEW_FLOW.requiredTotal + REVIEW_FLOW.optionalTotal,
  requiredTotalCount: REVIEW_FLOW.requiredTotal,
  reviewedTodayCount: REVIEW_FLOW.one,
  remainingRequiredCount: REVIEW_FLOW.one,
  newAvailableCount: REVIEW_FLOW.zero,
  extraAvailableCount: REVIEW_FLOW.optionalTotal,
  displayTotalCount: REVIEW_FLOW.requiredTotal + REVIEW_FLOW.optionalTotal,
  displayReviewedCount: REVIEW_FLOW.one,
  displayRemainingCount: REVIEW_FLOW.requiredTotal,
  completedAt: null,
  dictionaryActions: {
    pendingCount: REVIEW_FLOW.zero,
    needsApprovalCount: REVIEW_FLOW.zero,
  },
  currentCard: reviewCard,
  currentCardIsOptional: false,
}

export const emptyReviewSnapshot: VocabularyReviewSnapshot = {
  ...reviewSnapshot,
  status: 'completed',
  totalReadyCount: REVIEW_FLOW.zero,
  requiredTotalCount: REVIEW_FLOW.zero,
  reviewedTodayCount: REVIEW_FLOW.zero,
  remainingRequiredCount: REVIEW_FLOW.zero,
  newAvailableCount: REVIEW_FLOW.zero,
  extraAvailableCount: REVIEW_FLOW.zero,
  displayTotalCount: REVIEW_FLOW.zero,
  displayReviewedCount: REVIEW_FLOW.zero,
  displayRemainingCount: REVIEW_FLOW.zero,
  completedAt: REVIEW_FLOW.createdAt,
  currentCard: null,
}

export const reviewSuccess = {
  ok: true,
  reviewDate: REVIEW_FLOW.reviewDate,
  wordId: REVIEW_FLOW.wordId,
  word: REVIEW_FLOW.word,
  status: 'active',
  reviewStep: '3_days',
  nextReviewDate: REVIEW_FLOW.nextReviewDate,
  learnedAt: null,
  wasRequired: true,
} as const

export const createReviewStateHarness = (
  snapshot: VocabularyReviewSnapshot = reviewSnapshot,
) => {
  const calls = { count: REVIEW_FLOW.noCalls, reviewDate: '' }
  const repository: ReviewStateRepository = {
    loadSnapshot: ({ reviewDate }) => {
      calls.count += REVIEW_FLOW.callIncrement
      calls.reviewDate = reviewDate
      return Promise.resolve(snapshot)
    },
  }
  return { repository, calls }
}

export const createReviewWordHarness = (
  result: Awaited<ReturnType<ReviewWordRepository['review']>> = reviewSuccess,
) => {
  const calls = { count: REVIEW_FLOW.noCalls, reviewDate: '', action: '' }
  const repository: ReviewWordRepository = {
    review: ({ reviewDate, action }) => {
      calls.count += REVIEW_FLOW.callIncrement
      calls.reviewDate = reviewDate
      calls.action = action
      return Promise.resolve(result)
    },
  }
  return { repository, calls }
}
