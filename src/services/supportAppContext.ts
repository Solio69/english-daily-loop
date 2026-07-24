import {
  releaseMetadata,
  type ReleaseMetadata,
} from "../config/releaseMetadata";
import type { AppUser } from "../types/user";

export type SupportBrowserContext = {
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };
  telegramColorScheme: string | null;
};

const collectBrowserContext = (): SupportBrowserContext => ({
  userAgent: navigator.userAgent,
  viewport: {
    width: window.innerWidth,
    height: window.innerHeight,
  },
  telegramColorScheme: window.Telegram?.WebApp?.colorScheme ?? null,
});

export const buildSupportAppContext = (
  appUser: AppUser | null,
  metadata: ReleaseMetadata = releaseMetadata,
  browserContext: SupportBrowserContext = collectBrowserContext(),
): Record<string, unknown> => ({
  appVersion: metadata.appVersion,
  buildId: metadata.buildId,
  environment: metadata.environment,
  appUserId: appUser?.id ?? null,
  telegramUserId: appUser?.telegramUserId ?? null,
  role: appUser?.role ?? null,
  settings: appUser?.settings ?? null,
  subscription: appUser
    ? {
        tier: appUser.subscription.tier,
        accessType: appUser.subscription.accessType,
        limits: appUser.subscription.limits,
      }
    : null,
  homeProgress: appUser?.homeProgress ?? null,
  streakDays: appUser?.streakDays ?? null,
  ...browserContext,
});
