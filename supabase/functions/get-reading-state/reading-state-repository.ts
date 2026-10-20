import { getDailyReadingGenerationLimit } from '../_shared/access.ts'
import type { ServiceClient } from '../_shared/app.ts'
import { fail, getSafeErrorDetails, HTTP_STATUS } from '../_shared/server.ts'

const LOG_PREFIX = '[get-reading-state]'
const DB = {
  attempts: 'reading_generation_attempts',
  completions: 'user_daily_reading_completions',
  active: 'user_active_reading_texts',
  sources: 'user_vocabulary_word_sources',
  words: 'user_vocabulary_words',
  userId: 'user_id',
  attemptDate: 'attempt_date',
  completedDate: 'completed_date',
  readingTextId: 'reading_text_id',
  id: 'id',
  cardStatus: 'card_status',
  pending: 'pending',
  activeColumns:
    'user_id, reading_text_id, title, body, level, estimated_minutes, provider, model, fallback_used, generated_at, last_read_paragraph_index',
} as const

export type ActiveReadingRow = {
  reading_text_id: string
  title: string
  body: string
  level: string
  estimated_minutes: number
  provider: string
  model: string
  fallback_used: boolean
  last_read_paragraph_index: number | null
}

export type ReadingStateSnapshot = {
  usedAttempts: number
  isReadingCompletedToday: boolean
  active: ActiveReadingRow | null
}

export type SavedWordIndexes = {
  saved: number[]
  pending: number[]
}

export type ReadingStateRepository = {
  getDailyLimit: (userId: string) => Promise<number>
  loadSnapshot: (input: {
    userId: string
    studyDate: string
  }) => Promise<ReadingStateSnapshot>
  loadSavedWordIndexes: (input: {
    userId: string
    readingTextId: string
  }) => Promise<SavedWordIndexes>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isActiveReadingRow = (value: unknown): value is ActiveReadingRow =>
  isRecord(value) &&
  typeof value.reading_text_id === 'string' &&
  typeof value.title === 'string' &&
  typeof value.body === 'string' &&
  typeof value.level === 'string' &&
  typeof value.estimated_minutes === 'number' &&
  typeof value.provider === 'string' &&
  typeof value.model === 'string' &&
  typeof value.fallback_used === 'boolean' &&
  (value.last_read_paragraph_index === null ||
    Number.isInteger(value.last_read_paragraph_index))

const uniqueSortedIndexes = (indexes: unknown[]): number[] =>
  Array.from(
    new Set(
      indexes.filter(
        (index): index is number =>
          Number.isInteger(index) && Number(index) >= 0,
      ),
    ),
  ).sort((left, right) => left - right)

export const createReadingStateRepository = (
  supabase: ServiceClient,
): ReadingStateRepository => ({
  getDailyLimit: (userId) =>
    getDailyReadingGenerationLimit(supabase, userId, LOG_PREFIX),

  loadSnapshot: async ({ userId, studyDate }) => {
    const [
      { count: attemptsCount, error: attemptsError },
      { data: completionRow, error: completionError },
      { data: activeTextRow, error: activeTextError },
    ] = await Promise.all([
      supabase
        .from(DB.attempts)
        .select(DB.id, { count: 'exact', head: true })
        .eq(DB.userId, userId)
        .eq(DB.attemptDate, studyDate),
      supabase
        .from(DB.completions)
        .select(DB.id)
        .eq(DB.userId, userId)
        .eq(DB.completedDate, studyDate)
        .maybeSingle(),
      supabase
        .from(DB.active)
        .select(DB.activeColumns)
        .eq(DB.userId, userId)
        .maybeSingle(),
    ])

    if (attemptsError) {
      console.error(LOG_PREFIX + ' failed to count attempts', {
        appUserId: userId,
        ...getSafeErrorDetails(attemptsError),
      })
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'ATTEMPTS_LOAD_FAILED',
        'Failed to load generation attempts.',
      )
    }
    if (completionError) {
      console.error(LOG_PREFIX + ' failed to load completion', {
        appUserId: userId,
        ...getSafeErrorDetails(completionError),
      })
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'COMPLETION_LOAD_FAILED',
        'Failed to load reading completion.',
      )
    }
    if (
      activeTextError ||
      (activeTextRow != null && !isActiveReadingRow(activeTextRow))
    ) {
      console.error(LOG_PREFIX + ' failed to load active text', {
        appUserId: userId,
        ...(activeTextError ? getSafeErrorDetails(activeTextError) : {}),
      })
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'ACTIVE_TEXT_LOAD_FAILED',
        'Failed to load active reading text.',
      )
    }
    return {
      usedAttempts: attemptsCount ?? 0,
      isReadingCompletedToday: Boolean(completionRow),
      active: activeTextRow ?? null,
    }
  },

  loadSavedWordIndexes: async ({ userId, readingTextId }) => {
    const { data: sourceRows, error: sourceError } = await supabase
      .from(DB.sources)
      .select('word_id, word_index')
      .eq(DB.userId, userId)
      .eq(DB.readingTextId, readingTextId)

    if (sourceError) {
      console.error(LOG_PREFIX + ' failed to load saved word sources', {
        appUserId: userId,
        readingTextId,
        ...getSafeErrorDetails(sourceError),
      })
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'SAVED_WORDS_LOAD_FAILED',
        'Failed to load saved words.',
      )
    }

    const sources = (sourceRows ?? []).filter(
      (row): row is { word_id: string; word_index: number } =>
        isRecord(row) &&
        typeof row.word_id === 'string' &&
        typeof row.word_index === 'number',
    )
    const saved = uniqueSortedIndexes(sources.map((row) => row.word_index))
    const wordIds = Array.from(
      new Set(sources.map((row) => row.word_id).filter(Boolean)),
    )
    if (wordIds.length === 0) return { saved, pending: [] }

    const { data: pendingRows, error: pendingError } = await supabase
      .from(DB.words)
      .select(DB.id)
      .eq(DB.userId, userId)
      .eq(DB.cardStatus, DB.pending)
      .in(DB.id, wordIds)

    if (pendingError) {
      console.error(LOG_PREFIX + ' failed to load pending saved words', {
        appUserId: userId,
        readingTextId,
        ...getSafeErrorDetails(pendingError),
      })
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'SAVED_WORDS_LOAD_FAILED',
        'Failed to load saved words.',
      )
    }

    const pendingIds = new Set(
      (pendingRows ?? [])
        .filter(
          (row): row is { id: string } =>
            isRecord(row) && typeof row.id === 'string',
        )
        .map((row) => row.id),
    )
    return {
      saved,
      pending: uniqueSortedIndexes(
        sources
          .filter((row) => pendingIds.has(row.word_id))
          .map((row) => row.word_index),
      ),
    }
  },
})
