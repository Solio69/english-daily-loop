import {
  AppError,
  errorResponse,
  getTelegramUserFromBody,
  parseJsonObjectBody,
} from './server.ts'

const request = (body: string) =>
  new Request('http://localhost/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })

const assertError = async (
  action: () => Promise<unknown>,
  status: number,
  code: string,
) => {
  let caught: unknown
  try {
    await action()
  } catch (error) {
    caught = error
  }
  if (
    !(caught instanceof AppError) ||
    caught.status !== status ||
    caught.code !== code
  ) {
    throw new Error(`Expected ${status} ${code}, received ${String(caught)}`)
  }
}

Deno.test('JSON object boundary keeps fields as untrusted values', async () => {
  const body = await parseJsonObjectBody(request('{"initData":7,"limit":"3"}'))
  if (body.initData !== 7 || body.limit !== '3') {
    throw new Error('Parsed object fields changed unexpectedly')
  }
})

Deno.test('JSON object boundary rejects invalid roots and malformed JSON', async () => {
  for (const raw of ['null', '[]', '3', '"value"', 'true']) {
    await assertError(() => parseJsonObjectBody(request(raw)), 400, 'INVALID_BODY')
  }
  await assertError(() => parseJsonObjectBody(request('{')), 400, 'INVALID_JSON')
})

Deno.test('missing Telegram initData is rejected before signature or DB work', async () => {
  await assertError(
    () => getTelegramUserFromBody({}, 'fake-test-token'),
    400,
    'INIT_DATA_REQUIRED',
  )
})

Deno.test('invalid Telegram signature is rejected by the server', async () => {
  const initData = new URLSearchParams({
    user: JSON.stringify({ id: 123456 }),
    auth_date: String(Math.floor(Date.now() / 1000)),
    hash: '0'.repeat(64),
  }).toString()
  await assertError(
    () => getTelegramUserFromBody({ initData }, 'fake-test-token'),
    401,
    'AUTH_VALIDATION_FAILED',
  )
})

Deno.test('error envelope does not add internal details', async () => {
  const response = errorResponse(400, 'INVALID_BODY', 'Request body must be a JSON object.')
  const payload = await response.json()
  if (
    response.status !== 400 ||
    payload.ok !== false ||
    payload.error.code !== 'INVALID_BODY' ||
    'diagnostics' in payload.error
  ) {
    throw new Error('Public error response contract changed')
  }
})
