import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import {
  parseReadingText,
  splitReadingParagraphs as splitFrontendParagraphs,
} from '../src/utils/readingText'
import {
  getReachedReadingParagraphIndex,
  getReadingPositionRestoreKey,
} from '../src/utils/readingPosition'
import { ReadingPositionSync } from '../src/utils/readingPositionSync'
import {
  getReadingParagraphCount,
  splitReadingParagraphs as splitServerParagraphs,
} from '../supabase/functions/_shared/reading-text'

const noDelay = async (): Promise<void> => {}

const createManualTimer = () => {
  let scheduledCallback: (() => void) | null = null

  return {
    setTimer: (callback: () => void) => {
      scheduledCallback = callback
      return 1 as unknown as ReturnType<typeof setTimeout>
    },
    clearTimer: () => {
      scheduledCallback = null
    },
    run: () => {
      const callback = scheduledCallback
      scheduledCallback = null
      callback?.()
    },
  }
}

test('frontend and server split LF and CRLF paragraphs identically', () => {
  const cases = [
    {
      body: ' First line\ncontinues here. \n\nSecond paragraph.\n\n\nThird\n paragraph.',
      expected: [
        'First line continues here.',
        'Second paragraph.',
        'Third paragraph.',
      ],
    },
    {
      body: 'First line\r\ncontinues here.\r\n\r\nSecond paragraph.\r\n \t\r\nThird paragraph.',
      expected: [
        'First line continues here.',
        'Second paragraph.',
        'Third paragraph.',
      ],
    },
  ]

  for (const { body, expected } of cases) {
    assert.deepEqual(splitFrontendParagraphs(body), expected)
    assert.deepEqual(splitServerParagraphs(body), expected)
    assert.equal(getReadingParagraphCount(body), expected.length)
  }
})

test('paragraph parsing keeps one continuous word index', () => {
  const paragraphs = parseReadingText('First second.\r\n\r\nThird\r\nfourth.')
  const wordIndexes = paragraphs.flatMap((paragraph) =>
    paragraph.parts
      .map((part) => part.wordIndex)
      .filter((index): index is number => index !== null),
  )

  assert.deepEqual(wordIndexes, [0, 1, 2, 3])
})

test('hidden reading content creates a new restore cycle for the same text', () => {
  const visibleBeforeLoading = getReadingPositionRestoreKey('text-1', 4, true)
  const hiddenDuringLoading = getReadingPositionRestoreKey('text-1', 4, false)
  const visibleAfterFailedGeneration = getReadingPositionRestoreKey(
    'text-1',
    4,
    true,
  )

  assert.equal(visibleBeforeLoading, 'text-1:4')
  assert.equal(hiddenDuringLoading, null)
  assert.equal(visibleAfterFailedGeneration, visibleBeforeLoading)
})

test('reached paragraph is the last one above the viewport offset', () => {
  const measurements = [
    { index: 2, top: 240 },
    { index: 0, top: -180 },
    { index: 1, top: 72 },
  ]

  assert.equal(getReachedReadingParagraphIndex(measurements, 96), 1)
  assert.equal(
    getReachedReadingParagraphIndex(
      measurements.map((measurement) => ({
        ...measurement,
        top: measurement.top + 300,
      })),
      96,
    ),
    null,
  )
})

test('reset is saved after an already queued paragraph update', async () => {
  const savedPositions: Array<number | null> = []
  const timer = createManualTimer()
  let markFirstSaveStarted: (() => void) | null = null
  const firstSaveStarted = new Promise<void>((resolve) => {
    markFirstSaveStarted = resolve
  })
  let releaseFirstSave: (() => void) | null = null
  const firstSaveFinished = new Promise<void>((resolve) => {
    releaseFirstSave = resolve
  })

  const sync = new ReadingPositionSync({
    retryDelayMs: 0,
    delay: noDelay,
    setTimer: timer.setTimer,
    clearTimer: timer.clearTimer,
    save: async (_readingTextId, paragraphIndex) => {
      savedPositions.push(paragraphIndex)
      if (paragraphIndex === 4) {
        markFirstSaveStarted?.()
        await firstSaveFinished
      }
    },
    onError: () => {
      assert.fail('save should not fail')
    },
  })

  sync.setActiveText('text-1', 1)
  sync.schedule(4)
  timer.run()
  await firstSaveStarted
  sync.reset()
  releaseFirstSave?.()
  await sync.waitForIdle()

  assert.deepEqual(savedPositions, [4, null])
})

