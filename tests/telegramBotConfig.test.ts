import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  BOT_DESCRIPTION,
  BOT_DISPLAY_NAME,
  BOT_SHORT_DESCRIPTION,
  HELP_COMMAND_DESCRIPTION,
  OPEN_APP_BUTTON_TEXT,
  START_COMMAND_DESCRIPTION,
} from '../supabase/functions/telegram-bot-webhook/bot-flow.ts'
import {
  DEV_TELEGRAM_BOT_DISPLAY_NAME,
  TELEGRAM_BOT_PROFILE,
  TelegramBotConfigurationError,
  buildTelegramBotConfiguration,
  buildTelegramWebhookUrl,
  configureTelegramBot,
  createTelegramBotApi,
  deleteTelegramWebhook,
  sanitizeWebhookInfo,
  validateTelegramWebhookSecret,
} from '../scripts/telegram/bot-config.mjs'

import {
  TELEGRAM_BOT_CONFIG_MATCHING_PROFILE_RESPONSES,
  TELEGRAM_BOT_CONFIG_RESPONSES,
  TELEGRAM_BOT_CONFIG_MOCKS,
} from './mocks/telegramBotConfig.ts'

test('keeps configuration copy aligned with webhook replies', () => {
  assert.equal(
    DEV_TELEGRAM_BOT_DISPLAY_NAME,
    TELEGRAM_BOT_CONFIG_MOCKS.devDisplayName,
  )
  assert.equal(TELEGRAM_BOT_PROFILE.displayName, BOT_DISPLAY_NAME)
  assert.equal(TELEGRAM_BOT_PROFILE.shortDescription, BOT_SHORT_DESCRIPTION)
  assert.equal(TELEGRAM_BOT_PROFILE.description, BOT_DESCRIPTION)
  assert.equal(TELEGRAM_BOT_PROFILE.openAppButtonText, OPEN_APP_BUTTON_TEXT)
  assert.deepEqual(TELEGRAM_BOT_PROFILE.commands, [
    {
      command: TELEGRAM_BOT_CONFIG_MOCKS.command.start,
      description: START_COMMAND_DESCRIPTION,
    },
    {
      command: TELEGRAM_BOT_CONFIG_MOCKS.command.help,
      description: HELP_COMMAND_DESCRIPTION,
    },
  ])

  const productionProfile = JSON.parse(
    readFileSync(
      new URL(TELEGRAM_BOT_CONFIG_MOCKS.profilePath, import.meta.url),
      TELEGRAM_BOT_CONFIG_MOCKS.fileEncoding,
    ),
  ) as typeof TELEGRAM_BOT_PROFILE
  assert.deepEqual(productionProfile, TELEGRAM_BOT_PROFILE)
})

test('builds the public Edge Function webhook URL', () => {
  assert.equal(
    buildTelegramWebhookUrl(TELEGRAM_BOT_CONFIG_MOCKS.apiTunnelUrl),
    TELEGRAM_BOT_CONFIG_MOCKS.expectedWebhookUrl,
  )
  assert.throws(
    () => buildTelegramWebhookUrl(TELEGRAM_BOT_CONFIG_MOCKS.insecureUrl),
    TELEGRAM_BOT_CONFIG_MOCKS.secureUrlPattern,
  )
})

test('validates the project webhook secret contract', () => {
  assert.equal(
    validateTelegramWebhookSecret(TELEGRAM_BOT_CONFIG_MOCKS.webhookSecret),
    TELEGRAM_BOT_CONFIG_MOCKS.webhookSecret,
  )
  assert.throws(
    () =>
      validateTelegramWebhookSecret(
        TELEGRAM_BOT_CONFIG_MOCKS.invalidShortSecret,
      ),
    TELEGRAM_BOT_CONFIG_MOCKS.secretLengthPattern,
  )
  assert.throws(
    () =>
      validateTelegramWebhookSecret(
        `${TELEGRAM_BOT_CONFIG_MOCKS.webhookSecret}${TELEGRAM_BOT_CONFIG_MOCKS.invalidSecretSuffix}`,
      ),
    TELEGRAM_BOT_CONFIG_MOCKS.secretLengthPattern,
  )
})

