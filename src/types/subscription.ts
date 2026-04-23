export type SubscriptionPlanType = "monthly" | "yearly";

export type SubscriptionTier = "free" | "paid";

export type SubscriptionLimits = {
  dailyReadingGenerations: number;
  vocabularyWordsLimit: number;
};

export type UserSubscription = {
  id: string;
  planType: SubscriptionPlanType;
  startsAt: string;
  endsAt: string;
};

export type SubscriptionSummary = {
  tier: SubscriptionTier;
  limits: SubscriptionLimits;
  activeSubscription: UserSubscription | null;
  scheduledSubscription: UserSubscription | null;
};
