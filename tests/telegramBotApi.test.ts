import assert from 'node:assert/strict'
import test from 'node:test'
import {
  TelegramBotApiError,
  createTelegramBotApiClient,
} from '../supabase/functions/telegram-bot-webhook/telegram-bot-api.ts'
import { HTTP_STATUS } from './fixtures/http.ts'

import {
  TELEGRAM_BOT_API_MOCKS,
  TELEGRAM_BOT_API_RESPONSES,
} from './mocks/telegramBotApi.ts'

test('gets the default menu button without a chat id', async () => {
  const requests: Array<{ url: string; body: unknown }> = []
  const client = createTelegramBotApiClient({
    token: TELEGRAM_BOT_API_MOCKS.token,
    fetchImpl: async (input, init) => {
      requests.push({
        url: String(input),
        body: JSON.parse(String(init?.body)) as unknown,
      })
      return TELEGRAM_BOT_API_RESPONSES.menuButton()
    },
  })

  const result = await client.getDefaultMenuButton()
  assert.deepEqual(requests, [
    {
      url: TELEGRAM_BOT_API_MOCKS.expectedRequestUrl,
      body: TELEGRAM_BOT_API_MOCKS.expectedRequestBody,
    },
  ])
  assert.deepEqual(result, TELEGRAM_BOT_API_MOCKS.menuButton)
})

test('does not expose provider details or token in Telegram API errors', async () => {
  const client = createTelegramBotApiClient({
    token: TELEGRAM_BOT_API_MOCKS.sensitiveToken,
    fetchImpl: async () => TELEGRAM_BOT_API_RESPONSES.rejected(),
  })

  await assert.rejects(client.getDefaultMenuButton(), (error: unknown) => {
    assert.ok(error instanceof TelegramBotApiError)
    assert.equal(error.code, TELEGRAM_BOT_API_MOCKS.rejectionCode)
    assert.equal(error.providerStatus, HTTP_STATUS.badRequest)
    assert.equal(error.providerErrorCode, HTTP_STATUS.badRequest)
    assert.doesNotMatch(
      error.message,
      TELEGRAM_BOT_API_MOCKS.sensitiveDetailsPattern,
    )
    return true
  })
})

test('turns aborted requests into a safe timeout error', async () => {
  const client = createTelegramBotApiClient({
    token: TELEGRAM_BOT_API_MOCKS.token,
    timeoutMs: TELEGRAM_BOT_API_MOCKS.timeoutMs,
    fetchImpl: (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          TELEGRAM_BOT_API_MOCKS.abortEvent,
          () => {
            reject(
              new DOMException(
                TELEGRAM_BOT_API_MOCKS.abortMessage,
                TELEGRAM_BOT_API_MOCKS.abortErrorName,
              ),
            )
          },
        )
      }),
  })

  await assert.rejects(client.getDefaultMenuButton(), (error: unknown) => {
    assert.ok(error instanceof TelegramBotApiError)
    assert.equal(error.code, TELEGRAM_BOT_API_MOCKS.timeoutCode)
    return true
  })
})
