import { TELEGRAM_BOT_PROFILE } from '../../scripts/telegram/bot-config.mjs'
import { HTTP_STATUS } from '../fixtures/http.ts'
import { TELEGRAM_TEST } from '../fixtures/telegram.ts'

const BOT_OPERATIONS = {
  getMe: 'getMe',
  getMyName: 'getMyName',
  getMyShortDescription: 'getMyShortDescription',
  getMyDescription: 'getMyDescription',
  setMyName: 'setMyName',
  setMyShortDescription: 'setMyShortDescription',
  setMyDescription: 'setMyDescription',
  setMyCommands: 'setMyCommands',
  setChatMenuButton: 'setChatMenuButton',
  setWebhook: 'setWebhook',
  getWebhookInfo: 'getWebhookInfo',
  deleteWebhook: 'deleteWebhook',
} as const

const WEBHOOK_REJECTION_DETAIL =
  'https://temporary-tunnel.trycloudflare.com token-secret'

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
  operation: BOT_OPERATIONS,
  emptyText: '',
  urlSeparator: '/',
  lastSegment: -1,
  firstOperationIndex: 0,
  configuredNameOperationIndex: 2,
  commandsOperationIndex: 3,
  menuOperationIndex: 4,
  webhookOperationIndex: 5,
  initialPendingUpdates: 0,
  rawProviderError: 'raw error is not returned',
  rawProviderErrorPattern: /raw error/,
  outdatedProfileValue: 'outdated',
  webhookRejection: {
    operation: BOT_OPERATIONS.setWebhook,
    status: HTTP_STATUS.badRequest,
    reason: 'HOST_RESOLUTION',
    sensitiveDetail: WEBHOOK_REJECTION_DETAIL,
    sensitivePattern: /temporary-tunnel|token-secret/,
  },
  configuredOperations: [
    BOT_OPERATIONS.getMe,
    BOT_OPERATIONS.getMyName,
    BOT_OPERATIONS.setMyName,
    BOT_OPERATIONS.getMyShortDescription,
    BOT_OPERATIONS.setMyShortDescription,
    BOT_OPERATIONS.getMyDescription,
    BOT_OPERATIONS.setMyDescription,
    BOT_OPERATIONS.setMyCommands,
    BOT_OPERATIONS.setChatMenuButton,
    BOT_OPERATIONS.setWebhook,
    BOT_OPERATIONS.getWebhookInfo,
  ],
  matchingProfileOperations: [
    BOT_OPERATIONS.getMe,
    BOT_OPERATIONS.getMyName,
    BOT_OPERATIONS.getMyShortDescription,
    BOT_OPERATIONS.getMyDescription,
    BOT_OPERATIONS.setMyCommands,
    BOT_OPERATIONS.setChatMenuButton,
    BOT_OPERATIONS.setWebhook,
    BOT_OPERATIONS.getWebhookInfo,
  ],
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
  outdatedName: {
    ok: true,
    result: { name: TELEGRAM_BOT_CONFIG_MOCKS.outdatedProfileValue },
  },
  outdatedShortDescription: {
    ok: true,
    result: {
      short_description: TELEGRAM_BOT_CONFIG_MOCKS.outdatedProfileValue,
    },
  },
  outdatedDescription: {
    ok: true,
    result: { description: TELEGRAM_BOT_CONFIG_MOCKS.outdatedProfileValue },
  },
  matchingName: {
    ok: true,
    result: { name: TELEGRAM_BOT_CONFIG_MOCKS.devDisplayName },
  },
  matchingShortDescription: {
    ok: true,
    result: { short_description: TELEGRAM_BOT_PROFILE.shortDescription },
  },
  matchingDescription: {
    ok: true,
    result: { description: TELEGRAM_BOT_PROFILE.description },
  },
  rejectedWebhook: {
    ok: false,
    error_code: TELEGRAM_BOT_CONFIG_MOCKS.webhookRejection.status,
    description:
      'Bad Request: bad webhook: Failed to resolve host: ' +
      WEBHOOK_REJECTION_DETAIL,
  },
} as const

export const TELEGRAM_BOT_CONFIG_MATCHING_PROFILE_RESPONSES: Record<
  string,
  unknown
> = {
  [BOT_OPERATIONS.getMe]: TELEGRAM_BOT_CONFIG_RESPONSES.expectedBot,
  [BOT_OPERATIONS.getMyName]: TELEGRAM_BOT_CONFIG_RESPONSES.matchingName,
  [BOT_OPERATIONS.getMyShortDescription]:
    TELEGRAM_BOT_CONFIG_RESPONSES.matchingShortDescription,
  [BOT_OPERATIONS.getMyDescription]:
    TELEGRAM_BOT_CONFIG_RESPONSES.matchingDescription,
  [BOT_OPERATIONS.getWebhookInfo]: TELEGRAM_BOT_CONFIG_RESPONSES.webhookInfo,
}
