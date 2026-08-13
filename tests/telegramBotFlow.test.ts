import assert from "node:assert/strict";
import test from "node:test";
import {
  BOT_DESCRIPTION,
  BOT_DISPLAY_NAME,
  BOT_SHORT_DESCRIPTION,
  FALLBACK_MESSAGE,
  HELP_COMMAND_DESCRIPTION,
  HELP_MESSAGE,
  OPEN_APP_BUTTON_TEXT,
  START_COMMAND_DESCRIPTION,
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
  assert.equal(
    START_COMMAND_DESCRIPTION,
    "Открыть приветствие и приложение",
  );
  assert.equal(HELP_COMMAND_DESCRIPTION, "Как работает приложение");
});

test("keeps the agreed start, help, and fallback reply copy", () => {
  assert.equal(
    START_MESSAGE,
    `Привет! 👋

English Daily Loop — короткая практика английского на каждый день.

Читай тексты под свой уровень, сохраняй новые слова и повторяй их по дневному плану.

Хочешь узнать, как устроено занятие? Отправь /help.

Нажми «Открыть приложение», чтобы начать.`,
  );
  assert.equal(
    HELP_MESSAGE,
    `Как работает English Daily Loop 👇

📖 AI создаёт короткий текст по твоему уровню и времени чтения. Читай его в приложении, нажимай на незнакомые слова, чтобы сохранить их, и заверши текст.

✨ Открой «Материалы» и нажми «Готовить»: AI создаст для сохранённых слов карточки с переводом, частью речи, примерами и формами глаголов. Там же можно вернуться к прочитанным текстам и своему словарю.

🧠 Готовые карточки появляются в разделе «Слова». Открой перевод и выбери следующий интервал: если слово не вспомнилось, оно вернётся через день; если вспомнилось — выбери, через сколько показать его снова.

Так складывается ежедневное занятие: чтение → новые слова → повторение.

Нажми «Открыть приложение», чтобы начать или продолжить.`,
  );
  assert.equal(
    FALLBACK_MESSAGE,
    `Я понимаю только команды /start и /help.

Выбери нужную команду в меню или нажми «Открыть приложение».`,
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
  ["help with bot mention", { text: "/help@sample_bot" }],
] as const) {
  test(`routes ${name} to the exact help message`, () => {
    assert.deepEqual(resolveBotFlow(privateMessage(overrides)), {
      type: "reply",
      commandCategory: "help",
      updateCategory: "message",
      chatId: 123456789,
      text: HELP_MESSAGE,
    });
  });
}

for (const [name, overrides] of [
  ["unknown text", { text: "Как начать?" }],
  ["unknown command", { text: "/unknown" }],
  ["sticker", { sticker: { file_id: "not-read-by-flow" } }],
] as const) {
  test(`routes ${name} to the exact fallback message`, () => {
    assert.deepEqual(resolveBotFlow(privateMessage(overrides)), {
      type: "reply",
      commandCategory: "fallback",
      updateCategory: "message",
      chatId: 123456789,
      text: FALLBACK_MESSAGE,
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
