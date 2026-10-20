import { createServiceClient } from '../_shared/app.ts'
import {
  AppError,
  DEFAULT_INTERNAL_ERROR_MESSAGE,
  assertPostRequest,
  errorResponse,
  fail,
  getRequiredEnv,
  getRequestId,
  getTelegramUserFromBody,
  handleCorsPreflight,
  parseJsonBody,
  successResponse,
} from '../_shared/server.ts'
import {
  getProfileUser,
  saveProfileSettings,
} from '../_shared/user-profile-repository.ts'
import type { ProfileSettingsRow } from '../_shared/user-profile-repository.ts'
import { getSavedSettingsResponse } from '../_shared/user-profile-response.ts'

const LOG_PREFIX = '[save-user-settings]'
const INVALID_SETTINGS_CODE = 'INVALID_SETTINGS'
const INVALID_LEVEL_MESSAGE = 'English level is invalid.'
const INVALID_MINUTES_MESSAGE = 'Daily reading minutes value is invalid.'

const parseEnglishLevel = (value: unknown): ProfileSettingsRow['english_level'] => {
  const isSupportedLevel =
    value === 'A1' || value === 'A2' || value === 'B1' || value === 'B2'
  if (isSupportedLevel) return value
  return fail(400, INVALID_SETTINGS_CODE, INVALID_LEVEL_MESSAGE)
}

const parseDailyReadingMinutes = (
  value: unknown,
): ProfileSettingsRow['daily_reading_minutes'] => {
  const isSupportedMinutes =
    value === 3 || value === 5 || value === 10 || value === 15
  if (isSupportedMinutes) return value
  return fail(400, INVALID_SETTINGS_CODE, INVALID_MINUTES_MESSAGE)
}

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
    const body = await parseJsonBody<{
      initData?: unknown
      settings?: {
        englishLevel?: unknown
        dailyReadingMinutes?: unknown
      }
    }>(req)
    if (!body?.settings || typeof body.settings !== 'object') {
      fail(400, INVALID_SETTINGS_CODE, 'Settings payload is required.')
    }

    const settings: ProfileSettingsRow = {
      english_level: parseEnglishLevel(body.settings.englishLevel),
      daily_reading_minutes: parseDailyReadingMinutes(
        body.settings.dailyReadingMinutes,
      ),
    }
    const telegramUser = await getTelegramUserFromBody(
      body,
      env.TELEGRAM_BOT_TOKEN,
    )
    const supabase = createServiceClient(env)
    const user = await getProfileUser({
      supabase,
      telegramUserId: telegramUser.id,
      requestId,
      logPrefix: LOG_PREFIX,
      createIfMissing: false,
    })
    const nowIso = new Date().toISOString()
    const saved = await saveProfileSettings({
      supabase,
      user,
      settings,
      nowIso,
      logPrefix: LOG_PREFIX,
    })
    const response = await getSavedSettingsResponse({
      supabase,
      user: saved.user,
      settings: saved.settings,
      nowIso,
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

    console.error(`${LOG_PREFIX} failed`, {
      message:
        error instanceof Error ? error.message : 'Unknown settings save error.',
    })
    return errorResponse(
      500,
      'SETTINGS_SAVE_FAILED',
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    )
  }
})