test('debounce keeps only the latest changed paragraph and deduplicates saves', async () => {
  const timer = createManualTimer()
  const savedPositions: number[] = []
  const sync = new ReadingPositionSync({
    delay: noDelay,
    setTimer: timer.setTimer,
    clearTimer: timer.clearTimer,
    save: async (_readingTextId, paragraphIndex) => {
      if (paragraphIndex !== null) {
        savedPositions.push(paragraphIndex)
      }
    },
    onError: () => {
      assert.fail('save should not fail')
    },
  })

  sync.setActiveText('text-1', 1)
  sync.schedule(1)
  timer.run()
  await sync.waitForIdle()
  assert.deepEqual(savedPositions, [])

  sync.schedule(2)
  sync.schedule(3)
  timer.run()
  await sync.waitForIdle()
  assert.deepEqual(savedPositions, [3])

  sync.schedule(3)
  timer.run()
  await sync.waitForIdle()
  assert.deepEqual(savedPositions, [3])
})

test('position save retries once before showing an error', async () => {
  let calls = 0
  const errors: unknown[] = []
  const sync = new ReadingPositionSync({
    retryDelayMs: 0,
    delay: noDelay,
    save: async () => {
      calls += 1
      if (calls === 1) {
        throw new Error('temporary network error')
      }
    },
    onError: (error) => {
      errors.push(error)
    },
  })

  sync.setActiveText('text-1', 3)
  sync.reset()
  await sync.waitForIdle()

  assert.equal(calls, 2)
  assert.deepEqual(errors, [])
})

test('failed automatic retry exposes one error and manual retry can recover', async () => {
  let shouldFail = true
  let calls = 0
  const errors: unknown[] = []
  const savedPositions: Array<number | null> = []
  const sync = new ReadingPositionSync({
    retryDelayMs: 0,
    delay: noDelay,
    save: async (_readingTextId, paragraphIndex) => {
      calls += 1
      if (shouldFail) {
        throw new Error('network unavailable')
      }
      savedPositions.push(paragraphIndex)
    },
    onError: (error) => {
      errors.push(error)
    },
  })

  sync.setActiveText('text-1', 4)
  sync.reset()
  await sync.waitForIdle()

  assert.equal(calls, 2)
  assert.equal(errors.length, 1)

  shouldFail = false
  assert.equal(sync.retryFailed(), true)
  await sync.waitForIdle()

  assert.equal(calls, 3)
  assert.deepEqual(savedPositions, [null])
})

test('late success from a replaced text does not update current UI state', async () => {
  let markSaveStarted: (() => void) | null = null
  const saveStarted = new Promise<void>((resolve) => {
    markSaveStarted = resolve
  })
  let releaseSave: (() => void) | null = null
  const saveFinished = new Promise<void>((resolve) => {
    releaseSave = resolve
  })
  const savedTextIds: string[] = []

  const sync = new ReadingPositionSync({
    retryDelayMs: 0,
    delay: noDelay,
    save: async () => {
      markSaveStarted?.()
      await saveFinished
    },
    onSaved: ({ readingTextId }) => {
      savedTextIds.push(readingTextId)
    },
    onError: () => {
      assert.fail('save should not fail')
    },
  })

  sync.setActiveText('old-text', 2)
  sync.reset()
  await saveStarted
  sync.setActiveText('new-text', null)
  releaseSave?.()
  await sync.waitForIdle()

  assert.deepEqual(savedTextIds, [])
})

test('reading position schema and generation reset stay explicit', async () => {
  const [
    migration,
    generationMigration,
    saveRepository,
    saveService,
    readingScreen,
  ] = await Promise.all([
    readFile(
      'supabase/migrations/20260724120000_add_active_reading_position.sql',
      'utf8',
    ),
    readFile(
      'supabase/migrations/20261016120000_idempotent_reading_generation.sql',
      'utf8',
    ),
    readFile(
      'supabase/functions/save-reading-position/position-repository.ts',
      'utf8',
    ),
    readFile(
      'supabase/functions/save-reading-position/position-service.ts',
      'utf8',
    ),
    readFile('src/screens/ReadingScreen.tsx', 'utf8'),
  ])

  assert.match(
    migration,
    /last_read_paragraph_index is null\s+or last_read_paragraph_index >= 0/i,
  )
  assert.match(generationMigration, /last_read_paragraph_index = null/i)
  assert.match(
    saveRepository,
    /\.eq\(USER_ID, userId\)[\s\S]*\.eq\(READING_TEXT_ID, readingTextId\)/,
  )
  assert.match(saveService, /getReadingParagraphCount\(active\.body\)/)
  assert.match(readingScreen, /useReadingPosition\(text,\s*!loading\)/)
  assert.match(readingScreen, /actionLabel="Повторить"/)
})
