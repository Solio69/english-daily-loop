// @ts-nocheck
import { createServiceClient, getAppUserByTelegramId } from "../_shared/app.ts";
import {
  AppError,
  DEFAULT_INTERNAL_ERROR_MESSAGE,
  assertPostRequest,
  errorResponse,
  getRequiredEnv,
  getTelegramUserFromBody,
  handleCorsPreflight,
  parseJsonBody,
  successResponse,
} from "../_shared/server.ts";

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
    const tgUser = await getTelegramUserFromBody(body, env.TELEGRAM_BOT_TOKEN);

    const supabase = createServiceClient(env);
    const appUser = await getAppUserByTelegramId(
      supabase,
      tgUser.id,
      "[approve-vocabulary-cards]",
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
      .eq("user_id", appUser.id)
      .eq("card_status", "needs_approval")
      .select("id");

    if (updateError) {
      console.error("[approve-vocabulary-cards] failed to approve cards", {
        appUserId: appUser.id,
        error: updateError.message,
      });
      return errorResponse(
        500,
        "VOCABULARY_CARDS_APPROVE_FAILED",
        "Не удалось подтвердить карточки.",
      );
    }

    return successResponse(200, {
      approvedCount: updatedRows?.length ?? 0,
    });
  } catch (error) {
    if (error instanceof AppError) {
      console.error("[approve-vocabulary-cards] request failed", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return errorResponse(error.status, error.code, error.message);
    }

    const message =
      error instanceof Error ? error.message : "Unknown approve cards error.";
    console.error("[approve-vocabulary-cards] failed", { message });
    return errorResponse(
      500,
      "VOCABULARY_CARDS_APPROVE_FAILED",
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    );
  }
});
