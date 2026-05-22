import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "light" | "dark";
export type ThemePreference = "system" | Theme;

const THEME_STORAGE_KEY = "english-daily-loop-theme-preference";
const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

type ThemeContextValue = {
  effectiveTheme: Theme;
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  effectiveTheme: "light",
  themePreference: "system",
  setThemePreference: () => {},
});

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === "system" || value === "light" || value === "dark";

const getStoredThemePreference = (): ThemePreference => {
  try {
    const storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(storedPreference) ? storedPreference : "system";
  } catch {
    return "system";
  }
};

const getTelegramTheme = (): Theme | null => {
  const colorScheme = window.Telegram?.WebApp?.colorScheme;
  return colorScheme === "dark" || colorScheme === "light"
    ? colorScheme
    : null;
};

const getBrowserTheme = (): Theme => {
  if (window.matchMedia?.(THEME_MEDIA_QUERY).matches) {
    return "dark";
  }

  return "light";
};

const getSystemTheme = (): Theme => getTelegramTheme() ?? getBrowserTheme();

const applyThemeToDocument = (
  theme: Theme,
  themePreference: ThemePreference,
) => {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.themePreference = themePreference;
  document.documentElement.style.colorScheme = theme;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>(getStoredThemePreference);
  const [systemTheme, setSystemTheme] = useState<Theme>(getSystemTheme);

  const effectiveTheme: Theme =
    themePreference === "system" ? systemTheme : themePreference;

  const setThemePreference = useCallback((preference: ThemePreference) => {
    setThemePreferenceState(preference);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // localStorage may be unavailable in restricted webviews; UI state still works.
    }
  }, []);

  useEffect(() => {
    const updateSystemTheme = () => setSystemTheme(getSystemTheme());
    const webApp = window.Telegram?.WebApp;
    const mediaQuery = window.matchMedia?.(THEME_MEDIA_QUERY);

    webApp?.onEvent?.("themeChanged", updateSystemTheme);
    mediaQuery?.addEventListener?.("change", updateSystemTheme);

    updateSystemTheme();

    return () => {
      webApp?.offEvent?.("themeChanged", updateSystemTheme);
      mediaQuery?.removeEventListener?.("change", updateSystemTheme);
    };
  }, []);

  useEffect(() => {
    applyThemeToDocument(effectiveTheme, themePreference);
  }, [effectiveTheme, themePreference]);

  const contextValue = useMemo(
    () => ({
      effectiveTheme,
      themePreference,
      setThemePreference,
    }),
    [effectiveTheme, setThemePreference, themePreference],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
