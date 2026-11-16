import assert from 'node:assert/strict'
import test from 'node:test'
import { AppError } from '../supabase/functions/_shared/server.ts'
import {
  GenerationRunFailure,
  runReadingGeneration,
} from '../supabase/functions/generate-reading-text/generation-service.ts'
import {
  createGenerationHarness,
  DUPLICATE_PAYLOAD,
  GENERATION_CASE,
} from './mocks/readingGeneration.ts'

const runCase = (ports: ReturnType<typeof createGenerationHarness>['ports']) =>
  runReadingGeneration({
    telegramUserId: GENERATION_CASE.telegramUserId,
    requestId: GENERATION_CASE.requestId,
    models: [...GENERATION_CASE.models],
    apiKey: GENERATION_CASE.apiKey,
    requestStartedAt: GENERATION_CASE.startedAt,
    ports,
  })

test('generation claims once and finishes a validated active text', async () => {
  const { ports, calls } = createGenerationHarness()
  const previousLog = console.log
  console.log = () => undefined
  try {
    const result = await runCase(ports)
    assert.deepEqual(result, DUPLICATE_PAYLOAD)
    assert.deepEqual(calls.claims, [
      {
        requestId: GENERATION_CASE.requestId,
        studyDate: GENERATION_CASE.studyDate,
      },
    ])
    assert.equal(calls.ai, 1)
    assert.equal(calls.finished.length, 1)
    assert.equal(calls.finished[0].readingTextId, GENERATION_CASE.readingTextId)
    assert.equal(calls.finished[0].outputWordCount, GENERATION_CASE.wordCount)
    assert.equal(
      calls.finished[0].durationMs,
      GENERATION_CASE.finishedAt - GENERATION_CASE.startedAt,
    )
    assert.equal(calls.failed.length, 0)
  } finally {
    console.log = previousLog
  }
})

test('duplicate request returns existing result without another AI call', async () => {
  const { ports, calls } = createGenerationHarness({ duplicate: true })
  const result = await runCase(ports)
  assert.deepEqual(result, DUPLICATE_PAYLOAD)
  assert.equal(calls.duplicate, 1)
  assert.equal(calls.ai, 0)
  assert.equal(calls.metadata.length, 0)
  assert.equal(calls.finished.length, 0)
  assert.equal(calls.failed.length, 0)
})

test('exhausted daily limit stops before AI and does not mark a new attempt', async () => {
  const { ports, calls } = createGenerationHarness({ exhausted: true })
  await assert.rejects(
    runCase(ports),
    (error: unknown) =>
      error instanceof GenerationRunFailure &&
      error.reason instanceof AppError &&
      error.reason.code === GENERATION_CASE.limitCode,
  )
  assert.equal(calls.ai, 0)
  assert.equal(calls.failed.length, 0)
})

test('AI failure marks only the claimed attempt failed', async () => {
  const { ports, calls } = createGenerationHarness({ aiFails: true })
  const previousLog = console.log
  console.log = () => undefined
  try {
    await assert.rejects(
      runCase(ports),
      (error: unknown) =>
        error instanceof GenerationRunFailure &&
        error.reason instanceof Error &&
        error.reason.message === GENERATION_CASE.failureMessage,
    )
  } finally {
    console.log = previousLog
  }
  assert.equal(calls.ai, 1)
  assert.equal(calls.finished.length, 0)
  assert.equal(calls.failed.length, 1)
  assert.equal(calls.failed[0].attemptId, GENERATION_CASE.attemptId)
  assert.equal(calls.failed[0].requestId, GENERATION_CASE.requestId)
})

test('finish failure marks the attempt failed with the DB stage', async () => {
  const { ports, calls } = createGenerationHarness({ finishFails: true })
  const previousLog = console.log
  console.log = () => undefined
  try {
    await assert.rejects(
      runCase(ports),
      (error: unknown) =>
        error instanceof GenerationRunFailure &&
        error.reason instanceof AppError &&
        error.reason.code === GENERATION_CASE.finishFailureCode,
    )
  } finally {
    console.log = previousLog
  }
  assert.equal(calls.finished.length, 1)
  assert.equal(calls.failed.length, 1)
  assert.equal(calls.failed[0].failureStage, 'db_save')
})
