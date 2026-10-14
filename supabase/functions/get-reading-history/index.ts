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
  parseJsonObjectBody,
  successResponse,
} from "../_shared/server.ts";
import { createServiceClient, getAppUserByTelegramId } from "../_shared/app.ts";

type CompletedReadingTextRow = {
  id: string;
  completed_date: string;
  completed_at: string;
  title: string;
  body: string;
  level: string;
  estimated_minutes: number;
  provider: string;
  model: string;
  fallback_used: boolean;
};

type ReadingHistoryCursor = {
  completedAt: string;
  id: string;
};

const DEFAULT_PAGE_LIMIT = 10;
const MAX_PAGE_LIMIT = 30;

const clampPageLimit = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_PAGE_LIMIT;

  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_PAGE_LIMIT);
};

const encodeCursor = (item: CompletedReadingTextRow): string =>
  `${item.completed_at}|${item.id}`;

const parseCursor = (cursor: unknown): ReadingHistoryCursor | null => {
  if (cursor === null || cursor === undefined || cursor === "") {
    return null;
  }

  if (typeof cursor !== "string") {
    return fail(400, "INVALID_CURSOR", "History cursor must be a string.");
  }

  const [completedAt, id, ...extra] = cursor.split("|");
  if (!completedAt || !id || extra.length > 0) {
    fail(400, "INVALID_CURSOR", "History cursor is invalid.");
  }

  if (Number.isNaN(Date.parse(completedAt))) {
    fail(400, "INVALID_CURSOR", "History cursor date is invalid.");
  }

  return { completedAt, id };
};

const toHistoryItem = (row: CompletedReadingTextRow) => ({
  id: row.id,
  completedDate: row.completed_date,
  completedAt: row.completed_at,
  title: row.title,
  body: row.body,
  level: row.level,
  estimatedMinutes: row.estimated_minutes,
  generation: {
    provider: row.provider,
    model: row.model,
    fallbackUsed: row.fallback_used,
  },
});

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

    const body = await parseJsonObjectBody(req);

    const limit = clampPageLimit(body?.limit);
    const cursor = parseCursor(body?.cursor);
    const tgUser = await getTelegramUserFromBody(
      body,
      env.TELEGRAM_BOT_TOKEN,
    );

    const supabase = createServiceClient(env);

    const appUser = await getAppUserByTelegramId(
      supabase,
      tgUser.id,
      "[get-reading-history]",
      requestId,
    );
    let query = supabase
      .from("user_completed_reading_texts")
      .select(
        "id, completed_date, completed_at, title, body, level, estimated_minutes, provider, model, fallback_used",
      )
      .eq("user_id", appUser.id)
      .order("completed_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.or(
        `completed_at.lt.${cursor.completedAt},and(completed_at.eq.${cursor.completedAt},id.lt.${cursor.id})`,
      );
    }

    const { data: rows, error: historyError } = await query;

    if (historyError) {
      console.error("[get-reading-history] failed to load history", {
        appUserId: appUser.id,
        error: historyError.message,
      });
      fail(500, "READING_HISTORY_LOAD_FAILED", "Failed to load reading history.");
    }

    const historyRows = (rows ?? []) as CompletedReadingTextRow[];
    const visibleRows = historyRows.slice(0, limit);
    const hasNextPage = historyRows.length > limit;
    const nextCursor =
      hasNextPage && visibleRows.length > 0
        ? encodeCursor(visibleRows[visibleRows.length - 1])
        : null;

    return successResponse(200, {
      items: visibleRows.map(toHistoryItem),
      nextCursor,
    });
  } catch (error) {
    if (error instanceof AppError) {
      console.error("[get-reading-history] request failed", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return errorResponse(error.status, error.code, error.message);
    }

    const message =
      error instanceof Error ? error.message : "Unknown reading history error.";
    console.error("[get-reading-history] failed", { message });
    return errorResponse(
      500,
      "READING_HISTORY_FAILED",
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    );
  }
});
