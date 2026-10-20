import { getMoscowStudyDate } from '../_shared/moscow-study-date.ts'
import type { VocabularyReviewAction } from '../_shared/vocabulary-review.ts'
import { rejectReviewWordResult } from './review-word-contract.ts'
import type { ReviewWordRepository } from './review-word-repository.ts'

export const reviewVocabularyWord = async ({
  userId,
  wordId,
  action,
  repository,
  studyDate = getMoscowStudyDate,
}: {
  userId: string
  wordId: string
  action: VocabularyReviewAction
  repository: ReviewWordRepository
  studyDate?: () => string
}) => {
  const result = await repository.review({
    userId,
    wordId,
    action,
    reviewDate: studyDate(),
  })
  if (!result.ok) {
    return rejectReviewWordResult(result)
  }
  return {
    reviewDate: result.reviewDate,
    wordId: result.wordId,
    word: result.word,
    status: result.status,
    reviewStep: result.reviewStep,
    nextReviewDate: result.nextReviewDate,
    learnedAt: result.learnedAt,
    wasRequired: result.wasRequired,
  }
}
