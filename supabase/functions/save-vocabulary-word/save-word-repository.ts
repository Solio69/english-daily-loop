import { getVocabularyWordsLimit } from '../_shared/access.ts'
import { getUserEnglishLevel, type ServiceClient } from '../_shared/app.ts'
import { fail, HTTP_STATUS } from '../_shared/server.ts'
import type { VocabularyCardStatus } from '../_shared/vocabulary.ts'
import { SAVE_WORD_CODE, SAVE_WORD_ERROR } from './save-word-contract.ts'

const LOG_PREFIX = '[save-vocabulary-word]'
const ACTIVE_TEXT_TABLE = 'user_active_reading_texts'
const ACTIVE_TEXT_COLUMNS = 'reading_text_id, body'
const USER_ID_COLUMN = 'user_id'
const SAVE_RPC = 'save_pending_vocabulary_word_with_source'

type ActiveText = { reading_text_id: string; body: string }
type SaveParams = {
  userId: string
  word: string
  readingTextId: string
  readingDate: string
  wordIndex: number
  originalWord: string
  vocabularyLimit: number
}
type SaveResult =
  | {
      ok: true
      action: 'created' | 'reactivated' | 'already_exists'
      wordId: string
      word: string
      status: 'not_started' | 'active' | 'learned'
      cardStatus: VocabularyCardStatus
    }
  | { ok: false; code: string; message: string }

export type SaveWordRepository = {
  loadActiveText: (userId: string) => Promise<ActiveText | null>
  checkEnglishLevel: (userId: string) => Promise<void>
  getVocabularyLimit: (userId: string) => Promise<number>
  save: (params: SaveParams) => Promise<SaveResult>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isActiveText = (value: unknown): value is ActiveText =>
  isRecord(value) &&
  typeof value.reading_text_id === 'string' &&
  typeof value.body === 'string'

const isSaveResult = (value: unknown): value is SaveResult => {
  if (!isRecord(value) || typeof value.ok !== 'boolean') return false
  if (!value.ok) {
    return typeof value.code === 'string' && typeof value.message === 'string'
  }
  const validAction =
    value.action === 'created' ||
    value.action === 'reactivated' ||
    value.action === 'already_exists'
  const validStatus =
    value.status === 'not_started' ||
    value.status === 'active' ||
    value.status === 'learned'
  const validCardStatus =
    value.cardStatus === 'pending' ||
    value.cardStatus === 'needs_approval' ||
    value.cardStatus === 'ready'
  return (
    validAction &&
    validStatus &&
    validCardStatus &&
    typeof value.wordId === 'string' &&
    typeof value.word === 'string'
  )
}

export const createSaveWordRepository = (
  supabase: ServiceClient,
): SaveWordRepository => ({
  loadActiveText: async (userId) => {
    const { data, error } = await supabase
      .from(ACTIVE_TEXT_TABLE)
      .select(ACTIVE_TEXT_COLUMNS)
      .eq(USER_ID_COLUMN, userId)
      .maybeSingle()
    if (error) {
      console.error(LOG_PREFIX + ' failed to load active text', {
        appUserId: userId,
        error: error.message,
      })
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        SAVE_WORD_CODE.activeTextLoadFailed,
        SAVE_WORD_ERROR.activeTextLoad,
      )
    }
    if (data === null || data === undefined) return null
    if (!isActiveText(data)) {
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        SAVE_WORD_CODE.activeTextLoadFailed,
        SAVE_WORD_ERROR.activeTextLoad,
      )
    }
    return data
  },
  checkEnglishLevel: async (userId) => {
    await getUserEnglishLevel(supabase, userId, LOG_PREFIX)
  },
  getVocabularyLimit: (userId) =>
    getVocabularyWordsLimit(supabase, userId, LOG_PREFIX),
  save: async (params) => {
    const { data, error } = await supabase.rpc(SAVE_RPC, {
      p_user_id: params.userId,
      p_word: params.word,
      p_reading_text_id: params.readingTextId,
      p_reading_date: params.readingDate,
      p_word_index: params.wordIndex,
      p_original_word: params.originalWord,
      p_vocabulary_limit: params.vocabularyLimit,
    })
    if (error) {
      console.error(LOG_PREFIX + ' failed to save vocabulary word', {
        appUserId: params.userId,
        readingTextId: params.readingTextId,
        wordIndex: params.wordIndex,
        error: error.message,
      })
    }
    if (error || !isSaveResult(data)) {
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        SAVE_WORD_CODE.saveFailed,
        SAVE_WORD_ERROR.saveFailed,
      )
    }
    return data
  },
})
