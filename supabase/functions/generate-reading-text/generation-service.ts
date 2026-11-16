import { getMoscowStudyDate } from '../_shared/moscow-study-date.ts'
import {
  generateReadingTextWithOpenRouter,
  OPENROUTER_PROVIDER,
  READING_TEXT_PROMPT_VERSION,
  type GeneratedReadingText,
  type ReadingGenerationConfig,
  type EnglishLevel,
  type ReadingMinutes,
} from './ai-pipeline.ts'
import {
  buildAttemptMetadata,
  GENERATION_LOG_PREFIX,
  getFailureStage,
  getReadingGenerationConfig,
  type AttemptMetadata,
  type GenerationPayload,
} from './generation-contract.ts'
import type { ReadingGenerationRepository } from './generation-repository.ts'

export class GenerationRunFailure extends Error {
  readonly reason: unknown
  readonly metadata: AttemptMetadata | null

  constructor(reason: unknown, metadata: AttemptMetadata | null) {
    super(
      reason instanceof Error ? reason.message : 'Unknown generation error.',
    )
    this.reason = reason
    this.metadata = metadata
  }
}

export type ReadingGenerator = (input: {
  apiKey: string
  models: string[]
  targetLevel: EnglishLevel
  readingMinutes: ReadingMinutes
  config: ReadingGenerationConfig
}) => Promise<GeneratedReadingText>

export type ReadingGenerationPorts = {
  repository: ReadingGenerationRepository
  generate: ReadingGenerator
  studyDate: () => string
  now: () => number
  createId: () => string
}

export const createReadingGenerationPorts = ({
  repository,
}: {
  repository: ReadingGenerationRepository
}): ReadingGenerationPorts => ({
  repository,
  generate: generateReadingTextWithOpenRouter,
  studyDate: getMoscowStudyDate,
  now: Date.now,
  createId: () => crypto.randomUUID(),
})

export const runReadingGeneration = async ({
  telegramUserId,
  requestId,
  models,
  apiKey,
  requestStartedAt,
  ports,
}: {
  telegramUserId: number
  requestId: string
  models: string[]
  apiKey: string
  requestStartedAt: number
  ports: ReadingGenerationPorts
}): Promise<GenerationPayload> => {
  const { repository, generate, studyDate, now, createId } = ports
  let attemptId: string | null = null
  let metadata: AttemptMetadata | null = null

  try {
    const settings = await repository.loadSettings({
      telegramUserId,
      requestId,
    })
    const date = studyDate()
    const dailyLimit = await repository.getDailyLimit({
      userId: settings.appUserId,
    })
    const claim = await repository.claim({
      userId: settings.appUserId,
      studyDate: date,
      dailyLimit,
      requestId,
    })

    if (claim.isDuplicate) {
      return await repository.waitForDuplicate({
        userId: settings.appUserId,
        attemptId: claim.attemptId,
        dailyLimit,
        usedAttempts: claim.usedAttempts,
        remainingAttempts: claim.remainingAttempts,
      })
    }

    attemptId = claim.attemptId
    const config = getReadingGenerationConfig(settings.dailyReadingMinutes)
    metadata = buildAttemptMetadata({
      models,
      targetLevel: settings.englishLevel,
      readingMinutes: settings.dailyReadingMinutes,
      config,
    })

    console.log(GENERATION_LOG_PREFIX + ' start', {
      requestId,
      appUserId: settings.appUserId,
      attemptId,
      promptVersion: READING_TEXT_PROMPT_VERSION,
      studyDate: date,
      usedAttempts: claim.usedAttempts,
      remainingAttempts: claim.remainingAttempts,
      dailyLimit,
      baseLevel: settings.englishLevel,
      dailyReadingMinutes: settings.dailyReadingMinutes,
      targetLevel: settings.englishLevel,
      targetWords: config.wordMin + '-' + config.wordMax,
      validationWords:
        config.validationWordMin + '-' + config.validationWordMax,
      maxTokens: config.maxTokens,
      models,
    })

    await repository.saveMetadata({
      userId: settings.appUserId,
      attemptId,
      metadata,
    })

    const generated = await generate({
      apiKey,
      models,
      targetLevel: settings.englishLevel,
      readingMinutes: settings.dailyReadingMinutes,
      config,
    })

    const fallbackUsed = generated.usedModel !== models[0]
    metadata.fallbackUsed = fallbackUsed
    metadata.outputWordCount = generated.validation.wordCount
    const readingTextId = createId()

    await repository.finish({
      userId: settings.appUserId,
      attemptId,
      readingTextId,
      title: generated.title,
      body: generated.body,
      level: generated.level,
      estimatedMinutes: generated.estimatedMinutes,
      model: generated.usedModel,
      fallbackUsed,
      studyDate: date,
      outputWordCount: generated.validation.wordCount,
      durationMs: now() - requestStartedAt,
    })

    return {
      text: {
        id: readingTextId,
        title: generated.title,
        body: generated.body,
        level: generated.level,
        estimatedMinutes: generated.estimatedMinutes,
        lastReadParagraphIndex: null,
      },
      generation: {
        provider: OPENROUTER_PROVIDER,
        model: generated.usedModel,
        fallbackUsed,
        promptVersion: generated.promptVersion,
      },
      dailyLimit,
      usedAttempts: claim.usedAttempts,
      remainingAttempts: claim.remainingAttempts,
    }
  } catch (error) {
    if (attemptId !== null) {
      try {
        await repository.markFailed({
          attemptId,
          requestId,
          metadata,
          failureStage: getFailureStage(error),
          error,
          durationMs: now() - requestStartedAt,
        })
      } catch (markError) {
        console.error(
          GENERATION_LOG_PREFIX + ' failed to mark attempt failed',
          {
            requestId,
            attemptId,
            markError: markError instanceof Error ? markError.name : 'unknown',
          },
        )
      }
    }
    throw new GenerationRunFailure(error, metadata)
  }
}
