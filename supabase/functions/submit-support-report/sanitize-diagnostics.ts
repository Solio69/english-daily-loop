import { isValidRequestId } from "../_shared/server.ts";

export const SUPPORT_REPORT_MAX_BYTES = 100 * 1024;
export const SUPPORT_REPORT_MAX_COMMENT_LENGTH = 1000;

const MAX_STRING_LENGTH = 500;
const MAX_KEY_LENGTH = 80;
const MAX_ARRAY_LENGTH = 50;
const MAX_OBJECT_KEYS = 50;
const MAX_DEPTH = 5;
const MAX_EVENTS = 100;
const MAX_REQUEST_IDS = 50;
const MAX_AI_DIAGNOSTICS = 20;
const MAX_CURRENT_SCREEN_LENGTH = 80;

const SENSITIVE_KEY_PATTERN =
  /(authorization|bearer|body|content|hash|initdata|key|password|prompt|raw|secret|stack|text|token)/i;
const TELEGRAM_USER_ID_KEY_PATTERN = /^(telegramUserId|telegram_user_id)$/i;

const APP_CONTEXT_KEYS = [
  "appVersion",
  "buildId",
  "environment",
  "appUserId",
  "role",
  "settings",
  "subscription",
  "homeProgress",
  "streakDays",
  "userAgent",
  "viewport",
  "telegramColorScheme",
] as const;

type SupportDiagnosticsInput = {
  appContext: unknown;
  events: unknown;
  requestIds: unknown;
  aiDiagnostics: unknown;
};

export type SanitizedSupportDiagnostics = {
  appContext: Record<string, unknown>;
  events: unknown[];
  requestIds: string[];
  aiDiagnostics: unknown[];
};

export type PreparedSupportReport = SanitizedSupportDiagnostics & {
  currentScreen: string;
  userComment: string;
};

const isTelegramUserIdValue = (
  value: unknown,
  telegramUserId: number,
): boolean => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value === telegramUserId;
  }

  return typeof value === "string" &&
    value.trim() === String(telegramUserId);
};

const redactTelegramUserIdFromString = (
  value: string,
  telegramUserId: number,
): string =>
  value
    .split(String(telegramUserId))
    .join("[redacted]");

export const sanitizeSupportDiagnosticString = (
  value: string,
  telegramUserId: number,
  maxLength: number,
): string =>
  redactTelegramUserIdFromString(value, telegramUserId)
    .slice(0, maxLength);

const sanitizeValue = (
  value: unknown,
  telegramUserId: number,
  depth = 0,
): unknown => {
  if (depth > MAX_DEPTH) return "[truncated]";
  if (isTelegramUserIdValue(value, telegramUserId)) return "[redacted]";
  if (value === null || value === undefined) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    const sanitizedValue = redactTelegramUserIdFromString(
      value,
      telegramUserId,
    );
    return sanitizedValue.length > MAX_STRING_LENGTH
      ? `${sanitizedValue.slice(0, MAX_STRING_LENGTH)}...`
      : sanitizedValue;
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => sanitizeValue(item, telegramUserId, depth + 1));
  }
  if (typeof value === "object") {
    const sanitizedEntries: Array<[string, unknown]> = [];

    const entries = Object.entries(value as Record<string, unknown>)
      .slice(0, MAX_OBJECT_KEYS);

    for (const [key, item] of entries) {
      if (TELEGRAM_USER_ID_KEY_PATTERN.test(key)) continue;

      const sanitizedKey = redactTelegramUserIdFromString(
        key,
        telegramUserId,
      ).slice(0, MAX_KEY_LENGTH);
      if (!sanitizedKey) continue;

      sanitizedEntries.push([
        sanitizedKey,
        SENSITIVE_KEY_PATTERN.test(key)
          ? "[redacted]"
          : sanitizeValue(item, telegramUserId, depth + 1),
      ]);
    }

    return Object.fromEntries(sanitizedEntries);
  }

  return sanitizeSupportDiagnosticString(
    String(value),
    telegramUserId,
    MAX_STRING_LENGTH,
  );
};

