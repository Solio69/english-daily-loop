import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  BOT_DESCRIPTION,
  BOT_DISPLAY_NAME,
  BOT_SHORT_DESCRIPTION,
  HELP_COMMAND_DESCRIPTION,
  OPEN_APP_BUTTON_TEXT,
  START_COMMAND_DESCRIPTION,
} from "../supabase/functions/telegram-bot-webhook/bot-flow.ts";
import {
  DEV_TELEGRAM_BOT_DISPLAY_NAME,
  TELEGRAM_BOT_PROFILE,
  TelegramBotConfigurationError,
  buildTelegramBotConfiguration,
  buildTelegramWebhookUrl,
  configureTelegramBot,
  deleteTelegramWebhook,
  sanitizeWebhookInfo,
  validateTelegramWebhookSecret,
} from "../scripts/telegram/bot-config.mjs";

const webhookSecret = "valid_webhook_secret_value_1234567890";

test("keeps configuration copy aligned with webhook replies", () => {
  assert.equal(DEV_TELEGRAM_BOT_DISPLAY_NAME, "DEV: English Daily Loop");
  assert.equal(TELEGRAM_BOT_PROFILE.displayName, BOT_DISPLAY_NAME);
  assert.equal(TELEGRAM_BOT_PROFILE.shortDescription, BOT_SHORT_DESCRIPTION);
  assert.equal(TELEGRAM_BOT_PROFILE.description, BOT_DESCRIPTION);
  assert.equal(TELEGRAM_BOT_PROFILE.openAppButtonText, OPEN_APP_BUTTON_TEXT);
  assert.deepEqual(TELEGRAM_BOT_PROFILE.commands, [
    { command: "start", description: START_COMMAND_DESCRIPTION },
    { command: "help", description: HELP_COMMAND_DESCRIPTION },
  ]);

  const productionProfile = JSON.parse(
    readFileSync(
      new URL("../scripts/telegram/bot-profile.json", import.meta.url),
      "utf8",
    ),
  ) as typeof TELEGRAM_BOT_PROFILE;
  assert.deepEqual(productionProfile, TELEGRAM_BOT_PROFILE);
});

test("builds the public Edge Function webhook URL", () => {
  assert.equal(
    buildTelegramWebhookUrl("https://api-tunnel.example"),
    "https://api-tunnel.example/functions/v1/telegram-bot-webhook",
  );
  assert.throws(
    () => buildTelegramWebhookUrl("http://127.0.0.1:54321"),
    /HTTPS URL/,
  );
});

test("validates the project webhook secret contract", () => {
  assert.equal(validateTelegramWebhookSecret(webhookSecret), webhookSecret);
  assert.throws(() => validateTelegramWebhookSecret("short"), /32-256/);
  assert.throws(
    () => validateTelegramWebhookSecret(`${webhookSecret}!`),
    /32-256/,
  );
});

test("builds profile, private commands, menu, and webhook operations", () => {
  const operations = buildTelegramBotConfiguration({
    frontendUrl: "https://frontend.example",
    webhookUrl:
      "https://api.example/functions/v1/telegram-bot-webhook",
    webhookSecret,
    dropPendingUpdates: true,
  });

  assert.deepEqual(
    operations.map(({ operation }) => operation),
    [
      "setMyName",
      "setMyShortDescription",
      "setMyDescription",
      "setMyCommands",
      "setChatMenuButton",
      "setWebhook",
    ],
  );
  assert.deepEqual(operations[0]?.payload, {
    name: "English Daily Loop",
  });
  assert.deepEqual(operations[3]?.payload.scope, {
    type: "all_private_chats",
  });
  assert.deepEqual(operations[4]?.payload.menu_button, {
    type: "web_app",
    text: OPEN_APP_BUTTON_TEXT,
    web_app: { url: "https://frontend.example" },
  });
  assert.deepEqual(operations[5]?.payload, {
    url: "https://api.example/functions/v1/telegram-bot-webhook",
    allowed_updates: ["message"],
    secret_token: webhookSecret,
    drop_pending_updates: true,
  });
});

