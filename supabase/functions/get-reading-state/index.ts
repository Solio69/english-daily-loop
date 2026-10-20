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
  parseJsonBody,
  successResponse,
} from '../_shared/server.ts'
import { createReadingStateRepository } from './reading-state-repository.ts'
import { loadReadingState } from './reading-state-service.ts'

const LOG_PREFIX = '[get-reading-state]'
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TELEGRAM_BOT_TOKEN',
] as const

export const handleGetReadingState = async (
  req: Request,
): Promise<Response> => {
  const corsResponse = handleCorsPreflight(req)
  if (corsResponse) return corsResponse

  const requestId = getRequestId(req)
  try {
    assertPostRequest(req)
    const env = getRequiredEnv([...REQUIRED_ENV])
    const body = await parseJsonBody<{ initData?: unknown }>(req)
    const tgUser = await getTelegramUserFromBody(body, env.TELEGRAM_BOT_TOKEN)
    const supabase = createServiceClient(env)
    const appUser = await getAppUserByTelegramId(
      supabase,
      tgUser.id,
      LOG_PREFIX,
      requestId,
    )
    const data = await loadReadingState({
      userId: appUser.id,
      repository: createReadingStateRepository(supabase),
    })
    return successResponse(200, data)
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
      error instanceof Error ? error.message : 'Unknown reading state error.'
    console.error(LOG_PREFIX + ' failed', { message })
    return errorResponse(
      500,
      'READING_STATE_FAILED',
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    )
  }
}

Deno.serve(handleGetReadingState)
