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
import {
  COMPLETION_LOG_PREFIX,
  createReadingCompletionRepository,
} from './completion-repository.ts'
import { completeReadingText } from './completion-service.ts'

const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TELEGRAM_BOT_TOKEN',
] as const

export const handleCompleteReadingText = async (
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
      COMPLETION_LOG_PREFIX,
      requestId,
    )
    const data = await completeReadingText({
      userId: appUser.id,
      repository: createReadingCompletionRepository(supabase),
    })
    return successResponse(200, data)
  } catch (error) {
    if (error instanceof AppError) {
      console.error(COMPLETION_LOG_PREFIX + ' request failed', {
        status: error.status,
        code: error.code,
        message: error.message,
      })
      return errorResponse(error.status, error.code, error.message)
    }
    const message =
      error instanceof Error ? error.message : 'Unknown completion error.'
    console.error(COMPLETION_LOG_PREFIX + ' failed', { message })
    return errorResponse(
      500,
      'READING_COMPLETION_FAILED',
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    )
  }
}

Deno.serve(handleCompleteReadingText)
