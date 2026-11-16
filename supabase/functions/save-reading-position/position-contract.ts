import { fail } from '../_shared/server.ts'

export const POSITION_LOG_PREFIX = '[save-reading-position]'
export const ACTIVE_TEXT_UNAVAILABLE_MESSAGE =
  'Текст изменился или уже недоступен. Обнови экран.'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const parseReadingTextId = (value: unknown): string => {
  const parsed = typeof value === 'string' ? value.trim() : ''
  if (!UUID_PATTERN.test(parsed)) {
    fail(400, 'INVALID_READING_TEXT_ID', 'readingTextId must be a valid UUID.')
  }
  return parsed
}

export const parseParagraphIndex = (
  body: Record<string, unknown>,
): number | null => {
  if (!Object.prototype.hasOwnProperty.call(body, 'paragraphIndex')) {
    fail(400, 'PARAGRAPH_INDEX_REQUIRED', 'paragraphIndex is required.')
  }
  if (body.paragraphIndex === null) return null

  const paragraphIndex = body.paragraphIndex
  if (
    typeof paragraphIndex !== 'number' ||
    !Number.isInteger(paragraphIndex) ||
    paragraphIndex < 0
  ) {
    return fail(
      400,
      'INVALID_PARAGRAPH_INDEX',
      'paragraphIndex must be null or a non-negative integer.',
    )
  }
  return paragraphIndex
}
