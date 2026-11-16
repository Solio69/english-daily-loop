import { buildSafeAiDiagnostics } from '../_shared/ai-diagnostics.ts'
import { getMoscowStudyDate } from '../_shared/moscow-study-date.ts'
import { AppError } from '../_shared/server.ts'
import {
  type VocabularyCardAttemptCounts,
  type VocabularyCardGenerationState,
} from '../_shared/vocabulary-card-generation.ts'
import {
  VOCABULARY_CARD_PROMPT_VERSION,
  VocabularyAiError,
  generateVocabularyCardsBatch,
  type VocabularyCardBatchItem,
} from './ai-pipeline.ts'
import type {
  PendingWordRow,
  PreparationRepository,
} from './preparation-repository.ts'

const LOG_PREFIX = '[prepare-vocabulary-cards]'
const ZERO = 0
const ONE = 1
const GENERATION_FAILED_CODE = 'VOCABULARY_CARDS_GENERATION_FAILED'
const PREPARE_FAILED_CODE = 'VOCABULARY_PREPARE_FAILED'

type GenerateBatch = typeof generateVocabularyCardsBatch

const buildVocabularyAiDiagnostics = ({
  requestId,
  error,
  models,
  words,
  englishLevel,
  durationMs,
  counts,
}: {
  requestId: string
  error: unknown
  models: string[]
  words: PendingWordRow[]
  englishLevel: string
  durationMs: number
  counts: VocabularyCardAttemptCounts | null
}) =>
  buildSafeAiDiagnostics({
    functionName: 'prepare-vocabulary-cards',
    requestId,
    promptVersion: VOCABULARY_CARD_PROMPT_VERSION,
    modelChain: models,
    stage:
      error instanceof VocabularyAiError ? error.stage : 'output_validation',
    durationMs,
    metadata:
      error instanceof VocabularyAiError
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
      englishLevel,
      requestedCount: words.length,
      preparedCount: counts?.preparedCount ?? ZERO,
      failedCount: counts?.failedCount ?? words.length,
    },
  })

const buildPrepareResult = ({
  counts,
  remainingPendingCount,
  needsApprovalCount,
  generationState,
}: {
  counts: Omit<VocabularyCardAttemptCounts, 'requestedCount'>
  remainingPendingCount: number
  needsApprovalCount: number
  generationState: VocabularyCardGenerationState
}) => ({
  preparedCount: counts.preparedCount,
  failedCount: counts.failedCount,
  mergedCount: counts.mergedCount,
  reactivatedCount: counts.reactivatedCount,
  remainingPendingCount,
  needsApprovalCount,
  dailyLimit: generationState.dailyLimit,
  usedAttempts: generationState.usedAttempts,
  remainingAttempts: generationState.remainingAttempts,
})

