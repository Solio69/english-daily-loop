import assert from "node:assert/strict";
import test from "node:test";
import {
  createTelegramDevProcessEnv,
  validateTelegramDevEnv,
} from "../scripts/dev/env.mjs";
import { parseLocalSupabaseAnonKey } from "../scripts/dev/supabase-local.mjs";

const validEnv = {
  TELEGRAM_DEV_MODE: "true",
  DEV_TELEGRAM_BOT_USERNAME: "english_daily_loop_dev_bot",
  TELEGRAM_BOT_TOKEN: [
    "123456789",
    "fake-development-token-value",
  ].join(":"),
  TELEGRAM_BOT_WEBHOOK_SECRET: "valid_dev_webhook_secret_value_1234567890",
  OPENROUTER_API_KEY: "fake-development-openrouter-key",
  VITE_SUPABASE_URL: "https://local-api.trycloudflare.com",
  VITE_SUPABASE_ANON_KEY: "local-anon-key",
};

test("validates and normalizes isolated Telegram dev env", () => {
  const result = validateTelegramDevEnv(validEnv);

  assert.equal(result.botUsername, "@english_daily_loop_dev_bot");
  assert.equal(
    result.values.DEV_TELEGRAM_BOT_USERNAME,
    "@english_daily_loop_dev_bot",
  );
});

test("refuses the production Telegram bot", () => {
  assert.throws(
    () =>
      validateTelegramDevEnv({
        ...validEnv,
        DEV_TELEGRAM_BOT_USERNAME: "@english_daily_loop_bot",
      }),
    /production bot/i,
  );
});

test("requires the explicit Telegram development marker", () => {
  assert.throws(
    () =>
      validateTelegramDevEnv({
        ...validEnv,
        TELEGRAM_DEV_MODE: "false",
      }),
    /TELEGRAM_DEV_MODE="true"/,
  );
});

test("requires a strong Telegram webhook secret", () => {
  assert.throws(
    () =>
      validateTelegramDevEnv({
        ...validEnv,
        TELEGRAM_BOT_WEBHOOK_SECRET: "short",
      }),
    /32-256 characters/,
  );
});

test("removes inherited app variables before adding dev values", () => {
  const result = createTelegramDevProcessEnv(
    {
      PATH: "system-path",
      VITE_SUPABASE_URL: "https://production.supabase.co",
      TELEGRAM_BOT_TOKEN: "production-token",
      TELEGRAM_BOT_WEBHOOK_SECRET: "production-webhook-secret",
      OPENROUTER_API_KEY: "production-key",
    },
    validEnv,
  );

  assert.equal(result.PATH, "system-path");
  assert.equal(result.VITE_SUPABASE_URL, validEnv.VITE_SUPABASE_URL);
  assert.equal(result.TELEGRAM_BOT_TOKEN, validEnv.TELEGRAM_BOT_TOKEN);
  assert.equal(
    result.TELEGRAM_BOT_WEBHOOK_SECRET,
    validEnv.TELEGRAM_BOT_WEBHOOK_SECRET,
  );
  assert.equal(result.OPENROUTER_API_KEY, validEnv.OPENROUTER_API_KEY);
});

test("reads the anon key from local Supabase status output", () => {
  assert.equal(
    parseLocalSupabaseAnonKey(
      'API_URL="http://127.0.0.1:54321"\nANON_KEY="local-anon-key"\n',
    ),
    "local-anon-key",
  );
  assert.throws(
    () => parseLocalSupabaseAnonKey('API_URL="http://127.0.0.1:54321"'),
    /did not return ANON_KEY/,
  );
});
