import type { AppUser, SavedUserSettings } from '../types/user'

type ApplySavedSettingsParams = {
  currentUser: AppUser | null
  requestProfile: AppUser
  response: SavedUserSettings
}

export const applySavedSettings = ({
  currentUser,
  requestProfile,
  response,
}: ApplySavedSettingsParams): AppUser | null => {
  if (!currentUser) return null

  const homeProgress =
    currentUser.homeProgress === requestProfile.homeProgress
      ? response.homeProgress
      : currentUser.homeProgress
  const firstTextCompletedAt =
    currentUser.firstTextCompletedAt === requestProfile.firstTextCompletedAt
      ? response.user.firstTextCompletedAt
      : currentUser.firstTextCompletedAt

  return {
    ...currentUser,
    id: response.user.id,
    role: response.user.role,
    firstName: response.user.firstName,
    settingsCompletedAt: response.user.settingsCompletedAt,
    firstTextCompletedAt,
    settings: response.settings,
    subscription: response.subscription,
    homeProgress,
  }
}
