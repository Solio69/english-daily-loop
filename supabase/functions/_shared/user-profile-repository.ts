/// <reference path="../deno-globals.d.ts" />

import type { ServiceClient } from './app.ts'
import { fail, getSafeErrorDetails } from './server.ts'

export type ProfileUserRow = {
  id: string
  first_name: string | null
  settings_completed_at: string | null
  first_text_completed_at: string | null
  app_role: 'admin' | 'tester' | 'user'
}

export type ProfileSettingsRow = {
  english_level: 'A1' | 'A2' | 'B1' | 'B2'
  daily_reading_minutes: 3 | 5 | 10 | 15
}

type ProfileLookupParams = {
  supabase: ServiceClient
  telegramUserId: number
  requestId: string
  logPrefix: string
  firstName?: string | null
  createIfMissing: boolean
}

type SaveSettingsParams = {
  supabase: ServiceClient
  user: ProfileUserRow
  settings: ProfileSettingsRow
  nowIso: string
  logPrefix: string
}

const USER_COLUMNS =
  'id, first_name, settings_completed_at, first_text_completed_at, app_role'
const SETTINGS_COLUMNS = 'english_level, daily_reading_minutes'

export const getProfileUser = async ({
  supabase,
  telegramUserId,
  requestId,
  logPrefix,
  firstName = null,
  createIfMissing,
}: ProfileLookupParams): Promise<ProfileUserRow> => {
  const { data, error } = await supabase
    .from('users')
    .select(USER_COLUMNS)
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle()

  if (error) {
    console.error(`${logPrefix} failed to find user`, {
      requestId,
      stage: 'user_lookup',
      ...getSafeErrorDetails(error, [telegramUserId]),
    })
    fail(500, 'USER_FIND_FAILED', 'Failed to load user profile.')
  }

  if (data) return data as ProfileUserRow

  if (!createIfMissing) {
    fail(
      404,
      'USER_NOT_FOUND',
      'User profile was not found. Complete Telegram auth first.',
    )
  }

  const { data: createdUser, error: createError } = await supabase
    .from('users')
    .upsert(
      {
        telegram_user_id: telegramUserId,
        first_name: firstName,
        is_active: true,
      },
      { onConflict: 'telegram_user_id' },
    )
    .select(USER_COLUMNS)
    .single()

  if (createError || !createdUser) {
    console.error(`${logPrefix} failed to create user`, {
      requestId,
      stage: 'user_create',
      ...getSafeErrorDetails(createError, [telegramUserId]),
    })
    fail(500, 'USER_CREATE_FAILED', 'Failed to create user.')
  }

  return createdUser as ProfileUserRow
}

export const getProfileSettings = async ({
  supabase,
  userId,
  logPrefix,
}: {
  supabase: ServiceClient
  userId: string
  logPrefix: string
}): Promise<ProfileSettingsRow | null> => {
  const { data, error } = await supabase
    .from('user_settings')
    .select(SETTINGS_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error(`${logPrefix} failed to load user settings`, {
      appUserId: userId,
      error: error.message,
    })
    fail(500, 'SETTINGS_LOAD_FAILED', 'Failed to load user settings.')
  }

  return (data as ProfileSettingsRow | null) ?? null
}

export const saveProfileSettings = async ({
  supabase,
  user,
  settings,
  nowIso,
  logPrefix,
}: SaveSettingsParams): Promise<{
  user: ProfileUserRow
  settings: ProfileSettingsRow
}> => {
  const { data: settingsRow, error: upsertError } = await supabase
    .from('user_settings')
    .upsert({ user_id: user.id, ...settings }, { onConflict: 'user_id' })
    .select(SETTINGS_COLUMNS)
    .single()

  if (upsertError || !settingsRow) {
    console.error(`${logPrefix} failed to upsert settings`, {
      appUserId: user.id,
      error: upsertError?.message,
    })
    fail(500, 'SETTINGS_SAVE_FAILED', 'Failed to save user settings.')
  }

  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update({ settings_completed_at: nowIso })
    .eq('id', user.id)
    .is('settings_completed_at', null)
    .select(USER_COLUMNS)
    .maybeSingle()

  if (updateError) {
    console.error(`${logPrefix} failed to update onboarding status`, {
      appUserId: user.id,
      error: updateError.message,
    })
    fail(
      500,
      'ONBOARDING_STATUS_UPDATE_FAILED',
      'Failed to update onboarding status.',
    )
  }

  return {
    user: (updatedUser as ProfileUserRow | null) ?? user,
    settings: settingsRow as ProfileSettingsRow,
  }
}
