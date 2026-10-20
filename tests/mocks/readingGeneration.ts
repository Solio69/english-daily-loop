import { AppError } from '../../supabase/functions/_shared/server.ts'
import type {
  ReadingGenerationRepository,
  FinishGenerationInput,
  MarkFailedInput,
} from '../../supabase/functions/generate-reading-text/generation-repository.ts'
import type {
  AttemptMetadata,
  GenerationPayload,
} from '../../supabase/functions/generate-reading-text/generation-contract.ts'
import type { ReadingGenerationPorts } from '../../supabase/functions/generate-reading-text/generation-service.ts'

export const GENERATION_CASE = {
  telegramUserId: 321,
  requestId: 'req_generation_contract_01',
  userId: 'user-generation-contract',
  attemptId: 'attempt-generation-contract',
  readingTextId: 'text-generation-contract',
  studyDate: '2026-10-20',
  startedAt: 1000,
  finishedAt: 2000,
  dailyLimit: 10,
  usedAttempts: 2,
  remainingAttempts: 8,
  apiKey: 'fake-test-key',
  models: ['fake-primary-model', 'fake-secondary-model'],
  title: 'A Walk in Town',
  body: 'A safe generated reading text for a test scenario.',
  level: 'A2',
  readingMinutes: 3,
  wordCount: 130,
  provider: 'openrouter',
  promptVersion: 'reading-text-v2',
  limitCode: 'GENERATION_ATTEMPTS_EXHAUSTED',
  limitMessage: 'Попытки генерации текста на сегодня закончились.',
  failureMessage: 'AI request failed.',
  finishFailureCode: 'ACTIVE_TEXT_SAVE_FAILED',
} as const

export const DUPLICATE_PAYLOAD: GenerationPayload = {
  text: {
    id: GENERATION_CASE.readingTextId,
    title: GENERATION_CASE.title,
    body: GENERATION_CASE.body,
    level: GENERATION_CASE.level,
    estimatedMinutes: GENERATION_CASE.readingMinutes,
    lastReadParagraphIndex: null,
  },
  generation: {
    provider: GENERATION_CASE.provider,
    model: GENERATION_CASE.models[0],
    fallbackUsed: false,
    promptVersion: GENERATION_CASE.promptVersion,
  },
  dailyLimit: GENERATION_CASE.dailyLimit,
  usedAttempts: GENERATION_CASE.usedAttempts,
  remainingAttempts: GENERATION_CASE.remainingAttempts,
}

export type GenerationCalls = {
  claims: Array<{ requestId: string; studyDate: string }>
  metadata: AttemptMetadata[]
  finished: FinishGenerationInput[]
  failed: MarkFailedInput[]
  ai: number
  duplicate: number
}

export const createGenerationHarness = ({
  duplicate = false,
  exhausted = false,
  aiFails = false,
  finishFails = false,
}: {
  duplicate?: boolean
  exhausted?: boolean
  aiFails?: boolean
  finishFails?: boolean
} = {}): { ports: ReadingGenerationPorts; calls: GenerationCalls } => {
  const calls: GenerationCalls = {
    claims: [],
    metadata: [],
    finished: [],
    failed: [],
    ai: 0,
    duplicate: 0,
  }
  const repository: ReadingGenerationRepository = {
    loadSettings: async () => ({
      appUserId: GENERATION_CASE.userId,
      englishLevel: GENERATION_CASE.level,
      dailyReadingMinutes: GENERATION_CASE.readingMinutes,
    }),
    getDailyLimit: async () => GENERATION_CASE.dailyLimit,
    claim: async ({ requestId, studyDate }) => {
      calls.claims.push({ requestId, studyDate })
      if (exhausted) {
        throw new AppError(
          429,
          GENERATION_CASE.limitCode,
          GENERATION_CASE.limitMessage,
        )
      }
      return {
        isDuplicate: duplicate,
        attemptId: GENERATION_CASE.attemptId,
        usedAttempts: GENERATION_CASE.usedAttempts,
        remainingAttempts: GENERATION_CASE.remainingAttempts,
      }
    },
    waitForDuplicate: async () => {
      calls.duplicate += 1
      return DUPLICATE_PAYLOAD
    },
    saveMetadata: async ({ metadata }) => {
      calls.metadata.push({ ...metadata })
    },
    finish: async (input) => {
      calls.finished.push(input)
      if (finishFails) {
        throw new AppError(
          500,
          GENERATION_CASE.finishFailureCode,
          GENERATION_CASE.failureMessage,
        )
      }
    },
    markFailed: async (input) => {
      calls.failed.push(input)
    },
  }
  const ports: ReadingGenerationPorts = {
    repository,
    generate: async () => {
      calls.ai += 1
      if (aiFails) throw new Error(GENERATION_CASE.failureMessage)
      return {
        title: GENERATION_CASE.title,
        body: GENERATION_CASE.body,
        level: GENERATION_CASE.level,
        estimatedMinutes: GENERATION_CASE.readingMinutes,
        usedModel: GENERATION_CASE.models[0],
        promptVersion: GENERATION_CASE.promptVersion,
        validation: { wordCount: GENERATION_CASE.wordCount },
      }
    },
    studyDate: () => GENERATION_CASE.studyDate,
    now: () => GENERATION_CASE.finishedAt,
    createId: () => GENERATION_CASE.readingTextId,
  }
  return { ports, calls }
}
