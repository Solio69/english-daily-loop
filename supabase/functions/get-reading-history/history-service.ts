import { encodeCursor, type ReadingHistoryCursor } from './history-contract.ts'
import type {
  CompletedReadingRow,
  ReadingHistoryRepository,
} from './history-repository.ts'

const FIRST_INDEX = 0
const LAST_OFFSET = 1

const toHistoryItem = (row: CompletedReadingRow) => ({
  id: row.id,
  completedDate: row.completed_date,
  completedAt: row.completed_at,
  title: row.title,
  body: row.body,
  level: row.level,
  estimatedMinutes: row.estimated_minutes,
  generation: {
    provider: row.provider,
    model: row.model,
    fallbackUsed: row.fallback_used,
  },
})

export const loadReadingHistory = async ({
  userId,
  limit,
  cursor,
  repository,
}: {
  userId: string
  limit: number
  cursor: ReadingHistoryCursor | null
  repository: ReadingHistoryRepository
}) => {
  const rows = await repository.loadPage({ userId, limit, cursor })
  const visibleRows = rows.slice(FIRST_INDEX, limit)
  const hasNextPage = rows.length > limit
  const nextCursor =
    hasNextPage && visibleRows.length > FIRST_INDEX
      ? encodeCursor(visibleRows[visibleRows.length - LAST_OFFSET])
      : null
  return { items: visibleRows.map(toHistoryItem), nextCursor }
}
