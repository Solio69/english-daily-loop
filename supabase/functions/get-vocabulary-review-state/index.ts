import {
  AppError,
  DEFAULT_INTERNAL_ERROR_MESSAGE,
  assertPostRequest,
  errorResponse,
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
import { getMoscowStudyDate } from "../_shared/moscow-study-date.ts";
import { getReviewActionOptions } from "../_shared/vocabulary-review.ts";
import {
  loadVocabularyReviewSnapshot,
  type VocabularyReviewWordRow,
} from "../_shared/vocabulary-review-state.ts";

const LOG_PREFIX = "[get-vocabulary-review-state]";

const toReviewCard = (row: VocabularyReviewWordRow, isOptional: boolean) => ({
  id: row.id,
  word: row.word,
  translation: row.translation,
  partOfSpeech: row.part_of_speech,
  isVerb: row.is_verb,
  isRegularVerb: row.is_regular_verb,
  verbForms: row.verb_forms,
  examples: row.examples,
  status: row.status,
  cardStatus: row.card_status,
  reviewStep: row.review_step,
  nextReviewDate: row.next_review_date,
  lastReviewedAt: row.last_reviewed_at,
  reviewCount: row.review_count,
  isOptional,
  actions: getReviewActionOptions(row.status, row.review_step),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const loadReviewState = async (
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
) => {
  const studyDate = getMoscowStudyDate();
  const {
    currentCard,
    currentCardIsOptional,
    ...snapshot
  } = await loadVocabularyReviewSnapshot(
    supabase,
    userId,
    studyDate,
    LOG_PREFIX,
  );

  return {
    ...snapshot,
    currentCard: currentCard
      ? toReviewCard(currentCard, currentCardIsOptional)
      : null,
  };
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
      requestId,
    );
    const state = await loadReviewState(supabase, appUser.id);

    return successResponse(200, state);
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
      error instanceof Error ? error.message : "Unknown review state error.";
    console.error(`${LOG_PREFIX} failed`, { message });
    return errorResponse(
      500,
      "VOCABULARY_REVIEW_STATE_FAILED",
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    );
  }
});
