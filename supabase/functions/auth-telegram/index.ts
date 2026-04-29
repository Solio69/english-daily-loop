// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";


type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

type UserRow = {
  id: string;
  telegram_user_id: number;
  first_name: string | null;
  settings_completed_at: string | null;
  first_text_completed_at: string | null;
};

type UserSettingsRow = {
  english_level: "A1" | "A2" | "B1" | "B2";
  daily_exercise_minutes: number;
  daily_reading_minutes: number;
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

const parseDateToUtc = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const formatUtcDate = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getPreviousDate = (value: string): string => {
  const date = parseDateToUtc(value);
  date.setUTCDate(date.getUTCDate() - 1);
  return formatUtcDate(date);
};

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

const parseInitData = (
  rawInitData: string,
): { params: URLSearchParams; user: TelegramUser } => {
  const params = new URLSearchParams(rawInitData);
  const userRaw = params.get("user");

  if (!userRaw) {
    fail(401, "AUTH_VALIDATION_FAILED", "Отсутствует поле user в initData.");
  }

  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw) as TelegramUser;
  } catch {
    fail(401, "AUTH_VALIDATION_FAILED", "Некорректный формат user в initData.");
  }

  if (!user.id) {
    fail(401, "AUTH_VALIDATION_FAILED", "В initData отсутствует telegram user id.");
  }

  return { params, user };
};

