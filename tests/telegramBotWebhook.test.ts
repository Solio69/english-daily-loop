import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FALLBACK_MESSAGE,
  HELP_MESSAGE,
  OPEN_APP_BUTTON_TEXT,
  START_MESSAGE,
  type TelegramSendMessagePayload,
} from '../supabase/functions/telegram-bot-webhook/bot-flow.ts'
import {
  TelegramBotApiError,
  type TelegramBotApiClient,
} from '../supabase/functions/telegram-bot-webhook/telegram-bot-api.ts'
import {
  handleTelegramWebhook,
  isValidTelegramWebhookSecret,
  type TelegramWebhookLogger,
} from '../supabase/functions/telegram-bot-webhook/webhook-handler.ts'
import { HTTP_METHOD, HTTP_STATUS } from './fixtures/http.ts'

import { TELEGRAM_BOT_WEBHOOK_MOCKS } from './mocks/telegramBotWebhook.ts'

const privateUpdate = (text?: string) => ({
  update_id: TELEGRAM_BOT_WEBHOOK_MOCKS.updateId,
  message: {
    message_id: TELEGRAM_BOT_WEBHOOK_MOCKS.messageId,
    from: {
      id: TELEGRAM_BOT_WEBHOOK_MOCKS.userId,
      is_bot: false,
      first_name: TELEGRAM_BOT_WEBHOOK_MOCKS.firstName,
      username: TELEGRAM_BOT_WEBHOOK_MOCKS.username,
    },
    chat: {
      id: TELEGRAM_BOT_WEBHOOK_MOCKS.userId,
      type: TELEGRAM_BOT_WEBHOOK_MOCKS.privateType,
    },
    ...(text === undefined
      ? { sticker: { file_id: TELEGRAM_BOT_WEBHOOK_MOCKS.stickerId } }
      : { text }),
  },
})

const makeRequest = (
  body: string,
  options: { method?: string; secret?: string; contentLength?: string } = {},
) =>
  new Request(TELEGRAM_BOT_WEBHOOK_MOCKS.requestUrl, {
    method: options.method ?? HTTP_METHOD.post,
    headers: {
      [TELEGRAM_BOT_WEBHOOK_MOCKS.webhookHeader]:
        options.secret ?? TELEGRAM_BOT_WEBHOOK_MOCKS.webhookSecret,
      ...(options.contentLength
        ? {
            [TELEGRAM_BOT_WEBHOOK_MOCKS.contentLengthHeader]:
              options.contentLength,
          }
        : {}),
    },
    body: options.method === HTTP_METHOD.get ? undefined : body,
  })

const createBotApi = (overrides: Partial<TelegramBotApiClient> = {}) => {
  const sent: TelegramSendMessagePayload[] = []
  const botApi: TelegramBotApiClient = {
    getDefaultMenuButton: async () => ({
      type: TELEGRAM_BOT_WEBHOOK_MOCKS.menuType.webApp,
      text: OPEN_APP_BUTTON_TEXT,
      web_app: { url: TELEGRAM_BOT_WEBHOOK_MOCKS.appUrl },
    }),
    sendMessage: async (payload) => {
      sent.push(payload)
    },
    ...overrides,
  }
  return { botApi, sent }
}

const createLogger = () => {
  const entries: Array<{ level: string; message: string; fields: unknown }> = []
  const logger: TelegramWebhookLogger = {
    info: (message, fields) =>
      entries.push({
        level: TELEGRAM_BOT_WEBHOOK_MOCKS.logLevel.info,
        message,
        fields,
      }),
    error: (message, fields) =>
      entries.push({
        level: TELEGRAM_BOT_WEBHOOK_MOCKS.logLevel.error,
        message,
        fields,
      }),
  }
  return { logger, entries }
}

test('requires a strong Bot API-compatible webhook secret', () => {
  assert.equal(
    isValidTelegramWebhookSecret(TELEGRAM_BOT_WEBHOOK_MOCKS.webhookSecret),
    true,
  )
  assert.equal(
    isValidTelegramWebhookSecret(TELEGRAM_BOT_WEBHOOK_MOCKS.invalidShortSecret),
    false,
  )
  assert.equal(
    isValidTelegramWebhookSecret(
      TELEGRAM_BOT_WEBHOOK_MOCKS.invalidSpacedSecret,
    ),
    false,
  )
})

test('rejects wrong method and secret before Telegram API calls', async () => {
  const { botApi, sent } = createBotApi()
  const methodResponse = await handleTelegramWebhook(
    makeRequest(TELEGRAM_BOT_WEBHOOK_MOCKS.emptyBody, {
      method: HTTP_METHOD.get,
    }),
    { webhookSecret: TELEGRAM_BOT_WEBHOOK_MOCKS.webhookSecret, botApi },
  )
  assert.equal(methodResponse.status, HTTP_STATUS.methodNotAllowed)

  const authResponse = await handleTelegramWebhook(
    makeRequest(
      JSON.stringify(privateUpdate(TELEGRAM_BOT_WEBHOOK_MOCKS.command.start)),
      {
        secret: TELEGRAM_BOT_WEBHOOK_MOCKS.wrongSecret,
      },
    ),
    { webhookSecret: TELEGRAM_BOT_WEBHOOK_MOCKS.webhookSecret, botApi },
  )
  assert.equal(authResponse.status, HTTP_STATUS.unauthorized)
  assert.equal(sent.length, TELEGRAM_BOT_WEBHOOK_MOCKS.initialCount)
})

