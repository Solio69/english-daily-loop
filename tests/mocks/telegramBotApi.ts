import { HTTP_STATUS } from '../fixtures/http.ts'
import { TELEGRAM_TEST } from '../fixtures/telegram.ts'

export const TELEGRAM_BOT_API_MOCKS = {
  token: 'fake-token',
  sensitiveToken: 'sensitive-token',
  expectedRequestUrl:
    'https://api.telegram.org/botfake-token/getChatMenuButton',
  expectedRequestBody: {},
  menuButton: {
    type: 'web_app',
    text: 'Открыть приложение',
    web_app: { url: 'https://example.com' },
  },
  providerFailure: {
    ok: false,
    error_code: HTTP_STATUS.badRequest,
    description: 'provider response containing sensitive-token',
  },
  rejectionCode: 'TELEGRAM_API_REJECTED',
  timeoutCode: TELEGRAM_TEST.timeoutCode,
  sensitiveDetailsPattern: /sensitive-token|provider response/,
  timeoutMs: 5,
  abortEvent: 'abort',
  abortMessage: 'aborted',
  abortErrorName: 'AbortError',
} as const

export const TELEGRAM_BOT_API_RESPONSES = {
  menuButton: () =>
    Response.json({ ok: true, result: TELEGRAM_BOT_API_MOCKS.menuButton }),
  rejected: () =>
    Response.json(TELEGRAM_BOT_API_MOCKS.providerFailure, {
      status: HTTP_STATUS.badRequest,
    }),
}
