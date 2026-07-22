// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { getMoscowDate } from "../_shared/moscow-date.ts";
import { getReadingCompletionStreak } from "../_shared/reading-streak.ts";
import { getCompletedReadingTextCount } from "../_shared/reading-history.ts";
import { getSubscriptionSummary } from "../_shared/access.ts";
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
  app_role: "admin" | "tester" | "user";
};

type UserSettingsRow = {
  english_level: "A1" | "A2" | "B1" | "B2";
  daily_reading_minutes: number;
};

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
        "id, telegram_user_id, first_name, settings_completed_at, first_text_completed_at, app_role",
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
          "id, telegram_user_id, first_name, settings_completed_at, first_text_completed_at, app_role",
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

    const [
      settings,
      subscription,
      homeProgress,
      streakDays,
      completedReadingTextCount,
    ] = await Promise.all([
      getUserSettings(supabase, appUser.id),
      getSubscriptionSummary(supabase, appUser.id, "[auth-telegram]"),
      getSharedHomeProgress(supabase, appUser.id, "[auth-telegram]"),
      getReadingCompletionStreak(
        supabase,
        appUser.id,
        getMoscowDate(),
        "[auth-telegram]",
      ),
      getCompletedReadingTextCount(supabase, appUser.id, "[auth-telegram]"),
    ]);

    return successResponse(200, {
      user: {
        id: appUser.id,
        telegramUserId: appUser.telegram_user_id,
        firstName: appUser.first_name,
        settingsCompletedAt: appUser.settings_completed_at,
        firstTextCompletedAt: appUser.first_text_completed_at,
        role: appUser.app_role,
      },
      settings,
      subscription,
      homeProgress,
      streakDays,
      completedReadingTextCount,
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

