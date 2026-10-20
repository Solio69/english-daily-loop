import type { ReadingStateRepository } from '../get-reading-state/reading-state-repository.ts'
import { createReadingStateRepository } from '../get-reading-state/reading-state-repository.ts'
import type { ServiceClient } from './app.ts'
import type { ReadingPositionRepository } from '../save-reading-position/position-repository.ts'
import type { ReadingCompletionRepository } from '../complete-reading-text/completion-repository.ts'
import type { ReadingHistoryRepository } from '../get-reading-history/history-repository.ts'

export const READING_FLOW_CASE = {
  userId: 'test-reading-user',
  today: '2026-10-20',
  priorDate: '2026-10-19',
  readingTextId: 'active-text-id',
  staleTextId: 'stale-text-id',
  requestId: 'reading-flow-request',
  startedAt: 100,
  finishedAt: 200,
  firstCompletedAt: '2026-10-20T08:00:00Z',
  limit: 10,
  attempts: 2,
  remaining: 8,
  paragraphIndex: 1,
  invalidParagraphIndex: 3,
  zero: 0,
  one: 1,
  second: 2,
  title: 'A Test Reading',
  body: 'First paragraph.\n\nSecond paragraph.',
  level: 'A2',
  minutes: 3,
  provider: 'openrouter',
  model: 'test-model',
  source: 'ai',
  noActiveCode: 'NO_ACTIVE_READING_TEXT',
  changedCode: 'ACTIVE_TEXT_CHANGED',
  invalidIndexCode: 'INVALID_PARAGRAPH_INDEX',
  invalidCursorCode: 'INVALID_CURSOR',
  cursor: '2026-10-20T08:00:00Z|history-2',
  historyIdFirst: 'history-2',
  historyIdSecond: 'history-1',
  streakDays: 4,
  completedReadingTextCount: 12,
  sourcesTable: 'user_vocabulary_word_sources',
  wordsTable: 'user_vocabulary_words',
  wordIdFirst: 'word-first',
  wordIdSecond: 'word-second',
  invalidWordIndex: -1,
} as const

const SAVED_WORD_SOURCES = [
  {
    word_id: READING_FLOW_CASE.wordIdFirst,
    word_index: READING_FLOW_CASE.zero,
  },
  {
    word_id: READING_FLOW_CASE.wordIdSecond,
    word_index: READING_FLOW_CASE.one,
  },
  {
    word_id: READING_FLOW_CASE.wordIdFirst,
    word_index: READING_FLOW_CASE.zero,
  },
  {
    word_id: READING_FLOW_CASE.wordIdFirst,
    word_index: READING_FLOW_CASE.invalidWordIndex,
  },
]
const PENDING_WORD_ROWS = [{ id: READING_FLOW_CASE.wordIdSecond }]

export const createSavedWordRepositoryHarness = () => {
  const calls = { tables: [] as string[] }
  const supabase = {
    from: (table: string) => {
      calls.tables.push(table)
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data:
              table === READING_FLOW_CASE.sourcesTable
                ? SAVED_WORD_SOURCES
                : PENDING_WORD_ROWS,
            error: null,
          }).then(resolve),
      }
      return query
    },
  } as unknown as ServiceClient
  return { repository: createReadingStateRepository(supabase), calls }
}

export const ACTIVE_READING_ROW = {
  reading_text_id: READING_FLOW_CASE.readingTextId,
  title: READING_FLOW_CASE.title,
  body: READING_FLOW_CASE.body,
  level: READING_FLOW_CASE.level,
  estimated_minutes: READING_FLOW_CASE.minutes,
  provider: READING_FLOW_CASE.provider,
  model: READING_FLOW_CASE.model,
  fallback_used: false,
  last_read_paragraph_index: READING_FLOW_CASE.paragraphIndex,
}

export const HISTORY_ROWS = [
  {
    id: READING_FLOW_CASE.historyIdFirst,
    completed_date: READING_FLOW_CASE.today,
    completed_at: READING_FLOW_CASE.firstCompletedAt,
    title: READING_FLOW_CASE.title,
    body: READING_FLOW_CASE.body,
    level: READING_FLOW_CASE.level,
    estimated_minutes: READING_FLOW_CASE.minutes,
    provider: READING_FLOW_CASE.provider,
    model: READING_FLOW_CASE.model,
    fallback_used: false,
  },
  {
    id: READING_FLOW_CASE.historyIdSecond,
    completed_date: READING_FLOW_CASE.priorDate,
    completed_at: READING_FLOW_CASE.firstCompletedAt,
    title: READING_FLOW_CASE.title,
    body: READING_FLOW_CASE.body,
    level: READING_FLOW_CASE.level,
    estimated_minutes: READING_FLOW_CASE.minutes,
    provider: READING_FLOW_CASE.provider,
    model: READING_FLOW_CASE.model,
    fallback_used: false,
  },
]

export const createStateHarness = () => {
  const calls = { dates: [] as string[], wordReads: [] as string[] }
  const repository: ReadingStateRepository = {
    getDailyLimit: () => Promise.resolve(READING_FLOW_CASE.limit),
    loadSnapshot: ({ studyDate }) => {
      calls.dates.push(studyDate)
      return Promise.resolve({
        usedAttempts: READING_FLOW_CASE.attempts,
        isReadingCompletedToday: false,
        active: ACTIVE_READING_ROW,
      })
    },
    loadSavedWordIndexes: ({ readingTextId }) => {
      calls.wordReads.push(readingTextId)
      return Promise.resolve({
        saved: [READING_FLOW_CASE.paragraphIndex],
        pending: [READING_FLOW_CASE.paragraphIndex],
      })
    },
  }
  return { repository, calls }
}

export const createPositionHarness = ({
  activeId = READING_FLOW_CASE.readingTextId as string,
  updated = true,
}: { activeId?: string; updated?: boolean } = {}) => {
  const calls = { saves: [] as Array<number | null> }
  const repository: ReadingPositionRepository = {
    loadActive: () =>
      Promise.resolve({
        readingTextId: activeId,
        body: READING_FLOW_CASE.body,
      }),
    save: ({ paragraphIndex }) => {
      calls.saves.push(paragraphIndex)
      return Promise.resolve(updated)
    },
  }
  return { repository, calls }
}

export const createCompletionHarness = () => {
  const calls = { requestedDates: [] as string[], metricDates: [] as string[] }
  const repository: ReadingCompletionRepository = {
    complete: ({ studyDate }) => {
      calls.requestedDates.push(studyDate)
      return Promise.resolve({
        completedDate: READING_FLOW_CASE.today,
        firstTextCompletedAt: READING_FLOW_CASE.firstCompletedAt,
      })
    },
    getMetrics: ({ completedDate }) => {
      calls.metricDates.push(completedDate)
      return Promise.resolve({
        streakDays: READING_FLOW_CASE.streakDays,
        completedReadingTextCount: READING_FLOW_CASE.completedReadingTextCount,
      })
    },
  }
  return { repository, calls }
}

export const createHistoryHarness = () => {
  const calls = { userIds: [] as string[] }
  const repository: ReadingHistoryRepository = {
    loadPage: ({ userId }) => {
      calls.userIds.push(userId)
      return Promise.resolve(HISTORY_ROWS)
    },
  }
  return { repository, calls }
}
