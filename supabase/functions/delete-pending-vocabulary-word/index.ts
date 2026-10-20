import { createServiceClient, getAppUserByTelegramId } from '../_shared/app.ts'
import {
  AppError,
  DEFAULT_INTERNAL_ERROR_MESSAGE,
  assertPostRequest,
  errorResponse,
  getRequiredEnv,
  getRequestId,
  getTelegramUserFromBody,
  handleCorsPreflight,
  HTTP_STATUS,
  parseJsonBody,
  successResponse,
} from '../_shared/server.ts'
import {
  DELETE_WORD_CODE,
  parseDeleteWordInput,
} from './delete-word-contract.ts'
import { createDeleteWordRepository } from './delete-word-repository.ts'
import { deletePendingVocabularyWord } from './delete-word-service.ts'

const LOG_PREFIX = '[delete-pending-vocabulary-word]'
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TELEGRAM_BOT_TOKEN',
] as const

export const handleDeletePendingVocabularyWord = async (
  req: Request,
): Promise<Response> => {
  const corsResponse = handleCorsPreflight(req)
  if (corsResponse) return corsResponse

  const requestId = getRequestId(req)
  const requestStartedAt = Date.now()
  try {
    assertPostRequest(req)
    const env = getRequiredEnv([...REQUIRED_ENV])
    const body = await parseJsonBody<{
      initData?: unknown
      readingTextId?: unknown
      wordIndex?: unknown
    }>(req)
    const tgUser = await getTelegramUserFromBody(body, env.TELEGRAM_BOT_TOKEN)
    const input = parseDeleteWordInput(body)
    const supabase = createServiceClient(env)
    const appUser = await getAppUserByTelegramId(
      supabase,
      tgUser.id,
      LOG_PREFIX,
      requestId,
    )
    const result = await deletePendingVocabularyWord({
      ...input,
      userId: appUser.id,
      repository: createDeleteWordRepository(supabase),
    })
    console.info(LOG_PREFIX + ' pending word deleted', {
      requestId,
      appUserId: appUser.id,
      removedSourceCount: result.removedSourceCount,
      removedCurrentTextIndexCount: result.removedWordIndexes.length,
      durationMs: Date.now() - requestStartedAt,
    })
    return successResponse(HTTP_STATUS.OK, result, requestId)
  } catch (error) {
    if (error instanceof AppError) {
      console.error(LOG_PREFIX + ' request failed', {
        requestId,
        status: error.status,
        code: error.code,
        message: error.message,
        durationMs: Date.now() - requestStartedAt,
      })
      return errorResponse(error.status, error.code, error.message, requestId)
    }
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown vocabulary delete error.'
    console.error(LOG_PREFIX + ' failed', {
      requestId,
      message,
      durationMs: Date.now() - requestStartedAt,
    })
    return errorResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      DELETE_WORD_CODE.deleteFailed,
      DEFAULT_INTERNAL_ERROR_MESSAGE,
      requestId,
    )
  }
}

Deno.serve(handleDeletePendingVocabularyWord)