export const prepareVocabularyCards = async ({
  repository,
  userId,
  apiKey,
  models,
  requestId,
  requestStartedAt,
  generateBatch = generateVocabularyCardsBatch,
  studyDate = getMoscowStudyDate,
}: {
  repository: PreparationRepository
  userId: string
  apiKey: string
  models: string[]
  requestId: string
  requestStartedAt: number
  generateBatch?: GenerateBatch
  studyDate?: () => string
}) => {
  let startedAttempt: { attemptId: string; userId: string } | null = null
  let attemptStats: VocabularyCardAttemptCounts | null = null

  try {
    const englishLevel = await repository.getEnglishLevel(userId)
    const words = await repository.loadPending(userId)
    const currentStudyDate = studyDate()
    const dailyLimit = await repository.getDailyLimit(userId)

    if (words.length === ZERO) {
      const generationState = await repository.getGenerationState({
        userId,
        studyDate: currentStudyDate,
      })
      return buildPrepareResult({
        counts: {
          preparedCount: ZERO,
          failedCount: ZERO,
          mergedCount: ZERO,
          reactivatedCount: ZERO,
        },
        remainingPendingCount: ZERO,
        needsApprovalCount: ZERO,
        generationState,
      })
    }

    const claimedAttempt = await repository.claim({
      userId,
      studyDate: currentStudyDate,
      dailyLimit,
      requestedCount: words.length,
    })
    const generationState: VocabularyCardGenerationState = {
      dailyLimit,
      usedAttempts: claimedAttempt.usedAttempts,
      remainingAttempts: claimedAttempt.remainingAttempts,
    }
    startedAttempt = { attemptId: claimedAttempt.attemptId, userId }
    attemptStats = {
      requestedCount: words.length,
      preparedCount: ZERO,
      failedCount: words.length,
      mergedCount: ZERO,
      reactivatedCount: ZERO,
    }

    await repository.updateMetadata({
      attemptId: startedAttempt.attemptId,
      userId,
      models,
    })

    let cardsById = new Map<string, VocabularyCardBatchItem>()
    let usedModel: string | null = null
    try {
      const generated = await generateBatch({
        apiKey,
        models,
        words,
        level: englishLevel,
      })
      cardsById = new Map(generated.cards.map((card) => [card.id, card]))
      usedModel = generated.usedModel
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown vocabulary card error.'
      console.error(LOG_PREFIX + ' batch generation failed', {
        requestId,
        appUserId: userId,
        wordIds: words.map((word) => word.id),
        error: message,
      })
      const failedCount = words.length
      attemptStats.failedCount = failedCount
      await repository.markFailed({
        attemptId: startedAttempt.attemptId,
        userId,
        models,
        counts: attemptStats,
        durationMs: Date.now() - requestStartedAt,
        errorCode: GENERATION_FAILED_CODE,
        errorMessage: message,
      })
      const remainingPendingCount = await repository.countPending(userId)
      const needsApprovalCount = await repository.countNeedsApproval(userId)
      const diagnostics = buildVocabularyAiDiagnostics({
        requestId,
        error,
        models,
        words,
        englishLevel,
        durationMs: Date.now() - requestStartedAt,
        counts: attemptStats,
      })
      return {
        ...buildPrepareResult({
          counts: {
            preparedCount: ZERO,
            failedCount,
            mergedCount: ZERO,
            reactivatedCount: ZERO,
          },
          remainingPendingCount,
          needsApprovalCount,
          generationState,
        }),
        diagnostics,
      }
    }

    let preparedCount = ZERO
    let failedCount = ZERO
    let cancelledCount = ZERO
    let mergedCount = ZERO
    let reactivatedCount = ZERO
    for (const word of words) {
      const card = cardsById.get(word.id)
      if (!card) {
        failedCount += ONE
        continue
      }
      const saveResult = await repository.saveCard({
        userId,
        pendingWordId: word.id,
        card,
      })
      if (saveResult.cancelled) {
        cancelledCount += ONE
        continue
      }
      if (!saveResult.prepared) {
        failedCount += ONE
        continue
      }
      preparedCount += ONE
      if (saveResult.merged) mergedCount += ONE
      if (saveResult.reactivated) reactivatedCount += ONE
    }

    attemptStats.preparedCount = preparedCount
    attemptStats.failedCount = failedCount
    attemptStats.mergedCount = mergedCount
    attemptStats.reactivatedCount = reactivatedCount
    const remainingPendingCount = await repository.countPending(userId)
    const needsApprovalCount = await repository.countNeedsApproval(userId)
    await repository.markSucceeded({
      attemptId: startedAttempt.attemptId,
      userId,
      model: usedModel,
      models,
      counts: attemptStats,
      durationMs: Date.now() - requestStartedAt,
    })
    console.info(LOG_PREFIX + ' batch preparation completed', {
      appUserId: userId,
      attemptId: startedAttempt.attemptId,
      requestedCount: words.length,
      generatedValidCount: cardsById.size,
      preparedCount,
      failedCount,
      cancelledCount,
      mergedCount,
      reactivatedCount,
      remainingPendingCount,
      needsApprovalCount,
      dailyLimit,
      usedAttempts: generationState.usedAttempts,
      remainingAttempts: generationState.remainingAttempts,
    })
    return buildPrepareResult({
      counts: { preparedCount, failedCount, mergedCount, reactivatedCount },
      remainingPendingCount,
      needsApprovalCount,
      generationState,
    })
  } catch (error) {
    if (startedAttempt) {
      const code = error instanceof AppError ? error.code : PREPARE_FAILED_CODE
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown vocabulary prepare error.'
      await repository.markFailed({
        attemptId: startedAttempt.attemptId,
        userId: startedAttempt.userId,
        counts: attemptStats ?? undefined,
        durationMs: Date.now() - requestStartedAt,
        errorCode: code,
        errorMessage: message,
      })
    }
    throw error
  }
}
