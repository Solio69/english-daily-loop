import { existsSync } from "node:fs";
import process from "node:process";

import {
  cloudflaredExecutable,
  commands,
  edgeFunctionNames,
  localApiTunnelTarget,
  localFrontendTunnelTarget,
  envFilePath,
} from "./dev/config.mjs";
import {
  createTelegramDevProcessEnv,
  loadTelegramDevEnv,
  syncEnvValues,
} from "./dev/env.mjs";
import { color, useColor, withColor } from "./dev/logging.mjs";
import { runOnce, spawnLabeled, stopChildProcess } from "./dev/process.mjs";
import {
  getLocalSupabaseAnonKey,
  getSupabaseContainers,
  startSupabase,
} from "./dev/supabase-local.mjs";
import { waitForTunnelUrl } from "./dev/tunnels.mjs";
import {
  DEV_TELEGRAM_BOT_DISPLAY_NAME,
  TELEGRAM_BOT_PROFILE,
  TelegramBotConfigurationError,
  buildTelegramWebhookUrl,
  configureTelegramBot,
} from "./telegram/bot-config.mjs";

let shuttingDown = false;
const children = [];
const tunnelUrls = {
  frontend: null,
  api: null,
};
let startupSummaryPrinted = false;
let frontendStarted = false;
let telegramDevEnvValues = null;
let telegramDevBotUsername = null;
let telegramBotConfigured = false;
let telegramWebhookUrl = null;

// TODO: Local Telegram infra helper; keep API tunnel sync limited to the isolated dev env file.
function syncApiUrlToEnv(apiUrl) {
  syncEnvValues({
    VITE_SUPABASE_URL: apiUrl,
  });
  telegramDevEnvValues.VITE_SUPABASE_URL = apiUrl;
  process.stdout.write(
    "[env] VITE_SUPABASE_URL synced before frontend build.\n",
  );
}

function maybePrintStartupSummary() {
  if (startupSummaryPrinted) return;
  if (!tunnelUrls.frontend || !tunnelUrls.api) return;
  if (!frontendStarted) return;
  if (!telegramBotConfigured || !telegramWebhookUrl) return;
  startupSummaryPrinted = true;

  const checklistLine = "================ STARTUP SUMMARY ================";
  process.stdout.write(
    useColor
      ? `\n${color.bold}${color.cyan}${checklistLine}${color.reset}\n`
      : `\n${checklistLine}\n`,
  );
  process.stdout.write(
    useColor
      ? `${color.bold}${color.yellow}1) Telegram dev bot configured:${color.reset}\n`
      : "1) Telegram dev bot configured:\n",
  );
  process.stdout.write(`   Bot: ${telegramDevBotUsername}\n`);
  process.stdout.write(
    `   Menu button: ${TELEGRAM_BOT_PROFILE.openAppButtonText}\n`,
  );
  process.stdout.write(`   Mini App URL: ${tunnelUrls.frontend}\n`);
  process.stdout.write(`   Webhook URL: ${telegramWebhookUrl}\n`);
  process.stdout.write(
    useColor
      ? `${color.bold}${color.yellow}2) ${envFilePath} contains:${color.reset}\n`
      : `2) ${envFilePath} contains:\n`,
  );
  process.stdout.write(
    useColor
      ? `   VITE_SUPABASE_URL=${color.green}${tunnelUrls.api}${color.reset}\n`
      : `   VITE_SUPABASE_URL=${tunnelUrls.api}\n`,
  );
  process.stdout.write(
    useColor
      ? `${color.bold}${color.yellow}3) Tunnel status:${color.reset} URLs created\n`
      : "3) Tunnel status: URLs created\n",
  );
  process.stdout.write(
    "   Action: keep this terminal running while using the Mini App.\n\n",
  );
}

function highlightTunnelUrl(kind, url) {
  const title =
    kind === "frontend" ? "FRONTEND TUNNEL URL" : "SUPABASE API TUNNEL URL";
  const line = `================ ${title} ================`;
  process.stdout.write(
    useColor
      ? `\n${color.bold}${color.cyan}${line}${color.reset}\n`
      : `\n${line}\n`,
  );
  process.stdout.write(
    useColor ? `${color.bold}${color.green}${url}${color.reset}\n` : `${url}\n`,
  );
  process.stdout.write(
    useColor
      ? `${color.yellow}URL ready.${color.reset}\n`
      : "URL ready.\n",
  );

  if (kind === "api") {
    syncApiUrlToEnv(url);
  }

  maybePrintStartupSummary();
}

