export const TELEGRAM_BOT_PROFILE = Object.freeze({
  displayName: "English Daily Loop",
  shortDescription:
    "Ежедневная практика английского: чтение, новые слова и повторение.",
  description:
    "Читай короткие тексты по своему уровню, сохраняй новые слова и повторяй их по дневному плану — всё в одном небольшом занятии.",
  openAppButtonText: "Открыть приложение",
  commands: Object.freeze([
    Object.freeze({
      command: "start",
      description: "Открыть приветствие и приложение",
    }),
    Object.freeze({ command: "help", description: "Как работает приложение" }),
  ]),
});

export const DEV_TELEGRAM_BOT_DISPLAY_NAME = `DEV: ${TELEGRAM_BOT_PROFILE.displayName}`;

export const TELEGRAM_WEBHOOK_PATH =
  "/functions/v1/telegram-bot-webhook";

const WEBHOOK_SECRET_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;

export class TelegramBotConfigurationError extends Error {
  operation;
  code;
  providerStatus;
  providerErrorCode;

  constructor(
    operation,
    code,
    providerStatus = null,
    providerErrorCode = null,
  ) {
    super(`Telegram bot configuration operation ${operation} failed.`);
    this.name = "TelegramBotConfigurationError";
    this.operation = operation;
    this.code = code;
    this.providerStatus = providerStatus;
    this.providerErrorCode = providerErrorCode;
  }
}

const normalizeBotUsername = (value) => {
  const trimmed = String(value ?? "").trim();
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
};

export function validateTelegramWebhookSecret(value) {
  if (!WEBHOOK_SECRET_PATTERN.test(String(value ?? ""))) {
    throw new Error(
      "TELEGRAM_BOT_WEBHOOK_SECRET must contain 32-256 characters: A-Z, a-z, 0-9, _ or -.",
    );
  }
  return value;
}

export function validateHttpsUrl(value, label) {
  const rawValue = String(value ?? "").trim();
  let parsedUrl;
  try {
    parsedUrl = new URL(rawValue);
  } catch {
    throw new Error(`${label} must be a valid HTTPS URL.`);
  }

  if (
    parsedUrl.protocol !== "https:" ||
    !parsedUrl.hostname ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error(`${label} must be a valid HTTPS URL.`);
  }
  return rawValue;
}

export function buildTelegramWebhookUrl(apiBaseUrl) {
  const safeBaseUrl = validateHttpsUrl(apiBaseUrl, "Telegram API tunnel URL");
  return new URL(TELEGRAM_WEBHOOK_PATH, safeBaseUrl).toString();
}

export function buildTelegramBotConfiguration({
  displayName = String(TELEGRAM_BOT_PROFILE.displayName),
  frontendUrl,
  webhookUrl,
  webhookSecret,
  dropPendingUpdates = false,
}) {
  if (
    typeof displayName !== "string" ||
    displayName.trim() !== displayName ||
    displayName.length < 1 ||
    displayName.length > 64
  ) {
    throw new Error("Telegram bot display name must contain 1-64 characters.");
  }
  const safeFrontendUrl = validateHttpsUrl(
    frontendUrl,
    "Telegram Mini App URL",
  );
  const safeWebhookUrl = validateHttpsUrl(webhookUrl, "Telegram webhook URL");
  const safeWebhookSecret = validateTelegramWebhookSecret(webhookSecret);

  return [
    {
      operation: "setMyName",
      payload: { name: displayName },
    },
    {
      operation: "setMyShortDescription",
      payload: {
        short_description: TELEGRAM_BOT_PROFILE.shortDescription,
      },
    },
    {
      operation: "setMyDescription",
      payload: { description: TELEGRAM_BOT_PROFILE.description },
    },
    {
      operation: "setMyCommands",
      payload: {
        commands: TELEGRAM_BOT_PROFILE.commands,
        scope: { type: "all_private_chats" },
      },
    },
    {
      operation: "setChatMenuButton",
      payload: {
        menu_button: {
          type: "web_app",
          text: TELEGRAM_BOT_PROFILE.openAppButtonText,
          web_app: { url: safeFrontendUrl },
        },
      },
    },
    {
      operation: "setWebhook",
      payload: {
        url: safeWebhookUrl,
        allowed_updates: ["message"],
        secret_token: safeWebhookSecret,
        drop_pending_updates: Boolean(dropPendingUpdates),
      },
    },
  ];
}

