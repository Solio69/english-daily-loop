import { existsSync } from "node:fs";
import process from "node:process";

import {
  cloudflaredExecutable,
  commands,
  edgeFunctionNames,
  localApiTunnelTarget,
  localFrontendTunnelTarget,
} from "./dev/config.mjs";
import { syncEnvValues } from "./dev/env.mjs";
import { color, useColor, withColor } from "./dev/logging.mjs";
import { runOnce, spawnLabeled, stopChildProcess } from "./dev/process.mjs";
import {
  getSupabaseContainers,
  startSupabase,
} from "./dev/supabase-local.mjs";
import { attachTunnelUrlExtractor } from "./dev/tunnels.mjs";

let shuttingDown = false;
const children = [];
const tunnelUrls = {
  frontend: null,
  api: null,
};
const tunnelUrlWaiters = {
  frontend: [],
  api: [],
};
let startupSummaryPrinted = false;
let frontendRestartRequired = false;
let frontendBundleBuilt = false;
let frontendStarted = false;

// TODO: Local Telegram infra helper; keep API tunnel sync limited to local .env.local updates.
function syncApiUrlToEnv(apiUrl) {
  const changed = syncEnvValues({
    VITE_SUPABASE_URL: apiUrl,
  });

  if (changed) {
    if (frontendBundleBuilt) {
      frontendRestartRequired = true;
      process.stdout.write("[env] frontend restart required for new API URL.\n");
    } else {
      process.stdout.write("[env] VITE_SUPABASE_URL updated before frontend build.\n");
    }
  }
}

function maybePrintStartupSummary() {
  if (startupSummaryPrinted) return;
  if (!tunnelUrls.frontend || !tunnelUrls.api) return;
  if (!frontendStarted) return;
  startupSummaryPrinted = true;

  const checklistLine = "================ STARTUP SUMMARY ================";
  process.stdout.write(
    useColor
      ? `\n${color.bold}${color.cyan}${checklistLine}${color.reset}\n`
      : `\n${checklistLine}\n`,
  );
  process.stdout.write(
    useColor
      ? `${color.bold}${color.yellow}1) Update BotFather menu button:${color.reset}\n`
      : "1) Update BotFather menu button:\n",
  );
  process.stdout.write("   /setmenubutton\n");
  process.stdout.write("   Select bot: @english_daily_loop_bot\n");
  process.stdout.write(
    useColor
      ? `   URL: ${color.green}${tunnelUrls.frontend}${color.reset}\n`
      : `   URL: ${tunnelUrls.frontend}\n`,
  );
  process.stdout.write(
    useColor
      ? `${color.bold}${color.yellow}2) .env.local should contain:${color.reset}\n`
      : "2) .env.local should contain:\n",
  );
  process.stdout.write(
    useColor
      ? `   VITE_SUPABASE_URL=${color.green}${tunnelUrls.api}${color.reset}\n`
      : `   VITE_SUPABASE_URL=${tunnelUrls.api}\n`,
  );
  const restartStatus = frontendRestartRequired ? "YES" : "NO";
  process.stdout.write(
    useColor
      ? `${color.bold}${color.yellow}3) Frontend restart required:${color.reset} ${color.bold}${frontendRestartRequired ? color.yellow : color.green}${restartStatus}${color.reset}\n`
      : `3) Frontend restart required: ${restartStatus}\n`,
  );
  if (frontendRestartRequired) {
    process.stdout.write(
      "   Action: stop this run (Ctrl+C) and start `npm run dev:telegram` again.\n\n",
    );
  } else {
    process.stdout.write("   Action: continue, no restart needed.\n\n");
  }
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
      ? `${color.yellow}Copy this value now.${color.reset}\n`
      : "Copy this value now.\n",
  );

  if (kind === "api") {
    syncApiUrlToEnv(url);
  }

  maybePrintStartupSummary();
}

