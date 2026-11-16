import type { AppUser, SavedUserSettings } from '../../src/types/user'

export const PROFILE_MOCKS = {
  original: {
    id: 'profile-user',
    role: 'tester',
    firstName: 'Анна',
    streakDays: 2,
    completedReadingTextCount: 4,
    settingsCompletedAt: '2026-10-18T08:00:00.000Z',
    firstTextCompletedAt: '2026-10-17T08:00:00.000Z',
    settings: { englishLevel: 'A1', dailyReadingMinutes: 3 },
    subscription: {
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
  } satisfies AppUser,
  saved: {
    user: {
      id: 'profile-user',
      role: 'tester',
      firstName: 'Анна',
      settingsCompletedAt: '2026-10-18T08:00:00.000Z',
      firstTextCompletedAt: '2026-10-17T08:00:00.000Z',
    },
    settings: { englishLevel: 'B1', dailyReadingMinutes: 10 },
    subscription: {
      tier: 'paid',
      accessType: 'internal',
      limits: { dailyReadingGenerations: 10, vocabularyWordsLimit: 300 },
      activeSubscription: null,
      scheduledSubscription: null,
    },
    homeProgress: {
      lesson: { status: 'in_progress', currentStep: 'reading' },
      reading: { status: 'in_progress' },
      review: { status: 'completed', dueCount: 0, reviewedTodayCount: 0 },
    },
  } satisfies SavedUserSettings,
  updatedDuringSave: {
    streakDays: 3,
    completedReadingTextCount: 5,
    firstTextCompletedAt: '2026-10-20T08:00:00.000Z',
    homeProgress: {
      lesson: { status: 'completed', currentStep: null },
      reading: { status: 'completed' },
      review: { status: 'completed', dueCount: 0, reviewedTodayCount: 0 },
    },
  } satisfies Pick<
    AppUser,
    | 'streakDays'
    | 'completedReadingTextCount'
    | 'firstTextCompletedAt'
    | 'homeProgress'
  >,
} as const

export const PROFILE_CONTRACT_MOCKS = {
  auth: {
    user: {
      id: PROFILE_MOCKS.original.id,
      role: PROFILE_MOCKS.original.role,
      firstName: PROFILE_MOCKS.original.firstName,
      settingsCompletedAt: PROFILE_MOCKS.original.settingsCompletedAt,
      firstTextCompletedAt: PROFILE_MOCKS.original.firstTextCompletedAt,
    },
    settings: PROFILE_MOCKS.original.settings,
    subscription: PROFILE_MOCKS.original.subscription,
    homeProgress: PROFILE_MOCKS.original.homeProgress,
    streakDays: PROFILE_MOCKS.original.streakDays,
    completedReadingTextCount: PROFILE_MOCKS.original.completedReadingTextCount,
  },
  invalidRole: 'owner',
  errorMessage: 'Некорректный ответ сервера.',
  missingProgress: {
    user: PROFILE_MOCKS.saved.user,
    settings: PROFILE_MOCKS.saved.settings,
    subscription: PROFILE_MOCKS.saved.subscription,
  },
} as const