test('rejects oversized and invalid JSON requests', async () => {
  const { botApi, sent } = createBotApi()
  const oversizedResponse = await handleTelegramWebhook(
    makeRequest(TELEGRAM_BOT_WEBHOOK_MOCKS.emptyJsonObject, {
      contentLength: String(TELEGRAM_BOT_WEBHOOK_MOCKS.oversizedBytes),
    }),
    { webhookSecret: TELEGRAM_BOT_WEBHOOK_MOCKS.webhookSecret, botApi },
  )
  assert.equal(oversizedResponse.status, HTTP_STATUS.payloadTooLarge)

  const invalidJsonResponse = await handleTelegramWebhook(
    makeRequest(TELEGRAM_BOT_WEBHOOK_MOCKS.invalidJson),
    { webhookSecret: TELEGRAM_BOT_WEBHOOK_MOCKS.webhookSecret, botApi },
  )
  assert.equal(invalidJsonResponse.status, HTTP_STATUS.badRequest)
  assert.equal(sent.length, TELEGRAM_BOT_WEBHOOK_MOCKS.initialCount)
})

test('sends exact start, help, and fallback replies with the current menu URL', async () => {
  for (const [text, expectedText] of [
    [TELEGRAM_BOT_WEBHOOK_MOCKS.command.start, START_MESSAGE],
    [TELEGRAM_BOT_WEBHOOK_MOCKS.command.help, HELP_MESSAGE],
    [TELEGRAM_BOT_WEBHOOK_MOCKS.fallbackQuestion, FALLBACK_MESSAGE],
    [undefined, FALLBACK_MESSAGE],
  ]) {
    const { botApi, sent } = createBotApi()
    const response = await handleTelegramWebhook(
      makeRequest(JSON.stringify(privateUpdate(text))),
      { webhookSecret: TELEGRAM_BOT_WEBHOOK_MOCKS.webhookSecret, botApi },
    )

    assert.equal(response.status, HTTP_STATUS.ok)
    assert.deepEqual(sent, [
      {
        chat_id: TELEGRAM_BOT_WEBHOOK_MOCKS.userId,
        text: expectedText,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: OPEN_APP_BUTTON_TEXT,
                web_app: { url: TELEGRAM_BOT_WEBHOOK_MOCKS.appUrl },
              },
            ],
          ],
        },
      },
    ])
  }
})

test('acknowledges group updates without sending a reply', async () => {
  const { botApi, sent } = createBotApi()
  const privateMessage = privateUpdate(TELEGRAM_BOT_WEBHOOK_MOCKS.command.start)
  const update = {
    ...privateMessage,
    message: {
      ...privateMessage.message,
      chat: {
        id: TELEGRAM_BOT_WEBHOOK_MOCKS.groupId,
        type: TELEGRAM_BOT_WEBHOOK_MOCKS.groupType,
      },
    },
  }
  const response = await handleTelegramWebhook(
    makeRequest(JSON.stringify(update)),
    { webhookSecret: TELEGRAM_BOT_WEBHOOK_MOCKS.webhookSecret, botApi },
  )

  assert.equal(response.status, HTTP_STATUS.ok)
  assert.equal(sent.length, TELEGRAM_BOT_WEBHOOK_MOCKS.initialCount)
})

test('returns retryable errors for menu misconfiguration and Telegram failures', async () => {
  const missingMenu = createBotApi({
    getDefaultMenuButton: async () => ({
      type: TELEGRAM_BOT_WEBHOOK_MOCKS.menuType.commands,
    }),
  })
  const missingMenuResponse = await handleTelegramWebhook(
    makeRequest(
      JSON.stringify(privateUpdate(TELEGRAM_BOT_WEBHOOK_MOCKS.command.start)),
    ),
    {
      webhookSecret: TELEGRAM_BOT_WEBHOOK_MOCKS.webhookSecret,
      botApi: missingMenu.botApi,
    },
  )
  assert.equal(missingMenuResponse.status, HTTP_STATUS.unavailable)
  assert.equal(missingMenu.sent.length, TELEGRAM_BOT_WEBHOOK_MOCKS.initialCount)

  const failedApi = createBotApi({
    getDefaultMenuButton: async () => {
      throw new TelegramBotApiError(
        TELEGRAM_BOT_WEBHOOK_MOCKS.menuOperation,
        TELEGRAM_BOT_WEBHOOK_MOCKS.timeoutCode,
      )
    },
  })
  const failedApiResponse = await handleTelegramWebhook(
    makeRequest(
      JSON.stringify(privateUpdate(TELEGRAM_BOT_WEBHOOK_MOCKS.command.start)),
    ),
    {
      webhookSecret: TELEGRAM_BOT_WEBHOOK_MOCKS.webhookSecret,
      botApi: failedApi.botApi,
    },
  )
  assert.equal(failedApiResponse.status, HTTP_STATUS.badGateway)
})

test('logs only safe categories and operational metadata', async () => {
  const { botApi } = createBotApi()
  const { logger, entries } = createLogger()
  const response = await handleTelegramWebhook(
    makeRequest(
      JSON.stringify(
        privateUpdate(TELEGRAM_BOT_WEBHOOK_MOCKS.sensitiveMessage),
      ),
    ),
    {
      webhookSecret: TELEGRAM_BOT_WEBHOOK_MOCKS.webhookSecret,
      botApi,
      logger,
      now: () => TELEGRAM_BOT_WEBHOOK_MOCKS.nowMs,
    },
  )

  assert.equal(response.status, HTTP_STATUS.ok)
  const serializedLogs = JSON.stringify(entries)
  assert.doesNotMatch(
    serializedLogs,
    TELEGRAM_BOT_WEBHOOK_MOCKS.sensitiveLogPattern,
  )
  assert.match(serializedLogs, TELEGRAM_BOT_WEBHOOK_MOCKS.safeLogPattern)
})
