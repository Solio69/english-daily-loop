import { supabase } from "../lib/supabase";
import { SubscriptionSummary } from "../types/subscription";
import { HomeProgress } from "../types/homeProgress";
import { AppUser, SaveUserSettingsInput, UserSettings } from "../types/user";

const DEV_TELEGRAM_USER_ID = Number(
  import.meta.env.VITE_DEV_TELEGRAM_USER_ID ?? 999000001,
);
// TODO: Local launch helper. Keep fallback disabled for real Telegram auth checks.
const ENABLE_DEV_AUTH_FALLBACK =
  import.meta.env.VITE_ENABLE_DEV_AUTH_FALLBACK !== "false";
// TODO: Local debugging helper for browser console auth traces.
const AUTH_DEBUG_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_DEBUG_AUTH === "true";

type UserRow = {
  id: string;
  telegram_user_id: number;
  first_name: string | null;
  settings_completed_at: string | null;
  first_text_completed_at: string | null;
};

type AuthenticatedUserRow = UserRow & {
  streak_days: number;
  subscription: SubscriptionSummary;
  homeProgress: HomeProgress;
};

type UserSettingsRow = {
  english_level: "A1" | "A2" | "B1" | "B2";
  daily_exercise_minutes: number;
  daily_reading_minutes: number;
};

type AuthTelegramFunctionSuccess = {
  ok: true;
  data: {
    user: {
      id: string;
      telegramUserId: number;
      firstName: string | null;
      settingsCompletedAt: string | null;
      firstTextCompletedAt: string | null;
    };
    streakDays: number;
    subscription: SubscriptionSummary;
    homeProgress: HomeProgress;
  };
};

type AuthTelegramFunctionError = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

type AuthTelegramFunctionResponse =
  | AuthTelegramFunctionSuccess
  | AuthTelegramFunctionError;

const FREE_SUBSCRIPTION_SUMMARY: SubscriptionSummary = {
  tier: "free",
  limits: {
    dailyReadingGenerations: 3,
    vocabularyWordsLimit: 30,
  },
  activeSubscription: null,
  scheduledSubscription: null,
};

const DEFAULT_HOME_PROGRESS: HomeProgress = {
  lesson: {
    status: "not_started",
    currentStep: "reading",
  },
  reading: {
    status: "not_started",
  },
};

const authLog = (message: string, details?: unknown): void => {
  if (!AUTH_DEBUG_ENABLED) return;
  if (details !== undefined) {
    console.info(`[EDL auth] ${message}`, details);
    return;
  }
  console.info(`[EDL auth] ${message}`);
};

const mapSettings = (row: UserSettingsRow): UserSettings => ({
  englishLevel: row.english_level,
  dailyExerciseMinutes: row.daily_exercise_minutes,
  dailyReadingMinutes: row.daily_reading_minutes,
});

const mapUser = (
  user: UserRow,
  settings: UserSettings | null = null,
  subscription: SubscriptionSummary = FREE_SUBSCRIPTION_SUMMARY,
  homeProgress: HomeProgress = DEFAULT_HOME_PROGRESS,
  streakDays = 0,
): AppUser => ({
  id: user.id,
  telegramUserId: user.telegram_user_id,
  firstName: user.first_name,
  streakDays,
  settingsCompletedAt: user.settings_completed_at,
  firstTextCompletedAt: user.first_text_completed_at,
  settings,
  subscription,
  homeProgress,
});

const getOrCreateDevUser = async (): Promise<UserRow> => {
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, telegram_user_id, first_name, settings_completed_at, first_text_completed_at",
    )
    .eq("telegram_user_id", DEV_TELEGRAM_USER_ID)
    .maybeSingle();

  if (error) {
    throw new Error("Не удалось загрузить профиль пользователя.");
  }

  if (data) {
    return data as UserRow;
  }

  const { data: created, error: createError } = await supabase
    .from("users")
    .insert({
      telegram_user_id: DEV_TELEGRAM_USER_ID,
      username: "dev_user",
      first_name: "Dev",
      last_name: "User",
      language_code: "ru",
      is_active: true,
    })
    .select(
      "id, telegram_user_id, first_name, settings_completed_at, first_text_completed_at",
    )
    .single();

  if (createError || !created) {
    throw new Error("Не удалось инициализировать профиль пользователя.");
  }

  return created as UserRow;
};

const getTelegramInitData = (): string | null => {
  const initData = window.Telegram?.WebApp?.initData?.trim();
  authLog("Telegram initData check", {
    hasTelegramObject: Boolean(window.Telegram?.WebApp),
    hasInitData: Boolean(initData),
    initDataLength: initData?.length ?? 0,
  });
  return initData || null;
};

