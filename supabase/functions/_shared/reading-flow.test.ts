import assert from 'node:assert/strict'
import { AppError } from './server.ts'
import { loadReadingState } from '../get-reading-state/reading-state-service.ts'
import { saveReadingPosition } from '../save-reading-position/position-service.ts'
import { completeReadingText } from '../complete-reading-text/completion-service.ts'
import {
  clampPageLimit,
  parseCursor,
} from '../get-reading-history/history-contract.ts'
import { loadReadingHistory } from '../get-reading-history/history-service.ts'
import {
  ACTIVE_READING_ROW,
  READING_FLOW_CASE,
  createCompletionHarness,
  createHistoryHarness,
  createPositionHarness,
  createSavedWordRepositoryHarness,
  createStateHarness,
} from './reading-flow-test-mocks.ts'

const positionInput = ({
  repository,
  readingTextId = READING_FLOW_CASE.readingTextId,
  paragraphIndex = READING_FLOW_CASE.paragraphIndex,
}: {
  repository: ReturnType<typeof createPositionHarness>['repository']
  readingTextId?: string
  paragraphIndex?: number | null
}) => ({
  userId: READING_FLOW_CASE.userId,
  readingTextId,
  paragraphIndex,
  requestId: READING_FLOW_CASE.requestId,
  startedAt: READING_FLOW_CASE.startedAt,
  repository,
  now: () => READING_FLOW_CASE.finishedAt,
})

Deno.test(
  'reading state keeps prior-day active text and current-day counters',
  async () => {
    const { repository, calls } = createStateHarness()
    const state = await loadReadingState({
      userId: READING_FLOW_CASE.userId,
      repository,
      studyDate: () => READING_FLOW_CASE.today,
    })
    assert.equal(state.today, READING_FLOW_CASE.today)
    assert.equal(state.remainingAttempts, READING_FLOW_CASE.remaining)
    assert.equal(state.activeText?.id, ACTIVE_READING_ROW.reading_text_id)
    assert.equal(
      state.activeText?.lastReadParagraphIndex,
      ACTIVE_READING_ROW.last_read_paragraph_index,
    )
    assert.deepEqual(state.activeText?.savedWordIndexes, [
      READING_FLOW_CASE.paragraphIndex,
    ])
    assert.deepEqual(state.activeText?.pendingSavedWordIndexes, [
      READING_FLOW_CASE.paragraphIndex,
    ])
    assert.deepEqual(calls.dates, [READING_FLOW_CASE.today])
    assert.deepEqual(calls.wordReads, [READING_FLOW_CASE.readingTextId])
  },
)

Deno.test(
  'null reading position remains a valid top-of-text save',
  async () => {
    const { repository, calls } = createPositionHarness()
    const previousLog = console.log
    console.log = () => undefined
    try {
      const result = await saveReadingPosition(
        positionInput({ repository, paragraphIndex: null }),
      )
      assert.equal(result.paragraphIndex, null)
      assert.deepEqual(calls.saves, [null])
    } finally {
      console.log = previousLog
    }
  },
)

Deno.test(
  'saved word lookup deduplicates indexes and identifies pending words',
  async () => {
    const { repository, calls } = createSavedWordRepositoryHarness()
    const indexes = await repository.loadSavedWordIndexes({
      userId: READING_FLOW_CASE.userId,
      readingTextId: READING_FLOW_CASE.readingTextId,
    })
    assert.deepEqual(indexes.saved, [
      READING_FLOW_CASE.zero,
      READING_FLOW_CASE.one,
    ])
    assert.deepEqual(indexes.pending, [READING_FLOW_CASE.one])
    assert.deepEqual(calls.tables, [
      READING_FLOW_CASE.sourcesTable,
      READING_FLOW_CASE.wordsTable,
    ])
  },
)

Deno.test('stale reading text cannot update the current position', async () => {
  const { repository, calls } = createPositionHarness()
  await assert.rejects(
    saveReadingPosition(
      positionInput({
        repository,
        readingTextId: READING_FLOW_CASE.staleTextId,
      }),
    ),
    (error: unknown) =>
      error instanceof AppError && error.code === READING_FLOW_CASE.changedCode,
  )
  assert.deepEqual(calls.saves, [])
})

Deno.test(
  'paragraph outside the active text is rejected before a write',
  async () => {
    const { repository, calls } = createPositionHarness()
    await assert.rejects(
      saveReadingPosition(
        positionInput({
          repository,
          paragraphIndex: READING_FLOW_CASE.invalidParagraphIndex,
        }),
      ),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === READING_FLOW_CASE.invalidIndexCode,
    )
    assert.deepEqual(calls.saves, [])
  },
)

Deno.test(
  'concurrent text replacement after validation is rejected',
  async () => {
    const { repository } = createPositionHarness({ updated: false })
    await assert.rejects(
      saveReadingPosition(positionInput({ repository })),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === READING_FLOW_CASE.changedCode,
    )
  },
)

Deno.test(
  'completion metrics use the date returned by the database transaction',
  async () => {
    const { repository, calls } = createCompletionHarness()
    const result = await completeReadingText({
      userId: READING_FLOW_CASE.userId,
      repository,
      studyDate: () => READING_FLOW_CASE.priorDate,
    })
    assert.deepEqual(calls.requestedDates, [READING_FLOW_CASE.priorDate])
    assert.deepEqual(calls.metricDates, [READING_FLOW_CASE.today])
    assert.equal(result.completedDate, READING_FLOW_CASE.today)
    assert.equal(
      result.completedReadingTextCount,
      READING_FLOW_CASE.completedReadingTextCount,
    )
  },
)

Deno.test('history returns stable cursor and only visible rows', async () => {
  const { repository, calls } = createHistoryHarness()
  const result = await loadReadingHistory({
    userId: READING_FLOW_CASE.userId,
    limit: READING_FLOW_CASE.one,
    cursor: null,
    repository,
  })
  assert.equal(result.items.length, READING_FLOW_CASE.one)
  assert.equal(result.nextCursor, READING_FLOW_CASE.cursor)
  assert.deepEqual(calls.userIds, [READING_FLOW_CASE.userId])
})

Deno.test(
  'history cursor validation and limit clamping preserve the API',
  () => {
    assert.deepEqual(parseCursor(READING_FLOW_CASE.cursor), {
      completedAt: READING_FLOW_CASE.firstCompletedAt,
      id: READING_FLOW_CASE.historyIdFirst,
    })
    assert.equal(clampPageLimit(READING_FLOW_CASE.zero), READING_FLOW_CASE.one)
    assert.throws(
      () => parseCursor(READING_FLOW_CASE.invalidParagraphIndex),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === READING_FLOW_CASE.invalidCursorCode,
    )
  },
)
