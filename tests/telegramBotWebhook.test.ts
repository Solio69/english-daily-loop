import assert from "node:assert/strict";
import test from "node:test";
import {
  HELP_MESSAGE,
  OPEN_APP_BUTTON_TEXT,
  START_MESSAGE,
  type TelegramSendMessagePayload,
} from "../supabase/functions/telegram-bot-webhook/bot-flow.ts";
import {
  TelegramBotApiError,
  type TelegramBotApiClient,
} from "../supabase/functions/telegram-bot-webhook/telegram-bot-api.ts";
import {
  handleTelegramWebhook,
  isValidTelegramWebhookSecret,
  type TelegramWebhookLogger,
} from "../supabase/functions/telegram-bot-webhook/webhook-handler.ts";

const webhookSecret = "valid_webhook_secret_value_1234567890";

const privateUpdate = (text?: string) => ({
  update_id: 987654321,
  message: {
    message_id: 42,
    from: {
      id: 123456789,
      is_bot: false,
      first_name: "Sensitive Name",
      username: "sensitive_username",
    },
    chat: { id: 123456789, type: "private" },
    ...(text === undefined ? { sticker: { file_id: "private-file-id" } } : { text }),
  },
});

const makeRequest = (
  body: string,
  options: { method?: string; secret?: string; contentLength?: string } = {},
) =>
  new Request("https://example.com/functions/v1/telegram-bot-webhook", {
    method: options.method ?? "POST",
    headers: {
      "x-telegram-bot-api-secret-token": options.secret ?? webhookSecret,
      ...(options.contentLength
        ? { "content-length": options.contentLength }
        : {}),
    },
    body: options.method === "GET" ? undefined : body,
  });

const createBotApi = (overrides: Partial<TelegramBotApiClient> = {}) => {
  const sent: TelegramSendMessagePayload[] = [];
  const botApi: TelegramBotApiClient = {
    getDefaultMenuButton: async () => ({
      type: "web_app",
      text: OPEN_APP_BUTTON_TEXT,
      web_app: { url: "https://english-daily-loop.example" },
    }),
    sendMessage: async (payload) => {
      sent.push(payload);
    },
    ...overrides,
  };
  return { botApi, sent };
};

const createLogger = () => {
  const entries: Array<{ level: string; message: string; fields: unknown }> = [];
  const logger: TelegramWebhookLogger = {
    info: (message, fields) => entries.push({ level: "info", message, fields }),
    error: (message, fields) => entries.push({ level: "error", message, fields }),
  };
  return { logger, entries };
};

test("requires a strong Bot API-compatible webhook secret", () => {
  assert.equal(isValidTelegramWebhookSecret(webhookSecret), true);
  assert.equal(isValidTelegramWebhookSecret("short"), false);
  assert.equal(
    isValidTelegramWebhookSecret("invalid webhook secret value 123456789"),
    false,
  );
});

test("rejects wrong method and secret before Telegram API calls", async () => {
  const { botApi, sent } = createBotApi();
  const methodResponse = await handleTelegramWebhook(
    makeRequest("", { method: "GET" }),
    { webhookSecret, botApi },
  );
  assert.equal(methodResponse.status, 405);

  const authResponse = await handleTelegramWebhook(
    makeRequest(JSON.stringify(privateUpdate("/start")), {
      secret: "wrong_secret_value_12345678901234567890",
    }),
    { webhookSecret, botApi },
  );
  assert.equal(authResponse.status, 401);
  assert.equal(sent.length, 0);
});

test("rejects oversized and invalid JSON requests", async () => {
  const { botApi, sent } = createBotApi();
  const oversizedResponse = await handleTelegramWebhook(
    makeRequest("{}", { contentLength: String(64 * 1024 + 1) }),
    { webhookSecret, botApi },
  );
  assert.equal(oversizedResponse.status, 413);

  const invalidJsonResponse = await handleTelegramWebhook(
    makeRequest("not-json"),
    { webhookSecret, botApi },
  );
  assert.equal(invalidJsonResponse.status, 400);
  assert.equal(sent.length, 0);
});

test("sends exact start and fallback replies with the current menu URL", async () => {
  for (const [text, expectedText] of [
    ["/start", START_MESSAGE],
    ["/help", HELP_MESSAGE],
    ["Как начать?", HELP_MESSAGE],
  ]) {
    const { botApi, sent } = createBotApi();
    const response = await handleTelegramWebhook(
      makeRequest(JSON.stringify(privateUpdate(text))),
      { webhookSecret, botApi },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(sent, [
      {
        chat_id: 123456789,
        text: expectedText,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: OPEN_APP_BUTTON_TEXT,
                web_app: { url: "https://english-daily-loop.example" },
              },
            ],
          ],
        },
      },
    ]);
  }
});

test("acknowledges group updates without sending a reply", async () => {
  const { botApi, sent } = createBotApi();
  const update = privateUpdate("/start");
  update.message.chat = { id: -100123, type: "supergroup" };
  const response = await handleTelegramWebhook(
    makeRequest(JSON.stringify(update)),
    { webhookSecret, botApi },
  );

  assert.equal(response.status, 200);
  assert.equal(sent.length, 0);
});

test("returns retryable errors for menu misconfiguration and Telegram failures", async () => {
  const missingMenu = createBotApi({
    getDefaultMenuButton: async () => ({ type: "commands" }),
  });
  const missingMenuResponse = await handleTelegramWebhook(
    makeRequest(JSON.stringify(privateUpdate("/start"))),
    { webhookSecret, botApi: missingMenu.botApi },
  );
  assert.equal(missingMenuResponse.status, 503);
  assert.equal(missingMenu.sent.length, 0);

  const failedApi = createBotApi({
    getDefaultMenuButton: async () => {
      throw new TelegramBotApiError(
        "getChatMenuButton",
        "TELEGRAM_API_TIMEOUT",
      );
    },
  });
  const failedApiResponse = await handleTelegramWebhook(
    makeRequest(JSON.stringify(privateUpdate("/start"))),
    { webhookSecret, botApi: failedApi.botApi },
  );
  assert.equal(failedApiResponse.status, 502);
});

test("logs only safe categories and operational metadata", async () => {
  const { botApi } = createBotApi();
  const { logger, entries } = createLogger();
  const response = await handleTelegramWebhook(
    makeRequest(JSON.stringify(privateUpdate("Sensitive raw message"))),
    { webhookSecret, botApi, logger, now: () => 100 },
  );

  assert.equal(response.status, 200);
  const serializedLogs = JSON.stringify(entries);
  assert.doesNotMatch(
    serializedLogs,
    /Sensitive raw message|Sensitive Name|sensitive_username|987654321|123456789|valid_webhook_secret/,
  );
  assert.match(serializedLogs, /fallback|reply sent/);
});

