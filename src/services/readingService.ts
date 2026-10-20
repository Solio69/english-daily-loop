import {
  createRequestId,
  getTelegramInitData,
  invokeFunction,
  invokeFunctionWithInitData,
} from './functionClient'
import { retryUnknownGenerationOutcome } from './readingGenerationRetry'
import {
  parseReadingGenerationPayload,
  parseReadingState,
  READING_SERVICE_ERRORS,
} from './readingContracts'
import {
  CompleteReadingTextResult,
  GenerateReadingTextResult,
  ReadingState,
  SaveReadingPositionResult,
  ReadingGenerationPayload,
} from '../types/reading'

const GENERATION_FUNCTION = 'generate-reading-text'
const AI_SOURCE = 'ai'

const invokeReadingGeneration = async (): Promise<ReadingGenerationPayload> => {
  const initData = getTelegramInitData()
  const requestId = createRequestId()

  const payload = await retryUnknownGenerationOutcome(
    requestId,
    (stableRequestId) =>
      invokeFunctionWithInitData<unknown>(
        GENERATION_FUNCTION,
        initData,
        {},
        READING_SERVICE_ERRORS.generation,
        stableRequestId,
      ),
  )
  return parseReadingGenerationPayload(payload)
}

export const getReadingState = async (): Promise<ReadingState> =>
  parseReadingState(
    await invokeFunction<unknown>(
      'get-reading-state',
      {},
      READING_SERVICE_ERRORS.state,
    ),
  )

export const generateReadingText =
  async (): Promise<GenerateReadingTextResult> => {
    const payload = await invokeReadingGeneration()

    return {
      text: {
        ...payload.text,
        source: AI_SOURCE,
        generation: payload.generation,
      },
      dailyLimit: payload.dailyLimit,
      usedAttempts: payload.usedAttempts,
      remainingAttempts: payload.remainingAttempts,
    }
  }

export const completeReadingText =
  async (): Promise<CompleteReadingTextResult> =>
    invokeFunction<CompleteReadingTextResult>(
      'complete-reading-text',
      {},
      'Не удалось сохранить завершение текста.',
    )

export const saveReadingPosition = async (
  readingTextId: string,
  paragraphIndex: number | null,
): Promise<SaveReadingPositionResult> =>
  invokeFunction<SaveReadingPositionResult>(
    'save-reading-position',
    { readingTextId, paragraphIndex },
    paragraphIndex === null
      ? 'Не удалось сбросить позицию чтения.'
      : 'Не удалось сохранить позицию чтения.',
  )
