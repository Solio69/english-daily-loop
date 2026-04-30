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
  getTelegramUserFromBody,
  handleCorsPreflight,
  parseJsonBody,
  successResponse,
} from "../_shared/server.ts";

type DevToolAction =
  | "reset_generation_attempts"
  | "delete_today_reading_completion"
  | "reset_subscriptions";

type UserRow = {
  id: string;
  telegram_user_id: number;
};

const MOSCOW_TIME_ZONE = "Europe/Moscow";

// TODO: Local dev-only Edge Function; keep server env gate mandatory before DB mutations.
const parseAction = (value: unknown): DevToolAction => {
  if (
    value === "reset_generation_attempts" ||
    value === "delete_today_reading_completion" ||
    value === "reset_subscriptions"
  ) {
    return value;
  }

  fail(400, "INVALID_DEV_TOOL_ACTION", "Dev tool action is invalid.");
};

const getMoscowDate = (): string => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: MOSCOW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
};

const getAppUser = async (
  supabase: ReturnType<typeof createClient>,
  telegramUserId: number,
): Promise<UserRow> => {
  const { data, error } = await supabase
    .from("users")
    .select("id, telegram_user_id")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();

  if (error) {
    console.error("[dev-tools] failed to load user", {
      telegramUserId,
      error: error.message,
    });
    fail(500, "USER_FIND_FAILED", "Failed to load user profile.");
  }

  if (!data) {
    fail(
      404,
      "USER_NOT_FOUND",
      "User profile was not found. Complete Telegram auth first.",
    );
  }

  return data as UserRow;
};

const resetGenerationAttempts = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  today: string,
) => {
  const { count, error } = await supabase
    .from("reading_generation_attempts")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("attempt_date", today);

  if (error) {
    console.error("[dev-tools] failed to reset generation attempts", {
      userId,
      today,
      error: error.message,
    });
    fail(500, "DEV_TOOL_ACTION_FAILED", "Failed to reset generation attempts.");
  }

  return { generationAttempts: count ?? 0 };
};

const deleteTodayReadingCompletion = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  today: string,
) => {
  const { count: completedTextsCount, error: completedTextsError } =
    await supabase
      .from("user_completed_reading_texts")
      .delete({ count: "exact" })
      .eq("user_id", userId)
      .eq("completed_date", today);

  if (completedTextsError) {
    console.error("[dev-tools] failed to delete completed reading texts", {
      userId,
      today,
      error: completedTextsError.message,
    });
    fail(500, "DEV_TOOL_ACTION_FAILED", "Failed to delete completed texts.");
  }

  const { count: completionsCount, error: completionsError } = await supabase
    .from("user_daily_reading_completions")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("completed_date", today);

  if (completionsError) {
    console.error("[dev-tools] failed to delete daily reading completion", {
      userId,
      today,
      error: completionsError.message,
    });
    fail(500, "DEV_TOOL_ACTION_FAILED", "Failed to delete reading completion.");
  }

  return {
    dailyReadingCompletions: completionsCount ?? 0,
    completedReadingTexts: completedTextsCount ?? 0,
  };
};

const resetSubscriptions = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
) => {
  const { count, error } = await supabase
    .from("user_subscriptions")
    .delete({ count: "exact" })
    .eq("user_id", userId);

  if (error) {
    console.error("[dev-tools] failed to reset subscriptions", {
      userId,
      error: error.message,
    });
    fail(500, "DEV_TOOL_ACTION_FAILED", "Failed to reset subscriptions.");
  }

  return { subscriptions: count ?? 0 };
};

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) {
    return corsResponse;
  }

  try {
    assertPostRequest(req);

    const devToolsEnabled = getOptionalEnv("DEV_TOOLS_ENABLED") === "true";
    if (!devToolsEnabled) {
      fail(403, "DEV_TOOLS_DISABLED", "Dev tools are disabled.");
    }

    const env = getRequiredEnv([
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "TELEGRAM_BOT_TOKEN",
    ]);

    const body = await parseJsonBody<{
      initData?: unknown;
      action?: unknown;
    }>(req);

    const action = parseAction(body?.action);
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
    const appUser = await getAppUser(supabase, tgUser.id);
    const today = getMoscowDate();

    const deleted =
      action === "reset_generation_attempts"
        ? await resetGenerationAttempts(supabase, appUser.id, today)
        : action === "delete_today_reading_completion"
          ? await deleteTodayReadingCompletion(supabase, appUser.id, today)
          : await resetSubscriptions(supabase, appUser.id);

    return successResponse(200, {
      action,
      today,
      deleted,
    });
  } catch (error) {
    if (error instanceof AppError) {
      console.error("[dev-tools] request failed", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return errorResponse(error.status, error.code, error.message);
    }

    const message =
      error instanceof Error ? error.message : "Unknown dev tools error.";
    console.error("[dev-tools] failed", { message });
    return errorResponse(
      500,
      "DEV_TOOLS_FAILED",
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    );
  }
});
