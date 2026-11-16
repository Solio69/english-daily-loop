import type { ServiceClient } from '../_shared/app.ts'
import {
  DEFAULT_INTERNAL_ERROR_MESSAGE,
  fail,
  HTTP_STATUS,
} from '../_shared/server.ts'
import { DELETE_WORD_CODE, DELETE_WORD_ERROR } from './delete-word-contract.ts'

const LOG_PREFIX = '[delete-pending-vocabulary-word]'
const ACTIVE_TEXT_TABLE = 'user_active_reading_texts'
const ACTIVE_TEXT_COLUMN = 'reading_text_id'
const USER_ID_COLUMN = 'user_id'
const DELETE_RPC = 'delete_pending_vocabulary_word_with_sources'

type DeleteParams = {
  userId: string
  readingTextId: string
  wordIndex: number
}
type DeleteResult =
  | { ok: true; removedWordIndexes: number[]; removedSourceCount: number }
  | { ok: false; code: string; message: string }

export type DeleteWordRepository = {
  loadActiveTextId: (userId: string) => Promise<string | null>
  delete: (params: DeleteParams) => Promise<DeleteResult>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isDeleteResult = (value: unknown): value is DeleteResult => {
  if (!isRecord(value) || typeof value.ok !== 'boolean') return false
  if (!value.ok) {
    return typeof value.code === 'string' && typeof value.message === 'string'
  }
  return (
    Array.isArray(value.removedWordIndexes) &&
    value.removedWordIndexes.every(
      (index) => typeof index === 'number' && Number.isInteger(index),
    ) &&
    typeof value.removedSourceCount === 'number' &&
    Number.isInteger(value.removedSourceCount)
  )
}

export const createDeleteWordRepository = (
  supabase: ServiceClient,
): DeleteWordRepository => ({
  loadActiveTextId: async (userId) => {
    const { data, error } = await supabase
      .from(ACTIVE_TEXT_TABLE)
      .select(ACTIVE_TEXT_COLUMN)
      .eq(USER_ID_COLUMN, userId)
      .maybeSingle()
    if (error) {
      console.error(LOG_PREFIX + ' failed to load active text', {
        appUserId: userId,
        error: error.message,
      })
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        DELETE_WORD_CODE.activeTextLoadFailed,
        DEFAULT_INTERNAL_ERROR_MESSAGE,
      )
    }
    if (data === null || data === undefined) return null
    if (!isRecord(data) || typeof data.reading_text_id !== 'string') {
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        DELETE_WORD_CODE.activeTextLoadFailed,
        DEFAULT_INTERNAL_ERROR_MESSAGE,
      )
    }
    return data.reading_text_id
  },
  delete: async (params) => {
    const { data, error } = await supabase.rpc(DELETE_RPC, {
      p_user_id: params.userId,
      p_reading_text_id: params.readingTextId,
      p_word_index: params.wordIndex,
    })
    if (error) {
      console.error(LOG_PREFIX + ' RPC failed', {
        appUserId: params.userId,
        readingTextId: params.readingTextId,
        wordIndex: params.wordIndex,
        error: error.message,
      })
    }
    if (error || !isDeleteResult(data)) {
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        DELETE_WORD_CODE.deleteFailed,
        DELETE_WORD_ERROR.deleteFailed,
      )
    }
    return data
  },
})
