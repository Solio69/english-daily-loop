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

type VocabularyWordRow = {
  id: string;
  word: string;
  translation: string;
  part_of_speech: string;
  is_verb: boolean;
  is_regular_verb: boolean | null;
  verb_forms: {
    base?: string;
    past?: string;
    pastParticiple?: string;
  } | null;
  examples: string[];
  status: "not_started" | "active" | "learned";
  card_status: "needs_approval" | "ready";
  created_at: string;
  updated_at: string;
};

const MAX_ITEMS_PER_SECTION = 50;

const toVocabularyWord = (row: VocabularyWordRow) => ({
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
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

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
      "[get-vocabulary-words]",
    );
    const selectColumns =
      "id, word, translation, part_of_speech, is_verb, is_regular_verb, verb_forms, examples, status, card_status, created_at, updated_at";

    const [
      { data: needsApprovalRows, error: needsApprovalError },
      { data: readyRows, error: readyError },
    ] = await Promise.all([
      supabase
        .from("user_vocabulary_words")
        .select(selectColumns)
        .eq("user_id", appUser.id)
        .eq("card_status", "needs_approval")
        .order("updated_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(MAX_ITEMS_PER_SECTION),
      supabase
        .from("user_vocabulary_words")
        .select(selectColumns)
        .eq("user_id", appUser.id)
        .eq("card_status", "ready")
        .order("updated_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(MAX_ITEMS_PER_SECTION),
    ]);

    if (needsApprovalError || readyError) {
      console.error("[get-vocabulary-words] failed to load vocabulary words", {
        appUserId: appUser.id,
        needsApprovalError: needsApprovalError?.message,
        readyError: readyError?.message,
      });
      fail(500, "VOCABULARY_WORDS_LOAD_FAILED", "Failed to load vocabulary words.");
    }

    return successResponse(200, {
      needsApproval: ((needsApprovalRows ?? []) as VocabularyWordRow[]).map(
        toVocabularyWord,
      ),
      ready: ((readyRows ?? []) as VocabularyWordRow[]).map(toVocabularyWord),
    });
  } catch (error) {
    if (error instanceof AppError) {
      console.error("[get-vocabulary-words] request failed", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      return errorResponse(error.status, error.code, error.message);
    }

    const message =
      error instanceof Error ? error.message : "Unknown vocabulary words error.";
    console.error("[get-vocabulary-words] failed", { message });
    return errorResponse(
      500,
      "VOCABULARY_WORDS_FAILED",
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    );
  }
});