test('builds profile, private commands, menu, and webhook operations', () => {
  const operations = buildTelegramBotConfiguration({
    frontendUrl: TELEGRAM_BOT_CONFIG_MOCKS.frontendUrl,
    webhookUrl: TELEGRAM_BOT_CONFIG_MOCKS.webhookUrl,
    webhookSecret: TELEGRAM_BOT_CONFIG_MOCKS.webhookSecret,
    dropPendingUpdates: true,
  })

  assert.deepEqual(
    operations.map(({ operation }) => operation),
    [
      TELEGRAM_BOT_CONFIG_MOCKS.operation.setMyName,
      TELEGRAM_BOT_CONFIG_MOCKS.operation.setMyShortDescription,
      TELEGRAM_BOT_CONFIG_MOCKS.operation.setMyDescription,
      TELEGRAM_BOT_CONFIG_MOCKS.operation.setMyCommands,
      TELEGRAM_BOT_CONFIG_MOCKS.operation.setChatMenuButton,
      TELEGRAM_BOT_CONFIG_MOCKS.operation.setWebhook,
    ],
  )
  assert.deepEqual(
    operations[TELEGRAM_BOT_CONFIG_MOCKS.firstOperationIndex]?.payload,
    {
      name: TELEGRAM_BOT_CONFIG_MOCKS.displayName,
    },
  )
  assert.deepEqual(
    operations[TELEGRAM_BOT_CONFIG_MOCKS.commandsOperationIndex]?.payload.scope,
    {
      type: TELEGRAM_BOT_CONFIG_MOCKS.privateChatScope,
    },
  )
  assert.deepEqual(
    operations[TELEGRAM_BOT_CONFIG_MOCKS.menuOperationIndex]?.payload
      .menu_button,
    {
      type: TELEGRAM_BOT_CONFIG_MOCKS.menuButtonType,
      text: OPEN_APP_BUTTON_TEXT,
      web_app: { url: TELEGRAM_BOT_CONFIG_MOCKS.frontendUrl },
    },
  )
  assert.deepEqual(
    operations[TELEGRAM_BOT_CONFIG_MOCKS.webhookOperationIndex]?.payload,
    {
      url: TELEGRAM_BOT_CONFIG_MOCKS.webhookUrl,
      allowed_updates: [TELEGRAM_BOT_CONFIG_MOCKS.messageUpdate],
      secret_token: TELEGRAM_BOT_CONFIG_MOCKS.webhookSecret,
      drop_pending_updates: true,
    },
  )
})

test('allows the dev stack to apply a distinct display name', () => {
  const operations = buildTelegramBotConfiguration({
    displayName: DEV_TELEGRAM_BOT_DISPLAY_NAME,
    frontendUrl: TELEGRAM_BOT_CONFIG_MOCKS.frontendUrl,
    webhookUrl: TELEGRAM_BOT_CONFIG_MOCKS.webhookUrl,
    webhookSecret: TELEGRAM_BOT_CONFIG_MOCKS.webhookSecret,
  })

  assert.deepEqual(
    operations[TELEGRAM_BOT_CONFIG_MOCKS.firstOperationIndex]?.payload,
    {
      name: TELEGRAM_BOT_CONFIG_MOCKS.devDisplayName,
    },
  )
})

test('checks getMe before applying bot mutations', async () => {
  const operations: string[] = []
  const fetchImpl: typeof fetch = async (input) => {
    const operation =
      String(input)
        .split(TELEGRAM_BOT_CONFIG_MOCKS.urlSeparator)
        .at(TELEGRAM_BOT_CONFIG_MOCKS.lastSegment) ??
      TELEGRAM_BOT_CONFIG_MOCKS.emptyText
    operations.push(operation)
    if (operation === TELEGRAM_BOT_CONFIG_MOCKS.operation.getMe) {
      return Response.json(TELEGRAM_BOT_CONFIG_RESPONSES.wrongBot)
    }
    return Response.json(TELEGRAM_BOT_CONFIG_RESPONSES.success)
  }

  await assert.rejects(
    configureTelegramBot({
      token: TELEGRAM_BOT_CONFIG_MOCKS.sensitiveToken,
      expectedBotUsername: TELEGRAM_BOT_CONFIG_MOCKS.expectedBotUsername,
      frontendUrl: TELEGRAM_BOT_CONFIG_MOCKS.frontendUrl,
      webhookUrl: TELEGRAM_BOT_CONFIG_MOCKS.webhookUrl,
      webhookSecret: TELEGRAM_BOT_CONFIG_MOCKS.webhookSecret,
      fetchImpl,
    }),
    (error: unknown) => {
      assert.ok(error instanceof TelegramBotConfigurationError)
      assert.equal(error.code, TELEGRAM_BOT_CONFIG_MOCKS.usernameMismatchCode)
      return true
    },
  )
  assert.deepEqual(operations, [TELEGRAM_BOT_CONFIG_MOCKS.operation.getMe])
})

