import {
  createServiceClient,
  getAppUserByTelegramId,
  type ServiceClient,
} from '../_shared/app.ts'
import { getDailyReadingGenerationLimit } from '../_shared/access.ts'
import { sanitizeDiagnosticMessage } from '../_shared/ai-diagnostics.ts'
import {
  AppError,
  fail,
  getSafeErrorDetails,
  HTTP_STATUS,
} from '../_shared/server.ts'
import { OPENROUTER_PROVIDER } from './ai-pipeline.ts'
import {
  GENERATION_ERROR,
  GENERATION_LIMITS,
  GENERATION_LOG_PREFIX,
  parseEnglishLevel,
  parseReadingMinutes,
  toAttemptUpdatePayload,
  type AttemptMetadata,
  type ClaimedAttempt,
  type GenerationPayload,
  type UserReadingSettings,
} from './generation-contract.ts'
import type { AiFailureStage } from './ai-pipeline.ts'

const DB = {
  attempts: 'reading_generation_attempts',
  activeTexts: 'user_active_reading_texts',
  settings: 'user_settings',
  claimRpc: 'claim_reading_generation_request',
  finishRpc: 'finish_reading_generation_request',
  id: 'id',
  userId: 'user_id',
  readingTextId: 'reading_text_id',
  status: 'status',
  started: 'started',
  succeeded: 'succeeded',
  failed: 'failed',
  attemptColumns:
    'status, reading_text_id, model, fallback_used, prompt_version',
  activeColumns:
    'reading_text_id, title, body, level, estimated_minutes, last_read_paragraph_index',
} as const

const DUPLICATE_ERROR = {
  attemptLookup: {
    code: 'ATTEMPT_LOOKUP_FAILED',
    message: 'Failed to load generation attempt.',
  },
  activeLookup: {
    code: 'ACTIVE_TEXT_LOOKUP_FAILED',
    message: 'Failed to load generated text.',
  },
  superseded: {
    code: 'GENERATION_RESULT_SUPERSEDED',
    message: 'A newer reading text is active.',
  },
  processing: {
    code: 'GENERATION_STILL_PROCESSING',
    message: 'Generation is still processing.',
  },
} as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readString = (value: unknown, code: string): string => {
  if (typeof value === 'string') return value
  fail(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code,
    'Invalid generation database result.',
  )
}

const readNumber = (value: unknown, code: string): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  fail(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code,
    'Invalid generation database result.',
  )
}

export type FinishGenerationInput = {
  userId: string
  attemptId: string
  readingTextId: string
  title: string
  body: string
  level: string
  estimatedMinutes: number
  model: string
  fallbackUsed: boolean
  studyDate: string
  outputWordCount: number
  durationMs: number
}

export type MarkFailedInput = {
  attemptId: string
  requestId: string
  metadata: AttemptMetadata | null
  failureStage: AiFailureStage
  error: unknown
  durationMs: number
}

export type ReadingGenerationRepository = {
  loadSettings: (input: {
    telegramUserId: number
    requestId: string
  }) => Promise<UserReadingSettings>
  getDailyLimit: (input: { userId: string }) => Promise<number>
  claim: (input: {
    userId: string
    studyDate: string
    dailyLimit: number
    requestId: string
  }) => Promise<ClaimedAttempt>
  waitForDuplicate: (input: {
    userId: string
    attemptId: string
    dailyLimit: number
    usedAttempts: number
    remainingAttempts: number
  }) => Promise<GenerationPayload>
  saveMetadata: (input: {
    userId: string
    attemptId: string
    metadata: AttemptMetadata
  }) => Promise<void>
  finish: (input: FinishGenerationInput) => Promise<void>
  markFailed: (input: MarkFailedInput) => Promise<void>
}

