// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import {
  AppError,
  DEFAULT_INTERNAL_ERROR_MESSAGE,
  assertPostRequest,
  errorResponse,
  fail,
  getRequiredEnv,
  getTelegramUserFromBody,
  handleCorsPreflight,
  parseJsonBody,
  successResponse,
  type TelegramUser,
} from "../_shared/server.ts";
import { getHomeProgress as getSharedHomeProgress } from "../_shared/home-progress.ts";

type UserRow = {
  id: string;
  telegram_user_id: number;
  first_name: string | null;
  settings_completed_at: string | null;
  first_text_completed_at: string | null;
};

type UserSettingsRow = {
  english_level: "A1" | "A2" | "B1" | "B2";
  daily_reading_minutes: number;
};

type SubscriptionRow = {
  id: string;
  plan_type: "monthly" | "yearly";
  starts_at: string;
  ends_at: string;
};

const MOSCOW_TIME_ZONE = "Europe/Moscow";
const FREE_LIMITS = {
  dailyReadingGenerations: 3,
  vocabularyWordsLimit: 30,
};
const PAID_LIMITS = {
  dailyReadingGenerations: 10,
  vocabularyWordsLimit: 300,
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
        dailyReadingMinutes: row.daily_reading_minutes,
      }
    : null;

const getUserSettings = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
) => {
  const { data, error } = await supabase
    .from("user_settings")
    .select("english_level, daily_reading_minutes")
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
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) {
    return corsResponse;
  }

  try {
    assertPostRequest(req);

    const env = getRequiredEnv([
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "TELEGRAM_BOT_TOKEN",
    ]);

    const body = await parseJsonBody<{ initData?: unknown }>(req);
    const initData =
      typeof body?.initData === "string" ? body.initData.trim() : "";
    console.log("[auth-telegram] incoming request", {
      hasInitData: Boolean(initData),
      initDataLength: initData?.length ?? 0,
    });

    const tgUser = await getTelegramUserFromBody(
      body,
      env.TELEGRAM_BOT_TOKEN,
    );
    console.log("[auth-telegram] initData validated", {
      telegramUserId: tgUser.id,
    });

    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false },
      },
    );

    const { data: existingUser, error: findError } = await supabase
      .from("users")
      .select(
        "id, telegram_user_id, first_name, settings_completed_at, first_text_completed_at",
      )
      .eq("telegram_user_id", tgUser.id)
      .maybeSingle();

    if (findError) {
      console.error("[auth-telegram] failed to find user", {
        error: findError.message,
      });
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
        console.error("[auth-telegram] failed to create user", {
          error: createError?.message,
        });
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
      getSharedHomeProgress(supabase, appUser.id, "[auth-telegram]"),
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
    return errorResponse(
      500,
      "AUTH_TELEGRAM_FAILED",
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    );
  }
});

