import { invokeFunctionWithInitData } from './functionClient'
import { requireAuthProfile, requireSavedSettings } from './userContracts'
import type {
  AppUser,
  SaveUserSettingsInput,
  SavedUserSettings,
} from '../types/user'

const AUTH_DEBUG_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_DEBUG_AUTH === 'true'
const MISSING_INIT_DATA_MESSAGE =
  'Telegram initData не найден. Открой приложение внутри Telegram.'
const AUTH_FAILURE_MESSAGE = 'Не удалось авторизоваться через Telegram.'
const SETTINGS_FAILURE_MESSAGE = 'Не удалось сохранить настройки.'

const authLog = ({
  message,
  details,
}: {
  message: string
  details?: unknown
}): void => {
  if (!AUTH_DEBUG_ENABLED) return
  if (details !== undefined) {
    console.info(`[EDL auth] ${message}`, details)
    return
  }
  console.info(`[EDL auth] ${message}`)
}

const getTelegramInitData = (): string => {
  const initData = window.Telegram?.WebApp?.initData?.trim()
  authLog({
    message: 'Telegram initData check',
    details: {
      hasTelegramObject: Boolean(window.Telegram?.WebApp),
      hasInitData: Boolean(initData),
      initDataLength: initData?.length ?? 0,
    },
  })
  if (!initData) throw new Error(MISSING_INIT_DATA_MESSAGE)
  return initData
}

export const getCurrentAppUser = async (): Promise<AppUser> => {
  const initData = getTelegramInitData()
  const response = requireAuthProfile(
    await invokeFunctionWithInitData<unknown>(
      'auth-telegram',
      initData,
      {},
      AUTH_FAILURE_MESSAGE,
    ),
  )

  authLog({
    message: 'Bootstrapped app user',
    details: {
      appUserId: response.user.id,
      hasSettings: Boolean(response.settings),
      subscriptionTier: response.subscription.tier,
      readingStatus: response.homeProgress.reading.status,
      reviewStatus: response.homeProgress.review.status,
    },
  })

  return {
    ...response.user,
    settings: response.settings,
    subscription: response.subscription,
    homeProgress: response.homeProgress,
    streakDays: response.streakDays,
    completedReadingTextCount: response.completedReadingTextCount,
  }
}

export const saveCurrentUserSettings = async (
  input: SaveUserSettingsInput,
): Promise<SavedUserSettings> => {
  const initData = getTelegramInitData()
  const response = requireSavedSettings(
    await invokeFunctionWithInitData<unknown>(
      'save-user-settings',
      initData,
      { settings: input },
      SETTINGS_FAILURE_MESSAGE,
    ),
  )
  authLog({
    message: 'Settings saved successfully',
    details: { userId: response.user.id },
  })
  return response
}
