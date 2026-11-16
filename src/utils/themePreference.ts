export type Theme = 'light' | 'dark'
export type ThemePreference = 'system' | Theme

export const isThemePreference = (
  value: string | null,
): value is ThemePreference =>
  value === 'system' || value === 'light' || value === 'dark'

export const resolveSystemTheme = ({
  telegramColorScheme,
  browserPrefersDark,
}: {
  telegramColorScheme: string | null | undefined
  browserPrefersDark: boolean
}): Theme => {
  if (telegramColorScheme === 'dark' || telegramColorScheme === 'light') {
    return telegramColorScheme
  }
  return browserPrefersDark ? 'dark' : 'light'
}

export const resolveEffectiveTheme = ({
  preference,
  systemTheme,
}: {
  preference: ThemePreference
  systemTheme: Theme
}): Theme => (preference === 'system' ? systemTheme : preference)
