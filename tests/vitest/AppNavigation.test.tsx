import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAppNavigation } from '../../src/hooks/useAppNavigation'
import type { AppScreen } from '../../src/hooks/useAppNavigation'
import type { LessonCurrentStep } from '../../src/types/homeProgress'
import { APP_SHELL, APP_SHELL_NAVIGATION_CASES } from '../mocks/appShell'

describe('useAppNavigation', () => {
  it('keeps onboarding closed and continues a reading lesson into vocabulary', () => {
    const navigateTo =
      vi.fn<(screen: AppScreen, options?: { root?: boolean }) => void>()
    const navigateBack = vi.fn()
    const showToast = vi.fn()
    const { result, rerender } = renderHook(
      ({
        currentScreen,
        isSettingsCompleted,
        lessonCurrentStep,
      }: {
        currentScreen: AppScreen
        isSettingsCompleted: boolean
        lessonCurrentStep: LessonCurrentStep
      }) =>
        useAppNavigation({
          currentScreen,
          isSettingsCompleted,
          lessonCurrentStep,
          navigateTo,
          navigateBack,
          showToast,
        }),
      { initialProps: APP_SHELL_NAVIGATION_CASES.firstSetup },
    )

    act(() => result.current.openLesson())
    expect(navigateTo).toHaveBeenCalledWith(APP_SHELL.settingsScreen)
    act(() => result.current.openMaterials(APP_SHELL.vocabularyScreen))
    expect(showToast).toHaveBeenCalledWith(
      APP_SHELL.onboardingMessage,
      APP_SHELL.onboardingTone,
    )

    rerender(APP_SHELL_NAVIGATION_CASES.ready)
    act(() => result.current.openLesson())
    expect(navigateTo).toHaveBeenCalledWith(APP_SHELL.readingScreen)
    expect(result.current.continueLessonAfterReading).toBe(true)
    act(() => result.current.handleContinueLessonAfterReading())
    expect(navigateTo).toHaveBeenCalledWith(
      APP_SHELL.vocabularyScreen,
      APP_SHELL_NAVIGATION_CASES.rootOptions,
    )
    expect(result.current.continueLessonAfterReading).toBe(false)
  })

  it('keeps the selected materials tab and root navigation contract', () => {
    const navigateTo =
      vi.fn<(screen: AppScreen, options?: { root?: boolean }) => void>()
    const { result } = renderHook(() =>
      useAppNavigation({
        ...APP_SHELL_NAVIGATION_CASES.ready,
        navigateTo,
        navigateBack: vi.fn(),
        showToast: vi.fn(),
      }),
    )

    act(() => result.current.openMaterials('texts'))
    expect(result.current.materialsInitialTab).toBe('texts')
    expect(navigateTo).toHaveBeenCalledWith(APP_SHELL.materialsScreen)
    act(() => result.current.handleNavChange(APP_SHELL.materialsScreen))
    expect(result.current.materialsInitialTab).toBe('vocabulary')
    expect(navigateTo).toHaveBeenCalledWith(
      APP_SHELL.materialsScreen,
      APP_SHELL_NAVIGATION_CASES.rootOptions,
    )
  })
})
