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
import { createServiceClient } from '../_shared/app.ts'
import {
  submitSupportReportFlow,
  type SupportReportBody,
} from './support-report-flow.ts'
import { createSupportReportRepository } from './support-report-repository.ts'

const LOG_PREFIX = '[submit-support-report]'

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
    const body = await parseJsonBody<SupportReportBody>(req)
    const telegramUser = await getTelegramUserFromBody(
      body,
      env.TELEGRAM_BOT_TOKEN,
    )
    const repository = createSupportReportRepository({
      supabase: createServiceClient(env),
      requestId,
    })
    const saved = await submitSupportReportFlow({
      body,
      telegramUserId: telegramUser.id,
      dependencies: repository,
    })

    console.info(LOG_PREFIX, { requestId, stage: 'saved' })
    return successResponse(200, saved, requestId)
  } catch (error) {
    if (error instanceof AppError) {
      console.error(LOG_PREFIX, {
        requestId,
        stage: 'request_failed',
        status: error.status,
        code: error.code,
      })
      return errorResponse(error.status, error.code, error.message, requestId)
    }

    console.error(LOG_PREFIX, { requestId, stage: 'unexpected_error' })
    return errorResponse(
      500,
      'SUPPORT_REPORT_FAILED',
      DEFAULT_INTERNAL_ERROR_MESSAGE,
      requestId,
    )
  }
})
