import type { AppUser } from "../types/user";
import { clientLogger, type ClientLogEvent } from "./clientLogger";
import { invokeFunction } from "./functionClient";
import { buildSupportAppContext } from "./supportAppContext";

export { buildSupportAppContext } from "./supportAppContext";

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
      appContext: buildSupportAppContext(appUser),
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
