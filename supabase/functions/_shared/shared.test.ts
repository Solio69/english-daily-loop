import { getMoscowStudyDate } from './moscow-study-date.ts'
import { getReadingParagraphCount, splitReadingParagraphs } from './reading-text.ts'
import {
  AppError,
  assertPostRequest,
  handleCorsPreflight,
  parseJsonBody,
  successResponse,
} from './server.ts'

const assert = ({ condition, message }: { condition: boolean; message: string }) => {
  if (!condition) throw new Error(message)
}

Deno.test('Moscow study day changes at 05:00', () => {
  assert({
    condition: getMoscowStudyDate(new Date('2026-03-01T01:59:59Z')) === '2026-02-28',
    message: '04:59 Moscow must belong to the previous study day',
  })
  assert({
    condition: getMoscowStudyDate(new Date('2026-03-01T02:00:00Z')) === '2026-03-01',
    message: '05:00 Moscow must start the new study day',
  })
})

Deno.test('reading paragraphs normalize CRLF and inner line breaks', () => {
  const text = 'First\r\nline\r\n\r\nSecond paragraph'
  assert({
    condition: JSON.stringify(splitReadingParagraphs(text)) === JSON.stringify([
      'First line',
      'Second paragraph',
    ]),
    message: 'paragraphs must retain words and separate empty lines',
  })
  assert({
    condition: getReadingParagraphCount(text) === 2,
    message: 'paragraph count must match the visible text',
  })
})

Deno.test('shared HTTP helpers preserve success and method-error contracts', async () => {
  const options = handleCorsPreflight(new Request('http://localhost/', { method: 'OPTIONS' }))
  assert({
    condition: options?.headers.get('Access-Control-Allow-Methods') === 'POST, OPTIONS',
    message: 'preflight must permit POST and OPTIONS',
  })

  const response = successResponse(200, { value: 'ready' }, 'req_fixture')
  const payload = await response.json()
  assert({
    condition: response.status === 200 && payload.ok === true && payload.data.value === 'ready',
    message: 'success response must keep the public envelope',
  })

  let error: unknown
  try {
    assertPostRequest(new Request('http://localhost/', { method: 'GET' }))
  } catch (caught) {
    error = caught
  }
  assert({
    condition: error instanceof AppError && error.status === 405 && error.code === 'METHOD_NOT_ALLOWED',
    message: 'non-POST request must fail with 405',
  })
})

Deno.test('invalid JSON is rejected before handler logic', async () => {
  let error: unknown
  try {
    await parseJsonBody(
      new Request('http://localhost/', {
        method: 'POST',
        body: '{broken',
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  } catch (caught) {
    error = caught
  }
  assert({
    condition: error instanceof AppError && error.status === 400 && error.code === 'INVALID_JSON',
    message: 'malformed JSON must yield 400 INVALID_JSON',
  })
})
