import type { TelegramSendMessagePayload } from "./bot-flow.ts";

type TelegramApiEnvelope = {
  ok?: unknown;
  result?: unknown;
  error_code?: unknown;
};

export type TelegramFetch = typeof fetch;

export class TelegramBotApiError extends Error {
  operation: string;
  code: string;
  providerStatus: number | null;
  providerErrorCode: number | null;

  constructor(
    operation: string,
    code: string,
    providerStatus: number | null = null,
    providerErrorCode: number | null = null,
  ) {
    super(`Telegram Bot API operation ${operation} failed.`);
    this.name = "TelegramBotApiError";
    this.operation = operation;
    this.code = code;
    this.providerStatus = providerStatus;
    this.providerErrorCode = providerErrorCode;
  }
}

export type TelegramBotApiClient = {
  getDefaultMenuButton: () => Promise<unknown>;
  sendMessage: (payload: TelegramSendMessagePayload) => Promise<void>;
};

type TelegramBotApiClientOptions = {
  token: string;
  fetchImpl?: TelegramFetch;
  timeoutMs?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export const createTelegramBotApiClient = ({
  token,
  fetchImpl = fetch,
  timeoutMs = 5_000,
}: TelegramBotApiClientOptions): TelegramBotApiClient => {
  const call = async (
    operation: string,
    payload: Record<string, unknown>,
  ): Promise<unknown> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let response: Response;
      try {
        response = await fetchImpl(
          `https://api.telegram.org/bot${token}/${operation}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
          },
        );
      } catch (error) {
        const code =
          controller.signal.aborted ||
          (error instanceof Error && error.name === "AbortError")
            ? "TELEGRAM_API_TIMEOUT"
            : "TELEGRAM_API_NETWORK_ERROR";
        throw new TelegramBotApiError(operation, code);
      }

      let body: TelegramApiEnvelope;
      try {
        const parsedBody: unknown = await response.json();
        body = isRecord(parsedBody) ? parsedBody : {};
      } catch {
        throw new TelegramBotApiError(
          operation,
          "TELEGRAM_API_INVALID_RESPONSE",
          response.status,
        );
      }

      const providerErrorCode =
        typeof body.error_code === "number" &&
          Number.isSafeInteger(body.error_code)
          ? body.error_code
          : null;

      if (!response.ok || body.ok !== true) {
        throw new TelegramBotApiError(
          operation,
          "TELEGRAM_API_REJECTED",
          response.status,
          providerErrorCode,
        );
      }

      return body.result;
    } finally {
      clearTimeout(timeout);
    }
  };

  return {
    getDefaultMenuButton: () => call("getChatMenuButton", {}),
    sendMessage: async (payload) => {
      await call("sendMessage", payload);
    },
  };
};

