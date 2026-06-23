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
} from "../_shared/server.ts";
import { getHomeProgress as getSharedHomeProgress } from "../_shared/home-progress.ts";

type EnglishLevel = "A1" | "A2" | "B1" | "B2";
type DailyReadingMinutes = 3 | 5 | 10 | 15;

type UserRow = {
  id: string;
  telegram_user_id: number;
  first_name: string | null;
  settings_completed_at: string | null;
  first_text_completed_at: string | null;
};

type UserSettingsRow = {
  english_level: EnglishLevel;
  daily_reading_minutes: DailyReadingMinutes;
};

type SubscriptionRow = {
  id: string;
  plan_type: "monthly" | "yearly";
  starts_at: string;
  ends_at: string;
};

const FREE_LIMITS = {
  dailyReadingGenerations: 3,
  vocabularyWordsLimit: 30,
};
const PAID_LIMITS = {
  dailyReadingGenerations: 10,
  vocabularyWordsLimit: 300,
};

const parseEnglishLevel = (value: unknown): EnglishLevel => {
  if (value === "A1" || value === "A2" || value === "B1" || value === "B2") {
    return value;
  }

  fail(400, "INVALID_SETTINGS", "English level is invalid.");
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
  dailyReadingMinutes: row.daily_reading_minutes,
});

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

    const body = await parseJsonBody<{
      initData?: unknown;
      settings?: {
        englishLevel?: unknown;
        dailyReadingMinutes?: unknown;
      };
    }>(req);

    const settings = body?.settings;
    if (!settings || typeof settings !== "object") {
      fail(400, "INVALID_SETTINGS", "Settings payload is required.");
    }

    const englishLevel = parseEnglishLevel(settings.englishLevel);
    const dailyReadingMinutes = parseDailyReadingMinutes(
      settings.dailyReadingMinutes,
    );
    const tgUser = await getTelegramUserFromBody(
      body,
      env.TELEGRAM_BOT_TOKEN,
    );

    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false },
      },
    );

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select(
        "id, telegram_user_id, first_name, settings_completed_at, first_text_completed_at",
      )
      .eq("telegram_user_id", tgUser.id)
      .maybeSingle();

    if (userError) {
      console.error("[save-user-settings] failed to load user", {
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
    const { data: settingsRow, error: upsertError } = await supabase
      .from("user_settings")
      .upsert(
        {
          user_id: appUser.id,
          english_level: englishLevel,
          daily_reading_minutes: dailyReadingMinutes,
        },
        { onConflict: "user_id" },
      )
      .select("english_level, daily_reading_minutes")
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
      getSharedHomeProgress(supabase, appUser.id, "[save-user-settings]"),
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
    return errorResponse(
      500,
      "SETTINGS_SAVE_FAILED",
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    );
  }
});
