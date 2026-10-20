import type { ServiceClient } from '../_shared/app.ts'
import { createReadingGenerationRepository } from './generation-repository.ts'

export const REPOSITORY_CASE = {
  userId: 'user-repository-test',
  attemptId: 'attempt-repository-test',
  requestId: 'request-repository-test',
  readingTextId: 'reading-repository-test',
  date: '2026-10-20',
  dailyLimit: 10,
  usedAttempts: 2,
  remainingAttempts: 8,
  statusSucceeded: 'succeeded',
  statusFailed: 'failed',
  statusStarted: 'started',
  supersededCode: 'GENERATION_RESULT_SUPERSEDED',
  processingCode: 'GENERATION_STILL_PROCESSING',
  failedCode: 'TEXT_GENERATION_FAILED',
  invalidClaimCode: 'ATTEMPT_CLAIM_FAILED',
  claimRpc: 'claim_reading_generation_request',
  attemptsTable: 'reading_generation_attempts',
  activeTable: 'user_active_reading_texts',
  zero: 0,
  one: 1,
  timeoutAt: 100000,
} as const

export const CLAIM_RESULT = {
  ok: true,
  isDuplicate: false,
  attemptId: REPOSITORY_CASE.attemptId,
  usedAttempts: REPOSITORY_CASE.usedAttempts,
  remainingAttempts: REPOSITORY_CASE.remainingAttempts,
} as const

export const ATTEMPT_ROW = {
  status: REPOSITORY_CASE.statusSucceeded,
  reading_text_id: REPOSITORY_CASE.readingTextId,
  model: 'model-test',
  fallback_used: false,
  prompt_version: 'reading-text-v2',
} as const

export const ACTIVE_ROW = {
  reading_text_id: REPOSITORY_CASE.readingTextId,
  title: 'A Reading Test',
  body: 'A test body.',
  level: 'A2',
  estimated_minutes: 3,
  last_read_paragraph_index: null,
} as const

export const createRepositoryHarness = ({
  claimResult = CLAIM_RESULT as unknown,
  attemptStatus = REPOSITORY_CASE.statusSucceeded as string,
  activeRow = ACTIVE_ROW as unknown,
  clock = REPOSITORY_CASE.zero as number,
}: {
  claimResult?: unknown
  attemptStatus?: string
  activeRow?: unknown
  clock?: number
} = {}) => {
  const calls = { rpc: [] as string[], tables: [] as string[] }
  let clockCalls = REPOSITORY_CASE.zero
  const supabase = {
    rpc: (name: string) => {
      calls.rpc.push(name)
      return Promise.resolve({ data: claimResult, error: null })
    },
    from: (table: string) => {
      calls.tables.push(table)
      const query = {
        select: () => query,
        eq: () => query,
        single: () =>
          Promise.resolve({
            data: { ...ATTEMPT_ROW, status: attemptStatus },
            error: null,
          }),
        maybeSingle: () => Promise.resolve({ data: activeRow, error: null }),
      }
      return query
    },
  } as unknown as ServiceClient
  return {
    repository: createReadingGenerationRepository({
      supabase,
      now: () => {
        clockCalls += REPOSITORY_CASE.one
        return clockCalls === REPOSITORY_CASE.one ? REPOSITORY_CASE.zero : clock
      },
      delay: () => Promise.resolve(),
    }),
    calls,
  }
}
