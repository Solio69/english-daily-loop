import type { ServiceClient } from '../_shared/app.ts'
import { getPostReadingCompletionMetrics } from '../_shared/reading-completion-metrics.ts'
import { fail, getSafeErrorDetails, HTTP_STATUS } from '../_shared/server.ts'

export const COMPLETION_LOG_PREFIX = '[complete-reading-text]'
const COMPLETION_RPC = 'complete_daily_reading_text'
const NO_ACTIVE_CODE = 'NO_ACTIVE_READING_TEXT'

export type ReadingCompletion = {
  completedDate: string
  firstTextCompletedAt: string
}

export type ReadingCompletionRepository = {
  complete: (input: {
    userId: string
    studyDate: string
  }) => Promise<ReadingCompletion>
  getMetrics: (input: { userId: string; completedDate: string }) => Promise<{
    streakDays: number | null
    completedReadingTextCount: number | null
  }>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const createReadingCompletionRepository = (
  supabase: ServiceClient,
): ReadingCompletionRepository => ({
  complete: async ({ userId, studyDate }) => {
    const { data, error } = await supabase.rpc(COMPLETION_RPC, {
      p_user_id: userId,
      p_completed_date: studyDate,
    })

    if (error) {
      console.error(
        COMPLETION_LOG_PREFIX + ' failed to complete text transaction',
        {
          appUserId: userId,
          completedDate: studyDate,
          ...getSafeErrorDetails(error),
        },
      )
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'READING_COMPLETION_TRANSACTION_FAILED',
        'Failed to complete reading text.',
      )
    }
    if (!isRecord(data)) {
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'READING_COMPLETION_TRANSACTION_FAILED',
        'Empty completion result.',
      )
    }
    if (data.ok === false) {
      if (typeof data.code !== 'string' || typeof data.message !== 'string') {
        fail(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'READING_COMPLETION_TRANSACTION_FAILED',
          'Invalid completion result.',
        )
      }
      fail(
        data.code === NO_ACTIVE_CODE
          ? HTTP_STATUS.CONFLICT
          : HTTP_STATUS.INTERNAL_SERVER_ERROR,
        data.code,
        data.message,
      )
    }
    if (
      data.ok !== true ||
      typeof data.completedDate !== 'string' ||
      typeof data.firstTextCompletedAt !== 'string'
    ) {
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'READING_COMPLETION_TRANSACTION_FAILED',
        'Invalid completion result.',
      )
    }
    return {
      completedDate: data.completedDate,
      firstTextCompletedAt: data.firstTextCompletedAt,
    }
  },
  getMetrics: ({ userId, completedDate }) =>
    getPostReadingCompletionMetrics(
      supabase,
      userId,
      completedDate,
      COMPLETION_LOG_PREFIX,
    ),
})
