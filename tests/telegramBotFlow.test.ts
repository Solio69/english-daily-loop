import assert from "node:assert/strict";
import test from "node:test";
import {
  BOT_DESCRIPTION,
  BOT_DISPLAY_NAME,
  BOT_SHORT_DESCRIPTION,
  HELP_MESSAGE,
  OPEN_APP_BUTTON_TEXT,
  START_MESSAGE,
  buildSendMessagePayload,
  getMenuWebAppUrl,
  resolveBotFlow,
} from "../supabase/functions/telegram-bot-webhook/bot-flow.ts";

const privateMessage = (overrides: Record<string, unknown> = {}) => ({
  message: {
    chat: { id: 123456789, type: "private" },
    from: { id: 123456789, is_bot: false },
    ...overrides,
  },
});

test("keeps the agreed Telegram bot profile copy", () => {
  assert.equal(BOT_DISPLAY_NAME, "English Daily Loop");
  assert.equal(
    BOT_SHORT_DESCRIPTION,
    "Ежедневная практика английского: чтение, новые слова и повторение.",
  );
  assert.equal(
    BOT_DESCRIPTION,
    "Читай короткие тексты по своему уровню, сохраняй новые слова и повторяй их по дневному плану — всё в одном небольшом занятии.",
  );
});

for (const text of ["/start", "/start lesson", "/start@sample_bot"]) {
  test(`routes ${text} to the exact welcome message`, () => {
    assert.deepEqual(resolveBotFlow(privateMessage({ text })), {
      type: "reply",
      commandCategory: "start",
      updateCategory: "message",
      chatId: 123456789,
      text: START_MESSAGE,
    });
  });
}

for (const [name, overrides] of [
  ["help", { text: "/help" }],
  ["unknown text", { text: "Как начать?" }],
  ["sticker", { sticker: { file_id: "not-read-by-flow" } }],
] as const) {
  test(`routes ${name} to the exact help message`, () => {
    assert.deepEqual(resolveBotFlow(privateMessage(overrides)), {
      type: "reply",
      commandCategory: name === "help" ? "help" : "fallback",
      updateCategory: "message",
      chatId: 123456789,
      text: HELP_MESSAGE,
    });
  });
}

test("ignores unsupported, non-private, and bot-authored updates", () => {
  assert.equal(resolveBotFlow({ callback_query: {} }).type, "ignored");
  assert.equal(
    resolveBotFlow(
      privateMessage({ chat: { id: -100123, type: "supergroup" } }),
    ).type,
    "ignored",
  );
  assert.equal(
    resolveBotFlow(privateMessage({ from: { id: 1, is_bot: true } })).type,
    "ignored",
  );
});

test("extracts only a safe HTTPS URL from the default web app menu button", () => {
  assert.equal(
    getMenuWebAppUrl({
      type: "web_app",
      web_app: { url: "https://english-daily-loop.example/app" },
    }),
    "https://english-daily-loop.example/app",
  );
  assert.equal(getMenuWebAppUrl({ type: "commands" }), null);
  assert.equal(
    getMenuWebAppUrl({
      type: "web_app",
      web_app: { url: "http://127.0.0.1:3000" },
    }),
    null,
  );
  assert.equal(
    getMenuWebAppUrl({
      type: "web_app",
      web_app: { url: "https://user:pass@example.com" },
    }),
    null,
  );
});

test("builds one native web app button with the agreed label", () => {
  const flow = resolveBotFlow(privateMessage({ text: "/start" }));
  assert.equal(flow.type, "reply");
  if (flow.type !== "reply") return;

  assert.deepEqual(
    buildSendMessagePayload(flow, "https://english-daily-loop.example"),
    {
      chat_id: 123456789,
      text: START_MESSAGE,
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
  );
});

