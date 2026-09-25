import assert from "node:assert/strict";
import test from "node:test";
import {
  TelegramBotApiError,
  createTelegramBotApiClient,
} from "../supabase/functions/telegram-bot-webhook/telegram-bot-api.ts";

test("gets the default menu button without a chat id", async () => {
  const requests: Array<{ url: string; body: unknown }> = [];
  const client = createTelegramBotApiClient({
    token: "fake-token",
    fetchImpl: async (input, init) => {
      requests.push({
        url: String(input),
        body: JSON.parse(String(init?.body)) as unknown,
      });
      return Response.json({
        ok: true,
        result: {
          type: "web_app",
          text: "Открыть приложение",
          web_app: { url: "https://example.com" },
        },
      });
    },
  });

  const result = await client.getDefaultMenuButton();
  assert.deepEqual(requests, [
    {
      url: "https://api.telegram.org/botfake-token/getChatMenuButton",
      body: {},
    },
  ]);
  assert.deepEqual(result, {
    type: "web_app",
    text: "Открыть приложение",
    web_app: { url: "https://example.com" },
  });
});

test("does not expose provider details or token in Telegram API errors", async () => {
  const client = createTelegramBotApiClient({
    token: "sensitive-token",
    fetchImpl: async () =>
      Response.json(
        {
          ok: false,
          error_code: 400,
          description: "provider response containing sensitive-token",
        },
        { status: 400 },
      ),
  });

  await assert.rejects(
    client.getDefaultMenuButton(),
    (error: unknown) => {
      assert.ok(error instanceof TelegramBotApiError);
      assert.equal(error.code, "TELEGRAM_API_REJECTED");
      assert.equal(error.providerStatus, 400);
      assert.equal(error.providerErrorCode, 400);
      assert.doesNotMatch(error.message, /sensitive-token|provider response/);
      return true;
    },
  );
});

test("turns aborted requests into a safe timeout error", async () => {
  const client = createTelegramBotApiClient({
    token: "fake-token",
    timeoutMs: 5,
    fetchImpl: (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      }),
  });

  await assert.rejects(
    client.getDefaultMenuButton(),
    (error: unknown) => {
      assert.ok(error instanceof TelegramBotApiError);
      assert.equal(error.code, "TELEGRAM_API_TIMEOUT");
      return true;
    },
  );
});

