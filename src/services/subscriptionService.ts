import { invokeFunction } from "./functionClient";
import {
  SubscriptionPlanType,
  SubscriptionSummary,
} from "../types/subscription";

type ActivateSubscriptionPayload = {
  subscription: SubscriptionSummary;
};

export const activateSubscription = async (
  planType: SubscriptionPlanType,
): Promise<SubscriptionSummary> => {
  const payload = await invokeFunction<ActivateSubscriptionPayload>(
    "activate-subscription",
    { planType },
    "Не удалось оформить подписку. Попробуй еще раз.",
  );

  return payload.subscription;
};
