// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type EnglishLevel = "A1" | "A2" | "B1" | "B2";
type DailyReadingMinutes = 3 | 5 | 10 | 15;

type TelegramUser = {
  id: number;
};

type UserRow = {
  id: string;
  telegram_user_id: number;
  first_name: string | null;
  settings_completed_at: string | null;
  first_text_completed_at: string | null;
};

type UserSettingsRow = {
  english_level: EnglishLevel;
  daily_exercise_minutes: number;
  daily_reading_minutes: DailyReadingMinutes;
};

type SubscriptionRow = {
  id: string;
  plan_type: "monthly" | "yearly";
  starts_at: string;
  ends_at: string;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;
const MOSCOW_TIME_ZONE = "Europe/Moscow";
const DEV_TELEGRAM_USER_ID = 999000001;
const FREE_LIMITS = {
  dailyReadingGenerations: 3,
  vocabularyWordsLimit: 30,
};
const PAID_LIMITS = {
  dailyReadingGenerations: 10,
  vocabularyWordsLimit: 300,
};
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

const parseEnglishLevel = (value: unknown): EnglishLevel => {
  if (value === "A1" || value === "A2" || value === "B1" || value === "B2") {
    return value;
  }

  fail(400, "INVALID_SETTINGS", "English level is invalid.");
};

const parseDailyExerciseMinutes = (value: unknown): number => {
  if (Number.isInteger(value) && value >= 5 && value <= 60) {
    return value;
  }

  fail(400, "INVALID_SETTINGS", "Daily exercise minutes value is invalid.");
};

const parseDailyReadingMinutes = (value: unknown): DailyReadingMinutes => {
  if (value === 3 || value === 5 || value === 10 || value === 15) {
    return value;
  }

  fail(400, "INVALID_SETTINGS", "Daily reading minutes value is invalid.");
};

const mapSubscription = (row: SubscriptionRow | null) =>
  row
    ? {
        id: row.id,
        planType: row.plan_type,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
      }
    : null;

const mapSettings = (row: UserSettingsRow) => ({
  englishLevel: row.english_level,
  dailyExerciseMinutes: row.daily_exercise_minutes,
  dailyReadingMinutes: row.daily_reading_minutes,
});

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

const getTelegramUserId = async (
  body: { initData?: unknown; devTelegramUserId?: unknown },
  botToken: string,
): Promise<number> => {
  const initData =
    typeof body?.initData === "string" ? body.initData.trim() : "";

  if (initData) {
    const tgUser = await validateTelegramInitData(initData, botToken);
    return tgUser.id;
  }

  const isDevFallbackEnabled =
    Deno.env.get("VITE_ENABLE_DEV_AUTH_FALLBACK")?.trim() === "true";

  if (!isDevFallbackEnabled) {
    fail(
      400,
      "INIT_DATA_REQUIRED",
      "initData is required. Open the app inside Telegram.",
    );
  }

  const configuredDevTelegramUserId = Number(
    Deno.env.get("VITE_DEV_TELEGRAM_USER_ID")?.trim() || DEV_TELEGRAM_USER_ID,
  );
  const requestedDevTelegramUserId =
    typeof body?.devTelegramUserId === "number"
      ? body.devTelegramUserId
      : configuredDevTelegramUserId;

  if (
    !Number.isSafeInteger(requestedDevTelegramUserId) ||
    requestedDevTelegramUserId !== configuredDevTelegramUserId
  ) {
    fail(403, "DEV_AUTH_FORBIDDEN", "Dev auth fallback is not allowed.");
  }

  return requestedDevTelegramUserId;
};

const getSubscriptionSummary = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
) => {
  const nowIso = new Date().toISOString();
  const [
    { data: activeRows, error: activeError },
    { data: scheduledRows, error: scheduledError },
  ] = await Promise.all([
    supabase
      .from("user_subscriptions")
      .select("id, plan_type, starts_at, ends_at")
      .eq("user_id", userId)
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso)
      .order("ends_at", { ascending: false })
      .limit(1),
    supabase
      .from("user_subscriptions")
      .select("id, plan_type, starts_at, ends_at")
      .eq("user_id", userId)
      .gt("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(1),
  ]);

  if (activeError || scheduledError) {
    console.error("[save-user-settings] failed to load subscription", {
      appUserId: userId,
      activeError: activeError?.message,
      scheduledError: scheduledError?.message,
    });
    fail(500, "SUBSCRIPTION_LOAD_FAILED", "Failed to load subscription.");
  }

  const activeSubscription = ((activeRows ?? [])[0] ??
    null) as SubscriptionRow | null;
  const scheduledSubscription = ((scheduledRows ?? [])[0] ??
    null) as SubscriptionRow | null;

  return {
    tier: activeSubscription ? "paid" : "free",
    limits: activeSubscription ? PAID_LIMITS : FREE_LIMITS,
    activeSubscription: mapSubscription(activeSubscription),
    scheduledSubscription: mapSubscription(scheduledSubscription),
  };
};