test('configures the expected bot in a deterministic order', async () => {
  const requests: Array<{ operation: string; payload: unknown }> = []
  const fetchImpl: typeof fetch = async (input, init) => {
    const operation =
      String(input)
        .split(TELEGRAM_BOT_CONFIG_MOCKS.urlSeparator)
        .at(TELEGRAM_BOT_CONFIG_MOCKS.lastSegment) ??
      TELEGRAM_BOT_CONFIG_MOCKS.emptyText
    requests.push({
      operation,
      payload: JSON.parse(String(init?.body)) as unknown,
    })
    if (operation === TELEGRAM_BOT_CONFIG_MOCKS.operation.getMe) {
      return Response.json(TELEGRAM_BOT_CONFIG_RESPONSES.expectedBot)
    }
    if (operation === TELEGRAM_BOT_CONFIG_MOCKS.operation.getMyName) {
      return Response.json(TELEGRAM_BOT_CONFIG_RESPONSES.outdatedName)
    }
    if (
      operation === TELEGRAM_BOT_CONFIG_MOCKS.operation.getMyShortDescription
    ) {
      return Response.json(
        TELEGRAM_BOT_CONFIG_RESPONSES.outdatedShortDescription,
      )
    }
    if (operation === TELEGRAM_BOT_CONFIG_MOCKS.operation.getMyDescription) {
      return Response.json(TELEGRAM_BOT_CONFIG_RESPONSES.outdatedDescription)
    }
    if (operation === TELEGRAM_BOT_CONFIG_MOCKS.operation.getWebhookInfo) {
      return Response.json(TELEGRAM_BOT_CONFIG_RESPONSES.webhookInfo)
    }
    return Response.json(TELEGRAM_BOT_CONFIG_RESPONSES.success)
  }

  const result = await configureTelegramBot({
    token: TELEGRAM_BOT_CONFIG_MOCKS.sensitiveToken,
    expectedBotUsername: TELEGRAM_BOT_CONFIG_MOCKS.expectedBotUsername,
    displayName: DEV_TELEGRAM_BOT_DISPLAY_NAME,
    frontendUrl: TELEGRAM_BOT_CONFIG_MOCKS.frontendUrl,
    webhookUrl: TELEGRAM_BOT_CONFIG_MOCKS.webhookUrl,
    webhookSecret: TELEGRAM_BOT_CONFIG_MOCKS.webhookSecret,
    dropPendingUpdates: true,
    fetchImpl,
  })

  assert.equal(
    result.botUsername,
    TELEGRAM_BOT_CONFIG_MOCKS.expectedBotUsername,
  )
  assert.deepEqual(
    requests[TELEGRAM_BOT_CONFIG_MOCKS.configuredNameOperationIndex]?.payload,
    {
      name: TELEGRAM_BOT_CONFIG_MOCKS.devDisplayName,
    },
  )
  assert.deepEqual(
    requests.map(({ operation }) => operation),
    TELEGRAM_BOT_CONFIG_MOCKS.configuredOperations,
  )
  assert.equal(
    result.webhookInfo.pendingUpdateCount,
    TELEGRAM_BOT_CONFIG_MOCKS.initialPendingUpdates,
  )
})

