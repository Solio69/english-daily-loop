import type { ServiceClient } from './app.ts'

export const VOCABULARY_READ = {
  userId: 'user-1',
  studyDate: '2026-10-20',
  pendingCount: 2,
  approvalCount: 1,
  readyCount: 3,
  totalCount: 6,
  dailyLimit: 2,
  usedAttempts: 1,
  remainingAttempts: 1,
  wordId: 'word-1',
  word: 'apple',
  translation: 'яблоко',
  maxItems: 50,
  sectionCount: 2,
  countQueryCount: 4,
} as const

export type ReadCall = {
  table: string
  selected: string | null
  countRequested: boolean
  userId: string | null
  status: string | null
  order: Array<{ column: string; ascending: boolean }>
  limit: number | null
}

const readyRow = {
  id: VOCABULARY_READ.wordId,
  word: VOCABULARY_READ.word,
  translation: VOCABULARY_READ.translation,
  part_of_speech: 'noun',
  is_verb: false,
  is_regular_verb: null,
  verb_forms: null,
  examples: ['An apple is red.'],
  status: 'not_started',
  card_status: 'ready',
  review_step: null,
  next_review_date: null,
  last_reviewed_at: null,
  created_at: '2026-10-20T00:00:00Z',
  updated_at: '2026-10-20T00:00:00Z',
}

export const createVocabularyReadClient = ({
  readyRows = [readyRow],
}: {
  readyRows?: unknown[]
} = {}) => {
  const calls: ReadCall[] = []

  class ReadQuery {
    readonly call: ReadCall

    constructor(table: string) {
      this.call = {
        table,
        selected: null,
        countRequested: false,
        userId: null,
        status: null,
        order: [],
        limit: null,
      }
      calls.push(this.call)
    }

    select(columns: string, options?: { count?: string }) {
      this.call.selected = columns
      this.call.countRequested = options?.count === 'exact'
      return this
    }

    eq(column: string, value: string) {
      if (column === 'user_id') this.call.userId = value
      if (column === 'card_status') this.call.status = value
      return this
    }

    order(column: string, options: { ascending: boolean }) {
      this.call.order.push({ column, ascending: options.ascending })
      return this
    }

    limit(value: number) {
      this.call.limit = value
      return this
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?:
        ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?:
        ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      const counts: Record<string, number> = {
        pending: VOCABULARY_READ.pendingCount,
        needs_approval: VOCABULARY_READ.approvalCount,
        ready: VOCABULARY_READ.readyCount,
      }
      const response = this.call.countRequested
        ? {
            count: this.call.status
              ? counts[this.call.status]
              : VOCABULARY_READ.totalCount,
            error: null,
          }
        : {
            data: this.call.status === 'ready' ? readyRows : [],
            error: null,
          }
      return Promise.resolve(response).then(onfulfilled, onrejected)
    }
  }

  const client = {
    from: (table: string) => new ReadQuery(table),
  } as unknown as ServiceClient
  return { client, calls }
}
