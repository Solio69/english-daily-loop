import {
  AppError,
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
} from '../_shared/server.ts'
import { getConfiguredOpenRouterModelChain } from '../_shared/openrouter.ts'
import {
  buildReadingAiDiagnostics,
  GENERATION_ERROR,
  GENERATION_LOG_PREFIX,
} from './generation-contract.ts'
import { createDefaultReadingGenerationRepository } from './generation-repository.ts'
import {
  createReadingGenerationPorts,
  GenerationRunFailure,
  runReadingGeneration,
} from './generation-service.ts'

const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TELEGRAM_BOT_TOKEN',
  'OPENROUTER_API_KEY',
] as const

const getModels = (requestId: string): string[] => {
  try {
    return getConfiguredOpenRouterModelChain(getOptionalEnv)
  } catch (error) {
    console.error(GENERATION_LOG_PREFIX + ' invalid model configuration', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown model error.',
    })
    fail(
      500,
      'AI_MODEL_CONFIG_INVALID',
      'Server AI model config is not allowed.',
    )
  }
}

export const handleGenerateReadingText = async (
  req: Request,
): Promise<Response> => {
  const corsResponse = handleCorsPreflight(req)
  if (corsResponse) return corsResponse

  const requestStartedAt = Date.now()
  const requestId = getRequestId(req)

  try {
    assertPostRequest(req)
    const env = getRequiredEnv([...REQUIRED_ENV])
    const models = getModels(requestId)
    const body = await parseJsonBody<{ initData?: unknown }>(req)
    const telegramUser = await getTelegramUserFromBody(
      body,
      env.TELEGRAM_BOT_TOKEN,
    )
    const repository = createDefaultReadingGenerationRepository(env)
    const payload = await runReadingGeneration({
      telegramUserId: telegramUser.id,
      requestId,
      models,
      apiKey: env.OPENROUTER_API_KEY,
      requestStartedAt,
      ports: createReadingGenerationPorts({ repository }),
    })
    return successResponse(200, payload, requestId)
  } catch (caught) {
    const failure = caught instanceof GenerationRunFailure ? caught : null
    const error = failure?.reason ?? caught
    const diagnostics = buildReadingAiDiagnostics({
      requestId,
      error,
      attemptMetadata: failure?.metadata ?? null,
      durationMs: Date.now() - requestStartedAt,
    })

    if (error instanceof AppError) {
      console.error(GENERATION_LOG_PREFIX + ' request failed', {
        requestId,
        status: error.status,
        code: error.code,
        message: error.message,
      })
      return errorResponse(
        error.status,
        error.code,
        error.message,
        requestId,
        diagnostics,
      )
    }

    const message =
      error instanceof Error ? error.message : GENERATION_ERROR.unknownMessage
    console.error(GENERATION_LOG_PREFIX + ' failed', { requestId, message })
    return errorResponse(
      502,
      GENERATION_ERROR.failedCode,
      GENERATION_ERROR.publicMessage,
      requestId,
      diagnostics,
    )
  }
}

Deno.serve(handleGenerateReadingText)
