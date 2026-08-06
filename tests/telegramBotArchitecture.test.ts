import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readProjectFile = (relativePath: string): string =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("disables Supabase JWT verification only for the Telegram webhook", () => {
  const config = readProjectFile("supabase/config.toml");
  assert.match(
    config,
    /\[functions\.telegram-bot-webhook\]\s+verify_jwt\s*=\s*false/,
  );
  assert.equal(config.match(/verify_jwt\s*=\s*false/g)?.length, 1);
});

test("keeps the Telegram webhook independent from application data", () => {
  const files = [
    "supabase/functions/telegram-bot-webhook/index.ts",
    "supabase/functions/telegram-bot-webhook/bot-flow.ts",
    "supabase/functions/telegram-bot-webhook/telegram-bot-api.ts",
    "supabase/functions/telegram-bot-webhook/webhook-handler.ts",
  ].map(readProjectFile).join("\n");

  assert.doesNotMatch(
    files,
    /SUPABASE_SERVICE_ROLE_KEY|createClient|\.from\(|\.rpc\(/,
  );
});

test("keeps production Telegram credentials out of script parameters", () => {
  const script = readProjectFile(
    "scripts/telegram/configure-production-bot.ps1",
  );

  const parameterBlock = script.match(/param\(([\s\S]*?)\)\s*\$ErrorActionPreference/)
    ?.[1] ?? "";
  assert.doesNotMatch(parameterBlock, /BotToken|WebhookSecret/);
  assert.match(script, /Read-Host[^\n]+-AsSecureString/);
  assert.match(script, /ExpectedBotUsername = "english_daily_loop_bot"/);
  assert.match(script, /"getMe"/);
  assert.match(script, /"deleteWebhook"/);
  assert.match(script, /"getWebhookInfo"/);
  assert.match(script, /\[Text\.Encoding\]::UTF8\.GetBytes/);
  assert.doesNotMatch(script, /Write-Host[^\n]+\$(botToken|webhookSecret)/i);
});

test("exposes a guarded dev webhook rollback command", () => {
  const packageJson = JSON.parse(readProjectFile("package.json")) as {
    scripts?: Record<string, string>;
  };
  const rollbackScript = readProjectFile(
    "scripts/telegram/delete-dev-webhook.mjs",
  );

  assert.equal(
    packageJson.scripts?.["telegram:dev:webhook:delete"],
    "node scripts/telegram/delete-dev-webhook.mjs",
  );
  assert.match(rollbackScript, /loadTelegramDevEnv/);
  assert.match(rollbackScript, /deleteTelegramWebhook/);
  assert.doesNotMatch(rollbackScript, /TELEGRAM_BOT_TOKEN\s*=|token\s*:\s*["']/);
});
