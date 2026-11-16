import type { HomeProgress } from '../types/homeProgress'
import type { SubscriptionSummary } from '../types/subscription'
import type { AppUser, SavedUserSettings, UserSettings } from '../types/user'

export type AuthProfileResponse = Omit<SavedUserSettings, 'settings'> & {
  settings: UserSettings | null
  streakDays: number
  completedReadingTextCount: number | null
}

const INVALID_RESPONSE_MESSAGE = 'Некорректный ответ сервера.'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string'

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

const isRole = (value: unknown): value is AppUser['role'] =>
  value === 'admin' || value === 'tester' || value === 'user'

const isHomeStatus = (value: unknown): boolean =>
  value === 'not_started' || value === 'in_progress' || value === 'completed'

const isUser = (value: unknown): value is SavedUserSettings['user'] =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  isRole(value.role) &&
  isNullableString(value.firstName) &&
  isNullableString(value.settingsCompletedAt) &&
  isNullableString(value.firstTextCompletedAt)

const isSettings = (value: unknown): value is UserSettings =>
  isRecord(value) &&
  (value.englishLevel === 'A1' ||
    value.englishLevel === 'A2' ||
    value.englishLevel === 'B1' ||
    value.englishLevel === 'B2') &&
  (value.dailyReadingMinutes === 3 ||
    value.dailyReadingMinutes === 5 ||
    value.dailyReadingMinutes === 10 ||
    value.dailyReadingMinutes === 15)

const isSubscription = (value: unknown): value is SubscriptionSummary => {
  if (!isRecord(value) || !isRecord(value.limits)) return false
  const validTier = value.tier === 'free' || value.tier === 'paid'
  const validAccessType =
    value.accessType === 'free' ||
    value.accessType === 'subscription' ||
    value.accessType === 'internal'
  const isSubscriptionRow = (row: unknown) =>
    row === null ||
    (isRecord(row) &&
      typeof row.id === 'string' &&
      (row.planType === 'monthly' || row.planType === 'yearly') &&
      typeof row.startsAt === 'string' &&
      typeof row.endsAt === 'string')

  return (
    validTier &&
    validAccessType &&
    isCount(value.limits.dailyReadingGenerations) &&
    isCount(value.limits.vocabularyWordsLimit) &&
    isSubscriptionRow(value.activeSubscription) &&
    isSubscriptionRow(value.scheduledSubscription)
  )
}

const isHomeProgress = (value: unknown): value is HomeProgress => {
  if (!isRecord(value)) return false
  const { lesson, reading, review } = value
  return (
    isRecord(lesson) &&
    isHomeStatus(lesson.status) &&
    (lesson.currentStep === null ||
      lesson.currentStep === 'reading' ||
      lesson.currentStep === 'vocabulary') &&
    isRecord(reading) &&
    isHomeStatus(reading.status) &&
    isRecord(review) &&
    isHomeStatus(review.status) &&
    isCount(review.dueCount) &&
    isCount(review.reviewedTodayCount)
  )
}

const isSavedSettings = (value: unknown): value is SavedUserSettings =>
  isRecord(value) &&
  isUser(value.user) &&
  isSettings(value.settings) &&
  isSubscription(value.subscription) &&
  isHomeProgress(value.homeProgress)

const isAuthProfile = (value: unknown): value is AuthProfileResponse =>
  isRecord(value) &&
  isUser(value.user) &&
  (value.settings === null || isSettings(value.settings)) &&
  isSubscription(value.subscription) &&
  isHomeProgress(value.homeProgress) &&
  isCount(value.streakDays) &&
  (value.completedReadingTextCount === null ||
    isCount(value.completedReadingTextCount))

export const requireAuthProfile = (value: unknown): AuthProfileResponse => {
  if (!isAuthProfile(value)) throw new Error(INVALID_RESPONSE_MESSAGE)
  return value
}

export const requireSavedSettings = (value: unknown): SavedUserSettings => {
  if (!isSavedSettings(value)) throw new Error(INVALID_RESPONSE_MESSAGE)
  return value
}