async function configureDevTelegramBot() {
  telegramWebhookUrl = buildTelegramWebhookUrl(tunnelUrls.api);
  process.stdout.write(
    `[telegram-bot] configuring ${telegramDevBotUsername} for current tunnels...\n`,
  );
  const result = await configureTelegramBot({
    token: telegramDevEnvValues.TELEGRAM_BOT_TOKEN,
    expectedBotUsername: telegramDevBotUsername,
    displayName: DEV_TELEGRAM_BOT_DISPLAY_NAME,
    frontendUrl: tunnelUrls.frontend,
    webhookUrl: telegramWebhookUrl,
    webhookSecret: telegramDevEnvValues.TELEGRAM_BOT_WEBHOOK_SECRET,
    dropPendingUpdates: true,
  });
  telegramBotConfigured = true;
  process.stdout.write(
    `[telegram-bot] profile, commands, menu button and webhook configured for ${result.botUsername}.\n`,
  );
  process.stdout.write(
    `[telegram-bot] pending updates: ${result.webhookInfo.pendingUpdateCount}; last error: ${result.webhookInfo.hasLastError ? "yes" : "no"}.\n`,
  );
  maybePrintStartupSummary();
}

function prepareEnv() {
  const config = loadTelegramDevEnv();
  telegramDevEnvValues = config.values;
  telegramDevBotUsername = config.botUsername;
  process.stdout.write(
    `Preparing isolated Telegram dev mode for ${telegramDevBotUsername}...\n`,
  );
}

function getTelegramDevChildEnv() {
  return createTelegramDevProcessEnv(process.env, telegramDevEnvValues);
}

// TODO: Local infra guard; fail before publishing tunnel URLs if Docker/Supabase origins are unavailable.
async function assertLocalOriginReady(label, url) {
  const deadline = Date.now() + 15_000;
  let lastError = "Unknown error.";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.status < 500) {
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `${label} is not reachable at ${url}. Last error: ${lastError}`,
  );
}

// TODO: Local Telegram WebView uses a production-like bundle because Vite dev client/HMR can stall through quick tunnels.
async function buildFrontend() {
  process.stdout.write("[frontend-build] building frontend bundle for Telegram...\n");
  await runOnce(
    commands.pnpm,
    ["build:telegram"],
    "frontend build",
    { env: getTelegramDevChildEnv(), replaceEnv: true },
  );
}

function startFrontendWatcher() {
  const watcher = spawnLabeled(
    commands.pnpm,
    ["watch:telegram"],
    "frontend-watch",
    { env: getTelegramDevChildEnv(), replaceEnv: true },
  );
  children.push(watcher);
  watcher.on("exit", (code) => {
    if (shuttingDown) {
      return;
    }

    process.stderr.write(
      `\n[frontend-watch] exited with code ${code ?? "unknown"}; ` +
        "stopping local stack because frontend changes are no longer tracked.\n",
    );
    shutdown(1);
  });
}

// TODO: Local frontend stays on port 3000 because the Telegram tunnel targets that port.
function startFrontend() {
  const frontend = spawnLabeled(commands.pnpm, ["preview:telegram"], "frontend");
  children.push(frontend);
  frontendStarted = true;
  maybePrintStartupSummary();
  frontend.on("exit", (code) => {
    if (shuttingDown) {
      return;
    }

    if (code !== 0) {
      process.stderr.write(
        `\n[frontend] exited with code ${code ?? "unknown"}.\n`,
      );
    }
    shutdown(1);
  });
}

function startEdgeFunctions() {
  const edgeFunctions = spawnLabeled(
    commands.npx,
    [
      "supabase",
      "functions",
      "serve",
      ...edgeFunctionNames,
      "--env-file",
      envFilePath,
    ],
    "edge",
    { env: getTelegramDevChildEnv(), replaceEnv: true },
  );
  children.push(edgeFunctions);
  edgeFunctions.on("exit", (code) => {
    if (!shuttingDown) {
      process.stderr.write(
        `[edge] function runner exited with code ${code ?? "unknown"}; stopping local stack.\n`,
      );
      shutdown(1);
    }
  });
}

function startTunnel(kind, target, label) {
  const cloudflaredEnv = {
    TUNNEL_TRANSPORT_PROTOCOL: "http2",
  };
  process.stdout.write(
    `[${label}] forcing Cloudflare tunnel transport: ${cloudflaredEnv.TUNNEL_TRANSPORT_PROTOCOL}\n`,
  );
  const tunnel = spawnLabeled(
    cloudflaredExecutable,
    ["tunnel", "--url", target],
    label,
    { env: cloudflaredEnv },
  );
  children.push(tunnel);
  tunnel.on("exit", (code) => {
    if (!shuttingDown) {
      process.stderr.write(
        `[${label}] exited with code ${code ?? "unknown"}; stopping local stack.\n`,
      );
      shutdown(1);
    }
  });
  return tunnel;
}

