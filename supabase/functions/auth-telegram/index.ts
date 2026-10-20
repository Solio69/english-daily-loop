import { createServiceClient } from '../_shared/app.ts'
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
import { getProfileUser } from '../_shared/user-profile-repository.ts'
import { getAuthProfileResponse } from '../_shared/user-profile-response.ts'

const LOG_PREFIX = '[auth-telegram]'
const INTERNAL_ERROR_CODE = 'AUTH_TELEGRAM_FAILED'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflight(req)
  if (corsResponse) return corsResponse

  const requestId = getRequestId(req)

  try {
    assertPostRequest(req)
    const env = getRequiredEnv([
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'TELEGRAM_BOT_TOKEN',
    ])
    const body = await parseJsonBody<{ initData?: unknown }>(req)
    const telegramUser = await getTelegramUserFromBody(
      body,
      env.TELEGRAM_BOT_TOKEN,
    )
    const supabase = createServiceClient(env)
    const user = await getProfileUser({
      supabase,
      telegramUserId: telegramUser.id,
      firstName: telegramUser.first_name ?? null,
      requestId,
      logPrefix: LOG_PREFIX,
      createIfMissing: true,
    })
    const response = await getAuthProfileResponse({
      supabase,
      user,
      logPrefix: LOG_PREFIX,
    })

    return successResponse(200, response)
  } catch (error) {
    if (error instanceof AppError) {
      console.error(`${LOG_PREFIX} request failed`, {
        status: error.status,
        code: error.code,
        message: error.message,
      })
      return errorResponse(error.status, error.code, error.message)
    }

    console.error(`${LOG_PREFIX} auth failed`, {
      message: error instanceof Error ? error.message : 'Unknown auth error.',
    })
    return errorResponse(500, INTERNAL_ERROR_CODE, DEFAULT_INTERNAL_ERROR_MESSAGE)
  }
})
