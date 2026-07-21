import { existsSync, readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { parseEnv } from "node:util";

import {
  envFilePath,
  envTemplatePath,
  productionTelegramBotUsername,
} from "./config.mjs";

const requiredTelegramDevKeys = [
  "TELEGRAM_DEV_MODE",
  "DEV_TELEGRAM_BOT_USERNAME",
  "TELEGRAM_BOT_TOKEN",
  "OPENROUTER_API_KEY",
];

const managedAppEnvKeys = new Set([
  "TELEGRAM_DEV_MODE",
  "DEV_TELEGRAM_BOT_USERNAME",
  "TELEGRAM_BOT_TOKEN",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL_CHAIN",
  "OPENROUTER_MODEL_PRIMARY",
  "OPENROUTER_MODEL_FALLBACK",
  "OPENROUTER_MODEL_TERTIARY",
  "DEV_TOOLS_ENABLED",
  "SUBSCRIPTION_FLOW_ENABLED",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]);

function isPlaceholder(value) {
  return /^(?:YOUR_|CHANGE_ME|REPLACE_ME|TODO)/i.test(value.trim());
}

function normalizeBotUsername(value) {
  const trimmed = value.trim();
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export function validateTelegramDevEnv(values) {
  const missing = requiredTelegramDevKeys.filter((key) => {
    const value = values[key];
    return typeof value !== "string" || !value.trim() || isPlaceholder(value);
  });

  if (missing.length > 0) {
    throw new Error(
      `${envFilePath} is missing dev values: ${missing.join(", ")}. ` +
        `Create it from ${envTemplatePath} and fill only development credentials.`,
    );
  }

  if (values.TELEGRAM_DEV_MODE.trim().toLowerCase() !== "true") {
    throw new Error(
      `${envFilePath} must contain TELEGRAM_DEV_MODE="true".`,
    );
  }

  const botUsername = normalizeBotUsername(values.DEV_TELEGRAM_BOT_USERNAME);
  if (!/^@[A-Za-z0-9_]{5,32}bot$/i.test(botUsername)) {
    throw new Error(
      `DEV_TELEGRAM_BOT_USERNAME must be a Telegram bot username, got ${botUsername}.`,
    );
  }

  if (
    botUsername.toLowerCase() === productionTelegramBotUsername.toLowerCase()
  ) {
    throw new Error(
      `Refusing to start: ${botUsername} is the production bot. Use a separate development bot.`,
    );
  }

  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(values.TELEGRAM_BOT_TOKEN.trim())) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN does not look like a BotFather development token.",
    );
  }

  return {
    values: {
      ...values,
      DEV_TELEGRAM_BOT_USERNAME: botUsername,
    },
    botUsername,
  };
}

export function loadTelegramDevEnv() {
  if (!existsSync(envFilePath)) {
    throw new Error(
      `${envFilePath} not found. Create it from ${envTemplatePath}; ` +
        "dev:telegram never reads .env.local.",
    );
  }

  let values;
  try {
    values = parseEnv(readFileSync(envFilePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${envFilePath}: ${message}`);
  }

  return validateTelegramDevEnv(values);
}

function isManagedAppEnvKey(key) {
  return key.startsWith("VITE_") || managedAppEnvKeys.has(key);
}

export function createTelegramDevProcessEnv(baseEnv, devValues) {
  const isolated = {};
  for (const [key, value] of Object.entries(baseEnv)) {
    if (!isManagedAppEnvKey(key) && value !== undefined) {
      isolated[key] = value;
    }
  }

  return {
    ...isolated,
    ...devValues,
  };
}

export function syncEnvValues(values) {
  if (!existsSync(envFilePath)) {
    throw new Error(`${envFilePath} disappeared during startup.`);
  }

  try {
    const content = readFileSync(envFilePath, "utf8");
    let next = content;

    for (const [key, value] of Object.entries(values)) {
      const line = `${key}="${value}"`;
      const pattern = new RegExp(`^${key}=.*$`, "m");
      next = next.match(pattern)
        ? next.replace(pattern, line)
        : `${next.trimEnd()}\n${line}\n`;
    }

    if (next !== content) {
      writeFileSync(envFilePath, next, "utf8");
      process.stdout.write(
        `[env] updated ${Object.keys(values).join(", ")} in ${envFilePath}\n`,
      );
      return true;
    }

    process.stdout.write(
      `[env] ${Object.keys(values).join(", ")} already up to date in ${envFilePath}\n`,
    );
    return false;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[env] failed to update ${envFilePath}: ${message}`);
  }
}
