/// <reference path="../deno-globals.d.ts" />

// deno-lint-ignore no-import-prefix -- Pin the shared Supabase SDK without per-function import maps.
import { createClient } from "npm:@supabase/supabase-js@2.101.1";
import { fail, getSafeErrorDetails } from "./server.ts";
import { parseEnglishLevel, type EnglishLevel } from "./vocabulary.ts";

export const createServiceClient = (env: {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}) =>
  createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

export type ServiceClient = ReturnType<typeof createServiceClient>;

export const getAppUserByTelegramId = async (
  supabase: ServiceClient,
  telegramUserId: number,
  logPrefix: string,
  requestId: string,
): Promise<{ id: string }> => {
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();

  if (userError) {
    console.error(`${logPrefix} failed to load user`, {
      requestId,
      stage: "user_lookup",
      ...getSafeErrorDetails(userError, [telegramUserId]),
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

  return userRow as { id: string };
};

export const getUserEnglishLevel = async (
  supabase: ServiceClient,
  userId: string,
  logPrefix: string,
): Promise<EnglishLevel> => {
  const { data: settingsRow, error: settingsError } = await supabase
    .from("user_settings")
    .select("english_level")
    .eq("user_id", userId)
    .maybeSingle();

  if (settingsError) {
    console.error(`${logPrefix} failed to load settings`, {
      appUserId: userId,
      error: settingsError.message,
    });
    fail(500, "SETTINGS_LOAD_FAILED", "Failed to load user settings.");
  }

  if (!settingsRow) {
    fail(409, "SETTINGS_NOT_COMPLETED", "User settings are not completed yet.");
  }

  const englishLevel = parseEnglishLevel(
    (settingsRow as { english_level?: unknown }).english_level,
  );
  if (!englishLevel) {
    return fail(
      500,
      "INVALID_ENGLISH_LEVEL",
      "User english level has an unsupported value.",
    );
  }

  return englishLevel;
};
