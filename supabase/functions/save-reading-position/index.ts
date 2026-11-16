import { createServiceClient, getAppUserByTelegramId } from '../_shared/app.ts'
import {
  AppError,
  DEFAULT_INTERNAL_ERROR_MESSAGE,
  assertPostRequest,
  errorResponse,
  getRequestId,
  getRequiredEnv,
  getTelegramUserFromBody,
  handleCorsPreflight,
  parseJsonObjectBody,
  successResponse,
} from '../_shared/server.ts'
import {
  parseParagraphIndex,
  parseReadingTextId,
  POSITION_LOG_PREFIX,
} from './position-contract.ts'
import { createReadingPositionRepository } from './position-repository.ts'
import { saveReadingPosition } from './position-service.ts'

const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TELEGRAM_BOT_TOKEN',
] as const

export const handleSaveReadingPosition = async (
  req: Request,
): Promise<Response> => {
  const corsResponse = handleCorsPreflight(req)
  if (corsResponse) return corsResponse

  const requestId = getRequestId(req)
  const startedAt = Date.now()
  try {
    assertPostRequest(req)
    const env = getRequiredEnv([...REQUIRED_ENV])
    const body = await parseJsonObjectBody(req)
    const tgUser = await getTelegramUserFromBody(body, env.TELEGRAM_BOT_TOKEN)
    const readingTextId = parseReadingTextId(body.readingTextId)
    const paragraphIndex = parseParagraphIndex(body)
    const supabase = createServiceClient(env)
    const appUser = await getAppUserByTelegramId(
      supabase,
      tgUser.id,
      POSITION_LOG_PREFIX,
      requestId,
    )
    const result = await saveReadingPosition({
      userId: appUser.id,
      readingTextId,
      paragraphIndex,
      requestId,
      startedAt,
      repository: createReadingPositionRepository(supabase),
    })
    return successResponse(200, result, requestId)
  } catch (error) {
    if (error instanceof AppError) {
      console.error(POSITION_LOG_PREFIX + ' request failed', {
        requestId,
        status: error.status,
        code: error.code,
        message: error.message,
        durationMs: Date.now() - startedAt,
      })
      return errorResponse(error.status, error.code, error.message, requestId)
    }
    const message =
      error instanceof Error ? error.message : 'Unknown reading position error.'
    console.error(POSITION_LOG_PREFIX + ' failed', {
      requestId,
      message,
      durationMs: Date.now() - startedAt,
    })
    return errorResponse(
      500,
      'READING_POSITION_SAVE_FAILED',
      DEFAULT_INTERNAL_ERROR_MESSAGE,
      requestId,
    )
  }
}

Deno.serve(handleSaveReadingPosition)
