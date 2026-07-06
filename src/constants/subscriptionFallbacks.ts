import type { SubscriptionSummary } from "../types/subscription";

// Used only as a client bootstrap fallback; server access helpers are the source of truth.
export const DEFAULT_FREE_SUBSCRIPTION_SUMMARY: SubscriptionSummary = {
  tier: "free",
  accessType: "free",
  limits: {
    dailyReadingGenerations: 3,
    vocabularyWordsLimit: 30,
  },
  activeSubscription: null,
  scheduledSubscription: null,
};
