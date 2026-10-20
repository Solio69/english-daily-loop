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
  parseReviewWordInput,
  REVIEW_WORD_CODE,
} from './review-word-contract.ts'
import { createReviewWordRepository } from './review-word-repository.ts'
import { reviewVocabularyWord } from './review-word-service.ts'

const LOG_PREFIX = '[review-vocabulary-word]'
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TELEGRAM_BOT_TOKEN',
] as const

export const handleReviewVocabularyWord = async (
  req: Request,
): Promise<Response> => {
  const corsResponse = handleCorsPreflight(req)
  if (corsResponse) return corsResponse

  const requestId = getRequestId(req)
  try {
    assertPostRequest(req)
    const env = getRequiredEnv([...REQUIRED_ENV])
    const body = await parseJsonBody<{
      initData?: unknown
      wordId?: unknown
      action?: unknown
    }>(req)
    const tgUser = await getTelegramUserFromBody(body, env.TELEGRAM_BOT_TOKEN)
    const input = parseReviewWordInput(body)
    const supabase = createServiceClient(env)
    const appUser = await getAppUserByTelegramId(
      supabase,
      tgUser.id,
      LOG_PREFIX,
      requestId,
    )
    const data = await reviewVocabularyWord({
      ...input,
      userId: appUser.id,
      repository: createReviewWordRepository(supabase),
    })
    return successResponse(HTTP_STATUS.OK, data)
  } catch (error) {
    if (error instanceof AppError) {
      console.error(LOG_PREFIX + ' request failed', {
        status: error.status,
        code: error.code,
        message: error.message,
      })
      return errorResponse(error.status, error.code, error.message)
    }
    const message =
      error instanceof Error ? error.message : 'Unknown review word error.'
    console.error(LOG_PREFIX + ' failed', { message })
    return errorResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      REVIEW_WORD_CODE.reviewFailed,
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    )
  }
}

Deno.serve(handleReviewVocabularyWord)
