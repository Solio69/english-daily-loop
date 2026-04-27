// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type TelegramUser = {
  id: number;
};

type UserRow = {
  id: string;
};

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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;
const DEFAULT_PAGE_LIMIT = 10;
const MAX_PAGE_LIMIT = 30;
const textEncoder = new TextEncoder();

class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const fail = (status: number, code: string, message: string): never => {
  throw new AppError(status, code, message);
};

const jsonResponse = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

const successResponse = (status: number, data: unknown): Response =>
  jsonResponse(status, { ok: true, data });

const errorResponse = (
  status: number,
  code: string,
  message: string,
): Response => jsonResponse(status, { ok: false, error: { code, message } });

const toBufferSource = (value: Uint8Array): BufferSource => {
  const view = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return view as BufferSource;
};

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
};

const hmacSha256 = async (
  key: Uint8Array,
  data: string,
): Promise<Uint8Array> => {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toBufferSource(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    toBufferSource(textEncoder.encode(data)),
  );

  return new Uint8Array(signature);
};

const buildDataCheckString = (params: URLSearchParams): string => {
  const pairs: string[] = [];

  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    pairs.push(`${key}=${value}`);
  }

  pairs.sort((a, b) => a.localeCompare(b));
  return pairs.join("\n");
};

const validateTelegramInitData = async (
  rawInitData: string,
  botToken: string,
): Promise<TelegramUser> => {
  const params = new URLSearchParams(rawInitData);
  const userRaw = params.get("user");
  const receivedHash = params.get("hash");
  const authDateRaw = params.get("auth_date");

  if (!userRaw || !receivedHash || !authDateRaw) {
    fail(401, "AUTH_VALIDATION_FAILED", "Telegram initData is incomplete.");
  }

  const authDate = Number(authDateRaw);
  if (!Number.isFinite(authDate)) {
    fail(401, "AUTH_VALIDATION_FAILED", "Telegram auth_date is invalid.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > MAX_AUTH_AGE_SECONDS) {
    fail(
      401,
      "AUTH_VALIDATION_FAILED",
      "Telegram initData is too old. Reopen the Mini App.",
    );
  }

  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw) as TelegramUser;
  } catch {
    fail(401, "AUTH_VALIDATION_FAILED", "Telegram user payload is invalid.");
  }

  if (!user.id) {
    fail(401, "AUTH_VALIDATION_FAILED", "Telegram user id is missing.");
  }

  const dataCheckString = buildDataCheckString(params);
  const secretKey = await hmacSha256(
    textEncoder.encode("WebAppData"),
    botToken,
  );
  const expectedHash = toHex(await hmacSha256(secretKey, dataCheckString));

  if (!timingSafeEqual(expectedHash, receivedHash.toLowerCase())) {
    fail(401, "AUTH_VALIDATION_FAILED", "Telegram initData signature is not valid.");
  }

  return user;
};

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
    fail(400, "INVALID_CURSOR", "History cursor must be a string.");
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Method Not Allowed");
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim();

    if (!supabaseUrl || !serviceRoleKey || !botToken) {
      return errorResponse(
        500,
        "SERVER_ENV_MISCONFIGURED",
        "Server env vars are not configured.",
      );
    }

    let body: { initData?: unknown; limit?: unknown; cursor?: unknown };
    try {
      body = (await req.json()) as {
        initData?: unknown;
        limit?: unknown;
        cursor?: unknown;
      };
    } catch {
      fail(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    const initData =
      typeof body?.initData === "string" ? body.initData.trim() : "";
    if (!initData) {
      fail(400, "INIT_DATA_REQUIRED", "initData is required.");
    }

    const limit = clampPageLimit(body?.limit);
    const cursor = parseCursor(body?.cursor);
    const tgUser = await validateTelegramInitData(initData, botToken);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_user_id", tgUser.id)
      .maybeSingle();

    if (userError) {
      console.error("[get-reading-history] failed to load user", {
        telegramUserId: tgUser.id,
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

    const appUser = userRow as UserRow;
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
    return errorResponse(500, "READING_HISTORY_FAILED", message);
  }
});
