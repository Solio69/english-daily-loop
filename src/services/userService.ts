import { invokeFunctionWithInitData } from "./functionClient";
import { SubscriptionSummary } from "../types/subscription";
import { HomeProgress } from "../types/homeProgress";
import {
  AppRole,
  AppUser,
  SaveUserSettingsInput,
  UserSettings,
} from "../types/user";
import { DEFAULT_FREE_SUBSCRIPTION_SUMMARY } from "../constants/subscriptionFallbacks";

// TODO: Local debugging helper for Telegram auth traces.
const AUTH_DEBUG_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_DEBUG_AUTH === "true";

type UserRow = {
  id: string;
  telegram_user_id: number;
  role: AppRole;
  first_name: string | null;
  settings_completed_at: string | null;
  first_text_completed_at: string | null;
};

type AuthenticatedUserRow = UserRow & {
  streak_days: number;
  subscription: SubscriptionSummary;
  homeProgress: HomeProgress;
  settings: UserSettings | null;
};

type AuthTelegramFunctionData = {
  user: {
    id: string;
    telegramUserId: number;
    role: AppRole;
    firstName: string | null;
    settingsCompletedAt: string | null;
    firstTextCompletedAt: string | null;
  };
  settings: UserSettings | null;
  streakDays: number;
  subscription: SubscriptionSummary;
  homeProgress: HomeProgress;
};

type SaveUserSettingsFunctionData = {
  user: {
    id: string;
    telegramUserId: number;
    role: AppRole;
    firstName: string | null;
    settingsCompletedAt: string | null;
    firstTextCompletedAt: string | null;
  };
  settings: UserSettings;
  subscription: SubscriptionSummary;
  homeProgress: HomeProgress;
};

const DEFAULT_HOME_PROGRESS: HomeProgress = {
  lesson: {
    status: "not_started",
    currentStep: "reading",
  },
  reading: {
    status: "not_started",
  },
  review: {
    status: "completed",
    dueCount: 0,
    reviewedTodayCount: 0,
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

const mapUser = (
  user: UserRow,
  settings: UserSettings | null = null,
  subscription: SubscriptionSummary = DEFAULT_FREE_SUBSCRIPTION_SUMMARY,
  homeProgress: HomeProgress = DEFAULT_HOME_PROGRESS,
  streakDays = 0,
): AppUser => {
  const normalizedHomeProgress: HomeProgress = {
    ...DEFAULT_HOME_PROGRESS,
    ...homeProgress,
    lesson: homeProgress.lesson ?? DEFAULT_HOME_PROGRESS.lesson,
    reading: homeProgress.reading ?? DEFAULT_HOME_PROGRESS.reading,
    review: homeProgress.review ?? DEFAULT_HOME_PROGRESS.review,
  };

  return {
    id: user.id,
    telegramUserId: user.telegram_user_id,
    role: user.role,
    firstName: user.first_name,
    streakDays,
    settingsCompletedAt: user.settings_completed_at,
    firstTextCompletedAt: user.first_text_completed_at,
    settings,
    subscription,
    homeProgress: normalizedHomeProgress,
  };
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

const getAuthenticatedUser = async (
  initData: string,
): Promise<AuthenticatedUserRow> => {
  authLog("Calling auth-telegram function", {
    source: "telegram",
  });
  const payload = await invokeFunctionWithInitData<AuthTelegramFunctionData>(
    "auth-telegram",
    initData,
    {},
    "Не удалось авторизоваться через Telegram.",
  );

  authLog("auth-telegram success", {
    telegramUserId: payload.user.telegramUserId,
    appUserId: payload.user.id,
  });

  return {
    id: payload.user.id,
    telegram_user_id: payload.user.telegramUserId,
    role: payload.user.role ?? "user",
    first_name: payload.user.firstName,
    streak_days: payload.streakDays,
    settings_completed_at: payload.user.settingsCompletedAt,
    first_text_completed_at: payload.user.firstTextCompletedAt,
    settings: payload.settings,
    subscription: payload.subscription,
    homeProgress: payload.homeProgress,
  };
};

export const getCurrentAppUser = async (): Promise<AppUser> => {
  const initData = getTelegramInitData();
  const source = initData ? "telegram" : "no_auth_source";
  authLog("Selecting user source", { source });
  if (!initData) {
    throw new Error(
      "Telegram initData не найден. Открой приложение внутри Telegram.",
    );
  }
  const user = await getAuthenticatedUser(initData);
  const settings = user.settings;
  const subscription =
    (user as Partial<AuthenticatedUserRow>).subscription ??
    DEFAULT_FREE_SUBSCRIPTION_SUMMARY;
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
    reviewStatus: homeProgress.review.status,
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
  const initData = getTelegramInitData();
  if (!initData) {
    throw new Error(
      "Telegram initData не найден. Открой приложение внутри Telegram.",
    );
  }
  const payload = await invokeFunctionWithInitData<SaveUserSettingsFunctionData>(
    "save-user-settings",
    initData,
    { settings: input },
    "Не удалось сохранить настройки.",
  );

  const userRow: UserRow = {
    id: payload.user.id,
    telegram_user_id: payload.user.telegramUserId,
    role: payload.user.role ?? "user",
    first_name: payload.user.firstName,
    settings_completed_at: payload.user.settingsCompletedAt,
    first_text_completed_at: payload.user.firstTextCompletedAt,
  };

  authLog("Settings saved successfully", { userId: userRow.id });
  return mapUser(
    userRow,
    payload.settings,
    payload.subscription ?? subscription,
    payload.homeProgress ?? homeProgress,
    streakDays,
  );
};
