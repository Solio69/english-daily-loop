import { getMoscowStudyDate } from '../_shared/moscow-study-date.ts'
import type { ReadingStateRepository } from './reading-state-repository.ts'

const EMPTY_INDEXES: number[] = []
const ZERO = 0
const AI_SOURCE = 'ai'

export const loadReadingState = async ({
  userId,
  repository,
  studyDate = getMoscowStudyDate,
}: {
  userId: string
  repository: ReadingStateRepository
  studyDate?: () => string
}) => {
  const today = studyDate()
  const dailyLimit = await repository.getDailyLimit(userId)
  const snapshot = await repository.loadSnapshot({ userId, studyDate: today })
  const { active } = snapshot
  const indexes = active
    ? await repository.loadSavedWordIndexes({
        userId,
        readingTextId: active.reading_text_id,
      })
    : { saved: EMPTY_INDEXES, pending: EMPTY_INDEXES }

  return {
    today,
    dailyLimit,
    usedAttempts: snapshot.usedAttempts,
    remainingAttempts: Math.max(dailyLimit - snapshot.usedAttempts, ZERO),
    isReadingCompletedToday: snapshot.isReadingCompletedToday,
    activeText: active
      ? {
          id: active.reading_text_id,
          title: active.title,
          body: active.body,
          level: active.level,
          estimatedMinutes: active.estimated_minutes,
          lastReadParagraphIndex: active.last_read_paragraph_index,
          savedWordIndexes: indexes.saved,
          pendingSavedWordIndexes: indexes.pending,
          source: AI_SOURCE,
          generation: {
            provider: active.provider,
            model: active.model,
            fallbackUsed: active.fallback_used,
          },
        }
      : null,
  }
}
