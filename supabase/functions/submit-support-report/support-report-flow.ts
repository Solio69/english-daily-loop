import { fail } from '../_shared/server.ts'
import {
  prepareSupportReport,
  type PreparedSupportReport,
} from './sanitize-diagnostics.ts'

export type SupportReportBody = {
  initData?: unknown
  comment?: unknown
  currentScreen?: unknown
  appContext?: unknown
  events?: unknown
  requestIds?: unknown
  aiDiagnostics?: unknown
}

export type SupportReportUser = {
  id: string
  app_role: 'admin' | 'tester' | 'user'
}

export type SavedSupportReport = {
  reportId: string
  createdAt: string
}

export type SupportReportDependencies = {
  getAppUser: (telegramUserId: number) => Promise<SupportReportUser>
  saveReport: (
    user: SupportReportUser,
    report: PreparedSupportReport,
  ) => Promise<SavedSupportReport>
}

export const submitSupportReportFlow = async ({
  body,
  telegramUserId,
  dependencies,
}: {
  body: SupportReportBody
  telegramUserId: number
  dependencies: SupportReportDependencies
}): Promise<SavedSupportReport> => {
  const comment = typeof body.comment === 'string' ? body.comment.trim() : ''
  if (!comment) {
    fail(400, 'SUPPORT_COMMENT_REQUIRED', 'Report comment is required.')
  }

  const user = await dependencies.getAppUser(telegramUserId)
  const report = prepareSupportReport({
    currentScreen: body.currentScreen,
    userComment: comment,
    appContext: body.appContext,
    events: body.events,
    requestIds: body.requestIds,
    aiDiagnostics: body.aiDiagnostics,
    telegramUserId,
  })
  return await dependencies.saveReport(user, report)
}
