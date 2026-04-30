// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import {
  AppError,
  DEFAULT_INTERNAL_ERROR_MESSAGE,
  assertPostRequest,
  errorResponse,
  fail,
  getRequiredEnv,
  getTelegramUserFromBody,
  handleCorsPreflight,
  parseJsonBody,
  successResponse,
} from "../_shared/server.ts";

type PlanType = "monthly" | "yearly";

type UserRow = {
  id: string;
  telegram_user_id: number;
};

type SubscriptionRow = {
  id: string;
  plan_type: PlanType;
  starts_at: string;
  ends_at: string;
};

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

const FREE_LIMITS = {
  dailyReadingGenerations: 3,
  vocabularyWordsLimit: 30,
};
const PAID_LIMITS = {
  dailyReadingGenerations: 10,
  vocabularyWordsLimit: 300,
};

const parsePlanType = (value: unknown): PlanType => {
  if (value === "monthly" || value === "yearly") {
    return value;
  }

  fail(400, "INVALID_PLAN_TYPE", "Subscription plan type is invalid.");
};

const mapSubscription = (row: SubscriptionRow | null) =>
  row
    ? {
        id: row.id,
        planType: row.plan_type,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
      }
    : null;

const getSubscriptionSummary = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  nowIso: string,
) => {
  const [
    { data: activeRows, error: activeError },
    { data: scheduledRows, error: scheduledError },
  ] = await Promise.all([
    supabase
      .from("user_subscriptions")
      .select("id, plan_type, starts_at, ends_at")
      .eq("user_id", userId)
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso)
      .order("ends_at", { ascending: false })
      .limit(1),
    supabase
      .from("user_subscriptions")
      .select("id, plan_type, starts_at, ends_at")
      .eq("user_id", userId)
      .gt("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(1),
  ]);

  if (activeError) {
    console.error("[activate-subscription] failed to load active subscription", {
      userId,
      error: activeError.message,
    });
    fail(500, "SUBSCRIPTION_LOAD_FAILED", "Failed to load subscription.");
  }

  if (scheduledError) {
    console.error("[activate-subscription] failed to load scheduled subscription", {
      userId,
      error: scheduledError.message,
    });
    fail(500, "SUBSCRIPTION_LOAD_FAILED", "Failed to load subscription.");
  }

  const activeSubscription = ((activeRows ?? [])[0] ??
    null) as SubscriptionRow | null;
  const scheduledSubscription = ((scheduledRows ?? [])[0] ??
    null) as SubscriptionRow | null;

  return {
    tier: activeSubscription ? "paid" : "free",
    limits: activeSubscription ? PAID_LIMITS : FREE_LIMITS,
    activeSubscription: mapSubscription(activeSubscription),
    scheduledSubscription: mapSubscription(scheduledSubscription),
  };
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

  try {
    assertPostRequest(req);

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

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id, telegram_user_id")
      .eq("telegram_user_id", tgUser.id)
      .maybeSingle();

    if (userError) {
      console.error("[activate-subscription] failed to load user", {
        telegramUserId: tgUser.id,
        error: userError.message,
      });
      fail(500, "USER_FIND_FAILED", "Failed to load user profile.");
    }

    if (!userRow) {
      fail(
        404,
        "USER_NOT_FOUND",
        "User profile was not found. Complete Telegram auth first.",
      );
    }

    const appUser = userRow as UserRow;
    const now = new Date();
    const nowIso = now.toISOString();
    await activateMvpSubscription(supabase, appUser.id, planType, nowIso);

    const subscription = await getSubscriptionSummary(
      supabase,
      appUser.id,
      nowIso,
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
