import { getMoscowStudyDate } from '../_shared/moscow-study-date.ts'
import { getReviewActionOptions } from '../_shared/vocabulary-review.ts'
import type { VocabularyReviewWordRow } from '../_shared/vocabulary-review-state.ts'
import type { ReviewStateRepository } from './review-state-repository.ts'

const toReviewCard = ({
  row,
  isOptional,
}: {
  row: VocabularyReviewWordRow
  isOptional: boolean
}) => ({
  id: row.id,
  word: row.word,
  translation: row.translation,
  partOfSpeech: row.part_of_speech,
  isVerb: row.is_verb,
  isRegularVerb: row.is_regular_verb,
  verbForms: row.verb_forms,
  examples: row.examples,
  status: row.status,
  cardStatus: row.card_status,
  reviewStep: row.review_step,
  nextReviewDate: row.next_review_date,
  lastReviewedAt: row.last_reviewed_at,
  reviewCount: row.review_count,
  isOptional,
  actions: getReviewActionOptions(row.status, row.review_step),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const loadReviewState = async ({
  userId,
  repository,
  studyDate = getMoscowStudyDate,
}: {
  userId: string
  repository: ReviewStateRepository
  studyDate?: () => string
}) => {
  const { currentCard, currentCardIsOptional, ...snapshot } =
    await repository.loadSnapshot({ userId, reviewDate: studyDate() })
  return {
    ...snapshot,
    currentCard: currentCard
      ? toReviewCard({ row: currentCard, isOptional: currentCardIsOptional })
      : null,
  }
}
