export const TELEGRAM_BOT_PROFILE = Object.freeze({
  displayName: 'English Daily Loop',
  shortDescription:
    'Ежедневная практика английского: чтение, новые слова и повторение.',
  description:
    'Читай короткие тексты по своему уровню, сохраняй новые слова и повторяй их по дневному плану — всё в одном небольшом занятии.',
  openAppButtonText: 'Открыть приложение',
  commands: Object.freeze([
    Object.freeze({
      command: 'start',
      description: 'Открыть приветствие и приложение',
    }),
    Object.freeze({ command: 'help', description: 'Как работает приложение' }),
  ]),
})

export const DEV_TELEGRAM_BOT_DISPLAY_NAME = `DEV: ${TELEGRAM_BOT_PROFILE.displayName}`

export const TELEGRAM_WEBHOOK_PATH = '/functions/v1/telegram-bot-webhook'

const WEBHOOK_SECRET_PATTERN = /^[A-Za-z0-9_-]{32,256}$/
export function validateTelegramWebhookSecret(value) {
  if (!WEBHOOK_SECRET_PATTERN.test(String(value ?? ''))) {
    throw new Error(
      'TELEGRAM_BOT_WEBHOOK_SECRET must contain 32-256 characters: A-Z, a-z, 0-9, _ or -.',
    )
  }
  return value
}

export function validateHttpsUrl(value, label) {
  const rawValue = String(value ?? '').trim()
  let parsedUrl
  try {
    parsedUrl = new URL(rawValue)
  } catch {
    throw new Error(`${label} must be a valid HTTPS URL.`)
  }

  if (
    parsedUrl.protocol !== 'https:' ||
    !parsedUrl.hostname ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error(`${label} must be a valid HTTPS URL.`)
  }
  return rawValue
}

export function buildTelegramWebhookUrl(apiBaseUrl) {
  const safeBaseUrl = validateHttpsUrl(apiBaseUrl, 'Telegram API tunnel URL')
  return new URL(TELEGRAM_WEBHOOK_PATH, safeBaseUrl).toString()
}

export function buildTelegramBotConfiguration({
  displayName = String(TELEGRAM_BOT_PROFILE.displayName),
  frontendUrl,
  webhookUrl,
  webhookSecret,
  dropPendingUpdates = false,
}) {
  if (
    typeof displayName !== 'string' ||
    displayName.trim() !== displayName ||
    displayName.length < 1 ||
    displayName.length > 64
  ) {
    throw new Error('Telegram bot display name must contain 1-64 characters.')
  }
  const safeFrontendUrl = validateHttpsUrl(frontendUrl, 'Telegram Mini App URL')
  const safeWebhookUrl = validateHttpsUrl(webhookUrl, 'Telegram webhook URL')
  const safeWebhookSecret = validateTelegramWebhookSecret(webhookSecret)

  return [
    {
      operation: 'setMyName',
      payload: { name: displayName },
    },
    {
      operation: 'setMyShortDescription',
      payload: {
        short_description: TELEGRAM_BOT_PROFILE.shortDescription,
      },
    },
    {
      operation: 'setMyDescription',
      payload: { description: TELEGRAM_BOT_PROFILE.description },
    },
    {
      operation: 'setMyCommands',
      payload: {
        commands: TELEGRAM_BOT_PROFILE.commands,
        scope: { type: 'all_private_chats' },
      },
    },
    {
      operation: 'setChatMenuButton',
      payload: {
        menu_button: {
          type: 'web_app',
          text: TELEGRAM_BOT_PROFILE.openAppButtonText,
          web_app: { url: safeFrontendUrl },
        },
      },
    },
    {
      operation: 'setWebhook',
      payload: {
        url: safeWebhookUrl,
        allowed_updates: ['message'],
        secret_token: safeWebhookSecret,
        drop_pending_updates: Boolean(dropPendingUpdates),
      },
    },
  ]
}
