import type { ServiceClient } from '../_shared/app.ts'
import { fail, HTTP_STATUS } from '../_shared/server.ts'

type VocabularyWordRow = {
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
  status: 'not_started' | 'active' | 'learned'
  card_status: 'needs_approval' | 'ready'
  review_step:
    | '1_day'
    | '3_days'
    | '7_days'
    | '14_days'
    | '1_month'
    | '2_months'
    | '3_months'
    | '4_months'
    | '5_months'
    | '6_months'
    | null
  next_review_date: string | null
  last_reviewed_at: string | null
  created_at: string
  updated_at: string
}

const LOG_PREFIX = '[get-vocabulary-words]'
const WORDS_TABLE = 'user_vocabulary_words'
const USER_ID_COLUMN = 'user_id'
const CARD_STATUS_COLUMN = 'card_status'
const UPDATED_AT_COLUMN = 'updated_at'
const ID_COLUMN = 'id'
const MAX_ITEMS_PER_SECTION = 50
const SELECT_COLUMNS =
  'id, word, translation, part_of_speech, is_verb, is_regular_verb, verb_forms, examples, status, card_status, review_step, next_review_date, last_reviewed_at, created_at, updated_at'

const toVocabularyWord = (row: VocabularyWordRow) => ({
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
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isVocabularyWordRow = (value: unknown): value is VocabularyWordRow =>
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
  (value.status === 'not_started' ||
    value.status === 'active' ||
    value.status === 'learned') &&
  (value.card_status === 'needs_approval' || value.card_status === 'ready') &&
  (value.review_step === null || typeof value.review_step === 'string') &&
  (value.next_review_date === null ||
    typeof value.next_review_date === 'string') &&
  (value.last_reviewed_at === null ||
    typeof value.last_reviewed_at === 'string') &&
  typeof value.created_at === 'string' &&
  typeof value.updated_at === 'string'

export const loadVocabularyWords = async ({
  supabase,
  userId,
}: {
  supabase: ServiceClient
  userId: string
}) => {
  const [approval, ready] = await Promise.all([
    supabase
      .from(WORDS_TABLE)
      .select(SELECT_COLUMNS)
      .eq(USER_ID_COLUMN, userId)
      .eq(CARD_STATUS_COLUMN, 'needs_approval')
      .order(UPDATED_AT_COLUMN, { ascending: false })
      .order(ID_COLUMN, { ascending: false })
      .limit(MAX_ITEMS_PER_SECTION),
    supabase
      .from(WORDS_TABLE)
      .select(SELECT_COLUMNS)
      .eq(USER_ID_COLUMN, userId)
      .eq(CARD_STATUS_COLUMN, 'ready')
      .order(UPDATED_AT_COLUMN, { ascending: false })
      .order(ID_COLUMN, { ascending: false })
      .limit(MAX_ITEMS_PER_SECTION),
  ])

  if (approval.error || ready.error) {
    console.error(LOG_PREFIX + ' failed to load vocabulary words', {
      appUserId: userId,
      needsApprovalError: approval.error?.message,
      readyError: ready.error?.message,
    })
    fail(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      'VOCABULARY_WORDS_LOAD_FAILED',
      'Failed to load vocabulary words.',
    )
  }
  const approvalRows = approval.data ?? []
  const readyRows = ready.data ?? []
  const invalidRows =
    !Array.isArray(approvalRows) ||
    !approvalRows.every(isVocabularyWordRow) ||
    !Array.isArray(readyRows) ||
    !readyRows.every(isVocabularyWordRow)
  if (invalidRows) {
    fail(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      'VOCABULARY_WORDS_LOAD_FAILED',
      'Failed to load vocabulary words.',
    )
  }
  return {
    needsApproval: approvalRows.map(toVocabularyWord),
    ready: readyRows.map(toVocabularyWord),
  }
}
