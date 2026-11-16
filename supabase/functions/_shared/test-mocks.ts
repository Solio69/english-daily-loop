export const STUDY_DAY_CASES = [
  {
    instant: '2026-03-01T01:59:59Z',
    expectedDate: '2026-02-28',
  },
  {
    instant: '2026-03-01T02:00:00Z',
    expectedDate: '2026-03-01',
  },
] as const

export const READING_PARAGRAPH_CASE = {
  text: 'First\r\nline\r\n\r\nSecond paragraph',
  expectedParagraphs: ['First line', 'Second paragraph'],
  expectedCount: 2,
} as const

export const HTTP_CASE = {
  success: {
    data: { value: 'ready' },
    requestId: 'req_fixture',
  },
  invalidJson: {
    body: '{broken',
  },
} as const

export const SERVER_CASES = {
  objectBody: {
    raw: '{"initData":7,"limit":"3"}',
    expected: { initData: 7, limit: '3' },
  },
  invalidRoots: ['null', '[]', '3', '"value"', 'true'],
  invalidJson: '{',
  telegram: {
    token: 'fake-test-token',
    userId: 123456,
    millisecondsPerSecond: 1000,
    invalidHash: '0'.repeat(64),
  },
  hiddenErrorField: 'diagnostics',
} as const
