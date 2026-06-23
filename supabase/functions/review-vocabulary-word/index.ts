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
import {
  getMoscowDate,
  type VocabularyReviewAction,
} from "../_shared/vocabulary-review.ts";

const LOG_PREFIX = "[review-vocabulary-word]";

const parseWordId = (value: unknown): string => {
  const parsed = typeof value === "string" ? value.trim() : "";
  if (!parsed) {
    fail(400, "WORD_ID_REQUIRED", "wordId is required.");
  }

  return parsed;
};

const parseAction = (value: unknown): VocabularyReviewAction => {
  if (
    value === "forgot" ||
    value === "same_step" ||
    value === "next_step" ||
    value === "jump_step"
  ) {
    return value;
  }

  fail(400, "INVALID_REVIEW_ACTION", "Review action is invalid.");
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
      wordId?: unknown;
      action?: unknown;
    }>(req);
    const tgUser = await getTelegramUserFromBody(
      body,
      env.TELEGRAM_BOT_TOKEN,
    );
    const wordId = parseWordId(body?.wordId);
    const action = parseAction(body?.action);

    const supabase = createServiceClient(env);
    const appUser = await getAppUserByTelegramId(
      supabase,
      tgUser.id,
      LOG_PREFIX,
    );
    const reviewDate = getMoscowDate();
    const { data, error } = await supabase.rpc("review_vocabulary_word", {
      p_user_id: appUser.id,
      p_word_id: wordId,
      p_action: action,
      p_review_date: reviewDate,
    });

    if (error) {
      console.error(`${LOG_PREFIX} failed to review word`, {
        appUserId: appUser.id,
        wordId,
        action,
        error: error.message,
      });
      fail(500, "VOCABULARY_REVIEW_FAILED", "Failed to review vocabulary word.");
    }

    const result = data as
      | {
          ok: true;
          wordId: string;
          word: string;
          status: string;
          reviewStep: string | null;
          nextReviewDate: string | null;
          learnedAt: string | null;
          wasRequired: boolean;
        }
      | {
          ok: false;
          code: string;
          message: string;
        }
      | null;

    if (!result) {
      fail(500, "VOCABULARY_REVIEW_FAILED", "Failed to review vocabulary word.");
    }

    if (!result.ok) {
      const status = result.code === "VOCABULARY_WORD_NOT_FOUND" ? 404 : 409;
      fail(status, result.code, result.message);
    }

    return successResponse(200, {
      reviewDate,
      wordId: result.wordId,
      word: result.word,
      status: result.status,
      reviewStep: result.reviewStep,
      nextReviewDate: result.nextReviewDate,
      learnedAt: result.learnedAt,
      wasRequired: result.wasRequired,
    });
  } catch (error) {
    if (error instanceof AppError) {
      console.error(`${LOG_PREFIX} request failed`, {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return errorResponse(error.status, error.code, error.message);
    }

    const message =
      error instanceof Error ? error.message : "Unknown review word error.";
    console.error(`${LOG_PREFIX} failed`, { message });
    return errorResponse(
      500,
      "VOCABULARY_REVIEW_FAILED",
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    );
  }
});