const validateTelegramInitData = async (
  rawInitData: string,
  botToken: string,
): Promise<TelegramUser> => {
  const { params, user } = parseInitData(rawInitData);

  const receivedHash = params.get("hash");
  if (!receivedHash) {
    fail(401, "AUTH_VALIDATION_FAILED", "Отсутствует hash в initData.");
  }

  const authDateRaw = params.get("auth_date");
  if (!authDateRaw) {
    fail(401, "AUTH_VALIDATION_FAILED", "Отсутствует auth_date в initData.");
  }

  const authDate = Number(authDateRaw);
  if (!Number.isFinite(authDate)) {
    fail(401, "AUTH_VALIDATION_FAILED", "Некорректный auth_date в initData.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > MAX_AUTH_AGE_SECONDS) {
    fail(
      401,
      "AUTH_VALIDATION_FAILED",
      "Данные Telegram устарели. Открой мини-приложение снова.",
    );
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
      "Не удалось подтвердить подпись Telegram initData.",
    );
  }

  return user;
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

const mapSubscription = (row: SubscriptionRow | null) =>
  row
    ? {
        id: row.id,
        planType: row.plan_type,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
      }
    : null;

const mapSettings = (row: UserSettingsRow | null) =>
  row
    ? {
        englishLevel: row.english_level,
        dailyExerciseMinutes: row.daily_exercise_minutes,
        dailyReadingMinutes: row.daily_reading_minutes,
      }
    : null;

const getTelegramUserFromRequest = async (
  body: { initData?: unknown },
  botToken: string,
): Promise<TelegramUser> => {
  const initData =
    typeof body?.initData === "string" ? body.initData.trim() : "";

  if (!initData) {
    fail(400, "INIT_DATA_REQUIRED", "initData is required.");
  }

  return validateTelegramInitData(initData, botToken);
};

const getUserSettings = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
) => {
  const { data, error } = await supabase
    .from("user_settings")
    .select(
      "english_level, daily_exercise_minutes, daily_reading_minutes",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[auth-telegram] failed to load user settings", {
      appUserId: userId,
      error: error.message,
    });
    fail(500, "SETTINGS_LOAD_FAILED", "Failed to load user settings.");
  }

  return mapSettings((data as UserSettingsRow | null) ?? null);
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
    console.error("[auth-telegram] failed to load subscription", {
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
    console.error("[auth-telegram] failed to load home progress", {
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
  const lessonStatus = readingStatus;
  const lessonCurrentStep = readingStatus === "completed" ? null : "reading";

  return {
    lesson: {
      status: lessonStatus,
      currentStep: lessonCurrentStep,
    },
    reading: {
      status: readingStatus,
    },
  };
};

const getReadingCompletionStreak = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
) => {
  const today = getMoscowDate();
  const { data: completionRows, error: completionError } = await supabase
    .from("user_daily_reading_completions")
    .select("completed_date")
    .eq("user_id", userId)
    .lte("completed_date", today)
    .order("completed_date", { ascending: false });

  if (completionError) {
    console.error("[auth-telegram] failed to load streak", {
      appUserId: userId,
      completionError: completionError.message,
    });
    fail(500, "STREAK_LOAD_FAILED", "Failed to load streak.");
  }

  let streakDays = 0;
  let expectedDate = today;

  for (const row of completionRows ?? []) {
    if (row.completed_date !== expectedDate) {
      if (streakDays === 0) {
        break;
      }

      break;
    }

    streakDays += 1;
    expectedDate = getPreviousDate(expectedDate);
  }

  return streakDays;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Method Not Allowed");
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");

    if (!supabaseUrl || !serviceRoleKey || !botToken) {
      fail(
        500,
        "SERVER_ENV_MISCONFIGURED",
        "Server auth env vars are not configured.",
      );
    }

    let body: {
      initData?: unknown;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      fail(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const initData =
      typeof body?.initData === "string" ? body.initData.trim() : "";
    console.log("[auth-telegram] incoming request", {
      hasInitData: Boolean(initData),
      initDataLength: initData?.length ?? 0,
    });

    const tgUser = await getTelegramUserFromRequest(body, botToken);
    console.log("[auth-telegram] initData validated", {
      telegramUserId: tgUser.id,
    });

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: existingUser, error: findError } = await supabase
      .from("users")
      .select(
        "id, telegram_user_id, first_name, settings_completed_at, first_text_completed_at",
      )
      .eq("telegram_user_id", tgUser.id)
      .maybeSingle();

    if (findError) {
      console.error("find user error", findError);
      fail(500, "USER_FIND_FAILED", "Failed to find user.");
    }

    let appUser: UserRow | null = (existingUser as UserRow | null) ?? null;

    if (!appUser) {
      const { data: createdUser, error: createError } = await supabase
        .from("users")
        .upsert(
          {
            telegram_user_id: tgUser.id,
            username: tgUser.username ?? null,
            first_name: tgUser.first_name ?? null,
            last_name: tgUser.last_name ?? null,
            language_code: tgUser.language_code ?? null,
            is_active: true,
          },
          { onConflict: "telegram_user_id" },
        )
        .select(
          "id, telegram_user_id, first_name, settings_completed_at, first_text_completed_at",
        )
        .single();

      if (createError || !createdUser) {
        console.error("create user error", createError);
        fail(500, "USER_CREATE_FAILED", "Failed to create user.");
      }

      appUser = createdUser as UserRow;
      console.log("[auth-telegram] user created", {
        appUserId: appUser.id,
        telegramUserId: appUser.telegram_user_id,
      });
    } else {
      console.log("[auth-telegram] existing user found", {
        appUserId: appUser.id,
        telegramUserId: appUser.telegram_user_id,
      });
    }

    const [settings, subscription, homeProgress, streakDays] = await Promise.all([
      getUserSettings(supabase, appUser.id),
      getSubscriptionSummary(supabase, appUser.id),
      getHomeProgress(supabase, appUser.id),
      getReadingCompletionStreak(supabase, appUser.id),
    ]);

    return successResponse(200, {
      user: {
        id: appUser.id,
        telegramUserId: appUser.telegram_user_id,
        firstName: appUser.first_name,
        settingsCompletedAt: appUser.settings_completed_at,
        firstTextCompletedAt: appUser.first_text_completed_at,
      },
      settings,
      subscription,
      homeProgress,
      streakDays,
    });
  } catch (error) {
    if (error instanceof AppError) {
      console.error("[auth-telegram] request failed", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return errorResponse(error.status, error.code, error.message);
    }

    const message =
      error instanceof Error ? error.message : "Unknown auth error.";
    console.error("[auth-telegram] auth failed", { message });
    return errorResponse(500, "AUTH_TELEGRAM_FAILED", message);
  }
});

