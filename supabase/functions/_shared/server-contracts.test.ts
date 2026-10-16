/// <reference path="../deno-globals.d.ts" />

import {
  errorResponse,
  getTelegramUserFromBody,
  parseJsonObjectBody,
} from './server.ts'
import {
  assertEquals,
  assertRejectsAppError,
  TEST_HTTP,
} from './test-support.ts'

import { SERVER_CASES } from './test-mocks.ts'

const request = (body: string) =>
  new Request(TEST_HTTP.url, {
    method: TEST_HTTP.method.post,
    headers: { [TEST_HTTP.header.contentType]: TEST_HTTP.contentType.json },
    body,
  })

Deno.test('JSON object boundary keeps fields as untrusted values', async () => {
  const body = await parseJsonObjectBody(request(SERVER_CASES.objectBody.raw))
  assertEquals({ actual: body, expected: SERVER_CASES.objectBody.expected })
})

Deno.test(
  'JSON object boundary rejects invalid roots and malformed JSON',
  async () => {
    for (const raw of SERVER_CASES.invalidRoots) {
      await assertRejectsAppError({
        action: () => parseJsonObjectBody(request(raw)),
        expectedStatus: TEST_HTTP.status.badRequest,
        expectedCode: TEST_HTTP.errorCode.invalidBody,
      })
    }
    await assertRejectsAppError({
      action: () => parseJsonObjectBody(request(SERVER_CASES.invalidJson)),
      expectedStatus: TEST_HTTP.status.badRequest,
      expectedCode: TEST_HTTP.errorCode.invalidJson,
    })
  },
)

Deno.test(
  'missing Telegram initData is rejected before signature or DB work',
  async () => {
    await assertRejectsAppError({
      action: () => getTelegramUserFromBody({}, SERVER_CASES.telegram.token),
      expectedStatus: TEST_HTTP.status.badRequest,
      expectedCode: TEST_HTTP.errorCode.initDataRequired,
    })
  },
)

Deno.test('invalid Telegram signature is rejected by the server', async () => {
  const initData = new URLSearchParams({
    user: JSON.stringify({ id: SERVER_CASES.telegram.userId }),
    auth_date: String(
      Math.floor(Date.now() / SERVER_CASES.telegram.millisecondsPerSecond),
    ),
    hash: SERVER_CASES.telegram.invalidHash,
  }).toString()
  await assertRejectsAppError({
    action: () =>
      getTelegramUserFromBody({ initData }, SERVER_CASES.telegram.token),
    expectedStatus: TEST_HTTP.status.unauthorized,
    expectedCode: TEST_HTTP.errorCode.authValidationFailed,
  })
})

Deno.test('error envelope does not add internal details', async () => {
  const response = errorResponse(
    TEST_HTTP.status.badRequest,
    TEST_HTTP.errorCode.invalidBody,
    TEST_HTTP.errorMessage.invalidBody,
  )
  const payload = await response.json()
  assertEquals({
    actual: response.status,
    expected: TEST_HTTP.status.badRequest,
  })
  assertEquals({ actual: payload.ok, expected: false })
  assertEquals({
    actual: payload.error.code,
    expected: TEST_HTTP.errorCode.invalidBody,
  })
  assertEquals({
    actual: SERVER_CASES.hiddenErrorField in payload.error,
    expected: false,
  })
})
