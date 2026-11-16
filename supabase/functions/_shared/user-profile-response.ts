/// <reference path="../deno-globals.d.ts" />

import type { ServiceClient } from './app.ts'
import { getSubscriptionSummary } from './access.ts'
import { getHomeProgress } from './home-progress.ts'
import { getCompletedReadingTextCount } from './reading-history.ts'
import { getReadingCompletionStreak } from './reading-streak.ts'
import { getMoscowStudyDate } from './moscow-study-date.ts'
import { getProfileSettings } from './user-profile-repository.ts'
import type {
  ProfileSettingsRow,
  ProfileUserRow,
} from './user-profile-repository.ts'

type ProfileResponseParams = {
  supabase: ServiceClient
  user: ProfileUserRow
  logPrefix: string
}

type SubscriptionSummary = Awaited<ReturnType<typeof getSubscriptionSummary>>
type HomeProgress = Awaited<ReturnType<typeof getHomeProgress>>

type AuthProfileParts = {
  user: ProfileUserRow
  settings: ProfileSettingsRow | null
  subscription: SubscriptionSummary
  homeProgress: HomeProgress
  streakDays: number
  completedReadingTextCount: number | null
}

const mapUser = ({
  user,
  settingsCompletedAt,
}: {
  user: ProfileUserRow
  settingsCompletedAt?: string
}) => ({
  id: user.id,
  firstName: user.first_name,
  settingsCompletedAt: user.settings_completed_at ?? settingsCompletedAt ?? null,
  firstTextCompletedAt: user.first_text_completed_at,
  role: user.app_role,
})

const mapSettings = (row: ProfileSettingsRow | null) =>
  row
    ? {
        englishLevel: row.english_level,
        dailyReadingMinutes: row.daily_reading_minutes,
      }
    : null

export const mapAuthProfileResponse = ({
  user,
  settings,
  subscription,
  homeProgress,
  streakDays,
  completedReadingTextCount,
}: AuthProfileParts) => ({
  user: mapUser({ user }),
  settings: mapSettings(settings),
  subscription,
  homeProgress,
  streakDays,
  completedReadingTextCount,
})

export const mapSavedSettingsResponse = ({
  user,
  settings,
  subscription,
  homeProgress,
  nowIso,
}: Omit<AuthProfileParts, 'streakDays' | 'completedReadingTextCount'> & {
  settings: ProfileSettingsRow
  nowIso: string
}) => ({
  user: mapUser({ user, settingsCompletedAt: nowIso }),
  settings: mapSettings(settings),
  subscription,
  homeProgress,
})

export const getAuthProfileResponse = async ({
  supabase,
  user,
  logPrefix,
}: ProfileResponseParams) => {
  const [
    settings,
    subscription,
    homeProgress,
    streakDays,
    completedReadingTextCount,
  ] = await Promise.all([
    getProfileSettings({ supabase, userId: user.id, logPrefix }),
    getSubscriptionSummary(supabase, user.id, logPrefix),
    getHomeProgress(supabase, user.id, logPrefix),
    getReadingCompletionStreak(
      supabase,
      user.id,
      getMoscowStudyDate(),
      logPrefix,
    ),
    getCompletedReadingTextCount(supabase, user.id, logPrefix),
  ])

  return mapAuthProfileResponse({
    user,
    settings,
    subscription,
    homeProgress,
    streakDays,
    completedReadingTextCount,
  })
}

export const getSavedSettingsResponse = async ({
  supabase,
  user,
  settings,
  logPrefix,
  nowIso,
}: ProfileResponseParams & {
  settings: ProfileSettingsRow
  nowIso: string
}) => {
  const [subscription, homeProgress] = await Promise.all([
    getSubscriptionSummary(supabase, user.id, logPrefix),
    getHomeProgress(supabase, user.id, logPrefix),
  ])

  return mapSavedSettingsResponse({
    user,
    settings,
    subscription,
    homeProgress,
    nowIso,
  })
}
