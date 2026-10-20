import { fail } from '../_shared/server.ts'

export const HISTORY_LOG_PREFIX = '[get-reading-history]'
const DEFAULT_PAGE_LIMIT = 10
const MAX_PAGE_LIMIT = 30
const MIN_PAGE_LIMIT = 1
const CURSOR_SEPARATOR = '|'

export type ReadingHistoryCursor = {
  completedAt: string
  id: string
}

export const clampPageLimit = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_PAGE_LIMIT
  return Math.min(Math.max(Math.trunc(parsed), MIN_PAGE_LIMIT), MAX_PAGE_LIMIT)
}

export const parseCursor = (cursor: unknown): ReadingHistoryCursor | null => {
  if (cursor === null || cursor === undefined || cursor === '') return null
  if (typeof cursor !== 'string') {
    return fail(400, 'INVALID_CURSOR', 'History cursor must be a string.')
  }
  const [completedAt, id, ...extra] = cursor.split(CURSOR_SEPARATOR)
  if (!completedAt || !id || extra.length > 0) {
    fail(400, 'INVALID_CURSOR', 'History cursor is invalid.')
  }
  if (Number.isNaN(Date.parse(completedAt))) {
    fail(400, 'INVALID_CURSOR', 'History cursor date is invalid.')
  }
  return { completedAt, id }
}

export const encodeCursor = (item: {
  completed_at: string
  id: string
}): string => item.completed_at + CURSOR_SEPARATOR + item.id