const sanitizeAppContext = (
  value: unknown,
  telegramUserId: number,
): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const source = value as Record<string, unknown>;
  const sanitizedEntries: Array<[string, unknown]> = [];

  for (const key of APP_CONTEXT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    sanitizedEntries.push([
      key,
      sanitizeValue(source[key], telegramUserId, 1),
    ]);
  }

  return Object.fromEntries(sanitizedEntries);
};

const sanitizeArray = (
  value: unknown,
  maxItems: number,
  telegramUserId: number,
): unknown[] =>
  Array.isArray(value)
    ? value
      .slice(-maxItems)
      .map((item) => sanitizeValue(item, telegramUserId))
    : [];

const normalizeRequestIds = (
  value: unknown,
  telegramUserId: number,
): string[] => {
  if (!Array.isArray(value)) return [];

  const requestIds = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const requestId = item.trim();
    if (
      !isValidRequestId(requestId) ||
      requestId.includes(String(telegramUserId))
    ) {
      continue;
    }
    requestIds.add(requestId);
  }

  return [...requestIds].slice(-MAX_REQUEST_IDS);
};

export const sanitizeSupportDiagnostics = (
  input: SupportDiagnosticsInput,
  telegramUserId: number,
): SanitizedSupportDiagnostics => ({
  appContext: sanitizeAppContext(input.appContext, telegramUserId),
  events: sanitizeArray(input.events, MAX_EVENTS, telegramUserId),
  requestIds: normalizeRequestIds(input.requestIds, telegramUserId),
  aiDiagnostics: sanitizeArray(
    input.aiDiagnostics,
    MAX_AI_DIAGNOSTICS,
    telegramUserId,
  ),
});

export const getSupportReportByteLength = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

const trimReportToBudget = (
  report: PreparedSupportReport,
): PreparedSupportReport => {
  const nextReport: PreparedSupportReport = {
    ...report,
    appContext: { ...report.appContext },
    events: [...report.events],
    requestIds: [...report.requestIds],
    aiDiagnostics: [...report.aiDiagnostics],
  };

  while (
    getSupportReportByteLength(nextReport) > SUPPORT_REPORT_MAX_BYTES &&
    nextReport.events.length > 0
  ) {
    nextReport.events.shift();
  }

  while (
    getSupportReportByteLength(nextReport) > SUPPORT_REPORT_MAX_BYTES &&
    nextReport.aiDiagnostics.length > 0
  ) {
    nextReport.aiDiagnostics.shift();
  }

  while (
    getSupportReportByteLength(nextReport) > SUPPORT_REPORT_MAX_BYTES &&
    nextReport.requestIds.length > 0
  ) {
    nextReport.requestIds.shift();
  }

  if (getSupportReportByteLength(nextReport) > SUPPORT_REPORT_MAX_BYTES) {
    nextReport.appContext = { truncated: true };
  }

  if (getSupportReportByteLength(nextReport) > SUPPORT_REPORT_MAX_BYTES) {
    return {
      currentScreen: nextReport.currentScreen,
      userComment: nextReport.userComment,
      appContext: { truncated: true },
      events: [],
      requestIds: [],
      aiDiagnostics: [],
    };
  }

  return nextReport;
};

export const prepareSupportReport = ({
  currentScreen,
  userComment,
  appContext,
  events,
  requestIds,
  aiDiagnostics,
  telegramUserId,
}: SupportDiagnosticsInput & {
  currentScreen: unknown;
  userComment: string;
  telegramUserId: number;
}): PreparedSupportReport => {
  const rawCurrentScreen =
    typeof currentScreen === "string" && currentScreen.trim()
      ? currentScreen.trim()
      : "unknown";
  const diagnostics = sanitizeSupportDiagnostics(
    { appContext, events, requestIds, aiDiagnostics },
    telegramUserId,
  );

  return trimReportToBudget({
    currentScreen: sanitizeSupportDiagnosticString(
      rawCurrentScreen,
      telegramUserId,
      MAX_CURRENT_SCREEN_LENGTH,
    ),
    userComment: userComment.slice(0, SUPPORT_REPORT_MAX_COMMENT_LENGTH),
    ...diagnostics,
  });
};