test('does not write bot profile fields that already match', async () => {
  const operations: string[] = []
  const fetchImpl: typeof fetch = async (input) => {
    const operation =
      String(input)
        .split(TELEGRAM_BOT_CONFIG_MOCKS.urlSeparator)
        .at(TELEGRAM_BOT_CONFIG_MOCKS.lastSegment) ??
      TELEGRAM_BOT_CONFIG_MOCKS.emptyText
    operations.push(operation)
    return Response.json(
      TELEGRAM_BOT_CONFIG_MATCHING_PROFILE_RESPONSES[operation] ??
        TELEGRAM_BOT_CONFIG_RESPONSES.success,
    )
  }

  await configureTelegramBot({
    token: TELEGRAM_BOT_CONFIG_MOCKS.sensitiveToken,
    expectedBotUsername: TELEGRAM_BOT_CONFIG_MOCKS.expectedBotUsername,
    displayName: DEV_TELEGRAM_BOT_DISPLAY_NAME,
    frontendUrl: TELEGRAM_BOT_CONFIG_MOCKS.frontendUrl,
    webhookUrl: TELEGRAM_BOT_CONFIG_MOCKS.webhookUrl,
    webhookSecret: TELEGRAM_BOT_CONFIG_MOCKS.webhookSecret,
    fetchImpl,
  })

  assert.deepEqual(
    operations,
    TELEGRAM_BOT_CONFIG_MOCKS.matchingProfileOperations,
  )
})

test('deletes only the expected bot webhook and sanitizes status', async () => {
  const operations: string[] = []
  const fetchImpl: typeof fetch = async (input) => {
    const operation =
      String(input)
        .split(TELEGRAM_BOT_CONFIG_MOCKS.urlSeparator)
        .at(TELEGRAM_BOT_CONFIG_MOCKS.lastSegment) ??
      TELEGRAM_BOT_CONFIG_MOCKS.emptyText
    operations.push(operation)
    if (operation === TELEGRAM_BOT_CONFIG_MOCKS.operation.getMe) {
      return Response.json(TELEGRAM_BOT_CONFIG_RESPONSES.expectedBot)
    }
    if (operation === TELEGRAM_BOT_CONFIG_MOCKS.operation.getWebhookInfo) {
      return Response.json(TELEGRAM_BOT_CONFIG_RESPONSES.webhookInfoWithError)
    }
    return Response.json(TELEGRAM_BOT_CONFIG_RESPONSES.success)
  }

  const status = await deleteTelegramWebhook({
    token: TELEGRAM_BOT_CONFIG_MOCKS.sensitiveToken,
    expectedBotUsername: TELEGRAM_BOT_CONFIG_MOCKS.expectedBotUsername,
    fetchImpl,
  })
  assert.deepEqual(operations, [
    TELEGRAM_BOT_CONFIG_MOCKS.operation.getMe,
    TELEGRAM_BOT_CONFIG_MOCKS.operation.deleteWebhook,
    TELEGRAM_BOT_CONFIG_MOCKS.operation.getWebhookInfo,
  ])
  assert.deepEqual(status, {
    url: TELEGRAM_BOT_CONFIG_MOCKS.emptyText,
    pendingUpdateCount: TELEGRAM_BOT_CONFIG_MOCKS.initialPendingUpdates,
    allowedUpdates: [],
    hasLastError: true,
  })
  assert.doesNotMatch(
    JSON.stringify(status),
    TELEGRAM_BOT_CONFIG_MOCKS.rawProviderErrorPattern,
  )
})

test('sanitizes malformed webhook status', () => {
  assert.deepEqual(sanitizeWebhookInfo(null), {
    url: TELEGRAM_BOT_CONFIG_MOCKS.emptyText,
    pendingUpdateCount: TELEGRAM_BOT_CONFIG_MOCKS.initialPendingUpdates,
    allowedUpdates: [],
    hasLastError: false,
  })
})

test('reports a safe webhook rejection category without exposing the response', async () => {
  const rejectedWebhook = TELEGRAM_BOT_CONFIG_MOCKS.webhookRejection
  const api = createTelegramBotApi({
    token: TELEGRAM_BOT_CONFIG_MOCKS.sensitiveToken,
    fetchImpl: async () =>
      Response.json(TELEGRAM_BOT_CONFIG_RESPONSES.rejectedWebhook, {
        status: rejectedWebhook.status,
      }),
  })

  await assert.rejects(
    api.call(rejectedWebhook.operation),
    (error: unknown) => {
      assert.ok(error instanceof TelegramBotConfigurationError)
      assert.equal(error.providerReason, rejectedWebhook.reason)
      assert.doesNotMatch(
        JSON.stringify(error),
        rejectedWebhook.sensitivePattern,
      )
      return true
    },
  )
})
