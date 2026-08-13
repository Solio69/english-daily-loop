export const resolveHomeGreetingSession = (
  didSessionStartWithoutSettings: boolean | null,
  settingsCompletedAt: string | null,
): boolean =>
  didSessionStartWithoutSettings ?? (settingsCompletedAt === null);

export const getHomeGreeting = (
  didSessionStartWithoutSettings: boolean,
): string =>
  didSessionStartWithoutSettings ? "Добро пожаловать," : "С возвращением,";
