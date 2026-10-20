import assert from 'node:assert/strict'
import { AppError } from '../_shared/server.ts'
import {
  ACTIVE_ROW,
  CLAIM_RESULT,
  REPOSITORY_CASE,
  createRepositoryHarness,
} from './test-mocks.ts'

const DUPLICATE_INPUT = {
  userId: REPOSITORY_CASE.userId,
  attemptId: REPOSITORY_CASE.attemptId,
  dailyLimit: REPOSITORY_CASE.dailyLimit,
  usedAttempts: REPOSITORY_CASE.usedAttempts,
  remainingAttempts: REPOSITORY_CASE.remainingAttempts,
}

Deno.test('claim reads the existing atomic RPC result', async () => {
  const { repository, calls } = createRepositoryHarness()
  const result = await repository.claim({
    userId: REPOSITORY_CASE.userId,
    studyDate: REPOSITORY_CASE.date,
    dailyLimit: REPOSITORY_CASE.dailyLimit,
    requestId: REPOSITORY_CASE.requestId,
  })
  assert.deepEqual(result, {
    isDuplicate: CLAIM_RESULT.isDuplicate,
    attemptId: CLAIM_RESULT.attemptId,
    usedAttempts: CLAIM_RESULT.usedAttempts,
    remainingAttempts: CLAIM_RESULT.remainingAttempts,
  })
  assert.deepEqual(calls.rpc, [REPOSITORY_CASE.claimRpc])
})

Deno.test(
  'claim rejects malformed database output at its boundary',
  async () => {
    const { repository } = createRepositoryHarness({ claimResult: null })
    await assert.rejects(
      repository.claim({
        userId: REPOSITORY_CASE.userId,
        studyDate: REPOSITORY_CASE.date,
        dailyLimit: REPOSITORY_CASE.dailyLimit,
        requestId: REPOSITORY_CASE.requestId,
      }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === REPOSITORY_CASE.invalidClaimCode,
    )
  },
)

Deno.test(
  'duplicate success returns only the matching active reading',
  async () => {
    const { repository, calls } = createRepositoryHarness()
    const result = await repository.waitForDuplicate(DUPLICATE_INPUT)
    assert.deepEqual(result.text, {
      id: ACTIVE_ROW.reading_text_id,
      title: ACTIVE_ROW.title,
      body: ACTIVE_ROW.body,
      level: ACTIVE_ROW.level,
      estimatedMinutes: ACTIVE_ROW.estimated_minutes,
      lastReadParagraphIndex: ACTIVE_ROW.last_read_paragraph_index,
    })
    assert.deepEqual(calls.tables, [
      REPOSITORY_CASE.attemptsTable,
      REPOSITORY_CASE.activeTable,
    ])
  },
)

Deno.test(
  'duplicate failed attempt retains the public AI failure',
  async () => {
    const { repository } = createRepositoryHarness({
      attemptStatus: REPOSITORY_CASE.statusFailed,
    })
    await assert.rejects(
      repository.waitForDuplicate(DUPLICATE_INPUT),
      (error: unknown) =>
        error instanceof AppError && error.code === REPOSITORY_CASE.failedCode,
    )
  },
)

Deno.test('superseded duplicate result is not returned as active', async () => {
  const { repository } = createRepositoryHarness({ activeRow: null })
  await assert.rejects(
    repository.waitForDuplicate(DUPLICATE_INPUT),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === REPOSITORY_CASE.supersededCode,
  )
})

Deno.test(
  'unfinished duplicate times out within the configured budget',
  async () => {
    const { repository } = createRepositoryHarness({
      attemptStatus: REPOSITORY_CASE.statusStarted,
      clock: REPOSITORY_CASE.timeoutAt,
    })
    await assert.rejects(
      repository.waitForDuplicate(DUPLICATE_INPUT),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === REPOSITORY_CASE.processingCode,
    )
  },
)
