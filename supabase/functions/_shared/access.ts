/// <reference path="../deno-globals.d.ts" />

import type { ServiceClient } from "./app.ts";
import { fail } from "./server.ts";

export type AppRole = "admin" | "tester" | "user";

type SubscriptionRow = {
  id: string;
  plan_type: "monthly" | "yearly";
  starts_at: string;
  ends_at: string;
};

type SubscriptionLimits = {
  dailyReadingGenerations: number;
  vocabularyWordsLimit: number;
};

type AccessContext = {
  role: AppRole;
  hasInternalAccess: boolean;
  hasPaidAccess: boolean;
  limits: SubscriptionLimits;
  activeSubscription: SubscriptionRow | null;
  scheduledSubscription: SubscriptionRow | null;
  dailyVocabularyCardGenerationLimit: number;
};

const FREE_LIMITS: SubscriptionLimits = {
  dailyReadingGenerations: 3,
  vocabularyWordsLimit: 30,
};

const PAID_LIMITS: SubscriptionLimits = {
  dailyReadingGenerations: 10,
  vocabularyWordsLimit: 300,
};

const FREE_DAILY_CARD_GENERATION_LIMIT = 5;
const PAID_DAILY_CARD_GENERATION_LIMIT = 20;

const INTERNAL_ROLES: AppRole[] = ["admin", "tester"];

export const normalizeAppRole = (value: unknown): AppRole =>
  value === "admin" || value === "tester" || value === "user"
    ? value
    : "user";

export const isInternalAccessRole = (role: AppRole): boolean =>
  INTERNAL_ROLES.includes(role);

const mapSubscription = (row: SubscriptionRow | null) =>
  row
    ? {
        id: row.id,
        planType: row.plan_type,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
      }
    : null;

export const getUserRole = async (
  supabase: ServiceClient,
  userId: string,
  logPrefix: string,
): Promise<AppRole> => {
  const { data, error } = await supabase
    .from("users")
    .select("app_role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error(`${logPrefix} failed to load user role`, {
      appUserId: userId,
      error: error.message,
    });
    fail(500, "USER_ROLE_LOAD_FAILED", "Failed to load user access.");
  }

  if (!data) {
    fail(
      404,
      "USER_NOT_FOUND",
      "User profile was not found. Complete Telegram auth first.",
    );
  }

  return normalizeAppRole((data as { app_role?: unknown }).app_role);
};

const getSubscriptionRows = async (
  supabase: ServiceClient,
  userId: string,
  logPrefix: string,
) => {
  const nowIso = new Date().toISOString();
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

  if (activeError || scheduledError) {
    console.error(`${logPrefix} failed to load subscription`, {
      appUserId: userId,
      activeError: activeError?.message,
      scheduledError: scheduledError?.message,
    });
    fail(500, "SUBSCRIPTION_LOAD_FAILED", "Failed to load subscription.");
  }

  return {
    activeSubscription: ((activeRows ?? [])[0] ?? null) as SubscriptionRow | null,
    scheduledSubscription: ((scheduledRows ?? [])[0] ??
      null) as SubscriptionRow | null,
  };
};

export const getAccessContext = async (
  supabase: ServiceClient,
  userId: string,
  logPrefix: string,
): Promise<AccessContext> => {
  const [role, { activeSubscription, scheduledSubscription }] =
    await Promise.all([
      getUserRole(supabase, userId, logPrefix),
      getSubscriptionRows(supabase, userId, logPrefix),
    ]);
  const hasInternalAccess = isInternalAccessRole(role);
  const hasPaidAccess = hasInternalAccess || Boolean(activeSubscription);

  return {
    role,
    hasInternalAccess,
    hasPaidAccess,
    limits: hasPaidAccess ? PAID_LIMITS : FREE_LIMITS,
    activeSubscription,
    scheduledSubscription,
    dailyVocabularyCardGenerationLimit: hasPaidAccess
      ? PAID_DAILY_CARD_GENERATION_LIMIT
      : FREE_DAILY_CARD_GENERATION_LIMIT,
  };
};

export const getSubscriptionSummary = async (
  supabase: ServiceClient,
  userId: string,
  logPrefix: string,
) => {
  const access = await getAccessContext(supabase, userId, logPrefix);

  return {
    tier: access.hasPaidAccess ? "paid" : "free",
    accessType: access.hasInternalAccess
      ? "internal"
      : access.activeSubscription
        ? "subscription"
        : "free",
    limits: access.limits,
    activeSubscription: mapSubscription(access.activeSubscription),
    scheduledSubscription: mapSubscription(access.scheduledSubscription),
  };
};

export const getDailyReadingGenerationLimit = async (
  supabase: ServiceClient,
  userId: string,
  logPrefix: string,
): Promise<number> => {
  const access = await getAccessContext(supabase, userId, logPrefix);
  return access.limits.dailyReadingGenerations;
};

export const getVocabularyWordsLimit = async (
  supabase: ServiceClient,
  userId: string,
  logPrefix: string,
): Promise<number> => {
  const access = await getAccessContext(supabase, userId, logPrefix);
  return access.limits.vocabularyWordsLimit;
};

export const getDailyVocabularyCardGenerationLimit = async (
  supabase: ServiceClient,
  userId: string,
  logPrefix: string,
): Promise<number> => {
  const access = await getAccessContext(supabase, userId, logPrefix);
  return access.dailyVocabularyCardGenerationLimit;
};

export const assertAdminRole = async (
  supabase: ServiceClient,
  userId: string,
  logPrefix: string,
): Promise<void> => {
  const role = await getUserRole(supabase, userId, logPrefix);

  if (role !== "admin") {
    fail(403, "DEV_TOOLS_ADMIN_REQUIRED", "Dev tools require admin access.");
  }
};
