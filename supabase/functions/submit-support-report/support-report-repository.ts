import { fail } from '../_shared/server.ts'
import type { ServiceClient } from '../_shared/app.ts'
import type { PreparedSupportReport } from './sanitize-diagnostics.ts'
import type {
  SavedSupportReport,
  SupportReportDependencies,
  SupportReportUser,
} from './support-report-flow.ts'

const LOG_PREFIX = '[submit-support-report]'
const RATE_LIMIT_DB_SIGNAL = 'SUPPORT_REPORT_RATE_LIMITED'

export const createSupportReportRepository = ({
  supabase,
  requestId,
}: {
  supabase: ServiceClient
  requestId: string
}): SupportReportDependencies => {
  const getAppUser = async (
    telegramUserId: number,
  ): Promise<SupportReportUser> => {
    const { data, error } = await supabase
      .from('users')
      .select('id, app_role')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle()

    if (error) {
      console.error(LOG_PREFIX, { requestId, stage: 'user_lookup' })
      fail(500, 'USER_FIND_FAILED', 'Failed to load user profile.')
    }
    if (!data) {
      fail(
        404,
        'USER_NOT_FOUND',
        'User profile was not found. Complete Telegram auth first.',
      )
    }
    return data as SupportReportUser
  }

  const saveReport = async (
    user: SupportReportUser,
    report: PreparedSupportReport,
  ): Promise<SavedSupportReport> => {
    const { data, error } = await supabase.rpc('submit_support_report', {
      p_user_id: user.id,
      p_app_role: user.app_role,
      p_current_screen: report.currentScreen,
      p_user_comment: report.userComment,
      p_app_context: report.appContext,
      p_events: report.events,
      p_request_ids: report.requestIds,
      p_ai_diagnostics: report.aiDiagnostics,
    })

    if (error) {
      if (error.code === 'P0001' && error.message === RATE_LIMIT_DB_SIGNAL) {
        fail(
          429,
          RATE_LIMIT_DB_SIGNAL,
          'Слишком много отчетов за последний час. Попробуй позже.',
        )
      }
      console.error(LOG_PREFIX, { requestId, stage: 'report_save' })
      fail(500, 'SUPPORT_REPORT_SAVE_FAILED', 'Failed to save support report.')
    }

    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      typeof data.reportId !== 'string' ||
      typeof data.createdAt !== 'string'
    ) {
      console.error(LOG_PREFIX, { requestId, stage: 'invalid_rpc_result' })
      fail(500, 'SUPPORT_REPORT_SAVE_FAILED', 'Failed to save support report.')
    }

    return {
      reportId: data.reportId,
      createdAt: data.createdAt,
    }
  }

  return { getAppUser, saveReport }
}
