import { AppError } from './server.ts'
import {
  HTTP_ALLOWED_METHODS,
  HTTP_CONTENT_TYPE,
  HTTP_HEADER,
  HTTP_METHOD,
  HTTP_STATUS,
} from '../../../tests/fixtures/http.ts'

// Ожидаемый публичный контракт тестов не импортируется из реализации server.ts.
export const TEST_HTTP = {
  url: 'http://localhost/',
  method: HTTP_METHOD,
  header: HTTP_HEADER,
  contentType: HTTP_CONTENT_TYPE,
  allowedMethods: HTTP_ALLOWED_METHODS,
  status: HTTP_STATUS,
  errorCode: {
    invalidBody: 'INVALID_BODY',
    invalidJson: 'INVALID_JSON',
    initDataRequired: 'INIT_DATA_REQUIRED',
    authValidationFailed: 'AUTH_VALIDATION_FAILED',
    methodNotAllowed: 'METHOD_NOT_ALLOWED',
  },
  errorMessage: {
    invalidBody: 'Request body must be a JSON object.',
  },
} as const

const ASSERTION_MESSAGE = {
  unequal: ({ expected, actual }: { expected: unknown; actual: unknown }) =>
    `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
  wrongErrorType: (caught: unknown) =>
    `Expected AppError, received ${String(caught)}`,
} as const

export const assertEquals = ({
  actual,
  expected,
}: {
  actual: unknown
  expected: unknown
}) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(ASSERTION_MESSAGE.unequal({ expected, actual }))
  }
}

export const assertRejectsAppError = async ({
  action,
  expectedStatus,
  expectedCode,
}: {
  action: () => unknown | Promise<unknown>
  expectedStatus: number
  expectedCode: string
}) => {
  let caught: unknown
  try {
    await action()
  } catch (error) {
    caught = error
  }

  if (!(caught instanceof AppError)) {
    throw new Error(ASSERTION_MESSAGE.wrongErrorType(caught))
  }

  assertEquals({ actual: caught.status, expected: expectedStatus })
  assertEquals({ actual: caught.code, expected: expectedCode })
}
