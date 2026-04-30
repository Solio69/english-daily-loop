// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type DevToolAction =
  | "reset_generation_attempts"
  | "delete_today_reading_completion"
  | "reset_subscriptions";

type TelegramUser = {
  id: number;
};

type UserRow = {
  id: string;
  telegram_user_id: number;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const INTERNAL_ERROR_MESSAGE =
  "Внутренняя ошибка сервера. Попробуй еще раз позже.";
const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;
const MOSCOW_TIME_ZONE = "Europe/Moscow";
const textEncoder = new TextEncoder();

// TODO: Local dev-only Edge Function; keep server env gate mandatory before DB mutations.
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

const parseAction = (value: unknown): DevToolAction => {
  if (
    value === "reset_generation_attempts" ||
    value === "delete_today_reading_completion" ||
    value === "reset_subscriptions"
  ) {
    return value;
  }

  fail(400, "INVALID_DEV_TOOL_ACTION", "Dev tool action is invalid.");
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

const toBufferSource = (value: Uint8Array): BufferSource => {
  const view = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return view as BufferSource;
};

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((item) => item.toString(16).padStart(2, "0"))
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
    fail(
      401,
      "AUTH_VALIDATION_FAILED",
      "Telegram initData signature is not valid.",
    );
  }

  return user;
};

const getAppUser = async (
  supabase: ReturnType<typeof createClient>,
  telegramUserId: number,
): Promise<UserRow> => {
  const { data, error } = await supabase
    .from("users")
    .select("id, telegram_user_id")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();

  if (error) {
    console.error("[dev-tools] failed to load user", {
      telegramUserId,
      error: error.message,
    });
    fail(500, "USER_FIND_FAILED", "Failed to load user profile.");
  }

  if (!data) {
    fail(
      404,
      "USER_NOT_FOUND",
      "User profile was not found. Complete Telegram auth first.",
    );
  }

  return data as UserRow;
};

const resetGenerationAttempts = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  today: string,
) => {
  const { count, error } = await supabase
    .from("reading_generation_attempts")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("attempt_date", today);

  if (error) {
    console.error("[dev-tools] failed to reset generation attempts", {
      userId,
      today,
      error: error.message,
    });
    fail(500, "DEV_TOOL_ACTION_FAILED", "Failed to reset generation attempts.");
  }

  return { generationAttempts: count ?? 0 };
};

const deleteTodayReadingCompletion = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  today: string,
) => {
  const { count: completedTextsCount, error: completedTextsError } =
    await supabase
      .from("user_completed_reading_texts")
      .delete({ count: "exact" })
      .eq("user_id", userId)
      .eq("completed_date", today);

  if (completedTextsError) {
    console.error("[dev-tools] failed to delete completed reading texts", {
      userId,
      today,
      error: completedTextsError.message,
    });
    fail(500, "DEV_TOOL_ACTION_FAILED", "Failed to delete completed texts.");
  }

  const { count: completionsCount, error: completionsError } = await supabase
    .from("user_daily_reading_completions")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("completed_date", today);

  if (completionsError) {
    console.error("[dev-tools] failed to delete daily reading completion", {
      userId,
      today,
      error: completionsError.message,
    });
    fail(500, "DEV_TOOL_ACTION_FAILED", "Failed to delete reading completion.");
  }

  return {
    dailyReadingCompletions: completionsCount ?? 0,
    completedReadingTexts: completedTextsCount ?? 0,
  };
};

const resetSubscriptions = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
) => {
  const { count, error } = await supabase
    .from("user_subscriptions")
    .delete({ count: "exact" })
    .eq("user_id", userId);

  if (error) {
    console.error("[dev-tools] failed to reset subscriptions", {
      userId,
      error: error.message,
    });
    fail(500, "DEV_TOOL_ACTION_FAILED", "Failed to reset subscriptions.");
  }

  return { subscriptions: count ?? 0 };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Method Not Allowed");
  }

  try {
    const devToolsEnabled =
      Deno.env.get("DEV_TOOLS_ENABLED")?.trim() === "true";
    if (!devToolsEnabled) {
      fail(403, "DEV_TOOLS_DISABLED", "Dev tools are disabled.");
    }

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

    let body: { initData?: unknown; action?: unknown };
    try {
      body = (await req.json()) as { initData?: unknown; action?: unknown };
    } catch {
      fail(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    const initData =
      typeof body?.initData === "string" ? body.initData.trim() : "";
    if (!initData) {
      fail(400, "INIT_DATA_REQUIRED", "initData is required.");
    }

    const action = parseAction(body?.action);
    const tgUser = await validateTelegramInitData(initData, botToken);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const appUser = await getAppUser(supabase, tgUser.id);
    const today = getMoscowDate();

    const deleted =
      action === "reset_generation_attempts"
        ? await resetGenerationAttempts(supabase, appUser.id, today)
        : action === "delete_today_reading_completion"
          ? await deleteTodayReadingCompletion(supabase, appUser.id, today)
          : await resetSubscriptions(supabase, appUser.id);

    return successResponse(200, {
      action,
      today,
      deleted,
    });
  } catch (error) {
    if (error instanceof AppError) {
      console.error("[dev-tools] request failed", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return errorResponse(error.status, error.code, error.message);
    }

    const message =
      error instanceof Error ? error.message : "Unknown dev tools error.";
    console.error("[dev-tools] failed", { message });
    return errorResponse(500, "DEV_TOOLS_FAILED", INTERNAL_ERROR_MESSAGE);
  }
});