test("allows the dev stack to apply a distinct display name", () => {
  const operations = buildTelegramBotConfiguration({
    displayName: DEV_TELEGRAM_BOT_DISPLAY_NAME,
    frontendUrl: "https://frontend.example",
    webhookUrl: "https://api.example/functions/v1/telegram-bot-webhook",
    webhookSecret,
  });

  assert.deepEqual(operations[0]?.payload, {
    name: "DEV: English Daily Loop",
  });
});

test("checks getMe before applying bot mutations", async () => {
  const operations: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const operation = String(input).split("/").at(-1) ?? "";
    operations.push(operation);
    if (operation === "getMe") {
      return Response.json({
        ok: true,
        result: { username: "another_dev_bot" },
      });
    }
    return Response.json({ ok: true, result: true });
  };

  await assert.rejects(
    configureTelegramBot({
      token: "sensitive-token",
      expectedBotUsername: "@expected_dev_bot",
      frontendUrl: "https://frontend.example",
      webhookUrl:
        "https://api.example/functions/v1/telegram-bot-webhook",
      webhookSecret,
      fetchImpl,
    }),
    (error: unknown) => {
      assert.ok(error instanceof TelegramBotConfigurationError);
      assert.equal(error.code, "TELEGRAM_BOT_USERNAME_MISMATCH");
      return true;
    },
  );
  assert.deepEqual(operations, ["getMe"]);
});

test("configures the expected bot in a deterministic order", async () => {
  const requests: Array<{ operation: string; payload: unknown }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const operation = String(input).split("/").at(-1) ?? "";
    requests.push({
      operation,
      payload: JSON.parse(String(init?.body)) as unknown,
    });
    if (operation === "getMe") {
      return Response.json({
        ok: true,
        result: { username: "expected_dev_bot" },
      });
    }
    if (operation === "getWebhookInfo") {
      return Response.json({
        ok: true,
        result: {
          url: "https://api.example/functions/v1/telegram-bot-webhook",
          pending_update_count: 0,
          allowed_updates: ["message"],
        },
      });
    }
    return Response.json({ ok: true, result: true });
  };

  const result = await configureTelegramBot({
    token: "sensitive-token",
    expectedBotUsername: "@expected_dev_bot",
    displayName: DEV_TELEGRAM_BOT_DISPLAY_NAME,
    frontendUrl: "https://frontend.example",
    webhookUrl: "https://api.example/functions/v1/telegram-bot-webhook",
    webhookSecret,
    dropPendingUpdates: true,
    fetchImpl,
  });

  assert.equal(result.botUsername, "@expected_dev_bot");
  assert.deepEqual(requests[1]?.payload, {
    name: "DEV: English Daily Loop",
  });
  assert.deepEqual(
    requests.map(({ operation }) => operation),
    [
      "getMe",
      "setMyName",
      "setMyShortDescription",
      "setMyDescription",
      "setMyCommands",
      "setChatMenuButton",
      "setWebhook",
      "getWebhookInfo",
    ],
  );
  assert.equal(result.webhookInfo.pendingUpdateCount, 0);
});

test("deletes only the expected bot webhook and sanitizes status", async () => {
  const operations: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const operation = String(input).split("/").at(-1) ?? "";
    operations.push(operation);
    if (operation === "getMe") {
      return Response.json({
        ok: true,
        result: { username: "expected_dev_bot" },
      });
    }
    if (operation === "getWebhookInfo") {
      return Response.json({
        ok: true,
        result: {
          url: "",
          pending_update_count: 0,
          last_error_message: "raw error is not returned",
        },
      });
    }
    return Response.json({ ok: true, result: true });
  };

  const status = await deleteTelegramWebhook({
    token: "sensitive-token",
    expectedBotUsername: "@expected_dev_bot",
    fetchImpl,
  });
  assert.deepEqual(operations, ["getMe", "deleteWebhook", "getWebhookInfo"]);
  assert.deepEqual(status, {
    url: "",
    pendingUpdateCount: 0,
    allowedUpdates: [],
    hasLastError: true,
  });
  assert.doesNotMatch(JSON.stringify(status), /raw error/);
});

test("sanitizes malformed webhook status", () => {
  assert.deepEqual(sanitizeWebhookInfo(null), {
    url: "",
    pendingUpdateCount: 0,
    allowedUpdates: [],
    hasLastError: false,
  });
});
