import { buildSafeAiDiagnostics } from '../_shared/ai-diagnostics.ts'
import { AppError, fail } from '../_shared/server.ts'
import {
  AiGenerationError,
  READING_TEXT_PROMPT_VERSION,
  type AiFailureStage,
  type EnglishLevel,
  type ReadingGenerationConfig,
  type ReadingMinutes,
} from './ai-pipeline.ts'

export type UserReadingSettings = {
  appUserId: string
  englishLevel: EnglishLevel
  dailyReadingMinutes: ReadingMinutes
}

export type AttemptMetadata = {
  promptVersion: string
  modelChain: string[]
  targetLevel: EnglishLevel
  readingMinutes: ReadingMinutes
  targetWordMin: number
  targetWordMax: number
  validationWordMin: number
  validationWordMax: number
  maxTokens: number
  fallbackUsed: boolean | null
  outputWordCount: number | null
}

export type ClaimedAttempt = {
  isDuplicate: boolean
  attemptId: string
  usedAttempts: number
  remainingAttempts: number
}

export type GenerationPayload = {
  text: {
    id: string
    title: string
    body: string
    level: string
    estimatedMinutes: number
    lastReadParagraphIndex: null | number
  }
  generation: {
    provider: string
    model: string | null
    fallbackUsed: boolean | null
    promptVersion: string | null
  }
  dailyLimit: number
  usedAttempts: number
  remainingAttempts: number
}

export const GENERATION_ERROR = {
  publicMessage: 'Не удалось сгенерировать текст. Попробуй еще раз позже.',
  failedCode: 'TEXT_GENERATION_FAILED',
  unknownMessage: 'Unknown generation error.',
} as const

export const GENERATION_LIMITS = {
  duplicateWaitMs: 95_000,
  duplicatePollMs: 2_000,
  finishAttempts: 2,
} as const

export const GENERATION_LOG_PREFIX = '[generate-reading-text]'

const READING_CONFIG_BY_MINUTES: Record<
  ReadingMinutes,
  Omit<ReadingGenerationConfig, 'validationWordMin' | 'validationWordMax'>
> = {
  3: { wordMin: 120, wordMax: 180, maxTokens: 700 },
  5: { wordMin: 220, wordMax: 320, maxTokens: 1050 },
  10: { wordMin: 450, wordMax: 650, maxTokens: 1800 },
  15: { wordMin: 700, wordMax: 950, maxTokens: 2600 },
}

const VALIDATION_MIN_FACTOR = 0.8
const VALIDATION_MAX_FACTOR = 1.2

export const parseEnglishLevel = (value: unknown): EnglishLevel => {
  if (value === 'A1' || value === 'A2' || value === 'B1' || value === 'B2') {
    return value
  }
  fail(
    500,
    'INVALID_ENGLISH_LEVEL',
    'User english level has an unsupported value.',
  )
}

export const parseReadingMinutes = (value: unknown): ReadingMinutes => {
  if (value === 3 || value === 5 || value === 10 || value === 15) {
    return value
  }
  fail(
    500,
    'INVALID_READING_MINUTES',
    'User reading minutes has an unsupported value.',
  )
}

export const getReadingGenerationConfig = (
  readingMinutes: ReadingMinutes,
): ReadingGenerationConfig => {
  const config = READING_CONFIG_BY_MINUTES[readingMinutes]
  return {
    ...config,
    validationWordMin: Math.floor(config.wordMin * VALIDATION_MIN_FACTOR),
    validationWordMax: Math.ceil(config.wordMax * VALIDATION_MAX_FACTOR),
  }
}

export const buildAttemptMetadata = ({
  models,
  targetLevel,
  readingMinutes,
  config,
}: {
  models: string[]
  targetLevel: EnglishLevel
  readingMinutes: ReadingMinutes
  config: ReadingGenerationConfig
}): AttemptMetadata => ({
  promptVersion: READING_TEXT_PROMPT_VERSION,
  modelChain: models,
  targetLevel,
  readingMinutes,
  targetWordMin: config.wordMin,
  targetWordMax: config.wordMax,
  validationWordMin: config.validationWordMin,
  validationWordMax: config.validationWordMax,
  maxTokens: config.maxTokens,
  fallbackUsed: null,
  outputWordCount: null,
})

export const toAttemptUpdatePayload = (
  metadata: AttemptMetadata,
): Record<string, unknown> => ({
  prompt_version: metadata.promptVersion,
  model_chain: metadata.modelChain,
  target_level: metadata.targetLevel,
  reading_minutes: metadata.readingMinutes,
  target_word_min: metadata.targetWordMin,
  target_word_max: metadata.targetWordMax,
  validation_word_min: metadata.validationWordMin,
  validation_word_max: metadata.validationWordMax,
  max_tokens: metadata.maxTokens,
  fallback_used: metadata.fallbackUsed,
  output_word_count: metadata.outputWordCount,
})

export const getFailureStage = (error: unknown): AiFailureStage => {
  if (error instanceof AiGenerationError) return error.stage
  if (error instanceof AppError && error.code === 'ACTIVE_TEXT_SAVE_FAILED') {
    return 'db_save'
  }
  return 'unknown'
}

export const buildReadingAiDiagnostics = ({
  requestId,
  error,
  attemptMetadata,
  durationMs,
}: {
  requestId: string
  error: unknown
  attemptMetadata: AttemptMetadata | null
  durationMs: number
}) =>
  buildSafeAiDiagnostics({
    functionName: 'generate-reading-text',
    requestId,
    promptVersion:
      attemptMetadata?.promptVersion ?? READING_TEXT_PROMPT_VERSION,
    modelChain: attemptMetadata?.modelChain ?? null,
    stage: getFailureStage(error),
    durationMs,
    metadata:
      error instanceof AiGenerationError
        ? {
            model: error.model,
            finishReason: error.finishReason,
            completionTokens: error.completionTokens,
            reasoningTokens: error.reasoningTokens,
            providerStatus: error.providerStatus,
            providerErrorCode: error.providerErrorCode,
          }
        : null,
    details: {
      targetLevel: attemptMetadata?.targetLevel ?? null,
      readingMinutes: attemptMetadata?.readingMinutes ?? null,
      targetWordMin: attemptMetadata?.targetWordMin ?? null,
      targetWordMax: attemptMetadata?.targetWordMax ?? null,
      validationWordMin: attemptMetadata?.validationWordMin ?? null,
      validationWordMax: attemptMetadata?.validationWordMax ?? null,
      outputWordCount: attemptMetadata?.outputWordCount ?? null,
    },
  })
