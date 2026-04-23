// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type PlanType = "monthly" | "yearly";

type TelegramUser = {
  id: number;
};

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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;
const FREE_LIMITS = {
  dailyReadingGenerations: 3,
  vocabularyWordsLimit: 30,
};
const PAID_LIMITS = {
  dailyReadingGenerations: 10,
  vocabularyWordsLimit: 300,
};
const PLAN_DURATION_DAYS: Record<PlanType, number> = {
  monthly: 1,
  yearly: 7,
};
const textEncoder = new TextEncoder();

class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const fail = (status: number, code: string, message: string): never => {
  throw new AppError(status, code, message);
};

const jsonResponse = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

const successResponse = (status: number, data: unknown): Response =>
  jsonResponse(status, { ok: true, data });

const errorResponse = (
  status: number,
  code: string,
  message: string,
): Response => jsonResponse(status, { ok: false, error: { code, message } });

const parsePlanType = (value: unknown): PlanType => {
  if (value === "monthly" || value === "yearly") {
    return value;
  }
  fail(400, "INVALID_PLAN_TYPE", "Subscription plan type is invalid.");
};

const toBufferSource = (value: Uint8Array): BufferSource => {
  const view = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return view as BufferSource;
};

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};

const hmacSha256 = async (
  key: Uint8Array,
  data: string,
): Promise<Uint8Array> => {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toBufferSource(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    toBufferSource(textEncoder.encode(data)),
  );
  return new Uint8Array(signature);
};

const buildDataCheckString = (params: URLSearchParams): string => {
  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort((a, b) => a.localeCompare(b));
  return pairs.join("\n");
};

const validateTelegramInitData = async (
  rawInitData: string,
  botToken: string,
): Promise<TelegramUser> => {
  const params = new URLSearchParams(rawInitData);
  const userRaw = params.get("user");
  const receivedHash = params.get("hash");
  const authDateRaw = params.get("auth_date");

  if (!userRaw || !receivedHash || !authDateRaw) {
    fail(401, "AUTH_VALIDATION_FAILED", "Telegram initData is incomplete.");
  }

  const authDate = Number(authDateRaw);
  if (!Number.isFinite(authDate)) {
    fail(401, "AUTH_VALIDATION_FAILED", "Telegram auth_date is invalid.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > MAX_AUTH_AGE_SECONDS) {
    fail(
      401,
      "AUTH_VALIDATION_FAILED",
      "Telegram initData is too old. Reopen the Mini App.",
    );
  }

  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw) as TelegramUser;
  } catch {
    fail(401, "AUTH_VALIDATION_FAILED", "Telegram user payload is invalid.");
  }

  if (!user.id) {
    fail(401, "AUTH_VALIDATION_FAILED", "Telegram user id is missing.");
  }

  const dataCheckString = buildDataCheckString(params);
  const secretKey = await hmacSha256(
    textEncoder.encode("WebAppData"),
    botToken,
  );
  const expectedHash = toHex(await hmacSha256(secretKey, dataCheckString));

  if (!timingSafeEqual(expectedHash, receivedHash.toLowerCase())) {
    fail(
      401,
      "AUTH_VALIDATION_FAILED",
      "Telegram initData signature is not valid.",
    );
  }

  return user;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Method Not Allowed");
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim();

    if (!supabaseUrl || !serviceRoleKey || !botToken) {
      return errorResponse(
        500,
        "SERVER_ENV_MISCONFIGURED",
        "Server env vars are not configured.",
      );
    }

    let body: { initData?: unknown; planType?: unknown };
    try {
      body = (await req.json()) as { initData?: unknown; planType?: unknown };
    } catch {
      fail(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    const initData =
      typeof body?.initData === "string" ? body.initData.trim() : "";
    if (!initData) {
      fail(400, "INIT_DATA_REQUIRED", "initData is required.");
    }

    const planType = parsePlanType(body?.planType);
    const tgUser = await validateTelegramInitData(initData, botToken);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

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
    const currentSummary = await getSubscriptionSummary(
      supabase,
      appUser.id,
      nowIso,
    );
    const active = currentSummary.activeSubscription;
    const scheduled = currentSummary.scheduledSubscription;

    if (active?.planType === "yearly") {
      fail(
        409,
        "YEARLY_ALREADY_ACTIVE",
        "Yearly subscription is already active.",
      );
    }

    if (active?.planType === "monthly" && planType === "monthly") {
      fail(
        409,
        "MONTHLY_ALREADY_ACTIVE",
        "Monthly subscription is already active.",
      );
    }

    if (active?.planType === "monthly" && planType === "yearly" && scheduled) {
      fail(
        409,
        "YEARLY_ALREADY_SCHEDULED",
        "Yearly subscription is already scheduled.",
      );
    }

    const startsAt =
      active?.planType === "monthly" && planType === "yearly"
        ? new Date(active.endsAt)
        : now;
    const endsAt = addDays(startsAt, PLAN_DURATION_DAYS[planType]);

    const { error: insertError } = await supabase
      .from("user_subscriptions")
      .insert({
        user_id: appUser.id,
        plan_type: planType,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        source: "mvp_zero_price",
      });

    if (insertError) {
      console.error("[activate-subscription] failed to create subscription", {
        appUserId: appUser.id,
        planType,
        error: insertError.message,
      });
      fail(500, "SUBSCRIPTION_CREATE_FAILED", "Failed to activate subscription.");
    }

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
    return errorResponse(500, "SUBSCRIPTION_ACTIVATION_FAILED", message);
  }
});
