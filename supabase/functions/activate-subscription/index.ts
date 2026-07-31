// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import {
  AppError,
  DEFAULT_INTERNAL_ERROR_MESSAGE,
  assertPostRequest,
  errorResponse,
  fail,
  getOptionalEnv,
  getRequiredEnv,
  getRequestId,
  getTelegramUserFromBody,
  handleCorsPreflight,
  parseJsonBody,
  successResponse,
} from "../_shared/server.ts";
import { getSubscriptionSummary } from "../_shared/access.ts";
import { getAppUserByTelegramId } from "../_shared/app.ts";

type PlanType = "monthly" | "yearly";

type ActivateMvpSubscriptionResult =
  | {
      ok: true;
      subscriptionId: string;
      planType: PlanType;
      startsAt: string;
      endsAt: string;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

const parsePlanType = (value: unknown): PlanType => {
  if (value === "monthly" || value === "yearly") {
    return value;
  }

  fail(400, "INVALID_PLAN_TYPE", "Subscription plan type is invalid.");
};

const activateMvpSubscription = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  planType: PlanType,
  nowIso: string,
): Promise<Extract<ActivateMvpSubscriptionResult, { ok: true }>> => {
  const { data, error } = await supabase.rpc("activate_mvp_subscription", {
    p_user_id: userId,
    p_plan_type: planType,
    p_now: nowIso,
  });

  if (error) {
    console.error("[activate-subscription] failed to activate subscription transaction", {
      appUserId: userId,
      planType,
      error: error.message,
    });
    fail(500, "SUBSCRIPTION_ACTIVATION_TRANSACTION_FAILED", "Failed to activate subscription.");
  }

  const result = data as ActivateMvpSubscriptionResult | null;
  if (!result) {
    fail(500, "SUBSCRIPTION_ACTIVATION_TRANSACTION_FAILED", "Empty subscription activation result.");
  }

  if (!result.ok) {
    fail(
      result.code === "INVALID_PLAN_TYPE" ? 400 : 409,
      result.code,
      result.message,
    );
  }

  return result;
};

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) {
    return corsResponse;
  }

  const requestId = getRequestId(req);

  try {
    assertPostRequest(req);

    if (getOptionalEnv("SUBSCRIPTION_FLOW_ENABLED") !== "true") {
      fail(
        403,
        "SUBSCRIPTION_FLOW_DISABLED",
        "Subscription flow is disabled.",
      );
    }

    const env = getRequiredEnv([
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "TELEGRAM_BOT_TOKEN",
    ]);

    const body = await parseJsonBody<{
      initData?: unknown;
      planType?: unknown;
    }>(req);

    const planType = parsePlanType(body?.planType);
    const tgUser = await getTelegramUserFromBody(
      body,
      env.TELEGRAM_BOT_TOKEN,
    );

    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false },
      },
    );

    const appUser = await getAppUserByTelegramId(
      supabase,
      tgUser.id,
      "[activate-subscription]",
      requestId,
    );
    const now = new Date();
    const nowIso = now.toISOString();
    await activateMvpSubscription(supabase, appUser.id, planType, nowIso);

    const subscription = await getSubscriptionSummary(
      supabase,
      appUser.id,
      "[activate-subscription]",
    );

    return successResponse(200, { subscription });
  } catch (error) {
    if (error instanceof AppError) {
      console.error("[activate-subscription] request failed", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return errorResponse(error.status, error.code, error.message);
    }

    const message =
      error instanceof Error ? error.message : "Unknown subscription error.";
    console.error("[activate-subscription] failed", { message });
    return errorResponse(
      500,
      "SUBSCRIPTION_ACTIVATION_FAILED",
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    );
  }
});
