export type ReadingSource = 'ai' | 'db_fallback'

export type ReadingText = {
  id: string
  title: string
  level: string
  body: string
  estimatedMinutes: number
  lastReadParagraphIndex: number | null
  savedWordIndexes?: number[]
  pendingSavedWordIndexes?: number[]
  source?: ReadingSource
  generation?: {
    provider: string
    model: string | null
    fallbackUsed: boolean | null
    promptVersion?: string | null
  }
}

export type ReadingState = {
  today: string
  dailyLimit: number
  usedAttempts: number
  remainingAttempts: number
  isReadingCompletedToday: boolean
  activeText: ReadingText | null
}

export type GenerateReadingTextResult = {
  text: ReadingText
  dailyLimit: number
  usedAttempts: number
  remainingAttempts: number
}

export type ReadingGenerationPayload = {
  text: ReadingText
  generation: NonNullable<ReadingText['generation']>
  dailyLimit: number
  usedAttempts: number
  remainingAttempts: number
}

export type CompleteReadingTextResult = {
  completedDate: string
  firstTextCompletedAt: string | null
  isReadingCompletedToday: boolean
  streakDays?: number | null
  completedReadingTextCount?: number | null
}

export type SaveReadingPositionResult = {
  readingTextId: string
  paragraphIndex: number | null
}