const getOrCreateTelegramUser = async (
  initData: string,
): Promise<AuthenticatedUserRow> => {
  authLog("Calling auth-telegram function", {
    initDataLength: initData.length,
  });
  const { data, error } = await supabase.functions.invoke("auth-telegram", {
    body: { initData },
  });

  if (error) {
    authLog("auth-telegram invoke failed", error);
    throw new Error("Не удалось авторизоваться через Telegram.");
  }

  const payload = data as AuthTelegramFunctionResponse | null;
  if (!payload) {
    authLog("auth-telegram returned empty payload");
    throw new Error("Пустой ответ от сервера авторизации.");
  }

  if ("error" in payload) {
    authLog("auth-telegram returned business error", payload.error);
    throw new Error(payload.error.message);
  }

  authLog("auth-telegram success", {
    telegramUserId: payload.data.user.telegramUserId,
    appUserId: payload.data.user.id,
  });

  return {
    id: payload.data.user.id,
    telegram_user_id: payload.data.user.telegramUserId,
    first_name: payload.data.user.firstName,
    streak_days: payload.data.streakDays,
    settings_completed_at: payload.data.user.settingsCompletedAt,
    first_text_completed_at: payload.data.user.firstTextCompletedAt,
    subscription: payload.data.subscription,
    homeProgress: payload.data.homeProgress,
  };
};

const getUserSettings = async (
  userId: string,
): Promise<UserSettings | null> => {
  const { data, error } = await supabase
    .from("user_settings")
    .select(
      "english_level, daily_exercise_minutes, daily_reading_minutes",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Не удалось загрузить настройки пользователя.");
  }

  if (!data) {
    return null;
  }

  return mapSettings(data as UserSettingsRow);
};

const getUserById = async (userId: string): Promise<UserRow> => {
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, telegram_user_id, first_name, settings_completed_at, first_text_completed_at",
    )
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error("Не удалось загрузить профиль пользователя.");
  }

  return data as UserRow;
};

export const getCurrentAppUser = async (): Promise<AppUser> => {
  const initData = getTelegramInitData();
  const source = initData
    ? "telegram"
    : ENABLE_DEV_AUTH_FALLBACK
      ? "dev_fallback"
      : "no_auth_source";
  authLog("Selecting user source", { source });
  const user = initData
    ? await getOrCreateTelegramUser(initData)
    : ENABLE_DEV_AUTH_FALLBACK
      ? await getOrCreateDevUser()
      : (() => {
          throw new Error(
            "Telegram initData не найден. Открой приложение внутри Telegram.",
          );
        })();
  const settings = user.settings_completed_at
    ? await getUserSettings(user.id)
    : null;
  const subscription =
    (user as Partial<AuthenticatedUserRow>).subscription ??
    FREE_SUBSCRIPTION_SUMMARY;
  const homeProgress =
    (user as Partial<AuthenticatedUserRow>).homeProgress ??
    DEFAULT_HOME_PROGRESS;
  const streakDays = (user as Partial<AuthenticatedUserRow>).streak_days ?? 0;
  authLog("Bootstrapped app user", {
    appUserId: user.id,
    telegramUserId: user.telegram_user_id,
    hasSettings: Boolean(settings),
    subscriptionTier: subscription.tier,
    readingStatus: homeProgress.reading.status,
    streakDays,
  });
  return mapUser(user, settings, subscription, homeProgress, streakDays);
};

export const saveCurrentUserSettings = async (
  userId: string,
  input: SaveUserSettingsInput,
  subscription: SubscriptionSummary,
  homeProgress: HomeProgress,
  streakDays: number,
): Promise<AppUser> => {
  authLog("Saving user settings", { userId, input });
  const { error: upsertError } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      english_level: input.englishLevel,
      daily_exercise_minutes: input.dailyExerciseMinutes,
      daily_reading_minutes: input.dailyReadingMinutes,
    },
    { onConflict: "user_id" },
  );

  if (upsertError) {
    authLog("Failed to upsert user_settings", upsertError);
    throw new Error("Не удалось сохранить настройки.");
  }

  const nowIso = new Date().toISOString();
  const { error: markError } = await supabase
    .from("users")
    .update({ settings_completed_at: nowIso })
    .eq("id", userId)
    .is("settings_completed_at", null);

  if (markError) {
    authLog("Failed to update users.settings_completed_at", markError);
    throw new Error("Не удалось обновить статус онбординга.");
  }

  const user = await getUserById(userId);
  authLog("Settings saved successfully", { userId: user.id });
  return mapUser(user, input, subscription, homeProgress, streakDays);
};
