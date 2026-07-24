// @ts-nocheck
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
import {
  createServiceClient,
  getAppUserByTelegramId,
} from "../_shared/app.ts";
import { getMoscowStudyDate } from "../_shared/moscow-study-date.ts";
import {
  getVocabularyCardGenerationState,
} from "../_shared/vocabulary-card-generation.ts";

const LOG_PREFIX = "[get-vocabulary-state]";

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
    const body = await parseJsonBody<{ initData?: unknown }>(req);
    const tgUser = await getTelegramUserFromBody(
      body,
      env.TELEGRAM_BOT_TOKEN,
    );

    const supabase = createServiceClient(env);
    const appUser = await getAppUserByTelegramId(
      supabase,
      tgUser.id,
      LOG_PREFIX,
    );
    const studyDate = getMoscowStudyDate();
    const [
      { count: pendingCount, error: pendingError },
      { count: needsApprovalCount, error: needsApprovalError },
      { count: readyCount, error: readyError },
      { count: totalCount, error: totalError },
      cardGeneration,
    ] = await Promise.all([
      supabase
        .from("user_vocabulary_words")
        .select("id", { count: "exact", head: true })
        .eq("user_id", appUser.id)
        .eq("card_status", "pending"),
      supabase
        .from("user_vocabulary_words")
        .select("id", { count: "exact", head: true })
        .eq("user_id", appUser.id)
        .eq("card_status", "needs_approval"),
      supabase
        .from("user_vocabulary_words")
        .select("id", { count: "exact", head: true })
        .eq("user_id", appUser.id)
        .eq("card_status", "ready"),
      supabase
        .from("user_vocabulary_words")
        .select("id", { count: "exact", head: true })
        .eq("user_id", appUser.id),
      getVocabularyCardGenerationState(
        supabase,
        appUser.id,
        studyDate,
        LOG_PREFIX,
      ),
    ]);

    if (pendingError || needsApprovalError || readyError || totalError) {
      console.error("[get-vocabulary-state] failed to count vocabulary words", {
        appUserId: appUser.id,
        pendingError: pendingError?.message,
        needsApprovalError: needsApprovalError?.message,
        readyError: readyError?.message,
        totalError: totalError?.message,
      });
      fail(500, "VOCABULARY_STATE_LOAD_FAILED", "Failed to load vocabulary state.");
    }

    return successResponse(200, {
      pendingCount: pendingCount ?? 0,
      needsApprovalCount: needsApprovalCount ?? 0,
      readyCount: readyCount ?? 0,
      totalCount: totalCount ?? 0,
      cardGeneration,
    });
  } catch (error) {
    if (error instanceof AppError) {
      console.error("[get-vocabulary-state] request failed", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return errorResponse(error.status, error.code, error.message);
    }

    const message =
      error instanceof Error ? error.message : "Unknown vocabulary state error.";
    console.error("[get-vocabulary-state] failed", { message });
    return errorResponse(
      500,
      "VOCABULARY_STATE_FAILED",
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    );
  }
});
