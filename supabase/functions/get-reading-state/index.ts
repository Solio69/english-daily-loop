// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type TelegramUser = {
  id: number;
};

type UserRow = {
  id: string;
  telegram_user_id: number;
};

type ActiveReadingTextRow = {
  user_id: string;
  title: string;
  body: string;
  level: string;
  estimated_minutes: number;
  provider: string;
  model: string;
  fallback_used: boolean;
  generated_at: string;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;
const FREE_DAILY_GENERATION_LIMIT = 3;
const PAID_DAILY_GENERATION_LIMIT = 10;
const MOSCOW_TIME_ZONE = "Europe/Moscow";
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

const getMoscowDate = (): string => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: MOSCOW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
};

const getDailyGenerationLimit = async (
  supabase: ReturnType<typeof createClient>,
  user: UserRow,
): Promise<number> => {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso)
    .limit(1);

  if (error) {
    console.error("[get-reading-state] failed to load subscription", {
      appUserId: user.id,
      error: error.message,
    });
    fail(500, "SUBSCRIPTION_LOAD_FAILED", "Failed to load subscription.");
  }

  return (data ?? []).length > 0
    ? PAID_DAILY_GENERATION_LIMIT
    : FREE_DAILY_GENERATION_LIMIT;
};

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

    let body: { initData?: unknown };
    try {
      body = (await req.json()) as { initData?: unknown };
    } catch {
      fail(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    const initData =
      typeof body?.initData === "string" ? body.initData.trim() : "";
    if (!initData) {
      fail(400, "INIT_DATA_REQUIRED", "initData is required.");
    }

    const tgUser = await validateTelegramInitData(initData, botToken);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id, telegram_user_id")
      .eq("telegram_user_id", tgUser.id)
      .maybeSingle();

    if (userError) {
      console.error("[get-reading-state] failed to load user", {
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
    const today = getMoscowDate();
    const dailyLimit = await getDailyGenerationLimit(supabase, appUser);

    const [
      { count: attemptsCount, error: attemptsError },
      { data: completionRow, error: completionError },
      { data: activeTextRow, error: activeTextError },
    ] = await Promise.all([
      supabase
        .from("reading_generation_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", appUser.id)
        .eq("attempt_date", today),
      supabase
        .from("user_daily_reading_completions")
        .select("id")
        .eq("user_id", appUser.id)
        .eq("completed_date", today)
        .maybeSingle(),
      supabase
        .from("user_active_reading_texts")
        .select(
          "user_id, title, body, level, estimated_minutes, provider, model, fallback_used, generated_at",
        )
        .eq("user_id", appUser.id)
        .maybeSingle(),
    ]);

    if (attemptsError) {
      console.error("[get-reading-state] failed to count attempts", {
        appUserId: appUser.id,
        error: attemptsError.message,
      });
      fail(500, "ATTEMPTS_LOAD_FAILED", "Failed to load generation attempts.");
    }

    if (completionError) {
      console.error("[get-reading-state] failed to load completion", {
        appUserId: appUser.id,
        error: completionError.message,
      });
      fail(500, "COMPLETION_LOAD_FAILED", "Failed to load reading completion.");
    }

    if (activeTextError) {
      console.error("[get-reading-state] failed to load active text", {
        appUserId: appUser.id,
        error: activeTextError.message,
      });
      fail(500, "ACTIVE_TEXT_LOAD_FAILED", "Failed to load active reading text.");
    }

    const usedAttempts = attemptsCount ?? 0;
    const activeText = activeTextRow
      ? {
          id: `active-${(activeTextRow as ActiveReadingTextRow).user_id}`,
          title: (activeTextRow as ActiveReadingTextRow).title,
          body: (activeTextRow as ActiveReadingTextRow).body,
          level: (activeTextRow as ActiveReadingTextRow).level,
          estimatedMinutes: (activeTextRow as ActiveReadingTextRow)
            .estimated_minutes,
          source: "ai",
          generation: {
            provider: (activeTextRow as ActiveReadingTextRow).provider,
            model: (activeTextRow as ActiveReadingTextRow).model,
            fallbackUsed: (activeTextRow as ActiveReadingTextRow).fallback_used,
          },
        }
      : null;

    return successResponse(200, {
      today,
      dailyLimit,
      usedAttempts,
      remainingAttempts: Math.max(dailyLimit - usedAttempts, 0),
      isReadingCompletedToday: Boolean(completionRow),
      activeText,
    });
  } catch (error) {
    if (error instanceof AppError) {
      console.error("[get-reading-state] request failed", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return errorResponse(error.status, error.code, error.message);
    }

    const message =
      error instanceof Error ? error.message : "Unknown reading state error.";
    console.error("[get-reading-state] failed", { message });
    return errorResponse(500, "READING_STATE_FAILED", message);
  }
});