export const createReadingGenerationRepository = ({
  supabase,
  now = Date.now,
  delay = (milliseconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
}: {
  supabase: ServiceClient
  now?: () => number
  delay?: (milliseconds: number) => Promise<void>
}): ReadingGenerationRepository => ({
  loadSettings: async ({ telegramUserId, requestId }) => {
    const appUser = await getAppUserByTelegramId(
      supabase,
      telegramUserId,
      GENERATION_LOG_PREFIX,
      requestId,
    )
    const { data, error } = await supabase
      .from(DB.settings)
      .select('english_level, daily_reading_minutes')
      .eq(DB.userId, appUser.id)
      .maybeSingle()
    if (error) {
      console.error(GENERATION_LOG_PREFIX + ' failed to load user settings', {
        appUserId: appUser.id,
        ...getSafeErrorDetails(error),
      })
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'SETTINGS_LOAD_FAILED',
        'Failed to load user settings.',
      )
    }
    if (!isRecord(data)) {
      fail(
        HTTP_STATUS.CONFLICT,
        'SETTINGS_NOT_COMPLETED',
        'User settings are not completed yet.',
      )
    }
    return {
      appUserId: appUser.id,
      englishLevel: parseEnglishLevel(data.english_level),
      dailyReadingMinutes: parseReadingMinutes(data.daily_reading_minutes),
    }
  },
  getDailyLimit: ({ userId }) =>
    getDailyReadingGenerationLimit(supabase, userId, GENERATION_LOG_PREFIX),
  claim: async ({ userId, studyDate, dailyLimit, requestId }) => {
    const { data, error } = await supabase.rpc(DB.claimRpc, {
      p_user_id: userId,
      p_attempt_date: studyDate,
      p_daily_limit: dailyLimit,
      p_request_id: requestId,
      p_provider: OPENROUTER_PROVIDER,
    })
    if (error) {
      console.error(GENERATION_LOG_PREFIX + ' failed to claim attempt', {
        appUserId: userId,
        attemptDate: studyDate,
        ...getSafeErrorDetails(error),
      })
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'ATTEMPT_CLAIM_FAILED',
        'Failed to save generation attempt.',
      )
    }
    if (!isRecord(data)) {
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'ATTEMPT_CLAIM_FAILED',
        'Empty attempt claim result.',
      )
    }
    if (data.ok === false) {
      const code = readString(data.code, 'ATTEMPT_CLAIM_FAILED')
      const message = readString(data.message, 'ATTEMPT_CLAIM_FAILED')
      fail(
        code === 'GENERATION_ATTEMPTS_EXHAUSTED'
          ? 429
          : HTTP_STATUS.INTERNAL_SERVER_ERROR,
        code,
        message,
      )
    }
    if (data.ok !== true || typeof data.isDuplicate !== 'boolean') {
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'ATTEMPT_CLAIM_FAILED',
        'Invalid attempt claim result.',
      )
    }
    return {
      isDuplicate: data.isDuplicate,
      attemptId: readString(data.attemptId, 'ATTEMPT_CLAIM_FAILED'),
      usedAttempts: readNumber(data.usedAttempts, 'ATTEMPT_CLAIM_FAILED'),
      remainingAttempts: readNumber(
        data.remainingAttempts,
        'ATTEMPT_CLAIM_FAILED',
      ),
    }
  },
  waitForDuplicate: async ({
    userId,
    attemptId,
    dailyLimit,
    usedAttempts,
    remainingAttempts,
  }) => {
    const deadline = now() + GENERATION_LIMITS.duplicateWaitMs
    while (true) {
      const { data, error } = await supabase
        .from(DB.attempts)
        .select(DB.attemptColumns)
        .eq(DB.id, attemptId)
        .eq(DB.userId, userId)
        .single()
      if (error || !isRecord(data)) {
        fail(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          DUPLICATE_ERROR.attemptLookup.code,
          DUPLICATE_ERROR.attemptLookup.message,
        )
      }
      if (data.status === DB.succeeded) {
        const readingTextId = readString(
          data.reading_text_id,
          DUPLICATE_ERROR.attemptLookup.code,
        )
        const { data: active, error: activeError } = await supabase
          .from(DB.activeTexts)
          .select(DB.activeColumns)
          .eq(DB.userId, userId)
          .eq(DB.readingTextId, readingTextId)
          .maybeSingle()
        if (activeError) {
          fail(
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            DUPLICATE_ERROR.activeLookup.code,
            DUPLICATE_ERROR.activeLookup.message,
          )
        }
        if (!isRecord(active)) {
          fail(
            HTTP_STATUS.CONFLICT,
            DUPLICATE_ERROR.superseded.code,
            DUPLICATE_ERROR.superseded.message,
          )
        }
        return {
          text: {
            id: readString(
              active.reading_text_id,
              DUPLICATE_ERROR.activeLookup.code,
            ),
            title: readString(active.title, DUPLICATE_ERROR.activeLookup.code),
            body: readString(active.body, DUPLICATE_ERROR.activeLookup.code),
            level: readString(active.level, DUPLICATE_ERROR.activeLookup.code),
            estimatedMinutes: readNumber(
              active.estimated_minutes,
              DUPLICATE_ERROR.activeLookup.code,
            ),
            lastReadParagraphIndex:
              active.last_read_paragraph_index === null
                ? null
                : readNumber(
                    active.last_read_paragraph_index,
                    DUPLICATE_ERROR.activeLookup.code,
                  ),
          },
          generation: {
            provider: OPENROUTER_PROVIDER,
            model: typeof data.model === 'string' ? data.model : null,
            fallbackUsed:
              typeof data.fallback_used === 'boolean'
                ? data.fallback_used
                : null,
            promptVersion:
              typeof data.prompt_version === 'string'
                ? data.prompt_version
                : null,
          },
          dailyLimit,
          usedAttempts,
          remainingAttempts,
        }
      }
      if (data.status === DB.failed) {
        fail(
          HTTP_STATUS.BAD_GATEWAY,
          GENERATION_ERROR.failedCode,
          GENERATION_ERROR.publicMessage,
        )
      }
      if (now() >= deadline) {
        fail(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          DUPLICATE_ERROR.processing.code,
          DUPLICATE_ERROR.processing.message,
        )
      }
      await delay(GENERATION_LIMITS.duplicatePollMs)
    }
  },
  saveMetadata: async ({ userId, attemptId, metadata }) => {
    const { error } = await supabase
      .from(DB.attempts)
      .update(toAttemptUpdatePayload(metadata))
      .eq(DB.id, attemptId)
    if (error) {
      console.error(
        GENERATION_LOG_PREFIX + ' failed to update attempt metadata',
        {
          appUserId: userId,
          attemptId,
          ...getSafeErrorDetails(error),
        },
      )
    }
  },
  finish: async (input) => {
    const args = {
      p_user_id: input.userId,
      p_attempt_id: input.attemptId,
      p_reading_text_id: input.readingTextId,
      p_title: input.title,
      p_body: input.body,
      p_level: input.level,
      p_estimated_minutes: input.estimatedMinutes,
      p_provider: OPENROUTER_PROVIDER,
      p_model: input.model,
      p_fallback_used: input.fallbackUsed,
      p_reading_date: input.studyDate,
      p_output_word_count: input.outputWordCount,
      p_duration_ms: input.durationMs,
    }
    let finishError: unknown = null
    for (
      let attempt = 0;
      attempt < GENERATION_LIMITS.finishAttempts;
      attempt += 1
    ) {
      const result = await supabase.rpc(DB.finishRpc, args)
      finishError = result.error
      if (!finishError) break
    }
    if (finishError) {
      console.error(GENERATION_LOG_PREFIX + ' failed to finish attempt', {
        appUserId: input.userId,
        attemptId: input.attemptId,
        ...getSafeErrorDetails(finishError),
      })
      fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'ACTIVE_TEXT_SAVE_FAILED',
        'Failed to save generated text.',
      )
    }
  },
  markFailed: async ({
    attemptId,
    requestId,
    metadata,
    failureStage,
    error,
    durationMs,
  }) => {
    const code =
      error instanceof AppError ? error.code : GENERATION_ERROR.failedCode
    const message =
      error instanceof Error ? error.message : GENERATION_ERROR.unknownMessage
    const { error: updateError } = await supabase
      .from(DB.attempts)
      .update({
        ...(metadata ? toAttemptUpdatePayload(metadata) : {}),
        status: DB.failed,
        duration_ms: durationMs,
        failure_stage: failureStage,
        error_code: code,
        error_message: sanitizeDiagnosticMessage(message),
      })
      .eq(DB.id, attemptId)
      .eq(DB.status, DB.started)
    if (updateError) {
      console.error(GENERATION_LOG_PREFIX + ' failed to mark attempt failed', {
        requestId,
        attemptId,
        ...getSafeErrorDetails(updateError),
      })
    }
  },
})

export const createDefaultReadingGenerationRepository = (env: {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}): ReadingGenerationRepository =>
  createReadingGenerationRepository({ supabase: createServiceClient(env) })
