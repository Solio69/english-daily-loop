import { fail } from './server.ts'

export const assertSubscriptionFlowEnabled = (
  value: string | null | undefined,
) => {
  if (value !== 'true') {
    fail(403, 'SUBSCRIPTION_FLOW_DISABLED', 'Subscription flow is disabled.')
  }
}
