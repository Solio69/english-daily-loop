import { fail, HTTP_STATUS } from '../_shared/server.ts'
import type { VocabularyReviewAction } from '../_shared/vocabulary-review.ts'

export const REVIEW_WORD_CODE = {
  wordIdRequired: 'WORD_ID_REQUIRED',
  invalidAction: 'INVALID_REVIEW_ACTION',
  wordNotFound: 'VOCABULARY_WORD_NOT_FOUND',
  reviewFailed: 'VOCABULARY_REVIEW_FAILED',
} as const

export const REVIEW_WORD_ERROR = {
  wordIdRequired: 'wordId is required.',
  invalidAction: 'Review action is invalid.',
  reviewFailed: 'Failed to review vocabulary word.',
} as const

export const parseReviewWordInput = (body: {
  wordId?: unknown
  action?: unknown
}): { wordId: string; action: VocabularyReviewAction } => {
  const wordId = typeof body?.wordId === 'string' ? body.wordId.trim() : ''
  if (!wordId) {
    fail(
      HTTP_STATUS.BAD_REQUEST,
      REVIEW_WORD_CODE.wordIdRequired,
      REVIEW_WORD_ERROR.wordIdRequired,
    )
  }
  const action = body?.action
  const validAction =
    action === 'forgot' ||
    action === 'same_step' ||
    action === 'next_step' ||
    action === 'jump_step'
  if (!validAction) {
    fail(
      HTTP_STATUS.BAD_REQUEST,
      REVIEW_WORD_CODE.invalidAction,
      REVIEW_WORD_ERROR.invalidAction,
    )
  }
  return { wordId, action }
}

export const rejectReviewWordResult = ({
  code,
  message,
}: {
  code: string
  message: string
}): never => {
  const status =
    code === REVIEW_WORD_CODE.wordNotFound
      ? HTTP_STATUS.NOT_FOUND
      : HTTP_STATUS.CONFLICT
  fail(status, code, message)
}