async function startPublicTunnel(kind, target, label) {
  process.stdout.write(`[${label}] starting public tunnel...\n`);
  const tunnel = startTunnel(kind, target, label);
  return waitForTunnelUrl(tunnel, kind);
}

// TODO: Local Telegram-only tunnel orchestration; keep non-Telegram auth bypass out of this stack.
async function startApiTunnel() {
  if (!existsSync(cloudflaredExecutable)) {
    throw new Error(
      `${cloudflaredExecutable} not found; API tunnel is required for isolated Telegram dev mode.`,
    );
  }

  process.stdout.write(
    "[tunnel] starting api tunnel (127.0.0.1:54321)...\n",
  );
  return startPublicTunnel(
    "api",
    localApiTunnelTarget,
    "tunnel-api",
  );
}

async function startFrontendTunnel() {
  if (!existsSync(cloudflaredExecutable)) {
    throw new Error(
      `${cloudflaredExecutable} not found; frontend tunnel is required for Telegram dev mode.`,
    );
  }

  process.stdout.write(
    "[tunnel] starting frontend tunnel (127.0.0.1:3000)...\n",
  );
  return startPublicTunnel(
    "frontend",
    localFrontendTunnelTarget,
    "tunnel-frontend",
  );
}

async function startContainerLogs() {
  const containers = await getSupabaseContainers();
  // TODO: Local log streams must not dump container history and hide the startup summary.
  const followNewLogsArgs = ["logs", "--tail", "0", "--follow"];

  if (containers.db) {
    const dbLogs = spawnLabeled(
      commands.docker,
      [...followNewLogsArgs, containers.db],
      "db",
    );
    children.push(dbLogs);
    dbLogs.on("exit", (code) => {
      if (!shuttingDown) {
        process.stderr.write(
          `[db] log stream ended with code ${code ?? "unknown"}, continuing...\n`,
        );
      }
    });
  } else {
    process.stdout.write("[db] container not found, skipping DB logs\n");
  }

  if (containers.api) {
    const apiLogs = spawnLabeled(
      commands.docker,
      [...followNewLogsArgs, containers.api],
      "api",
    );
    children.push(apiLogs);
    apiLogs.on("exit", (code) => {
      if (!shuttingDown) {
        process.stderr.write(
          `[api] log stream ended with code ${code ?? "unknown"}, continuing...\n`,
        );
      }
    });
  } else {
    process.stdout.write("[api] container not found, skipping API logs\n");
  }
}

function terminateChildren() {
  for (const child of children) {
    if (!child) {
      continue;
    }
    stopChildProcess(child);
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  process.stdout.write("\nStopping foreground processes...\n");
  terminateChildren();
  setTimeout(() => process.exit(exitCode), 300);
}

async function main() {
  prepareEnv();
  const initialDevChildEnv = getTelegramDevChildEnv();
  await startSupabase(initialDevChildEnv);
  const localAnonKey = await getLocalSupabaseAnonKey(initialDevChildEnv);
  syncEnvValues({ VITE_SUPABASE_ANON_KEY: localAnonKey });
  telegramDevEnvValues.VITE_SUPABASE_ANON_KEY = localAnonKey;
  startEdgeFunctions();
  await assertLocalOriginReady(
    "Supabase API",
    `${localApiTunnelTarget}/rest/v1/`,
  );
  tunnelUrls.api = await startApiTunnel();
  highlightTunnelUrl("api", tunnelUrls.api);
  await buildFrontend();
  startFrontend();
  startFrontendWatcher();
  await assertLocalOriginReady("Frontend preview", localFrontendTunnelTarget);
  tunnelUrls.frontend = await startFrontendTunnel();
  highlightTunnelUrl("frontend", tunnelUrls.frontend);
  await configureDevTelegramBot();
  await startContainerLogs();

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  const telegramErrorDetails =
    error instanceof TelegramBotConfigurationError
      ? ` (${error.code}${error.providerStatus === null ? "" : `, HTTP ${error.providerStatus}`}${error.providerErrorCode === null ? "" : `, Telegram ${error.providerErrorCode}`}${error.providerReason === null ? "" : `, reason ${error.providerReason}`})`
      : "";
  process.stderr.write(
    `\nFailed to start local stack: ${error.message}${telegramErrorDetails}\n`,
  );
  if (!shuttingDown) {
    shuttingDown = true;
    process.stderr.write("Stopping processes from the failed startup...\n");
    terminateChildren();
  }
  setTimeout(() => process.exit(1), 300);
});
