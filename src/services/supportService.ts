import type { AppUser } from "../types/user";
import { clientLogger, type ClientLogEvent } from "./clientLogger";
import { invokeFunction } from "./functionClient";

export type SubmitSupportReportInput = {
  comment: string;
  currentScreen: string;
  appUser: AppUser | null;
};

export type SubmitSupportReportResult = {
  reportId: string;
  createdAt: string;
};

const collectRequestIds = (events: ClientLogEvent[]): string[] => {
  const requestIds = new Set<string>();

  for (const event of events) {
    const requestId = event.details?.requestId;
    if (typeof requestId === "string" && requestId.trim()) {
      requestIds.add(requestId.trim());
    }
  }

  return [...requestIds].slice(-50);
};

const collectAiDiagnostics = (
  events: ClientLogEvent[],
): Record<string, unknown>[] =>
  events
    .map((event) => event.details?.diagnostics)
    .filter(
      (diagnostics): diagnostics is Record<string, unknown> =>
        Boolean(diagnostics) &&
        typeof diagnostics === "object" &&
        !Array.isArray(diagnostics),
    )
    .slice(-20);

const buildAppContext = (
  appUser: AppUser | null,
): Record<string, unknown> => ({
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
  userAgent: navigator.userAgent,
  viewport: {
    width: window.innerWidth,
    height: window.innerHeight,
  },
  telegramColorScheme: window.Telegram?.WebApp?.colorScheme ?? null,
});

export const submitSupportReport = async ({
  comment,
  currentScreen,
  appUser,
}: SubmitSupportReportInput): Promise<SubmitSupportReportResult> => {
  const events = clientLogger.getSnapshot();

  const result = await invokeFunction<SubmitSupportReportResult>(
    "submit-support-report",
    {
      comment,
      currentScreen,
      appContext: buildAppContext(appUser),
      events,
      requestIds: collectRequestIds(events),
      aiDiagnostics: collectAiDiagnostics(events),
    },
    "Не удалось отправить отчет.",
  );

  clientLogger.info("support_report_submitted", {
    reportId: result.reportId,
  });

  return result;
};