function handleTunnelUrl(kind, url) {
  if (kind === "frontend" && !tunnelUrls.frontend) {
    tunnelUrls.frontend = url;
    highlightTunnelUrl("frontend", url);
    for (const resolve of tunnelUrlWaiters.frontend) {
      resolve(url);
    }
    tunnelUrlWaiters.frontend = [];
  }
  if (kind === "api" && !tunnelUrls.api) {
    tunnelUrls.api = url;
    highlightTunnelUrl("api", url);
    for (const resolve of tunnelUrlWaiters.api) {
      resolve(url);
    }
    tunnelUrlWaiters.api = [];
  }
}

function waitForTunnelUrl(kind) {
  if (tunnelUrls[kind]) {
    return Promise.resolve(tunnelUrls[kind]);
  }

  return new Promise((resolve) => {
    tunnelUrlWaiters[kind].push(resolve);
  });
}

function prepareEnv() {
  process.stdout.write("Preparing Telegram dev mode...\n");
}

// TODO: Local Telegram WebView is served from a production-like bundle to avoid Vite dev client stalls through quick tunnels.
async function buildFrontend() {
  process.stdout.write("[frontend-build] building frontend bundle for Telegram...\n");
  await runOnce(commands.pnpm, ["build"], "frontend build");
  frontendBundleBuilt = true;
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
    shutdown();
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
      ".env.local",
    ],
    "edge",
  );
  children.push(edgeFunctions);
  edgeFunctions.on("exit", (code) => {
    if (!shuttingDown) {
      process.stderr.write(
        `[edge] function runner exited with code ${code ?? "unknown"}, continuing...\n`,
      );
    }
  });
}

function startTunnel(kind, target, label) {
  const tunnel = spawnLabeled(
    cloudflaredExecutable,
    ["tunnel", "--url", target],
    label,
  );
  attachTunnelUrlExtractor(tunnel, kind, handleTunnelUrl);
  children.push(tunnel);
  tunnel.on("exit", (code) => {
    if (!shuttingDown) {
      process.stderr.write(
        `[${label}] exited with code ${code ?? "unknown"}, continuing...\n`,
      );
    }
  });
}

// TODO: Local Telegram-only tunnel orchestration; keep non-Telegram auth bypass out of this stack.
function startApiTunnel() {
  if (existsSync(cloudflaredExecutable)) {
    process.stdout.write(
      "[tunnel] starting api tunnel (localhost:55421)...\n",
    );
    startTunnel("api", localApiTunnelTarget, "tunnel-api");
    return true;
  }

  process.stdout.write(
    `[tunnel] ${cloudflaredExecutable} not found, skipping api tunnel auto-start\n`,
  );
  return false;
}

function startFrontendTunnel() {
  if (existsSync(cloudflaredExecutable)) {
    process.stdout.write("[tunnel] starting frontend tunnel (localhost:3000)...\n");
    startTunnel("frontend", localFrontendTunnelTarget, "tunnel-frontend");
    return true;
  }

  process.stdout.write(
    `[tunnel] ${cloudflaredExecutable} not found, skipping frontend tunnel auto-start\n`,
  );
  return false;
}

async function startContainerLogs() {
  const containers = await getSupabaseContainers();

  if (containers.db) {
    const dbLogs = spawnLabeled(commands.docker, ["logs", "-f", containers.db], "db");
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
      ["logs", "-f", containers.api],
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

function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  process.stdout.write("\nStopping foreground processes...\n");
  terminateChildren();
  setTimeout(() => process.exit(0), 300);
}

async function main() {
  prepareEnv();
  await startSupabase();
  startEdgeFunctions();
  const apiTunnelStarted = startApiTunnel();
  if (apiTunnelStarted) {
    await waitForTunnelUrl("api");
  }
  await buildFrontend();
  startFrontend();
  startFrontendTunnel();
  await startContainerLogs();

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  process.stderr.write(`\nFailed to start local stack: ${error.message}\n`);
  process.exit(1);
});
