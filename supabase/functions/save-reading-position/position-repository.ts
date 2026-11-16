import type { ServiceClient } from '../_shared/app.ts'
import { fail, getSafeErrorDetails, HTTP_STATUS } from '../_shared/server.ts'
import { POSITION_LOG_PREFIX } from './position-contract.ts'

const ACTIVE_TABLE = 'user_active_reading_texts'
const USER_ID = 'user_id'
const READING_TEXT_ID = 'reading_text_id'

export type ActivePositionText = {
  readingTextId: string
  body: string
}

export type ReadingPositionRepository = {
  loadActive: (input: {
    userId: string
    requestId: string
  }) => Promise<ActivePositionText | null>
  save: (input: {
    userId: string
    readingTextId: string
    paragraphIndex: number | null
    requestId: string
  }) => Promise<boolean>
}

export const createReadingPositionRepository = (
  supabase: ServiceClient,
): ReadingPositionRepository => ({
  loadActive: async ({ userId, requestId }) => {
    const { data, error } = await supabase
      .from(ACTIVE_TABLE)
      .select('reading_text_id, body')
      .eq(USER_ID, userId)
      .maybeSingle()
    if (
      error ||
      (data != null &&
        (typeof data?.reading_text_id !== 'string' ||
          typeof data?.body !== 'string'))
    ) {
      console.error(POSITION_LOG_PREFIX + ' failed to load active text', {
        requestId,
        appUserId: userId,
        ...(error ? getSafeErrorDetails(error) : {}),
      })
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'ACTIVE_TEXT_LOAD_FAILED',
        'Failed to load active reading text.',
      )
    }
    return data
      ? { readingTextId: data.reading_text_id, body: data.body }
      : null
  },

  save: async ({ userId, readingTextId, paragraphIndex, requestId }) => {
    const { data, error } = await supabase
      .from(ACTIVE_TABLE)
      .update({ last_read_paragraph_index: paragraphIndex })
      .eq(USER_ID, userId)
      .eq(READING_TEXT_ID, readingTextId)
      .select(READING_TEXT_ID)
      .maybeSingle()
    if (error) {
      console.error(POSITION_LOG_PREFIX + ' failed to update position', {
        requestId,
        appUserId: userId,
        readingTextId,
        paragraphIndex,
        ...getSafeErrorDetails(error),
      })
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'READING_POSITION_SAVE_FAILED',
        'Не удалось сохранить позицию чтения.',
      )
    }
    return Boolean(data)
  },
})
