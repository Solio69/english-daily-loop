import { isValidRequestId } from '../_shared/server.ts'

export const SUPPORT_REPORT_MAX_BYTES = 100 * 1024
export const SUPPORT_REPORT_MAX_COMMENT_LENGTH = 1000

const MAX_STRING_LENGTH = 500
const MAX_EVENTS = 100
const MAX_REQUEST_IDS = 50
const MAX_AI_DIAGNOSTICS = 20
const MAX_CURRENT_SCREEN_LENGTH = 80
const MAX_MODEL_CHAIN = 10
const REDACTED = '[redacted]'

const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+/gi
const TELEGRAM_BOT_TOKEN_PATTERN = /\b\d{6,}:[A-Za-z0-9_-]{20,}\b/g
const PROVIDER_KEY_PATTERN = /\bsk-[A-Za-z0-9_-]{10,}\b/gi
const SENSITIVE_ASSIGNMENT_PATTERN =
  /\b(initData|hash|auth_date|query_id|user|token|api[_-]?key|secret|password|authorization)["']?\s*[:=]\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\{[^}]*\}|[^\s&,}]+)/gi

type ProjectionRule =
  'scalar' | 'strings' | { readonly [key: string]: ProjectionRule }
type UnknownRecord = Record<string, unknown>

const CONTEXT_SCHEMA: Record<string, ProjectionRule> = {
  appVersion: 'scalar',
  buildId: 'scalar',
  environment: 'scalar',
  appUserId: 'scalar',
  role: 'scalar',
  settings: {
    englishLevel: 'scalar',
    dailyReadingMinutes: 'scalar',
  },
  subscription: {
    tier: 'scalar',
    accessType: 'scalar',
    limits: {
      dailyReadingGenerations: 'scalar',
      vocabularyWordsLimit: 'scalar',
    },
  },
  homeProgress: {
    lesson: { status: 'scalar', currentStep: 'scalar' },
    reading: { status: 'scalar' },
    review: {
      status: 'scalar',
      dueCount: 'scalar',
      reviewedTodayCount: 'scalar',
    },
  },
  streakDays: 'scalar',
  userAgent: 'scalar',
  viewport: { width: 'scalar', height: 'scalar' },
  telegramColorScheme: 'scalar',
}

const AI_DIAGNOSTIC_SCHEMA: Record<string, ProjectionRule> = {
  functionName: 'scalar',
  requestId: 'scalar',
  promptVersion: 'scalar',
  modelChain: 'strings',
  model: 'scalar',
  stage: 'scalar',
  durationMs: 'scalar',
  completionTokens: 'scalar',
  reasoningTokens: 'scalar',
  providerStatus: 'scalar',
  providerErrorCode: 'scalar',
  targetLevel: 'scalar',
  readingMinutes: 'scalar',
  targetWordMin: 'scalar',
  targetWordMax: 'scalar',
  validationWordMin: 'scalar',
  validationWordMax: 'scalar',
  outputWordCount: 'scalar',
  englishLevel: 'scalar',
  requestedCount: 'scalar',
  preparedCount: 'scalar',
  failedCount: 'scalar',
}

const EDGE_DETAILS_SCHEMA: Record<string, ProjectionRule> = {
  functionName: 'scalar',
  requestId: 'scalar',
  code: 'scalar',
  diagnostics: AI_DIAGNOSTIC_SCHEMA,
}

const EVENT_DETAIL_SCHEMAS: Record<string, Record<string, ProjectionRule>> = {
  screen_opened: { currentScreen: 'scalar', role: 'scalar' },
  edge_request_started: EDGE_DETAILS_SCHEMA,
  edge_request_succeeded: EDGE_DETAILS_SCHEMA,
  edge_request_failed: EDGE_DETAILS_SCHEMA,
  edge_request_diagnostics: EDGE_DETAILS_SCHEMA,
  reading_position_save_failed: {
    readingTextId: 'scalar',
    paragraphIndex: 'scalar',
  },
  support_report_submitted: { reportId: 'scalar' },
}

type SupportDiagnosticsInput = {
  appContext: unknown
  events: unknown
  requestIds: unknown
  aiDiagnostics: unknown
}

export type SanitizedSupportDiagnostics = {
  appContext: Record<string, unknown>
  events: unknown[]
  requestIds: string[]
  aiDiagnostics: unknown[]
}

export type PreparedSupportReport = SanitizedSupportDiagnostics & {
  currentScreen: string
  userComment: string
}

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const redactSensitiveText = (value: string, telegramUserId: number): string =>
  value
    .replace(BEARER_PATTERN, REDACTED)
    .replace(TELEGRAM_BOT_TOKEN_PATTERN, REDACTED)
    .replace(PROVIDER_KEY_PATTERN, REDACTED)
    .replace(
      SENSITIVE_ASSIGNMENT_PATTERN,
      (_match, key: string) => key + '=' + REDACTED,
    )
    .split(String(telegramUserId))
    .join(REDACTED)

export const sanitizeSupportDiagnosticString = (
  value: string,
  telegramUserId: number,
  maxLength: number,
): string => redactSensitiveText(value, telegramUserId).slice(0, maxLength)

const projectRecord = (
  value: unknown,
  schema: Record<string, ProjectionRule>,
  telegramUserId: number,
): Record<string, unknown> => {
  if (!isRecord(value)) return {}

  const result: Record<string, unknown> = {}
  for (const [key, rule] of Object.entries(schema)) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue
    const candidate = value[key]
    if (candidate === null) {
      result[key] = null
      continue
    }
    if (rule === 'scalar') {
      if (typeof candidate === 'string') {
        const sanitized = sanitizeSupportDiagnosticString(
          candidate,
          telegramUserId,
          MAX_STRING_LENGTH,
        )
        if (key !== 'requestId' || isValidRequestId(sanitized)) {
          result[key] = sanitized
        }
      } else if (typeof candidate === 'boolean') {
        result[key] = candidate
      } else if (
        typeof candidate === 'number' &&
        Number.isFinite(candidate) &&
        candidate !== telegramUserId
      ) {
        result[key] = candidate
      }
      continue
    }
    if (rule === 'strings') {
      if (Array.isArray(candidate)) {
        result[key] = candidate
          .filter((item): item is string => typeof item === 'string')
          .slice(0, MAX_MODEL_CHAIN)
          .map((item) =>
            sanitizeSupportDiagnosticString(
              item,
              telegramUserId,
              MAX_STRING_LENGTH,
            ),
          )
      }
      continue
    }
    if (isRecord(candidate)) {
      result[key] = projectRecord(candidate, rule, telegramUserId)
    }
  }
  return result
}

