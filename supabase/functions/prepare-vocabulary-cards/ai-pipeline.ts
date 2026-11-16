/// <reference path="../deno-globals.d.ts" />

import {
  OpenRouterError,
  excludeModel,
  getFailedOpenRouterModel,
  getOpenRouterErrorLogMetadata,
  requestOpenRouter,
} from '../_shared/openrouter.ts'
import type {
  EnglishLevel,
  VocabularyCardBatchItem,
} from '../_shared/vocabulary.ts'
import { VocabularyAiError, parseCardBatchJson } from './card-contract.ts'
import {
  VOCABULARY_CARD_PROMPT_VERSION,
  buildCardBatchMessages,
} from './card-prompt.ts'

export type {
  EnglishLevel,
  VocabularyCard,
  VocabularyCardBatchItem,
} from '../_shared/vocabulary.ts'
export { VocabularyAiError } from './card-contract.ts'
export { VOCABULARY_CARD_PROMPT_VERSION } from './card-prompt.ts'
export {
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_PRIMARY_MODEL,
  DEFAULT_TERTIARY_MODEL,
  OPENROUTER_PROVIDER,
  getOpenRouterModelChain,
} from '../_shared/openrouter.ts'

const MODEL_TIMEOUT_MS = 30_000
const GENERATION_TIMEOUT_MS = 30_000

export const generateVocabularyCardsBatch = async ({
  apiKey,
  models,
  words,
  level,
}: {
  apiKey: string
  models: string[]
  words: Array<{ id: string; word: string }>
  level: EnglishLevel
}): Promise<{ cards: VocabularyCardBatchItem[]; usedModel: string }> => {
  const messages = buildCardBatchMessages(words, level)
  const expectedIds = new Set(words.map((item) => item.id))
  let remainingModels = [...models]
  let lastErrorMessage = 'Unknown vocabulary card error.'
  let lastModel: string | null = null
  const startedAt = Date.now()

  while (remainingModels.length > 0) {
    let routed: { content: string; usedModel: string }
    const remainingBudgetMs = GENERATION_TIMEOUT_MS - (Date.now() - startedAt)
    if (remainingBudgetMs <= 0) {
      throw new VocabularyAiError(
        'AI-модели не ответили в общий лимит времени. Попробуй еще раз чуть позже.',
        { stage: 'provider_request' },
      )
    }

    try {
      routed = await requestOpenRouter({
        apiKey,
        models: remainingModels,
        messages,
        maxTokens: Math.max(1400, words.length * 420),
        temperature: 0.2,
        timeoutMs: Math.min(MODEL_TIMEOUT_MS, remainingBudgetMs),
      })
    } catch (error) {
      lastErrorMessage =
        error instanceof Error ? error.message : 'Unknown provider error.'
      lastModel = error instanceof OpenRouterError ? error.model : null
      const stage =
        error instanceof OpenRouterError ? error.stage : 'provider_request'
      console.error('[prepare-vocabulary-cards] model routing failed', {
        models: remainingModels,
        promptVersion: VOCABULARY_CARD_PROMPT_VERSION,
        stage,
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

      throw new VocabularyAiError(lastErrorMessage, {
        stage,
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
      return {
        cards: parseCardBatchJson(routed.content, expectedIds, level),
        usedModel: routed.usedModel,
      }
    } catch (error) {
      lastErrorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown output validation error.'
      lastModel = routed.usedModel
      console.error(
        '[prepare-vocabulary-cards] generated cards validation failed',
        {
          usedModel: routed.usedModel,
          candidateModels: remainingModels,
          promptVersion: VOCABULARY_CARD_PROMPT_VERSION,
          stage: 'output_validation',
          error: lastErrorMessage,
        },
      )
      remainingModels = excludeModel(remainingModels, routed.usedModel)
    }
  }

  throw new VocabularyAiError(lastErrorMessage, {
    stage: 'output_validation',
    model: lastModel,
  })
}
