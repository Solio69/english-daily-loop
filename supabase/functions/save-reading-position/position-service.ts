import { getReadingParagraphCount } from '../_shared/reading-text.ts'
import { fail } from '../_shared/server.ts'
import {
  ACTIVE_TEXT_UNAVAILABLE_MESSAGE,
  POSITION_LOG_PREFIX,
} from './position-contract.ts'
import type { ReadingPositionRepository } from './position-repository.ts'

export const saveReadingPosition = async ({
  userId,
  readingTextId,
  paragraphIndex,
  requestId,
  startedAt,
  repository,
  now = Date.now,
}: {
  userId: string
  readingTextId: string
  paragraphIndex: number | null
  requestId: string
  startedAt: number
  repository: ReadingPositionRepository
  now?: () => number
}) => {
  const active = await repository.loadActive({ userId, requestId })
  if (!active)
    fail(409, 'NO_ACTIVE_READING_TEXT', ACTIVE_TEXT_UNAVAILABLE_MESSAGE)
  if (active.readingTextId !== readingTextId) {
    fail(409, 'ACTIVE_TEXT_CHANGED', ACTIVE_TEXT_UNAVAILABLE_MESSAGE)
  }
  if (
    paragraphIndex !== null &&
    paragraphIndex >= getReadingParagraphCount(active.body)
  ) {
    fail(
      400,
      'INVALID_PARAGRAPH_INDEX',
      'paragraphIndex is outside of the active text.',
    )
  }

  const updated = await repository.save({
    userId,
    readingTextId,
    paragraphIndex,
    requestId,
  })
  if (!updated)
    fail(409, 'ACTIVE_TEXT_CHANGED', ACTIVE_TEXT_UNAVAILABLE_MESSAGE)

  console.log(POSITION_LOG_PREFIX + ' position saved', {
    requestId,
    appUserId: userId,
    readingTextId,
    paragraphIndex,
    durationMs: now() - startedAt,
  })
  return { readingTextId, paragraphIndex }
}
