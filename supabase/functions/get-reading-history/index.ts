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
  parseJsonObjectBody,
  successResponse,
} from '../_shared/server.ts'
import {
  clampPageLimit,
  HISTORY_LOG_PREFIX,
  parseCursor,
} from './history-contract.ts'
import { createReadingHistoryRepository } from './history-repository.ts'
import { loadReadingHistory } from './history-service.ts'

const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TELEGRAM_BOT_TOKEN',
] as const

export const handleGetReadingHistory = async (
  req: Request,
): Promise<Response> => {
  const corsResponse = handleCorsPreflight(req)
  if (corsResponse) return corsResponse

  const requestId = getRequestId(req)
  try {
    assertPostRequest(req)
    const env = getRequiredEnv([...REQUIRED_ENV])
    const body = await parseJsonObjectBody(req)
    const limit = clampPageLimit(body?.limit)
    const cursor = parseCursor(body?.cursor)
    const tgUser = await getTelegramUserFromBody(body, env.TELEGRAM_BOT_TOKEN)
    const supabase = createServiceClient(env)
    const appUser = await getAppUserByTelegramId(
      supabase,
      tgUser.id,
      HISTORY_LOG_PREFIX,
      requestId,
    )
    const data = await loadReadingHistory({
      userId: appUser.id,
      limit,
      cursor,
      repository: createReadingHistoryRepository(supabase),
    })
    return successResponse(200, data)
  } catch (error) {
    if (error instanceof AppError) {
      console.error(HISTORY_LOG_PREFIX + ' request failed', {
        status: error.status,
        code: error.code,
        message: error.message,
      })
      return errorResponse(error.status, error.code, error.message)
    }
    const message =
      error instanceof Error ? error.message : 'Unknown reading history error.'
    console.error(HISTORY_LOG_PREFIX + ' failed', { message })
    return errorResponse(
      500,
      'READING_HISTORY_FAILED',
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    )
  }
}

Deno.serve(handleGetReadingHistory)
