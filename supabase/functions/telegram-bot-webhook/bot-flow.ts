export const BOT_DISPLAY_NAME = "English Daily Loop";
export const BOT_SHORT_DESCRIPTION =
  "Ежедневная практика английского: чтение, новые слова и повторение.";
export const BOT_DESCRIPTION =
  "Читай короткие тексты по своему уровню, сохраняй новые слова и повторяй их по дневному плану — всё в одном небольшом занятии.";
export const OPEN_APP_BUTTON_TEXT = "Открыть приложение";
export const START_COMMAND_DESCRIPTION =
  "Открыть приветствие и приложение";
export const HELP_COMMAND_DESCRIPTION = "Как работает приложение";

export const START_MESSAGE = `Привет! 👋

English Daily Loop — короткая практика английского на каждый день.

Читай тексты под свой уровень, сохраняй новые слова и повторяй их по дневному плану.

Хочешь узнать, как устроено занятие? Отправь /help.

Нажми «Открыть приложение», чтобы начать.`;

export const HELP_MESSAGE = `Как работает English Daily Loop 👇

📖 AI создаёт короткий текст по твоему уровню и времени чтения. Читай его в приложении, нажимай на незнакомые слова, чтобы сохранить их, и заверши текст.

✨ Открой «Материалы» и нажми «Готовить»: AI создаст для сохранённых слов карточки с переводом, частью речи, примерами и формами глаголов. Там же можно вернуться к прочитанным текстам и своему словарю.

🧠 Готовые карточки появляются в разделе «Слова». Открой перевод и выбери следующий интервал: если слово не вспомнилось, оно вернётся через день; если вспомнилось — выбери, через сколько показать его снова.

Так складывается ежедневное занятие: чтение → новые слова → повторение.

Нажми «Открыть приложение», чтобы начать или продолжить.`;

export const FALLBACK_MESSAGE = `Я понимаю только команды /start и /help.

Выбери нужную команду в меню или нажми «Открыть приложение».`;

type UnknownRecord = Record<string, unknown>;

export type BotCommandCategory = "start" | "help" | "fallback" | "ignored";

export type BotFlowResult =
  | {
      type: "ignored";
      commandCategory: "ignored";
      updateCategory: "unsupported" | "non_private" | "invalid_message";
    }
  | {
      type: "reply";
      commandCategory: Exclude<BotCommandCategory, "ignored">;
      updateCategory: "message";
      chatId: number;
      text: string;
    };

export type TelegramSendMessagePayload = {
  chat_id: number;
  text: string;
  reply_markup: {
    inline_keyboard: Array<
      Array<{
        text: string;
        web_app: { url: string };
      }>
    >;
  };
};

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const isTelegramChatId = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value);

const getCommandCategory = (
  text: unknown,
): Exclude<BotCommandCategory, "ignored"> => {
  if (typeof text !== "string") {
    return "fallback";
  }

  const firstToken = text.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "";
  if (/^\/start(?:@[a-z0-9_]{5,32})?$/.test(firstToken)) {
    return "start";
  }
  if (/^\/help(?:@[a-z0-9_]{5,32})?$/.test(firstToken)) {
    return "help";
  }

  return "fallback";
};

export const resolveBotFlow = (update: unknown): BotFlowResult => {
  if (!isRecord(update) || !isRecord(update.message)) {
    return {
      type: "ignored",
      commandCategory: "ignored",
      updateCategory: "unsupported",
    };
  }

  const message = update.message;
  if (!isRecord(message.chat) || message.chat.type !== "private") {
    return {
      type: "ignored",
      commandCategory: "ignored",
      updateCategory: "non_private",
    };
  }

  if (
    !isTelegramChatId(message.chat.id) ||
    !isRecord(message.from) ||
    message.from.is_bot !== false
  ) {
    return {
      type: "ignored",
      commandCategory: "ignored",
      updateCategory: "invalid_message",
    };
  }

  const commandCategory = getCommandCategory(message.text);
  const responseText =
    commandCategory === "start"
      ? START_MESSAGE
      : commandCategory === "help"
        ? HELP_MESSAGE
        : FALLBACK_MESSAGE;

  return {
    type: "reply",
    commandCategory,
    updateCategory: "message",
    chatId: message.chat.id,
    text: responseText,
  };
};

export const getMenuWebAppUrl = (menuButton: unknown): string | null => {
  if (
    !isRecord(menuButton) ||
    menuButton.type !== "web_app" ||
    !isRecord(menuButton.web_app) ||
    typeof menuButton.web_app.url !== "string"
  ) {
    return null;
  }

  const rawUrl = menuButton.web_app.url.trim();
  try {
    const parsedUrl = new URL(rawUrl);
    if (
      parsedUrl.protocol !== "https:" ||
      !parsedUrl.hostname ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      return null;
    }
    return rawUrl;
  } catch {
    return null;
  }
};

export const buildSendMessagePayload = (
  flow: Extract<BotFlowResult, { type: "reply" }>,
  webAppUrl: string,
): TelegramSendMessagePayload => ({
  chat_id: flow.chatId,
  text: flow.text,
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: OPEN_APP_BUTTON_TEXT,
          web_app: { url: webAppUrl },
        },
      ],
    ],
  },
});
