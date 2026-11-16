import { createServiceClient, getAppUserByTelegramId } from '../_shared/app.ts'
import { getConfiguredOpenRouterModelChain } from '../_shared/openrouter.ts'
import {
  AppError,
  DEFAULT_INTERNAL_ERROR_MESSAGE,
  assertPostRequest,
  errorResponse,
  fail,
  getOptionalEnv,
  getRequiredEnv,
  getRequestId,
  getTelegramUserFromBody,
  handleCorsPreflight,
  parseJsonBody,
  successResponse,
  HTTP_STATUS,
} from '../_shared/server.ts'
import { createPreparationRepository } from './preparation-repository.ts'
import { prepareVocabularyCards } from './preparation-service.ts'

const LOG_PREFIX = '[prepare-vocabulary-cards]'
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TELEGRAM_BOT_TOKEN',
  'OPENROUTER_API_KEY',
] as const

export const handlePrepareVocabularyCards = async (
  req: Request,
): Promise<Response> => {
  const corsResponse = handleCorsPreflight(req)
  if (corsResponse) return corsResponse

  const requestStartedAt = Date.now()
  const requestId = getRequestId(req)
  try {
    assertPostRequest(req)
    const env = getRequiredEnv([...REQUIRED_ENV])
    let models: string[]
    try {
      models = getConfiguredOpenRouterModelChain(getOptionalEnv)
    } catch (error) {
      console.error(LOG_PREFIX + ' invalid model configuration', {
        error: error instanceof Error ? error.message : 'Unknown model error.',
      })
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'AI_MODEL_CONFIG_INVALID',
        'Server AI model config is not allowed.',
      )
    }
    const body = await parseJsonBody<{ initData?: unknown }>(req)
    const tgUser = await getTelegramUserFromBody(body, env.TELEGRAM_BOT_TOKEN)
    const supabase = createServiceClient(env)
    const appUser = await getAppUserByTelegramId(
      supabase,
      tgUser.id,
      LOG_PREFIX,
      requestId,
    )
    const data = await prepareVocabularyCards({
      repository: createPreparationRepository(supabase),
      userId: appUser.id,
      apiKey: env.OPENROUTER_API_KEY,
      models,
      requestId,
      requestStartedAt,
    })
    return successResponse(HTTP_STATUS.OK, data, requestId)
  } catch (error) {
    if (error instanceof AppError) {
      console.error(LOG_PREFIX + ' request failed', {
        requestId,
        status: error.status,
        code: error.code,
        message: error.message,
      })
      return errorResponse(error.status, error.code, error.message, requestId)
    }
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown vocabulary prepare error.'
    console.error(LOG_PREFIX + ' failed', { requestId, message })
    return errorResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      'VOCABULARY_PREPARE_FAILED',
      DEFAULT_INTERNAL_ERROR_MESSAGE,
      requestId,
    )
  }
}

Deno.serve(handlePrepareVocabularyCards)
