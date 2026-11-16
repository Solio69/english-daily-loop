import type {
  ReadingGenerationPayload,
  ReadingState,
  ReadingText,
} from '../types/reading'

export const READING_SERVICE_ERRORS = {
  state: 'Не удалось загрузить состояние чтения.',
  generation: 'Не удалось обратиться к AI-сервису.',
} as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isIndexArray = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.every((index) => Number.isInteger(index) && index >= 0)

const isGeneration = (
  value: unknown,
): value is NonNullable<ReadingText['generation']> =>
  isRecord(value) &&
  typeof value.provider === 'string' &&
  (value.model === null || typeof value.model === 'string') &&
  (value.fallbackUsed === null || typeof value.fallbackUsed === 'boolean') &&
  (value.promptVersion === undefined ||
    value.promptVersion === null ||
    typeof value.promptVersion === 'string')

const isReadingText = (value: unknown): value is ReadingText =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.title === 'string' &&
  typeof value.body === 'string' &&
  typeof value.level === 'string' &&
  isNumber(value.estimatedMinutes) &&
  (value.lastReadParagraphIndex === null ||
    (Number.isInteger(value.lastReadParagraphIndex) &&
      Number(value.lastReadParagraphIndex) >= 0)) &&
  (value.savedWordIndexes === undefined ||
    isIndexArray(value.savedWordIndexes)) &&
  (value.pendingSavedWordIndexes === undefined ||
    isIndexArray(value.pendingSavedWordIndexes)) &&
  (value.generation === undefined || isGeneration(value.generation)) &&
  (value.source === undefined ||
    value.source === 'ai' ||
    value.source === 'db_fallback')

export const parseReadingState = (value: unknown): ReadingState => {
  if (
    !isRecord(value) ||
    typeof value.today !== 'string' ||
    !isNumber(value.dailyLimit) ||
    !isNumber(value.usedAttempts) ||
    !isNumber(value.remainingAttempts) ||
    typeof value.isReadingCompletedToday !== 'boolean' ||
    (value.activeText !== null && !isReadingText(value.activeText))
  ) {
    throw new Error(READING_SERVICE_ERRORS.state)
  }
  return value as ReadingState
}

export const parseReadingGenerationPayload = (
  value: unknown,
): ReadingGenerationPayload => {
  if (
    !isRecord(value) ||
    !isReadingText(value.text) ||
    !isGeneration(value.generation) ||
    !isNumber(value.dailyLimit) ||
    !isNumber(value.usedAttempts) ||
    !isNumber(value.remainingAttempts)
  ) {
    throw new Error(READING_SERVICE_ERRORS.generation)
  }
  return value as ReadingGenerationPayload
}
