import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentAppUser } from '../services/userService'
import type { AppUser } from '../types/user'
import { getMoscowStudyDate } from '../utils/moscowStudyDate'
import { resolveHomeGreetingSession } from '../utils/homeGreeting'
import type { ShowToast } from './useToast'

type UseAppUserProfileParams = {
  onReady: () => void
  showToast: ShowToast
}

export const useAppUserProfile = ({
  onReady,
  showToast,
}: UseAppUserProfileParams) => {
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [didSessionStartWithoutSettings, setDidSessionStartWithoutSettings] =
    useState<boolean | null>(null)
  const bootstrapInFlight = useRef(false)
  const initialBootstrapStarted = useRef(false)
  const [profileSnapshotDate, setProfileSnapshotDate] = useState(() =>
    getMoscowStudyDate(),
  )

  const appUserId = appUser?.id ?? null

  const refreshCurrentUser = useCallback(async () => {
    const user = await getCurrentAppUser()
    setAppUser(user)
    setDidSessionStartWithoutSettings((currentValue) =>
      resolveHomeGreetingSession(currentValue, user.settingsCompletedAt),
    )
    setProfileSnapshotDate(getMoscowStudyDate())
    return user
  }, [])

  const retryBootstrap = useCallback(async () => {
    if (bootstrapInFlight.current) return

    bootstrapInFlight.current = true
    setAuthError(null)
    setIsBootstrapping(true)
    try {
      window.Telegram?.WebApp?.ready?.()
      await refreshCurrentUser()
      onReady()
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить профиль пользователя.',
      )
    } finally {
      bootstrapInFlight.current = false
      setIsBootstrapping(false)
    }
  }, [onReady, refreshCurrentUser])

  useEffect(() => {
    if (initialBootstrapStarted.current) return
    initialBootstrapStarted.current = true
    void retryBootstrap()
  }, [retryBootstrap])

  useEffect(() => {
    if (isBootstrapping || !appUserId) return

    let isRefreshing = false
    const refreshIfDateChanged = async () => {
      if (document.visibilityState === 'hidden') return

      const currentDate = getMoscowStudyDate()
      if (currentDate === profileSnapshotDate || isRefreshing) return

      isRefreshing = true
      try {
        await refreshCurrentUser()
      } catch (error) {
        showToast(
          error instanceof Error
            ? error.message
            : 'Не удалось обновить дневной прогресс.',
          'error',
        )
      } finally {
        isRefreshing = false
      }
    }
    const refreshHandler = () => {
      void refreshIfDateChanged()
    }

    window.addEventListener('focus', refreshHandler)
    document.addEventListener('visibilitychange', refreshHandler)
    const interval = window.setInterval(refreshHandler, 60_000)

    return () => {
      window.removeEventListener('focus', refreshHandler)
      document.removeEventListener('visibilitychange', refreshHandler)
      window.clearInterval(interval)
    }
  }, [
    appUserId,
    isBootstrapping,
    profileSnapshotDate,
    refreshCurrentUser,
    showToast,
  ])

  return {
    appUser,
    setAppUser,
    isBootstrapping,
    authError,
    didSessionStartWithoutSettings,
    retryBootstrap,
    refreshCurrentUser,
  }
}