const getHomeProgress = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
) => {
  const today = getMoscowDate();
  const [
    { data: completionRows, error: completionError },
    { data: activeTextRow, error: activeTextError },
  ] = await Promise.all([
    supabase
      .from("user_daily_reading_completions")
      .select("user_id")
      .eq("user_id", userId)
      .eq("completed_date", today)
      .limit(1),
    supabase
      .from("user_active_reading_texts")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (completionError || activeTextError) {
    console.error("[save-user-settings] failed to load home progress", {
      appUserId: userId,
      completionError: completionError?.message,
      activeTextError: activeTextError?.message,
    });
    fail(500, "HOME_PROGRESS_LOAD_FAILED", "Failed to load home progress.");
  }

  const readingStatus =
    (completionRows?.length ?? 0) > 0
      ? "completed"
      : activeTextRow
        ? "in_progress"
        : "not_started";

  return {
    lesson: {
      status: readingStatus,
      currentStep: readingStatus === "completed" ? null : "reading",
    },
    reading: {
      status: readingStatus,
    },
  };
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

    let body: {
      initData?: unknown;
      devTelegramUserId?: unknown;
      settings?: {
        englishLevel?: unknown;
        dailyExerciseMinutes?: unknown;
        dailyReadingMinutes?: unknown;
      };
    };

    try {
      body = (await req.json()) as typeof body;
    } catch {
      fail(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    const settings = body?.settings;
    if (!settings || typeof settings !== "object") {
      fail(400, "INVALID_SETTINGS", "Settings payload is required.");
    }

    const englishLevel = parseEnglishLevel(settings.englishLevel);
    const dailyExerciseMinutes = parseDailyExerciseMinutes(
      settings.dailyExerciseMinutes,
    );
    const dailyReadingMinutes = parseDailyReadingMinutes(
      settings.dailyReadingMinutes,
    );
    const telegramUserId = await getTelegramUserId(body, botToken);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select(
        "id, telegram_user_id, first_name, settings_completed_at, first_text_completed_at",
      )
      .eq("telegram_user_id", telegramUserId)
      .maybeSingle();

    if (userError) {
      console.error("[save-user-settings] failed to load user", {
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

    const appUser = userRow as UserRow;
    const { data: settingsRow, error: upsertError } = await supabase
      .from("user_settings")
      .upsert(
        {
          user_id: appUser.id,
          english_level: englishLevel,
          daily_exercise_minutes: dailyExerciseMinutes,
          daily_reading_minutes: dailyReadingMinutes,
        },
        { onConflict: "user_id" },
      )
      .select(
        "english_level, daily_exercise_minutes, daily_reading_minutes",
      )
      .single();

    if (upsertError || !settingsRow) {
      console.error("[save-user-settings] failed to upsert settings", {
        appUserId: appUser.id,
        error: upsertError?.message,
      });
      fail(500, "SETTINGS_SAVE_FAILED", "Failed to save user settings.");
    }

    const nowIso = new Date().toISOString();
    const { data: updatedUser, error: updateUserError } = await supabase
      .from("users")
      .update({ settings_completed_at: nowIso })
      .eq("id", appUser.id)
      .is("settings_completed_at", null)
      .select(
        "id, telegram_user_id, first_name, settings_completed_at, first_text_completed_at",
      )
      .maybeSingle();

    if (updateUserError) {
      console.error("[save-user-settings] failed to update onboarding status", {
        appUserId: appUser.id,
        error: updateUserError.message,
      });
      fail(500, "ONBOARDING_STATUS_UPDATE_FAILED", "Failed to update onboarding status.");
    }

    const user = (updatedUser as UserRow | null) ?? appUser;
    const [subscription, homeProgress] = await Promise.all([
      getSubscriptionSummary(supabase, appUser.id),
      getHomeProgress(supabase, appUser.id),
    ]);

    return successResponse(200, {
      user: {
        id: user.id,
        telegramUserId: user.telegram_user_id,
        firstName: user.first_name,
        settingsCompletedAt: user.settings_completed_at ?? nowIso,
        firstTextCompletedAt: user.first_text_completed_at,
      },
      settings: mapSettings(settingsRow as UserSettingsRow),
      subscription,
      homeProgress,
    });
  } catch (error) {
    if (error instanceof AppError) {
      console.error("[save-user-settings] request failed", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return errorResponse(error.status, error.code, error.message);
    }

    const message =
      error instanceof Error ? error.message : "Unknown settings save error.";
    console.error("[save-user-settings] failed", { message });
    return errorResponse(500, "SETTINGS_SAVE_FAILED", message);
  }
});
