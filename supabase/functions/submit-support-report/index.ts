import {
  AppError,
  DEFAULT_INTERNAL_ERROR_MESSAGE,
  assertPostRequest,
  errorResponse,
  fail,
  getRequiredEnv,
  getRequestId,
  getSafeErrorDetails,
  getTelegramUserFromBody,
  handleCorsPreflight,
  parseJsonBody,
  successResponse,
} from "../_shared/server.ts";
import {
  createServiceClient,
  type ServiceClient,
} from "../_shared/app.ts";
import {
  prepareSupportReport,
} from "./sanitize-diagnostics.ts";

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
  app_role: "admin" | "tester" | "user";
};

const LOG_PREFIX = "[submit-support-report]";
const REPORTS_PER_HOUR_LIMIT = 5;

const getAppUser = async (
  supabase: ServiceClient,
  telegramUserId: number,
  requestId: string,
): Promise<AppUserRow> => {
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id, app_role")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();

  if (userError) {
    console.error(`${LOG_PREFIX} failed to load user`, {
      requestId,
      stage: "user_lookup",
      ...getSafeErrorDetails(userError, [telegramUserId]),
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

    const supabase = createServiceClient(env);
    const appUser = await getAppUser(supabase, tgUser.id, requestId);
    await assertReportRateLimit(supabase, appUser.id);
    const preparedReport = prepareSupportReport({
      currentScreen: body.currentScreen,
      userComment: comment,
      appContext: body.appContext,
      events: body.events,
      requestIds: body.requestIds,
      aiDiagnostics: body.aiDiagnostics,
      telegramUserId: tgUser.id,
    });

    const { data: insertedReport, error: insertError } = await supabase
      .from("support_reports")
      .insert({
        user_id: appUser.id,
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
