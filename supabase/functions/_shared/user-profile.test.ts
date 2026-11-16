/// <reference path="../deno-globals.d.ts" />

import { resolveAccessContext } from './access.ts'
import { AppError } from './server.ts'
import { assertSubscriptionFlowEnabled } from './subscription-flow.ts'
import { assertEquals } from './test-support.ts'
import {
  getProfileUser,
  saveProfileSettings,
} from './user-profile-repository.ts'
import {
  mapAuthProfileResponse,
  mapSavedSettingsResponse,
} from './user-profile-response.ts'
import {
  PROFILE_CASE,
  createProfileRepositoryHarness,
} from './user-profile-test-mocks.ts'

Deno.test('returning profile uses existing user without a write', async () => {
  const { client, calls } = createProfileRepositoryHarness()
  const user = await getProfileUser({
    supabase: client,
    telegramUserId: PROFILE_CASE.telegramUserId,
    requestId: PROFILE_CASE.requestId,
    logPrefix: PROFILE_CASE.logPrefix,
    createIfMissing: true,
  })

  assertEquals({ actual: user, expected: PROFILE_CASE.existingUser })
  assertEquals({ actual: calls.userUpsert, expected: PROFILE_CASE.noCalls })
})

Deno.test('first profile creates one user with database defaults', async () => {
  const { client, calls } = createProfileRepositoryHarness({ existingUser: null })
  const user = await getProfileUser({
    supabase: client,
    telegramUserId: PROFILE_CASE.telegramUserId,
    firstName: PROFILE_CASE.firstName,
    requestId: PROFILE_CASE.requestId,
    logPrefix: PROFILE_CASE.logPrefix,
    createIfMissing: true,
  })

  assertEquals({ actual: user, expected: PROFILE_CASE.createdUser })
  assertEquals({ actual: calls.userUpsert, expected: PROFILE_CASE.oneCall })
})

Deno.test('settings endpoint refuses an unknown user before writes', async () => {
  const { client, calls } = createProfileRepositoryHarness({ existingUser: null })
  let error: unknown
  try {
    await getProfileUser({
      supabase: client,
      telegramUserId: PROFILE_CASE.telegramUserId,
      requestId: PROFILE_CASE.requestId,
      logPrefix: PROFILE_CASE.logPrefix,
      createIfMissing: false,
    })
  } catch (caught) {
    error = caught
  }

  assertEquals({
    actual: error instanceof AppError ? error.code : null,
    expected: PROFILE_CASE.missingUserCode,
  })
  assertEquals({ actual: calls.userUpsert, expected: PROFILE_CASE.noCalls })
  assertEquals({ actual: calls.settingsUpsert, expected: PROFILE_CASE.noCalls })
})

Deno.test('settings save keeps an existing completion timestamp', async () => {
  const { client, calls } = createProfileRepositoryHarness({ updatedUser: null })
  const result = await saveProfileSettings({
    supabase: client,
    user: PROFILE_CASE.existingUser,
    settings: PROFILE_CASE.settings,
    nowIso: PROFILE_CASE.nowIso,
    logPrefix: PROFILE_CASE.logPrefix,
  })

  assertEquals({ actual: result.user, expected: PROFILE_CASE.existingUser })
  assertEquals({ actual: result.settings, expected: PROFILE_CASE.settings })
  assertEquals({ actual: calls.settingsUpsert, expected: PROFILE_CASE.oneCall })
  assertEquals({ actual: calls.userUpdate, expected: PROFILE_CASE.oneCall })
})

Deno.test('auth response exposes only the agreed internal profile fields', () => {
  const response = mapAuthProfileResponse({
    user: PROFILE_CASE.existingUser,
    settings: PROFILE_CASE.settings,
    subscription: PROFILE_CASE.subscriptionSummary,
    homeProgress: PROFILE_CASE.homeProgress,
    streakDays: PROFILE_CASE.streakDays,
    completedReadingTextCount: PROFILE_CASE.completedReadingTextCount,
  })

  assertEquals({
    actual: response.user,
    expected: PROFILE_CASE.expectedExistingUser,
  })
  assertEquals({
    actual: response.settings,
    expected: PROFILE_CASE.expectedSettings,
  })
  assertEquals({
    actual: response.completedReadingTextCount,
    expected: PROFILE_CASE.completedReadingTextCount,
  })
})

Deno.test('first settings response has a completed timestamp', () => {
  const response = mapSavedSettingsResponse({
    user: PROFILE_CASE.createdUser,
    settings: PROFILE_CASE.settings,
    subscription: PROFILE_CASE.subscriptionSummary,
    homeProgress: PROFILE_CASE.homeProgress,
    nowIso: PROFILE_CASE.nowIso,
  })
  assertEquals({
    actual: response.user,
    expected: PROFILE_CASE.expectedCreatedUserAfterSettings,
  })
})

Deno.test('server role matrix preserves internal and free quotas', () => {
  for (const testCase of PROFILE_CASE.accessCases) {
    const result = resolveAccessContext({
      role: testCase.role,
      activeSubscription: null,
      scheduledSubscription: null,
    })
    assertEquals({
      actual: result.hasInternalAccess,
      expected: testCase.hasInternalAccess,
    })
    assertEquals({
      actual: result.hasPaidAccess,
      expected: testCase.hasPaidAccess,
    })
    assertEquals({
      actual: result.limits.dailyReadingGenerations,
      expected: testCase.dailyReadingGenerations,
    })
    assertEquals({
      actual: result.limits.vocabularyWordsLimit,
      expected: testCase.vocabularyWordsLimit,
    })
    assertEquals({
      actual: result.dailyVocabularyCardGenerationLimit,
      expected: testCase.dailyVocabularyCardGenerationLimit,
    })
  }
})

Deno.test('a user with active subscription gets paid limits', () => {
  const result = resolveAccessContext({
    role: PROFILE_CASE.subscribedUserRole,
    activeSubscription: PROFILE_CASE.subscription,
    scheduledSubscription: null,
  })
  assertEquals({ actual: result.hasPaidAccess, expected: true })
  assertEquals({
    actual: result.limits.dailyReadingGenerations,
    expected: PROFILE_CASE.paidReadingGenerations,
  })
})

Deno.test('hidden subscription endpoint rejects a disabled flow', () => {
  let error: unknown
  try {
    assertSubscriptionFlowEnabled(PROFILE_CASE.subscriptionDisabledValue)
  } catch (caught) {
    error = caught
  }

  assertEquals({
    actual: error instanceof AppError ? error.code : null,
    expected: PROFILE_CASE.subscriptionDisabledCode,
  })
  assertEquals({
    actual: error instanceof AppError ? error.status : null,
    expected: PROFILE_CASE.subscriptionDisabledStatus,
  })
  assertSubscriptionFlowEnabled(PROFILE_CASE.subscriptionEnabledValue)
})
