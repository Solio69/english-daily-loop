import {
  loadTelegramDevEnv,
} from "../dev/env.mjs";
import {
  deleteTelegramWebhook,
} from "./bot-config.mjs";

async function main() {
  const config = loadTelegramDevEnv();
  process.stdout.write(
    `[telegram-bot] deleting webhook for ${config.botUsername}...\n`,
  );
  const status = await deleteTelegramWebhook({
    token: config.values.TELEGRAM_BOT_TOKEN,
    expectedBotUsername: config.botUsername,
    dropPendingUpdates: true,
  });
  process.stdout.write(
    `[telegram-bot] webhook deleted; URL empty: ${status.url === "" ? "yes" : "no"}; pending updates: ${status.pendingUpdateCount}.\n`,
  );
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Telegram webhook delete failed.";
  process.stderr.write(`[telegram-bot] ${message}\n`);
  process.exitCode = 1;
});

