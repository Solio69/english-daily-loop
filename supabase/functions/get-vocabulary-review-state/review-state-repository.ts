import type { ServiceClient } from '../_shared/app.ts'
import {
  loadVocabularyReviewSnapshot,
  type VocabularyReviewSnapshot,
} from '../_shared/vocabulary-review-state.ts'

const LOG_PREFIX = '[get-vocabulary-review-state]'

export type ReviewStateRepository = {
  loadSnapshot: (input: {
    userId: string
    reviewDate: string
  }) => Promise<VocabularyReviewSnapshot>
}

export const createReviewStateRepository = (
  supabase: ServiceClient,
): ReviewStateRepository => ({
  loadSnapshot: ({ userId, reviewDate }) =>
    loadVocabularyReviewSnapshot(supabase, userId, reviewDate, LOG_PREFIX),
})
