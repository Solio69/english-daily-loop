import { createServiceClient, getAppUserByTelegramId } from "../_shared/app.ts";
import { parseDevToolInput } from "../_shared/dev-tools-contract.ts";
import {
  assertDevToolsEnabled,
  runAuthorizedDevToolAction,
} from "../_shared/dev-tools-flow.ts";
import { getMoscowStudyDate } from "../_shared/moscow-study-date.ts";
import {
  AppError,
  assertPostRequest,
  DEFAULT_INTERNAL_ERROR_MESSAGE,
  errorResponse,
  getOptionalEnv,
  getRequestId,
  getRequiredEnv,
  getTelegramUserFromBody,
  handleCorsPreflight,
  parseJsonBody,
  successResponse,
} from "../_shared/server.ts";

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  const requestId = getRequestId(req);

  try {
    assertPostRequest(req);
    assertDevToolsEnabled(getOptionalEnv("DEV_TOOLS_ENABLED"));

    const env = getRequiredEnv([
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "TELEGRAM_BOT_TOKEN",
    ]);
    const body = await parseJsonBody<{
      initData?: unknown;
      action?: unknown;
      reviewStep?: unknown;
    }>(req);
    const input = parseDevToolInput(body ?? {});
    const tgUser = await getTelegramUserFromBody(body, env.TELEGRAM_BOT_TOKEN);
    const supabase = createServiceClient(env);
    const appUser = await getAppUserByTelegramId(
      supabase,
      tgUser.id,
      "[dev-tools]",
      requestId,
    );
    const studyDate = getMoscowStudyDate();
    const changes = await runAuthorizedDevToolAction({
      supabase,
      userId: appUser.id,
      studyDate,
      input,
    });

    return successResponse(200, {
      action: input.action,
      today: studyDate,
      changes,
    });
  } catch (error) {
    if (error instanceof AppError) {
      console.error("[dev-tools] request failed", {
        requestId,
        status: error.status,
        code: error.code,
      });
      return errorResponse(error.status, error.code, error.message);
    }

    console.error("[dev-tools] unexpected failure", { requestId });
    return errorResponse(
      500,
      "DEV_TOOLS_FAILED",
      DEFAULT_INTERNAL_ERROR_MESSAGE,
    );
  }
});
