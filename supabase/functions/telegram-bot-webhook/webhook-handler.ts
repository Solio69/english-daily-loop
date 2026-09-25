import { getRequestId } from "../_shared/server.ts";
import {
  buildSendMessagePayload,
  getMenuWebAppUrl,
  resolveBotFlow,
} from "./bot-flow.ts";
import {
  TelegramBotApiError,
  type TelegramBotApiClient,
} from "./telegram-bot-api.ts";

const MAX_BODY_BYTES = 64 * 1024;
const WEBHOOK_SECRET_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;

type SafeLogFields = Record<string, string | number | boolean | null>;

export type TelegramWebhookLogger = {
  info: (message: string, fields: SafeLogFields) => void;
  error: (message: string, fields: SafeLogFields) => void;
};

type TelegramWebhookDependencies = {
  webhookSecret: string;
  botApi: TelegramBotApiClient;
  logger?: TelegramWebhookLogger;
  now?: () => number;
  requestId?: string;
};

class WebhookRequestError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "WebhookRequestError";
    this.status = status;
    this.code = code;
  }
}

const defaultLogger: TelegramWebhookLogger = {
  info: (message, fields) => console.info(message, fields),
  error: (message, fields) => console.error(message, fields),
};

const jsonResponse = (
  status: number,
  payload: Record<string, unknown>,
): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const textEncoder = new TextEncoder();

const timingSafeEqual = async (left: string, right: string): Promise<boolean> => {
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", textEncoder.encode(left)),
    crypto.subtle.digest("SHA-256", textEncoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let mismatch = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    mismatch |= leftBytes[index] ^ rightBytes[index];
  }
  return mismatch === 0;
};

export const isValidTelegramWebhookSecret = (value: string): boolean =>
  WEBHOOK_SECRET_PATTERN.test(value);

const readBoundedBody = async (request: Request): Promise<string> => {
  const contentLength = request.headers.get("content-length")?.trim();
  if (contentLength) {
    const parsedLength = Number(contentLength);
    if (Number.isFinite(parsedLength) && parsedLength > MAX_BODY_BYTES) {
      throw new WebhookRequestError(
        413,
        "REQUEST_BODY_TOO_LARGE",
        "Request body is too large.",
      );
    }
  }

  if (!request.body) {
    throw new WebhookRequestError(
      400,
      "INVALID_JSON",
      "Request body must be valid JSON.",
    );
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new WebhookRequestError(
        413,
        "REQUEST_BODY_TOO_LARGE",
        "Request body is too large.",
      );
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
};

const parseUpdate = async (request: Request): Promise<unknown> => {
  const rawBody = await readBoundedBody(request);
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new WebhookRequestError(
      400,
      "INVALID_JSON",
      "Request body must be valid JSON.",
    );
  }
};

export const handleTelegramWebhook = async (
  request: Request,
  dependencies: TelegramWebhookDependencies,
): Promise<Response> => {
  const logger = dependencies.logger ?? defaultLogger;
  const now = dependencies.now ?? Date.now;
  const startedAt = now();
  const requestId = dependencies.requestId ?? getRequestId(request);

  try {
    if (request.method !== "POST") {
      throw new WebhookRequestError(
        405,
        "METHOD_NOT_ALLOWED",
        "Method Not Allowed",
      );
    }

    if (!isValidTelegramWebhookSecret(dependencies.webhookSecret)) {
      throw new WebhookRequestError(
        500,
        "WEBHOOK_SECRET_MISCONFIGURED",
        "Webhook secret is not configured.",
      );
    }

    const receivedSecret =
      request.headers.get("x-telegram-bot-api-secret-token") ?? "";
    if (!(await timingSafeEqual(receivedSecret, dependencies.webhookSecret))) {
      throw new WebhookRequestError(
        401,
        "WEBHOOK_AUTH_FAILED",
        "Webhook authentication failed.",
      );
    }

    const update = await parseUpdate(request);
    const flow = resolveBotFlow(update);
    if (flow.type === "ignored") {
      logger.info("[telegram-bot-webhook] update ignored", {
        requestId,
        updateCategory: flow.updateCategory,
        commandCategory: flow.commandCategory,
        durationMs: Math.max(0, now() - startedAt),
      });
      return jsonResponse(200, { ok: true, requestId });
    }

    const menuButton = await dependencies.botApi.getDefaultMenuButton();
    const webAppUrl = getMenuWebAppUrl(menuButton);
    if (!webAppUrl) {
      throw new WebhookRequestError(
        503,
        "TELEGRAM_MENU_BUTTON_MISCONFIGURED",
        "Telegram menu button is not configured.",
      );
    }

    await dependencies.botApi.sendMessage(
      buildSendMessagePayload(flow, webAppUrl),
    );

    logger.info("[telegram-bot-webhook] reply sent", {
      requestId,
      updateCategory: flow.updateCategory,
      commandCategory: flow.commandCategory,
      durationMs: Math.max(0, now() - startedAt),
    });
    return jsonResponse(200, { ok: true, requestId });
  } catch (error) {
    if (error instanceof WebhookRequestError) {
      logger.error("[telegram-bot-webhook] request rejected", {
        requestId,
        status: error.status,
        code: error.code,
        durationMs: Math.max(0, now() - startedAt),
      });
      return jsonResponse(error.status, {
        ok: false,
        error: { code: error.code, requestId },
      });
    }

    if (error instanceof TelegramBotApiError) {
      logger.error("[telegram-bot-webhook] Telegram API failed", {
        requestId,
        status: 502,
        code: error.code,
        operation: error.operation,
        providerStatus: error.providerStatus,
        providerErrorCode: error.providerErrorCode,
        durationMs: Math.max(0, now() - startedAt),
      });
      return jsonResponse(502, {
        ok: false,
        error: { code: "TELEGRAM_BOT_API_FAILED", requestId },
      });
    }

    logger.error("[telegram-bot-webhook] unexpected failure", {
      requestId,
      status: 500,
      code: "TELEGRAM_WEBHOOK_FAILED",
      durationMs: Math.max(0, now() - startedAt),
    });
    return jsonResponse(500, {
      ok: false,
      error: { code: "TELEGRAM_WEBHOOK_FAILED", requestId },
    });
  }
};
