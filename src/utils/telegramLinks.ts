const TELEGRAM_USERNAME_PATTERN = /^[A-Za-z0-9_]{5,32}$/;

export const getTelegramProfileUrl = (
  username: string | undefined,
): string | null => {
  const normalizedUsername = username?.trim().replace(/^@/, "") ?? "";

  if (!TELEGRAM_USERNAME_PATTERN.test(normalizedUsername)) {
    return null;
  }

  return `https://t.me/${normalizedUsername}`;
};

export const openTelegramLink = (url: string): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  const telegramWebApp = window.Telegram?.WebApp;

  if (telegramWebApp?.openTelegramLink) {
    telegramWebApp.openTelegramLink(url);
    return true;
  }

  window.open(url, "_blank", "noopener,noreferrer");
  return true;
};
