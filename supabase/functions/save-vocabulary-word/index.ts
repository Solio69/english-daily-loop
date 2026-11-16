import { createServiceClient, getAppUserByTelegramId } from '../_shared/app.ts'
import { getMoscowStudyDate } from '../_shared/moscow-study-date.ts'
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
import { parseSaveWordInput, SAVE_WORD_CODE } from './save-word-contract.ts'
import { createSaveWordRepository } from './save-word-repository.ts'
import { saveVocabularyWord } from './save-word-service.ts'

const LOG_PREFIX = '[save-vocabulary-word]'
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TELEGRAM_BOT_TOKEN',
] as const

export const handleSaveVocabularyWord = async (
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
      readingTextId?: unknown
      word?: unknown
      wordIndex?: unknown
    }>(req)
    const tgUser = await getTelegramUserFromBody(body, env.TELEGRAM_BOT_TOKEN)
    const input = parseSaveWordInput(body)
    const supabase = createServiceClient(env)
    const appUser = await getAppUserByTelegramId(
      supabase,
      tgUser.id,
      LOG_PREFIX,
      requestId,
    )
    const result = await saveVocabularyWord({
      ...input,
      userId: appUser.id,
      studyDate: getMoscowStudyDate(),
      repository: createSaveWordRepository(supabase),
    })
    return successResponse(HTTP_STATUS.OK, result)
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
      error instanceof Error ? error.message : 'Unknown vocabulary save error.'
    console.error(LOG_PREFIX + ' failed', { message })
    return errorResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      SAVE_WORD_CODE.saveFailed,
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    )
  }
}

Deno.serve(handleSaveVocabularyWord)
