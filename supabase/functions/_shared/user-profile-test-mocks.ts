import type { ServiceClient } from './app.ts'
import type {
  ProfileSettingsRow,
  ProfileUserRow,
} from './user-profile-repository.ts'

export const PROFILE_CASE = {
  telegramUserId: 123456,
  requestId: 'req_profile_fixture',
  logPrefix: '[profile-test]',
  firstName: 'Anna',
  nowIso: '2026-10-20T08:00:00.000Z',
  noCalls: 0,
  oneCall: 1,
  badRequestStatus: 400,
  missingUserStatus: 404,
  missingUserCode: 'USER_NOT_FOUND',
  existingUser: {
    id: 'existing-profile-user',
    first_name: 'Anna',
    settings_completed_at: '2026-10-18T08:00:00.000Z',
    first_text_completed_at: null,
    app_role: 'admin',
  } satisfies ProfileUserRow,
  createdUser: {
    id: 'new-profile-user',
    first_name: 'Anna',
    settings_completed_at: null,
    first_text_completed_at: null,
    app_role: 'tester',
  } satisfies ProfileUserRow,
  settings: {
    english_level: 'B1',
    daily_reading_minutes: 10,
  } satisfies ProfileSettingsRow,
  expectedSettings: { englishLevel: 'B1', dailyReadingMinutes: 10 },
  expectedExistingUser: {
    id: 'existing-profile-user',
    firstName: 'Anna',
    settingsCompletedAt: '2026-10-18T08:00:00.000Z',
    firstTextCompletedAt: null,
    role: 'admin',
  },
  expectedCreatedUserAfterSettings: {
    id: 'new-profile-user',
    firstName: 'Anna',
    settingsCompletedAt: '2026-10-20T08:00:00.000Z',
    firstTextCompletedAt: null,
    role: 'tester',
  },
  subscriptionSummary: {
    tier: 'paid',
    accessType: 'internal',
    limits: { dailyReadingGenerations: 10, vocabularyWordsLimit: 300 },
    activeSubscription: null,
    scheduledSubscription: null,
  },
  homeProgress: {
    lesson: { status: 'not_started', currentStep: 'reading' },
    reading: { status: 'not_started' },
    review: { status: 'completed', dueCount: 0, reviewedTodayCount: 0 },
  },
  streakDays: 2,
  completedReadingTextCount: 4,
  accessCases: [
    {
      role: 'admin',
      hasInternalAccess: true,
      hasPaidAccess: true,
      dailyReadingGenerations: 10,
      vocabularyWordsLimit: 300,
      dailyVocabularyCardGenerationLimit: 20,
    },
    {
      role: 'tester',
      hasInternalAccess: true,
      hasPaidAccess: true,
      dailyReadingGenerations: 10,
      vocabularyWordsLimit: 300,
      dailyVocabularyCardGenerationLimit: 20,
    },
    {
      role: 'user',
      hasInternalAccess: false,
      hasPaidAccess: false,
      dailyReadingGenerations: 3,
      vocabularyWordsLimit: 30,
      dailyVocabularyCardGenerationLimit: 5,
    },
  ],
  subscription: {
    id: 'active-subscription',
    plan_type: 'monthly',
    starts_at: '2026-10-01T00:00:00.000Z',
    ends_at: '2026-11-01T00:00:00.000Z',
  },
  subscribedUserRole: 'user',
  paidReadingGenerations: 10,
  subscriptionEnabledValue: 'true',
  subscriptionDisabledValue: undefined,
  subscriptionDisabledCode: 'SUBSCRIPTION_FLOW_DISABLED',
  subscriptionDisabledStatus: 403,
} as const

export const createProfileRepositoryHarness = ({
  existingUser = PROFILE_CASE.existingUser,
  updatedUser = PROFILE_CASE.existingUser,
}: {
  existingUser?: ProfileUserRow | null
  updatedUser?: ProfileUserRow | null
} = {}) => {
  const calls = { userUpsert: 0, settingsUpsert: 0, userUpdate: 0 }
  const client = {
    from: (table: string) => {
      let operation: 'read' | 'upsert' | 'update' = 'read'
      const query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        upsert: () => {
          operation = 'upsert'
          if (table === 'users') calls.userUpsert += 1
          if (table === 'user_settings') calls.settingsUpsert += 1
          return query
        },
        update: () => {
          operation = 'update'
          calls.userUpdate += 1
          return query
        },
        maybeSingle: () =>
          Promise.resolve({
            data:
              table === 'users'
                ? operation === 'update'
                  ? updatedUser
                  : existingUser
                : PROFILE_CASE.settings,
            error: null,
          }),
        single: () =>
          Promise.resolve({
            data:
              table === 'users'
                ? PROFILE_CASE.createdUser
                : PROFILE_CASE.settings,
            error: null,
          }),
      }
      return query
    },
  } as unknown as ServiceClient

  return { client, calls }
}
