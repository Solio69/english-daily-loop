import { invokeFunction } from './functionClient'
import type { ReadingHistoryPage } from '../types/materials'
import { requireReadingHistoryPage } from './materialsContracts'

export const HISTORY_PAGE_LIMIT = 10

export const getReadingHistory = async ({
  cursor = null,
  limit = HISTORY_PAGE_LIMIT,
}: {
  cursor?: string | null
  limit?: number
} = {}): Promise<ReadingHistoryPage> =>
  requireReadingHistoryPage(
    await invokeFunction<unknown>(
      'get-reading-history',
      { cursor, limit },
      'Не удалось загрузить прочитанные тексты.',
    ),
  )