export function sanitizeWebhookInfo(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    url: typeof source.url === "string" ? source.url : "",
    pendingUpdateCount:
      Number.isSafeInteger(source.pending_update_count) &&
      source.pending_update_count >= 0
        ? source.pending_update_count
        : 0,
    allowedUpdates: Array.isArray(source.allowed_updates)
      ? source.allowed_updates.filter((item) => typeof item === "string")
      : [],
    hasLastError:
      Number.isSafeInteger(source.last_error_date) ||
      typeof source.last_error_message === "string",
  };
}

export function createTelegramBotApi({
  token,
  fetchImpl = fetch,
  timeoutMs = 10_000,
}) {
  const call = async (operation, payload = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let response;
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
          controller.signal.aborted || error?.name === "AbortError"
            ? "TELEGRAM_API_TIMEOUT"
            : "TELEGRAM_API_NETWORK_ERROR";
        throw new TelegramBotConfigurationError(operation, code);
      }

      let body;
      try {
        body = await response.json();
      } catch {
        throw new TelegramBotConfigurationError(
          operation,
          "TELEGRAM_API_INVALID_RESPONSE",
          response.status,
        );
      }

      if (!response.ok || body?.ok !== true) {
        throw new TelegramBotConfigurationError(
          operation,
          "TELEGRAM_API_REJECTED",
          response.status,
          Number.isSafeInteger(body?.error_code) ? body.error_code : null,
        );
      }

      return body.result;
    } finally {
      clearTimeout(timeout);
    }
  };

  return { call };
}

export async function configureTelegramBot({
  token,
  expectedBotUsername,
  displayName = String(TELEGRAM_BOT_PROFILE.displayName),
  frontendUrl,
  webhookUrl,
  webhookSecret,
  dropPendingUpdates = false,
  fetchImpl = fetch,
}) {
  const api = createTelegramBotApi({ token, fetchImpl });
  const expectedUsername = normalizeBotUsername(expectedBotUsername);
  const bot = await api.call("getMe");
  const actualUsername = normalizeBotUsername(bot?.username);

  if (
    !/^@[A-Za-z0-9_]{5,32}bot$/i.test(actualUsername) ||
    actualUsername.toLowerCase() !== expectedUsername.toLowerCase()
  ) {
    throw new TelegramBotConfigurationError(
      "getMe",
      "TELEGRAM_BOT_USERNAME_MISMATCH",
    );
  }

  const operations = buildTelegramBotConfiguration({
    displayName,
    frontendUrl,
    webhookUrl,
    webhookSecret,
    dropPendingUpdates,
  });
  for (const { operation, payload } of operations) {
    await api.call(operation, payload);
  }

  const webhookInfo = sanitizeWebhookInfo(await api.call("getWebhookInfo"));
  return { botUsername: actualUsername, webhookInfo };
}

export async function deleteTelegramWebhook({
  token,
  expectedBotUsername,
  dropPendingUpdates = false,
  fetchImpl = fetch,
}) {
  const api = createTelegramBotApi({ token, fetchImpl });
  const expectedUsername = normalizeBotUsername(expectedBotUsername);
  const bot = await api.call("getMe");
  const actualUsername = normalizeBotUsername(bot?.username);
  if (actualUsername.toLowerCase() !== expectedUsername.toLowerCase()) {
    throw new TelegramBotConfigurationError(
      "getMe",
      "TELEGRAM_BOT_USERNAME_MISMATCH",
    );
  }

  await api.call("deleteWebhook", {
    drop_pending_updates: Boolean(dropPendingUpdates),
  });
  return sanitizeWebhookInfo(await api.call("getWebhookInfo"));
}
