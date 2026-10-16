import { TELEGRAM_TEST } from '../fixtures/telegram.ts'

export const TELEGRAM_BOT_CONFIG_MOCKS = {
  webhookSecret: TELEGRAM_TEST.webhookSecret,
  invalidShortSecret: 'short',
  invalidSecretSuffix: '!',
  devDisplayName: 'DEV: English Daily Loop',
  displayName: 'English Daily Loop',
  command: { start: 'start', help: 'help' },
  profilePath: '../scripts/telegram/bot-profile.json',
  fileEncoding: 'utf8',
  apiTunnelUrl: 'https://api-tunnel.example',
  expectedWebhookUrl:
    'https://api-tunnel.example/functions/v1/telegram-bot-webhook',
  insecureUrl: 'http://127.0.0.1:54321',
  secureUrlPattern: /HTTPS URL/,
  secretLengthPattern: /32-256/,
  frontendUrl: 'https://frontend.example',
  webhookUrl: 'https://api.example/functions/v1/telegram-bot-webhook',
  sensitiveToken: 'sensitive-token',
  expectedBotUsername: '@expected_dev_bot',
  actualBotUsername: 'expected_dev_bot',
  wrongBotUsername: 'another_dev_bot',
  usernameMismatchCode: 'TELEGRAM_BOT_USERNAME_MISMATCH',
  menuButtonType: 'web_app',
  privateChatScope: 'all_private_chats',
  messageUpdate: 'message',
  operation: {
    getMe: 'getMe',
    setMyName: 'setMyName',
    setMyShortDescription: 'setMyShortDescription',
    setMyDescription: 'setMyDescription',
    setMyCommands: 'setMyCommands',
    setChatMenuButton: 'setChatMenuButton',
    setWebhook: 'setWebhook',
    getWebhookInfo: 'getWebhookInfo',
    deleteWebhook: 'deleteWebhook',
  },
  emptyText: '',
  urlSeparator: '/',
  lastSegment: -1,
  firstOperationIndex: 0,
  nameOperationIndex: 1,
  commandsOperationIndex: 3,
  menuOperationIndex: 4,
  webhookOperationIndex: 5,
  initialPendingUpdates: 0,
  rawProviderError: 'raw error is not returned',
  rawProviderErrorPattern: /raw error/,
} as const

export const TELEGRAM_BOT_CONFIG_RESPONSES = {
  success: { ok: true, result: true },
  wrongBot: {
    ok: true,
    result: { username: TELEGRAM_BOT_CONFIG_MOCKS.wrongBotUsername },
  },
  expectedBot: {
    ok: true,
    result: { username: TELEGRAM_BOT_CONFIG_MOCKS.actualBotUsername },
  },
  webhookInfo: {
    ok: true,
    result: {
      url: TELEGRAM_BOT_CONFIG_MOCKS.webhookUrl,
      pending_update_count: TELEGRAM_BOT_CONFIG_MOCKS.initialPendingUpdates,
      allowed_updates: [TELEGRAM_BOT_CONFIG_MOCKS.messageUpdate],
    },
  },
  webhookInfoWithError: {
    ok: true,
    result: {
      url: TELEGRAM_BOT_CONFIG_MOCKS.emptyText,
      pending_update_count: TELEGRAM_BOT_CONFIG_MOCKS.initialPendingUpdates,
      last_error_message: TELEGRAM_BOT_CONFIG_MOCKS.rawProviderError,
    },
  },
} as const
