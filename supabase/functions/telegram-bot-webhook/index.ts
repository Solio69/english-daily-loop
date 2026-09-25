// @ts-nocheck
import {
  AppError,
  errorResponse,
  getRequiredEnv,
  getRequestId,
} from "../_shared/server.ts";
import { createTelegramBotApiClient } from "./telegram-bot-api.ts";
import { handleTelegramWebhook } from "./webhook-handler.ts";

const LOG_PREFIX = "[telegram-bot-webhook]";

Deno.serve(async (request: Request) => {
  const requestId = getRequestId(request);

  try {
    const env = getRequiredEnv([
      "TELEGRAM_BOT_TOKEN",
      "TELEGRAM_BOT_WEBHOOK_SECRET",
    ]);
    const botApi = createTelegramBotApiClient({
      token: env.TELEGRAM_BOT_TOKEN,
    });

    return await handleTelegramWebhook(request, {
      webhookSecret: env.TELEGRAM_BOT_WEBHOOK_SECRET,
      botApi,
      requestId,
    });
  } catch (error) {
    if (error instanceof AppError) {
      console.error(`${LOG_PREFIX} server env misconfigured`, {
        requestId,
        status: error.status,
        code: error.code,
      });
      return errorResponse(error.status, error.code, error.message, requestId);
    }

    console.error(`${LOG_PREFIX} entrypoint failed`, {
      requestId,
      status: 500,
      code: "TELEGRAM_WEBHOOK_ENTRYPOINT_FAILED",
    });
    return errorResponse(
      500,
      "TELEGRAM_WEBHOOK_ENTRYPOINT_FAILED",
      "Внутренняя ошибка сервера.",
      requestId,
    );
  }
});