const sanitizeEvents = (value: unknown, telegramUserId: number): unknown[] => {
  if (!Array.isArray(value)) return []
  return value.slice(-MAX_EVENTS).flatMap((item): unknown[] => {
    if (!isRecord(item) || typeof item.event !== 'string') return []
    if (
      !Object.prototype.hasOwnProperty.call(EVENT_DETAIL_SCHEMAS, item.event)
    ) {
      return []
    }
    const envelope = projectRecord(
      item,
      { id: 'scalar', createdAt: 'scalar', level: 'scalar' },
      telegramUserId,
    )
    return [
      {
        ...envelope,
        event: item.event,
        details: projectRecord(
          item.details,
          EVENT_DETAIL_SCHEMAS[item.event],
          telegramUserId,
        ),
      },
    ]
  })
}

const normalizeRequestIds = (
  value: unknown,
  telegramUserId: number,
): string[] => {
  if (!Array.isArray(value)) return []
  const requestIds = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') continue
    const requestId = item.trim()
    const sanitized = sanitizeSupportDiagnosticString(
      requestId,
      telegramUserId,
      MAX_STRING_LENGTH,
    )
    if (!isValidRequestId(requestId) || sanitized !== requestId) {
      continue
    }
    requestIds.add(requestId)
  }
  return [...requestIds].slice(-MAX_REQUEST_IDS)
}

export const sanitizeSupportDiagnostics = (
  input: SupportDiagnosticsInput,
  telegramUserId: number,
): SanitizedSupportDiagnostics => ({
  appContext: projectRecord(input.appContext, CONTEXT_SCHEMA, telegramUserId),
  events: sanitizeEvents(input.events, telegramUserId),
  requestIds: normalizeRequestIds(input.requestIds, telegramUserId),
  aiDiagnostics: Array.isArray(input.aiDiagnostics)
    ? input.aiDiagnostics
        .slice(-MAX_AI_DIAGNOSTICS)
        .filter(isRecord)
        .map((item) =>
          projectRecord(item, AI_DIAGNOSTIC_SCHEMA, telegramUserId),
        )
        .filter((item) => Object.keys(item).length > 0)
    : [],
})

export const getSupportReportByteLength = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength

const trimReportToBudget = (
  report: PreparedSupportReport,
): PreparedSupportReport => {
  const nextReport: PreparedSupportReport = {
    ...report,
    appContext: { ...report.appContext },
    events: [...report.events],
    requestIds: [...report.requestIds],
    aiDiagnostics: [...report.aiDiagnostics],
  }

  while (
    getSupportReportByteLength(nextReport) > SUPPORT_REPORT_MAX_BYTES &&
    nextReport.events.length > 0
  ) {
    nextReport.events.shift()
  }
  while (
    getSupportReportByteLength(nextReport) > SUPPORT_REPORT_MAX_BYTES &&
    nextReport.aiDiagnostics.length > 0
  ) {
    nextReport.aiDiagnostics.shift()
  }
  while (
    getSupportReportByteLength(nextReport) > SUPPORT_REPORT_MAX_BYTES &&
    nextReport.requestIds.length > 0
  ) {
    nextReport.requestIds.shift()
  }
  if (getSupportReportByteLength(nextReport) > SUPPORT_REPORT_MAX_BYTES) {
    nextReport.appContext = { truncated: true }
  }
  return nextReport
}

export const prepareSupportReport = ({
  currentScreen,
  userComment,
  appContext,
  events,
  requestIds,
  aiDiagnostics,
  telegramUserId,
}: SupportDiagnosticsInput & {
  currentScreen: unknown
  userComment: string
  telegramUserId: number
}): PreparedSupportReport => {
  const rawCurrentScreen =
    typeof currentScreen === 'string' && currentScreen.trim()
      ? currentScreen.trim()
      : 'unknown'
  const diagnostics = sanitizeSupportDiagnostics(
    { appContext, events, requestIds, aiDiagnostics },
    telegramUserId,
  )
  return trimReportToBudget({
    currentScreen: sanitizeSupportDiagnosticString(
      rawCurrentScreen,
      telegramUserId,
      MAX_CURRENT_SCREEN_LENGTH,
    ),
    userComment: sanitizeSupportDiagnosticString(
      userComment,
      telegramUserId,
      SUPPORT_REPORT_MAX_COMMENT_LENGTH,
    ),
    ...diagnostics,
  })
}
