// @ts-nocheck
import {
  AppError,
  DEFAULT_INTERNAL_ERROR_MESSAGE,
  assertPostRequest,
  errorResponse,
  fail,
  getRequiredEnv,
  getRequestId,
  getTelegramUserFromBody,
  handleCorsPreflight,
  parseJsonBody,
  successResponse,
} from "../_shared/server.ts";
import {
  createServiceClient,
  type ServiceClient,
} from "../_shared/app.ts";

type SupportReportBody = {
  initData?: unknown;
  comment?: unknown;
  currentScreen?: unknown;
  appContext?: unknown;
  events?: unknown;
  requestIds?: unknown;
  aiDiagnostics?: unknown;
};

type AppUserRow = {
  id: string;
  telegram_user_id: number;
  app_role: "admin" | "tester" | "user";
};

const LOG_PREFIX = "[submit-support-report]";
const MAX_REPORT_BYTES = 100 * 1024;
const MAX_COMMENT_LENGTH = 1000;
const MAX_EVENTS = 100;
const MAX_REQUEST_IDS = 50;
const MAX_AI_DIAGNOSTICS = 20;
const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_LENGTH = 50;
const MAX_DEPTH = 5;
const REPORTS_PER_HOUR_LIMIT = 5;
const SENSITIVE_KEY_PATTERN =
  /(authorization|bearer|body|content|hash|initdata|key|password|prompt|raw|secret|stack|text|token)/i;

const textEncoder = new TextEncoder();

const sanitizeValue = (value: unknown, depth = 0): unknown => {
  if (depth > MAX_DEPTH) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}...`
      : value;
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key)
          ? "[redacted]"
          : sanitizeValue(item, depth + 1),
      ]),
    );
  }

  return String(value);
};

const sanitizeObject = (value: unknown): Record<string, unknown> => {
  const sanitized = sanitizeValue(value);
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : {};
};

const sanitizeArray = (value: unknown, maxItems: number): unknown[] =>
  Array.isArray(value)
    ? value.slice(-maxItems).map((item) => sanitizeValue(item))
    : [];

const normalizeRequestIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  const requestIds = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const requestId = item.trim();
    if (!requestId || requestId.length > 80) continue;
    requestIds.add(requestId);
  }

  return [...requestIds].slice(-MAX_REQUEST_IDS);
};

const getJsonByteLength = (value: unknown): number =>
  textEncoder.encode(JSON.stringify(value)).byteLength;

const trimReportToBudget = (report: {
  currentScreen: string;
  userComment: string;
  appContext: Record<string, unknown>;
  events: unknown[];
  requestIds: string[];
  aiDiagnostics: unknown[];
}): typeof report => {
  let nextReport = { ...report, events: [...report.events] };

  while (getJsonByteLength(nextReport) > MAX_REPORT_BYTES && nextReport.events.length > 0) {
    nextReport.events.shift();
  }

  if (getJsonByteLength(nextReport) > MAX_REPORT_BYTES) {
    nextReport = {
      ...nextReport,
      aiDiagnostics: nextReport.aiDiagnostics.slice(-5),
    };
  }

  if (getJsonByteLength(nextReport) > MAX_REPORT_BYTES) {
    nextReport = {
      ...nextReport,
      appContext: { truncated: true },
    };
  }

  return nextReport;
};

const getAppUser = async (
  supabase: ServiceClient,
  telegramUserId: number,
): Promise<AppUserRow> => {
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id, telegram_user_id, app_role")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();

  if (userError) {
    console.error(`${LOG_PREFIX} failed to load user`, {
      telegramUserId,
      error: userError.message,
    });
    fail(500, "USER_FIND_FAILED", "Failed to load user profile.");
  }

  if (!userRow) {
    fail(
      404,
      "USER_NOT_FOUND",
      "User profile was not found. Complete Telegram auth first.",
    );
  }

  return userRow as AppUserRow;
};

const assertReportRateLimit = async (
  supabase: ServiceClient,
  userId: string,
): Promise<void> => {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("support_reports")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error) {
    console.error(`${LOG_PREFIX} failed to check rate limit`, {
      appUserId: userId,
      error: error.message,
    });
    fail(500, "SUPPORT_RATE_LIMIT_FAILED", "Failed to check report limit.");
  }

  if ((count ?? 0) >= REPORTS_PER_HOUR_LIMIT) {
    fail(
      429,
      "SUPPORT_REPORT_RATE_LIMITED",
      "Слишком много отчетов за последний час. Попробуй позже.",
    );
  }
};

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) {
    return corsResponse;
  }

  const requestId = getRequestId(req);

  try {
    assertPostRequest(req);

    const env = getRequiredEnv([
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "TELEGRAM_BOT_TOKEN",
    ]);
    const body = await parseJsonBody<SupportReportBody>(req);
    const tgUser = await getTelegramUserFromBody(
      body,
      env.TELEGRAM_BOT_TOKEN,
    );
    const comment =
      typeof body.comment === "string" ? body.comment.trim() : "";
    if (!comment) {
      fail(400, "SUPPORT_COMMENT_REQUIRED", "Report comment is required.");
    }

    const currentScreen =
      typeof body.currentScreen === "string" && body.currentScreen.trim()
        ? body.currentScreen.trim().slice(0, 80)
        : "unknown";

    const supabase = createServiceClient(env);
    const appUser = await getAppUser(supabase, tgUser.id);
    await assertReportRateLimit(supabase, appUser.id);

    const preparedReport = trimReportToBudget({
      currentScreen,
      userComment: comment.slice(0, MAX_COMMENT_LENGTH),
      appContext: sanitizeObject(body.appContext),
      events: sanitizeArray(body.events, MAX_EVENTS),
      requestIds: normalizeRequestIds(body.requestIds),
      aiDiagnostics: sanitizeArray(body.aiDiagnostics, MAX_AI_DIAGNOSTICS),
    });

    const { data: insertedReport, error: insertError } = await supabase
      .from("support_reports")
      .insert({
        user_id: appUser.id,
        telegram_user_id: appUser.telegram_user_id,
        app_role: appUser.app_role,
        current_screen: preparedReport.currentScreen,
        user_comment: preparedReport.userComment,
        app_context: preparedReport.appContext,
        events: preparedReport.events,
        request_ids: preparedReport.requestIds,
        ai_diagnostics: preparedReport.aiDiagnostics,
      })
      .select("id, created_at")
      .single();

    if (insertError) {
      console.error(`${LOG_PREFIX} failed to insert report`, {
        requestId,
        appUserId: appUser.id,
        error: insertError.message,
      });
      fail(500, "SUPPORT_REPORT_SAVE_FAILED", "Failed to save support report.");
    }

    console.info(`${LOG_PREFIX} report saved`, {
      requestId,
      appUserId: appUser.id,
      reportId: insertedReport.id,
      eventsCount: preparedReport.events.length,
      requestIdsCount: preparedReport.requestIds.length,
    });

    return successResponse(
      200,
      {
        reportId: insertedReport.id,
        createdAt: insertedReport.created_at,
      },
      requestId,
    );
  } catch (error) {
    if (error instanceof AppError) {
      console.error(`${LOG_PREFIX} request failed`, {
        requestId,
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return errorResponse(error.status, error.code, error.message, requestId);
    }

    const message =
      error instanceof Error ? error.message : "Unknown support report error.";
    console.error(`${LOG_PREFIX} failed`, { requestId, message });
    return errorResponse(
      500,
      "SUPPORT_REPORT_FAILED",
      DEFAULT_INTERNAL_ERROR_MESSAGE,
      requestId,
    );
  }
});
