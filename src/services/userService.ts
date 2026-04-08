import { supabase } from "../lib/supabase";
import { AppUser, SaveUserSettingsInput, UserSettings } from "../types/user";

const DEV_TELEGRAM_USER_ID = 999000001;

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
  daily_review_words: number;
};

const mapSettings = (row: UserSettingsRow): UserSettings => ({
  englishLevel: row.english_level,
  dailyExerciseMinutes: row.daily_exercise_minutes,
  dailyReviewWords: row.daily_review_words,
});

const mapUser = (
  user: UserRow,
  settings: UserSettings | null = null,
): AppUser => ({
  id: user.id,
  telegramUserId: user.telegram_user_id,
  firstName: user.first_name,
  settingsCompletedAt: user.settings_completed_at,
  firstTextCompletedAt: user.first_text_completed_at,
  settings,
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

const getUserSettings = async (
  userId: string,
): Promise<UserSettings | null> => {
  const { data, error } = await supabase
    .from("user_settings")
    .select("english_level, daily_exercise_minutes, daily_review_words")
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
  const user = await getOrCreateDevUser();
  const settings = user.settings_completed_at
    ? await getUserSettings(user.id)
    : null;
  return mapUser(user, settings);
};

export const saveCurrentUserSettings = async (
  userId: string,
  input: SaveUserSettingsInput,
): Promise<AppUser> => {
  const { error: upsertError } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      english_level: input.englishLevel,
      daily_exercise_minutes: input.dailyExerciseMinutes,
      daily_review_words: input.dailyReviewWords,
    },
    { onConflict: "user_id" },
  );

  if (upsertError) {
    throw new Error("Не удалось сохранить настройки.");
  }

  const nowIso = new Date().toISOString();
  const { error: markError } = await supabase
    .from("users")
    .update({ settings_completed_at: nowIso })
    .eq("id", userId)
    .is("settings_completed_at", null);

  if (markError) {
    throw new Error("Не удалось обновить статус онбординга.");
  }

  const user = await getUserById(userId);
  return mapUser(user, input);
};

export const markFirstTextCompleted = async (
  userId: string,
): Promise<AppUser> => {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("users")
    .update({ first_text_completed_at: nowIso })
    .eq("id", userId)
    .is("first_text_completed_at", null);

  if (error) {
    throw new Error("Не удалось обновить статус завершения текста.");
  }

  const user = await getUserById(userId);
  const settings = user.settings_completed_at
    ? await getUserSettings(userId)
    : null;
  return mapUser(user, settings);
};
