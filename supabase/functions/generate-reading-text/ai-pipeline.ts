/// <reference path="../deno-globals.d.ts" />

import {
  OpenRouterError,
  excludeModel,
  getFailedOpenRouterModel,
  getOpenRouterErrorLogMetadata,
  requestOpenRouter,
} from '../_shared/openrouter.ts'
import { buildPromptMessages } from './reading-prompt.ts'
import { parseGeneratedJson } from './reading-validation.ts'

export {
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_PRIMARY_MODEL,
  DEFAULT_READING_MODEL_CHAIN,
  DEFAULT_TERTIARY_MODEL,
  OPENROUTER_PROVIDER,
  getOpenRouterModelChain,
} from '../_shared/openrouter.ts'

export type EnglishLevel = 'A1' | 'A2' | 'B1' | 'B2'
export type ReadingMinutes = 3 | 5 | 10 | 15

export type ReadingGenerationConfig = {
  wordMin: number
  wordMax: number
  validationWordMin: number
  validationWordMax: number
  maxTokens: number
}

export type GeneratedReadingText = {
  title: string
  body: string
  estimatedMinutes: ReadingMinutes
  level: EnglishLevel
  usedModel: string
  promptVersion: string
  validation: {
    wordCount: number
  }
}

export type AiFailureStage =
  | 'provider_request'
  | 'provider_response'
  | 'output_validation'
  | 'db_save'
  | 'unknown'

export class AiGenerationError extends Error {
  stage: AiFailureStage
  model: string | null
  finishReason: string | null
  completionTokens: number | null
  reasoningTokens: number | null
  providerStatus: number | null
  providerErrorCode: string | null

  constructor(
    stage: AiFailureStage,
    message: string,
    metadata: {
      model?: string | null
      finishReason?: string | null
      completionTokens?: number | null
      reasoningTokens?: number | null
      providerStatus?: number | null
      providerErrorCode?: string | number | null
    } = {},
  ) {
    super(message)
    this.stage = stage
    this.model = metadata.model ?? null
    this.finishReason = metadata.finishReason ?? null
    this.completionTokens = metadata.completionTokens ?? null
    this.reasoningTokens = metadata.reasoningTokens ?? null
    this.providerStatus = metadata.providerStatus ?? null
    this.providerErrorCode =
      metadata.providerErrorCode == null
        ? null
        : String(metadata.providerErrorCode)
  }
}

type GenerateReadingTextParams = {
  apiKey: string
  models: string[]
  targetLevel: EnglishLevel
  readingMinutes: ReadingMinutes
  config: ReadingGenerationConfig
}

export const READING_TEXT_PROMPT_VERSION = 'reading-text-v2'

const MODEL_TIMEOUT_MS = 25_000
const GENERATION_TIMEOUT_MS = 90_000
export const generateReadingTextWithOpenRouter = async ({
  apiKey,
  models,
  targetLevel,
  readingMinutes,
  config,
}: GenerateReadingTextParams): Promise<GeneratedReadingText> => {
  const messages = buildPromptMessages(targetLevel, readingMinutes, config)
  let remainingModels = [...models]
  let lastErrorMessage = 'Unknown generation error.'
  let lastModel: string | null = null
  const startedAt = Date.now()

  while (remainingModels.length > 0) {
    let routed: { content: string; usedModel: string }
    const elapsedMs = Date.now() - startedAt
    const remainingBudgetMs = GENERATION_TIMEOUT_MS - elapsedMs

    if (remainingBudgetMs <= 0) {
      throw new AiGenerationError(
        'provider_request',
        'AI-модели не ответили в общий лимит времени. Попробуй еще раз чуть позже.',
      )
    }

    try {
      routed = await requestOpenRouter({
        apiKey,
        models: remainingModels,
        messages,
        maxTokens: config.maxTokens,
        temperature: 0.7,
        timeoutMs: Math.min(MODEL_TIMEOUT_MS, remainingBudgetMs),
      })
    } catch (error) {
      lastErrorMessage =
        error instanceof Error ? error.message : 'Unknown generation error.'
      lastModel = error instanceof OpenRouterError ? error.model : null
      const stage =
        error instanceof OpenRouterError ? error.stage : 'provider_request'
      console.error('[generate-reading-text] model routing failed', {
        models: remainingModels,
        promptVersion: READING_TEXT_PROMPT_VERSION,
        stage,
        elapsedMs,
        remainingBudgetMs,
        ...getOpenRouterErrorLogMetadata(error),
        error: lastErrorMessage,
      })

      if (
        error instanceof OpenRouterError &&
        error.retryableContent &&
        remainingModels.length > 1 &&
        Date.now() - startedAt < GENERATION_TIMEOUT_MS
      ) {
        const failedModel = getFailedOpenRouterModel(error, remainingModels)
        remainingModels = excludeModel(remainingModels, failedModel)
        continue
      }

      throw new AiGenerationError(stage, lastErrorMessage, {
        model: error instanceof OpenRouterError ? error.model : null,
        finishReason:
          error instanceof OpenRouterError ? error.finishReason : null,
        completionTokens:
          error instanceof OpenRouterError ? error.completionTokens : null,
        reasoningTokens:
          error instanceof OpenRouterError ? error.reasoningTokens : null,
        providerStatus:
          error instanceof OpenRouterError ? error.providerStatus : null,
        providerErrorCode:
          error instanceof OpenRouterError ? error.providerErrorCode : null,
      })
    }

    try {
      const generated = parseGeneratedJson(
        routed.content,
        targetLevel,
        readingMinutes,
        config,
      )
      return {
        ...generated,
        usedModel: routed.usedModel,
        promptVersion: READING_TEXT_PROMPT_VERSION,
      }
    } catch (error) {
      lastErrorMessage =
        error instanceof Error ? error.message : 'Unknown generation error.'
      lastModel = routed.usedModel
      console.error(
        '[generate-reading-text] generated content validation failed',
        {
          usedModel: routed.usedModel,
          candidateModels: remainingModels,
          promptVersion: READING_TEXT_PROMPT_VERSION,
          stage: 'output_validation',
          error: lastErrorMessage,
        },
      )
      remainingModels = excludeModel(remainingModels, routed.usedModel)
    }
  }

  throw new AiGenerationError('output_validation', lastErrorMessage, {
    model: lastModel,
  })
}
