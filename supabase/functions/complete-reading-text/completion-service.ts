import { getMoscowStudyDate } from '../_shared/moscow-study-date.ts'
import type { ReadingCompletionRepository } from './completion-repository.ts'

export const completeReadingText = async ({
  userId,
  repository,
  studyDate = getMoscowStudyDate,
}: {
  userId: string
  repository: ReadingCompletionRepository
  studyDate?: () => string
}) => {
  const completion = await repository.complete({
    userId,
    studyDate: studyDate(),
  })
  const { streakDays, completedReadingTextCount } = await repository.getMetrics(
    {
      userId,
      completedDate: completion.completedDate,
    },
  )
  return {
    completedDate: completion.completedDate,
    firstTextCompletedAt: completion.firstTextCompletedAt,
    isReadingCompletedToday: true,
    streakDays,
    completedReadingTextCount,
  }
}
