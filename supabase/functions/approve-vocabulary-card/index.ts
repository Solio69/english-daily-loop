// @ts-nocheck
import {
  AppError,
  DEFAULT_INTERNAL_ERROR_MESSAGE,
  assertPostRequest,
  errorResponse,
  fail,
  getRequiredEnv,
  getRequestId,
  getTelegramUserFromBody,
  handleCorsPreflight,
  parseJsonBody,
  successResponse,
} from "../_shared/server.ts";
import {
  createServiceClient,
  getAppUserByTelegramId,
} from "../_shared/app.ts";

const parseWordId = (value: unknown): string => {
  const parsed = typeof value === "string" ? value.trim() : "";
  if (!parsed) {
    fail(400, "WORD_ID_REQUIRED", "wordId is required.");
  }

  return parsed;
};

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) {
    return corsResponse;
  }

  const requestId = getRequestId(req);

  try {
    assertPostRequest(req);

    const env = getRequiredEnv([
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "TELEGRAM_BOT_TOKEN",
    ]);
    const body = await parseJsonBody<{ initData?: unknown; wordId?: unknown }>(
      req,
    );
    const tgUser = await getTelegramUserFromBody(
      body,
      env.TELEGRAM_BOT_TOKEN,
    );
    const wordId = parseWordId(body?.wordId);

    const supabase = createServiceClient(env);
    const appUser = await getAppUserByTelegramId(
      supabase,
      tgUser.id,
      "[approve-vocabulary-card]",
      requestId,
    );
    const { data: updatedRows, error: updateError } = await supabase
      .from("user_vocabulary_words")
      .update({
        card_status: "ready",
        status: "not_started",
        review_step: null,
        next_review_date: null,
        last_reviewed_at: null,
        review_count: 0,
        forgot_count: 0,
        same_step_count: 0,
        next_step_count: 0,
        jump_step_count: 0,
        learned_at: null,
      })
      .eq("id", wordId)
      .eq("user_id", appUser.id)
      .eq("card_status", "needs_approval")
      .select("id, word, status, card_status");

    if (updateError) {
      console.error("[approve-vocabulary-card] failed to approve card", {
        appUserId: appUser.id,
        wordId,
        error: updateError.message,
      });
      fail(500, "VOCABULARY_CARD_APPROVE_FAILED", "Failed to approve card.");
    }

    const updatedWord = updatedRows?.[0];
    if (!updatedWord) {
      fail(
        404,
        "VOCABULARY_CARD_NOT_FOUND",
        "Vocabulary card was not found or already approved.",
      );
    }

    return successResponse(200, {
      wordId: updatedWord.id,
      word: updatedWord.word,
      status: updatedWord.status,
      cardStatus: updatedWord.card_status,
    });
  } catch (error) {
    if (error instanceof AppError) {
      console.error("[approve-vocabulary-card] request failed", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return errorResponse(error.status, error.code, error.message);
    }

    const message =
      error instanceof Error ? error.message : "Unknown approve card error.";
    console.error("[approve-vocabulary-card] failed", { message });
    return errorResponse(
      500,
      "VOCABULARY_CARD_APPROVE_FAILED",
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    );
  }
});
