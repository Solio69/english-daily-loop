/// <reference path="../deno-globals.d.ts" />

import { getMoscowStudyDate } from './moscow-study-date.ts'
import {
  getReadingParagraphCount,
  splitReadingParagraphs,
} from './reading-text.ts'
import {
  assertPostRequest,
  handleCorsPreflight,
  parseJsonBody,
  successResponse,
} from './server.ts'
import {
  assertEquals,
  assertRejectsAppError,
  TEST_HTTP,
} from './test-support.ts'

import {
  HTTP_CASE,
  READING_PARAGRAPH_CASE,
  STUDY_DAY_CASES,
} from './test-mocks.ts'

Deno.test('Moscow study day changes at 05:00', () => {
  for (const { instant, expectedDate } of STUDY_DAY_CASES) {
    assertEquals({
      actual: getMoscowStudyDate(new Date(instant)),
      expected: expectedDate,
    })
  }
})

Deno.test('reading paragraphs normalize CRLF and inner line breaks', () => {
  assertEquals({
    actual: splitReadingParagraphs(READING_PARAGRAPH_CASE.text),
    expected: READING_PARAGRAPH_CASE.expectedParagraphs,
  })
  assertEquals({
    actual: getReadingParagraphCount(READING_PARAGRAPH_CASE.text),
    expected: READING_PARAGRAPH_CASE.expectedCount,
  })
})

Deno.test(
  'shared HTTP helpers preserve success and method-error contracts',
  async () => {
    const options = handleCorsPreflight(
      new Request(TEST_HTTP.url, { method: TEST_HTTP.method.options }),
    )
    assertEquals({
      actual: options?.headers.get(TEST_HTTP.header.allowMethods),
      expected: TEST_HTTP.allowedMethods,
    })

    const response = successResponse(
      TEST_HTTP.status.ok,
      HTTP_CASE.success.data,
      HTTP_CASE.success.requestId,
    )
    const payload = await response.json()
    assertEquals({ actual: response.status, expected: TEST_HTTP.status.ok })
    assertEquals({
      actual: payload,
      expected: {
        ok: true,
        data: HTTP_CASE.success.data,
        requestId: HTTP_CASE.success.requestId,
      },
    })

    await assertRejectsAppError({
      action: () =>
        assertPostRequest(
          new Request(TEST_HTTP.url, { method: TEST_HTTP.method.get }),
        ),
      expectedStatus: TEST_HTTP.status.methodNotAllowed,
      expectedCode: TEST_HTTP.errorCode.methodNotAllowed,
    })
  },
)

Deno.test('invalid JSON is rejected before handler logic', async () => {
  await assertRejectsAppError({
    action: () =>
      parseJsonBody(
        new Request(TEST_HTTP.url, {
          method: TEST_HTTP.method.post,
          body: HTTP_CASE.invalidJson.body,
          headers: {
            [TEST_HTTP.header.contentType]: TEST_HTTP.contentType.json,
          },
        }),
      ),
    expectedStatus: TEST_HTTP.status.badRequest,
    expectedCode: TEST_HTTP.errorCode.invalidJson,
  })
})
