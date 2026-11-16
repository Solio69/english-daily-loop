import type {
  DevToolAction,
  DevToolActionOptions,
  DevToolsResult,
} from '../types/devTools'
import { invokeFunction } from './functionClient'

export const runDevToolAction = async (
  action: DevToolAction,
  options: DevToolActionOptions = {},
): Promise<DevToolsResult> =>
  invokeFunction<DevToolsResult>(
    'dev-tools',
    { action, ...options },
    'Не удалось выполнить dev-действие.',
  )
