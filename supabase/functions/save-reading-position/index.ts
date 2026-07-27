// @ts-nocheck
import {
  AppError,
  DEFAULT_INTERNAL_ERROR_MESSAGE,
  assertPostRequest,
  errorResponse,
  fail,
  getRequestId,
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
import { getReadingParagraphCount } from "../_shared/reading-text.ts";

type ActiveReadingTextRow = {
  reading_text_id: string;
  body: string;
};

const LOG_PREFIX = "[save-reading-position]";
const ACTIVE_TEXT_UNAVAILABLE_MESSAGE =
  "Текст изменился или уже недоступен. Обнови экран.";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parseReadingTextId = (value: unknown): string => {
  const parsed = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(parsed)) {
    fail(400, "INVALID_READING_TEXT_ID", "readingTextId must be a valid UUID.");
  }

  return parsed;
};

const parseParagraphIndex = (
  body: Record<string, unknown>,
): number | null => {
  if (!Object.prototype.hasOwnProperty.call(body, "paragraphIndex")) {
    fail(400, "PARAGRAPH_INDEX_REQUIRED", "paragraphIndex is required.");
  }

  if (body.paragraphIndex === null) {
    return null;
  }

  if (
    typeof body.paragraphIndex !== "number" ||
    !Number.isInteger(body.paragraphIndex) ||
    body.paragraphIndex < 0
  ) {
    fail(
      400,
      "INVALID_PARAGRAPH_INDEX",
      "paragraphIndex must be null or a non-negative integer.",
    );
  }

  return body.paragraphIndex;
};

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) {
    return corsResponse;
  }

  const requestId = getRequestId(req);
  const startedAt = Date.now();

  try {
    assertPostRequest(req);

    const env = getRequiredEnv([
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "TELEGRAM_BOT_TOKEN",
    ]);
    const body = await parseJsonBody<Record<string, unknown>>(req);
    const tgUser = await getTelegramUserFromBody(
      body,
      env.TELEGRAM_BOT_TOKEN,
    );
    const readingTextId = parseReadingTextId(body.readingTextId);
    const paragraphIndex = parseParagraphIndex(body);
    const supabase = createServiceClient(env);
    const appUser = await getAppUserByTelegramId(
      supabase,
      tgUser.id,
      LOG_PREFIX,
      requestId,
    );

    const { data: activeTextRow, error: activeTextError } = await supabase
      .from("user_active_reading_texts")
      .select("reading_text_id, body")
      .eq("user_id", appUser.id)
      .maybeSingle();

    if (activeTextError) {
      console.error(`${LOG_PREFIX} failed to load active text`, {
        requestId,
        appUserId: appUser.id,
        error: activeTextError.message,
      });
      fail(500, "ACTIVE_TEXT_LOAD_FAILED", "Failed to load active reading text.");
    }

    if (!activeTextRow) {
      fail(409, "NO_ACTIVE_READING_TEXT", ACTIVE_TEXT_UNAVAILABLE_MESSAGE);
    }

    const activeText = activeTextRow as ActiveReadingTextRow;
    if (activeText.reading_text_id !== readingTextId) {
      fail(409, "ACTIVE_TEXT_CHANGED", ACTIVE_TEXT_UNAVAILABLE_MESSAGE);
    }

    if (
      paragraphIndex !== null &&
      paragraphIndex >= getReadingParagraphCount(activeText.body)
    ) {
      fail(
        400,
        "INVALID_PARAGRAPH_INDEX",
        "paragraphIndex is outside of the active text.",
      );
    }

    const { data: updatedRow, error: updateError } = await supabase
      .from("user_active_reading_texts")
      .update({ last_read_paragraph_index: paragraphIndex })
      .eq("user_id", appUser.id)
      .eq("reading_text_id", readingTextId)
      .select("reading_text_id")
      .maybeSingle();

    if (updateError) {
      console.error(`${LOG_PREFIX} failed to update position`, {
        requestId,
        appUserId: appUser.id,
        readingTextId,
        paragraphIndex,
        error: updateError.message,
      });
      fail(
        500,
        "READING_POSITION_SAVE_FAILED",
        "Не удалось сохранить позицию чтения.",
      );
    }

    if (!updatedRow) {
      fail(409, "ACTIVE_TEXT_CHANGED", ACTIVE_TEXT_UNAVAILABLE_MESSAGE);
    }

    console.log(`${LOG_PREFIX} position saved`, {
      requestId,
      appUserId: appUser.id,
      readingTextId,
      paragraphIndex,
      durationMs: Date.now() - startedAt,
    });

    return successResponse(
      200,
      { readingTextId, paragraphIndex },
      requestId,
    );
  } catch (error) {
    if (error instanceof AppError) {
      console.error(`${LOG_PREFIX} request failed`, {
        requestId,
        status: error.status,
        code: error.code,
        message: error.message,
        durationMs: Date.now() - startedAt,
      });
      return errorResponse(
        error.status,
        error.code,
        error.message,
        requestId,
      );
    }

    const message =
      error instanceof Error ? error.message : "Unknown reading position error.";
    console.error(`${LOG_PREFIX} failed`, {
      requestId,
      message,
      durationMs: Date.now() - startedAt,
    });
    return errorResponse(
      500,
      "READING_POSITION_SAVE_FAILED",
      DEFAULT_INTERNAL_ERROR_MESSAGE,
      requestId,
    );
  }
});
