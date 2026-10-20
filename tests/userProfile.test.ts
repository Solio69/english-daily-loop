import assert from 'node:assert/strict'
import test from 'node:test'
import { applySavedSettings } from '../src/utils/userProfile'
import {
  requireAuthProfile,
  requireSavedSettings,
} from '../src/services/userContracts'
import { PROFILE_CONTRACT_MOCKS, PROFILE_MOCKS } from './mocks/userProfile'

test('settings save uses server progress when no local action raced it', () => {
  const result = applySavedSettings({
    currentUser: PROFILE_MOCKS.original,
    requestProfile: PROFILE_MOCKS.original,
    response: PROFILE_MOCKS.saved,
  })

  assert.deepEqual(result?.settings, PROFILE_MOCKS.saved.settings)
  assert.deepEqual(result?.homeProgress, PROFILE_MOCKS.saved.homeProgress)
  assert.equal(result?.streakDays, PROFILE_MOCKS.original.streakDays)
})

test('settings save preserves progress and counters updated during the request', () => {
  const currentUser = {
    ...PROFILE_MOCKS.original,
    ...PROFILE_MOCKS.updatedDuringSave,
  }
  const result = applySavedSettings({
    currentUser,
    requestProfile: PROFILE_MOCKS.original,
    response: PROFILE_MOCKS.saved,
  })

  assert.deepEqual(result?.settings, PROFILE_MOCKS.saved.settings)
  assert.deepEqual(
    result?.homeProgress,
    PROFILE_MOCKS.updatedDuringSave.homeProgress,
  )
  assert.equal(result?.streakDays, PROFILE_MOCKS.updatedDuringSave.streakDays)
  assert.equal(
    result?.completedReadingTextCount,
    PROFILE_MOCKS.updatedDuringSave.completedReadingTextCount,
  )
  assert.equal(
    result?.firstTextCompletedAt,
    PROFILE_MOCKS.updatedDuringSave.firstTextCompletedAt,
  )
})

test('profile contract accepts complete auth and settings responses', () => {
  assert.deepEqual(
    requireAuthProfile(PROFILE_CONTRACT_MOCKS.auth),
    PROFILE_CONTRACT_MOCKS.auth,
  )
  assert.deepEqual(
    requireSavedSettings(PROFILE_MOCKS.saved),
    PROFILE_MOCKS.saved,
  )
})

test('profile contract rejects invalid role and incomplete progress safely', () => {
  const invalidRole = {
    ...PROFILE_CONTRACT_MOCKS.auth,
    user: {
      ...PROFILE_CONTRACT_MOCKS.auth.user,
      role: PROFILE_CONTRACT_MOCKS.invalidRole,
    },
  }

  assert.throws(() => requireAuthProfile(invalidRole), {
    message: PROFILE_CONTRACT_MOCKS.errorMessage,
  })
  assert.throws(
    () => requireSavedSettings(PROFILE_CONTRACT_MOCKS.missingProgress),
    { message: PROFILE_CONTRACT_MOCKS.errorMessage },
  )
})
