import type { ServiceClient } from '../_shared/app.ts'
import { fail, getSafeErrorDetails, HTTP_STATUS } from '../_shared/server.ts'
import {
  HISTORY_LOG_PREFIX,
  type ReadingHistoryCursor,
} from './history-contract.ts'

const HISTORY_TABLE = 'user_completed_reading_texts'
const HISTORY_COLUMNS =
  'id, completed_date, completed_at, title, body, level, estimated_minutes, provider, model, fallback_used'
const USER_ID = 'user_id'
const PAGE_OVERFETCH = 1

export type CompletedReadingRow = {
  id: string
  completed_date: string
  completed_at: string
  title: string
  body: string
  level: string
  estimated_minutes: number
  provider: string
  model: string
  fallback_used: boolean
}

export type ReadingHistoryRepository = {
  loadPage: (input: {
    userId: string
    limit: number
    cursor: ReadingHistoryCursor | null
  }) => Promise<CompletedReadingRow[]>
}

const isCompletedReadingRow = (value: unknown): value is CompletedReadingRow =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  typeof value.id === 'string' &&
  'completed_date' in value &&
  typeof value.completed_date === 'string' &&
  'completed_at' in value &&
  typeof value.completed_at === 'string' &&
  'title' in value &&
  typeof value.title === 'string' &&
  'body' in value &&
  typeof value.body === 'string' &&
  'level' in value &&
  typeof value.level === 'string' &&
  'estimated_minutes' in value &&
  typeof value.estimated_minutes === 'number' &&
  'provider' in value &&
  typeof value.provider === 'string' &&
  'model' in value &&
  typeof value.model === 'string' &&
  'fallback_used' in value &&
  typeof value.fallback_used === 'boolean'

export const createReadingHistoryRepository = (
  supabase: ServiceClient,
): ReadingHistoryRepository => ({
  loadPage: async ({ userId, limit, cursor }) => {
    let query = supabase
      .from(HISTORY_TABLE)
      .select(HISTORY_COLUMNS)
      .eq(USER_ID, userId)
      .order('completed_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + PAGE_OVERFETCH)

    if (cursor) {
      query = query.or(
        'completed_at.lt.' +
          cursor.completedAt +
          ',and(completed_at.eq.' +
          cursor.completedAt +
          ',id.lt.' +
          cursor.id +
          ')',
      )
    }
    const { data, error } = await query
    if (error) {
      console.error(HISTORY_LOG_PREFIX + ' failed to load history', {
        appUserId: userId,
        ...getSafeErrorDetails(error),
      })
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'READING_HISTORY_LOAD_FAILED',
        'Failed to load reading history.',
      )
    }
    const rows = data ?? []
    if (!Array.isArray(rows) || !rows.every(isCompletedReadingRow)) {
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'READING_HISTORY_LOAD_FAILED',
        'Invalid reading history result.',
      )
    }
    return rows
  },
})
