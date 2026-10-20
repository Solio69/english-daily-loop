import type {
  CompletedReadingText,
  ReadingHistoryPage,
} from '../types/materials'

const INVALID_RESPONSE_MESSAGE = 'Некорректный ответ сервера.'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isCompletedReadingText = (
  value: unknown,
): value is CompletedReadingText => {
  if (!isRecord(value) || !isRecord(value.generation)) return false
  const { generation } = value
  return (
    typeof value.id === 'string' &&
    typeof value.completedDate === 'string' &&
    typeof value.completedAt === 'string' &&
    typeof value.title === 'string' &&
    typeof value.body === 'string' &&
    typeof value.level === 'string' &&
    typeof value.estimatedMinutes === 'number' &&
    Number.isFinite(value.estimatedMinutes) &&
    typeof generation.provider === 'string' &&
    typeof generation.model === 'string' &&
    typeof generation.fallbackUsed === 'boolean'
  )
}

export const requireReadingHistoryPage = (
  value: unknown,
): ReadingHistoryPage => {
  const isValidPage =
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isCompletedReadingText) &&
    (value.nextCursor === null || typeof value.nextCursor === 'string')
  if (!isValidPage) throw new Error(INVALID_RESPONSE_MESSAGE)
  return value as ReadingHistoryPage
}
