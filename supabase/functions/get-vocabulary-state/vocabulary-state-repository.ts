import type { ServiceClient } from '../_shared/app.ts'
import { getMoscowStudyDate } from '../_shared/moscow-study-date.ts'
import { fail, HTTP_STATUS } from '../_shared/server.ts'
import { getVocabularyCardGenerationState } from '../_shared/vocabulary-card-generation.ts'

const LOG_PREFIX = '[get-vocabulary-state]'
const WORDS_TABLE = 'user_vocabulary_words'
const ID_COLUMN = 'id'
const USER_ID_COLUMN = 'user_id'
const CARD_STATUS_COLUMN = 'card_status'
const COUNT_OPTIONS = { count: 'exact', head: true } as const
const ZERO = 0

export const loadVocabularyState = async ({
  supabase,
  userId,
  studyDate = getMoscowStudyDate,
  loadGenerationState = getVocabularyCardGenerationState,
}: {
  supabase: ServiceClient
  userId: string
  studyDate?: () => string
  loadGenerationState?: typeof getVocabularyCardGenerationState
}) => {
  const currentStudyDate = studyDate()
  const [pending, approval, ready, total, cardGeneration] = await Promise.all([
    supabase
      .from(WORDS_TABLE)
      .select(ID_COLUMN, COUNT_OPTIONS)
      .eq(USER_ID_COLUMN, userId)
      .eq(CARD_STATUS_COLUMN, 'pending'),
    supabase
      .from(WORDS_TABLE)
      .select(ID_COLUMN, COUNT_OPTIONS)
      .eq(USER_ID_COLUMN, userId)
      .eq(CARD_STATUS_COLUMN, 'needs_approval'),
    supabase
      .from(WORDS_TABLE)
      .select(ID_COLUMN, COUNT_OPTIONS)
      .eq(USER_ID_COLUMN, userId)
      .eq(CARD_STATUS_COLUMN, 'ready'),
    supabase
      .from(WORDS_TABLE)
      .select(ID_COLUMN, COUNT_OPTIONS)
      .eq(USER_ID_COLUMN, userId),
    loadGenerationState(supabase, userId, currentStudyDate, LOG_PREFIX),
  ])

  const hasCountError =
    pending.error || approval.error || ready.error || total.error
  if (hasCountError) {
    console.error(LOG_PREFIX + ' failed to count vocabulary words', {
      appUserId: userId,
      pendingError: pending.error?.message,
      needsApprovalError: approval.error?.message,
      readyError: ready.error?.message,
      totalError: total.error?.message,
    })
    fail(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      'VOCABULARY_STATE_LOAD_FAILED',
      'Failed to load vocabulary state.',
    )
  }

  return {
    pendingCount: pending.count ?? ZERO,
    needsApprovalCount: approval.count ?? ZERO,
    readyCount: ready.count ?? ZERO,
    totalCount: total.count ?? ZERO,
    cardGeneration,
  }
}
