import {
  TELEGRAM_BOT_PROFILE,
  buildTelegramBotConfiguration,
} from './bot-profile.mjs'
import {
  TelegramBotConfigurationError,
  createTelegramBotApi,
  sanitizeWebhookInfo,
} from './bot-api.mjs'

export {
  TELEGRAM_BOT_PROFILE,
  DEV_TELEGRAM_BOT_DISPLAY_NAME,
  TELEGRAM_WEBHOOK_PATH,
  validateTelegramWebhookSecret,
  validateHttpsUrl,
  buildTelegramWebhookUrl,
  buildTelegramBotConfiguration,
} from './bot-profile.mjs'
export {
  TelegramBotConfigurationError,
  createTelegramBotApi,
  sanitizeWebhookInfo,
} from './bot-api.mjs'

const PROFILE_READ_OPERATIONS = Object.freeze({
  setMyName: Object.freeze({ operation: 'getMyName', field: 'name' }),
  setMyShortDescription: Object.freeze({
    operation: 'getMyShortDescription',
    field: 'short_description',
  }),
  setMyDescription: Object.freeze({
    operation: 'getMyDescription',
    field: 'description',
  }),
})

const normalizeBotUsername = (value) => {
  const trimmed = String(value ?? '').trim()
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`
}

export async function configureTelegramBot({
  token,
  expectedBotUsername,
  displayName = String(TELEGRAM_BOT_PROFILE.displayName),
  frontendUrl,
  webhookUrl,
  webhookSecret,
  dropPendingUpdates = false,
  fetchImpl = fetch,
}) {
  const api = createTelegramBotApi({ token, fetchImpl })
  const expectedUsername = normalizeBotUsername(expectedBotUsername)
  const bot = await api.call('getMe')
  const actualUsername = normalizeBotUsername(bot?.username)

  if (
    !/^@[A-Za-z0-9_]{5,32}bot$/i.test(actualUsername) ||
    actualUsername.toLowerCase() !== expectedUsername.toLowerCase()
  ) {
    throw new TelegramBotConfigurationError(
      'getMe',
      'TELEGRAM_BOT_USERNAME_MISMATCH',
    )
  }

  const operations = buildTelegramBotConfiguration({
    displayName,
    frontendUrl,
    webhookUrl,
    webhookSecret,
    dropPendingUpdates,
  })
  for (const { operation, payload } of operations) {
    const profileRead = PROFILE_READ_OPERATIONS[operation]
    if (profileRead) {
      const currentProfile = await api.call(profileRead.operation)
      if (currentProfile?.[profileRead.field] === payload[profileRead.field]) {
        continue
      }
    }
    await api.call(operation, payload)
  }

  const webhookInfo = sanitizeWebhookInfo(await api.call('getWebhookInfo'))
  return { botUsername: actualUsername, webhookInfo }
}

export async function deleteTelegramWebhook({
  token,
  expectedBotUsername,
  dropPendingUpdates = false,
  fetchImpl = fetch,
}) {
  const api = createTelegramBotApi({ token, fetchImpl })
  const expectedUsername = normalizeBotUsername(expectedBotUsername)
  const bot = await api.call('getMe')
  const actualUsername = normalizeBotUsername(bot?.username)
  if (actualUsername.toLowerCase() !== expectedUsername.toLowerCase()) {
    throw new TelegramBotConfigurationError(
      'getMe',
      'TELEGRAM_BOT_USERNAME_MISMATCH',
    )
  }

  await api.call('deleteWebhook', {
    drop_pending_updates: Boolean(dropPendingUpdates),
  })
  return sanitizeWebhookInfo(await api.call('getWebhookInfo'))
}
