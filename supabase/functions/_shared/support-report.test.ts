/// <reference path="../deno-globals.d.ts" />

import type { ServiceClient } from './app.ts'
import { assertEquals, assertRejectsAppError } from './test-support.ts'
import { prepareSupportReport } from '../submit-support-report/sanitize-diagnostics.ts'
import { submitSupportReportFlow } from '../submit-support-report/support-report-flow.ts'
import { createSupportReportRepository } from '../submit-support-report/support-report-repository.ts'

const TELEGRAM_USER_ID = 987654321
const USER = { id: 'mock-internal-user', app_role: 'tester' as const }
const SAVED = {
  reportId: 'mock-report-id',
  createdAt: '2026-10-20T12:00:00.000Z',
}
const REQUEST_ID = 'req_support-test'
const COMMENT = 'Не открывается текст'

Deno.test(
  'support flow prepares a bounded report before one save',
  async () => {
    const calls: string[] = []
    const result = await submitSupportReportFlow({
      body: {
        comment: COMMENT,
        currentScreen: 'reading',
        events: [
          {
            event: 'edge_request_failed',
            details: {
              functionName: 'get-reading-state',
              secret: 'synthetic secret',
            },
          },
        ],
      },
      telegramUserId: TELEGRAM_USER_ID,
      dependencies: {
        getAppUser: (id) => {
          assertEquals({ actual: id, expected: TELEGRAM_USER_ID })
          calls.push('lookup')
          return Promise.resolve(USER)
        },
        saveReport: (user, report) => {
          calls.push('save')
          assertEquals({ actual: user, expected: USER })
          assertEquals({ actual: report.userComment, expected: COMMENT })
          assertEquals({ actual: report.events.length, expected: 1 })
          return Promise.resolve(SAVED)
        },
      },
    })
    assertEquals({ actual: result, expected: SAVED })
    assertEquals({ actual: calls, expected: ['lookup', 'save'] })
  },
)

Deno.test('support repository hides raw database failures', async () => {
  const rawError = 'private database detail token=syntheticSecret'
  const captured: unknown[][] = []
  const previousConsoleError = console.error
  console.error = (...args: unknown[]) => {
    captured.push(args)
  }
  try {
    const client = {
      rpc: () =>
        Promise.resolve({
          data: null,
          error: { code: 'XX000', message: rawError },
        }),
    } as unknown as ServiceClient
    const repository = createSupportReportRepository({
      supabase: client,
      requestId: REQUEST_ID,
    })
    const report = prepareSupportReport({
      currentScreen: 'settings',
      userComment: COMMENT,
      appContext: {},
      events: [],
      requestIds: [],
      aiDiagnostics: [],
      telegramUserId: TELEGRAM_USER_ID,
    })
    await assertRejectsAppError({
      action: () => repository.saveReport(USER, report),
      expectedStatus: 500,
      expectedCode: 'SUPPORT_REPORT_SAVE_FAILED',
    })
  } finally {
    console.error = previousConsoleError
  }
  assertEquals({
    actual: JSON.stringify(captured).includes(rawError),
    expected: false,
  })
})

Deno.test(
  'support flow rejects an empty comment before lookup or save',
  async () => {
    let called = false
    await assertRejectsAppError({
      action: () =>
        submitSupportReportFlow({
          body: { comment: '  ' },
          telegramUserId: TELEGRAM_USER_ID,
          dependencies: {
            getAppUser: () => {
              called = true
              return Promise.resolve(USER)
            },
            saveReport: () => {
              called = true
              return Promise.resolve(SAVED)
            },
          },
        }),
      expectedStatus: 400,
      expectedCode: 'SUPPORT_COMMENT_REQUIRED',
    })
    assertEquals({ actual: called, expected: false })
  },
)

Deno.test(
  'support repository maps the atomic DB limit to HTTP 429',
  async () => {
    const client = {
      rpc: () =>
        Promise.resolve({
          data: null,
          error: { code: 'P0001', message: 'SUPPORT_REPORT_RATE_LIMITED' },
        }),
    } as unknown as ServiceClient
    const repository = createSupportReportRepository({
      supabase: client,
      requestId: REQUEST_ID,
    })
    const report = prepareSupportReport({
      currentScreen: 'settings',
      userComment: COMMENT,
      appContext: {},
      events: [],
      requestIds: [],
      aiDiagnostics: [],
      telegramUserId: TELEGRAM_USER_ID,
    })
    await assertRejectsAppError({
      action: () => repository.saveReport(USER, report),
      expectedStatus: 429,
      expectedCode: 'SUPPORT_REPORT_RATE_LIMITED',
    })
  },
)

Deno.test(
  'support repository sends only internal identity and prepared fields',
  async () => {
    let rpcName: string | undefined
    let rpcArgs: Record<string, unknown> | undefined
    const client = {
      rpc: (name: string, args: Record<string, unknown>) => {
        rpcName = name
        rpcArgs = args
        return Promise.resolve({ data: SAVED, error: null })
      },
    } as unknown as ServiceClient
    const repository = createSupportReportRepository({
      supabase: client,
      requestId: REQUEST_ID,
    })
    const report = prepareSupportReport({
      currentScreen: 'settings',
      userComment: COMMENT,
      appContext: {},
      events: [],
      requestIds: [],
      aiDiagnostics: [],
      telegramUserId: TELEGRAM_USER_ID,
    })
    const result = await repository.saveReport(USER, report)
    assertEquals({ actual: rpcName, expected: 'submit_support_report' })
    assertEquals({ actual: rpcArgs?.p_user_id, expected: USER.id })
    assertEquals({
      actual: Object.hasOwn(rpcArgs ?? {}, 'p_telegram_user_id'),
      expected: false,
    })
    assertEquals({ actual: result, expected: SAVED })
  },
)
