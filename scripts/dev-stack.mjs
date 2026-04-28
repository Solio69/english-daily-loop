import { existsSync } from "node:fs";
import process from "node:process";

import {
  cloudflaredExecutable,
  commands,
  devScenarios,
  edgeFunctionNames,
  frontendLocalUrl,
  localApiTunnelTarget,
  localFrontendTunnelTarget,
  localSupabaseApiUrl,
  parseDevArgs,
} from "./dev/config.mjs";
import { syncEnvValues } from "./dev/env.mjs";
import { color, useColor, withColor } from "./dev/logging.mjs";
import { spawnLabeled, stopChildProcess } from "./dev/process.mjs";
import {
  getSupabaseContainers,
  startSupabase,
} from "./dev/supabase-local.mjs";
import { attachTunnelUrlExtractor } from "./dev/tunnels.mjs";

const { mode, scenarioName, activeScenario } = parseDevArgs();

let shuttingDown = false;
const children = [];
const tunnelUrls = {
  frontend: null,
  api: null,
};
let startupSummaryPrinted = false;
let frontendRestartRequired = false;

function printUsageAndExit(message) {
  if (message) {
    process.stderr.write(`${message}\n\n`);
  }
  process.stderr.write("Usage:\n");
  process.stderr.write("  npm run dev:telegram\n");
  process.stderr.write("  npm run dev:browser -- <scenario>\n\n");
  process.stderr.write("Scenarios:\n");
  for (const [name, scenario] of Object.entries(devScenarios)) {
    process.stderr.write(
      `  ${name.padEnd(16)} ${scenario.telegramUserId}  ${scenario.description}\n`,
    );
  }
  process.exit(1);
}

if (mode !== "telegram" && mode !== "browser") {
  printUsageAndExit(`Unknown dev mode: ${mode}`);
}

if (mode === "browser" && !activeScenario) {
  printUsageAndExit(`Unknown browser scenario: ${scenarioName}`);
}

function syncApiUrlToEnv(apiUrl) {
  const changed = syncEnvValues({
    VITE_SUPABASE_URL: apiUrl,
  });

  if (changed) {
    frontendRestartRequired = true;
    process.stdout.write("[env] frontend restart required for new API URL.\n");
  }
}

function maybePrintStartupSummary() {
  if (startupSummaryPrinted) return;
  if (!tunnelUrls.frontend || !tunnelUrls.api) return;
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
  }
  if (kind === "api" && !tunnelUrls.api) {
    tunnelUrls.api = url;
    highlightTunnelUrl("api", url);
  }
}

function printBrowserStartupSummary() {
  if (startupSummaryPrinted) return;
  startupSummaryPrinted = true;

  const scenario = activeScenario ?? devScenarios.fresh;
  const line = "================ BROWSER DEV SUMMARY ================";
  process.stdout.write(
    useColor
      ? `\n${color.bold}${color.cyan}${line}${color.reset}\n`
      : `\n${line}\n`,
  );
  process.stdout.write(
    useColor
      ? `${color.bold}${color.yellow}Scenario:${color.reset} ${scenarioName} (${scenario.telegramUserId})\n`
      : `Scenario: ${scenarioName} (${scenario.telegramUserId})\n`,
  );
  process.stdout.write(`Description: ${scenario.description}\n`);
  process.stdout.write(
    useColor
      ? `Open: ${color.green}${frontendLocalUrl}${color.reset}\n`
      : `Open: ${frontendLocalUrl}\n`,
  );
  process.stdout.write(
    "Auth: dev fallback is enabled for this local browser run.\n\n",
  );
}

function prepareEnv() {
  if (mode === "browser") {
    const scenario = activeScenario ?? devScenarios.fresh;
    process.stdout.write(
      `Preparing browser dev scenario "${scenarioName}" (${scenario.telegramUserId})...\n`,
    );
    syncEnvValues({
      VITE_SUPABASE_URL: localSupabaseApiUrl,
      VITE_ENABLE_DEV_AUTH_FALLBACK: "true",
      VITE_DEV_TELEGRAM_USER_ID: String(scenario.telegramUserId),
    });
    return;
  }

  process.stdout.write("Preparing Telegram dev mode...\n");
  syncEnvValues({
    VITE_ENABLE_DEV_AUTH_FALLBACK: "false",
  });
}

function startFrontend() {
  const frontend = spawnLabeled(commands.pnpm, ["dev"], "frontend");
  children.push(frontend);
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

function startTunnels() {
  if (mode === "telegram" && existsSync(cloudflaredExecutable)) {
    process.stdout.write(
      "[tunnel] starting frontend tunnel (localhost:3000) and api tunnel (localhost:55421)...\n",
    );

    const frontendTunnel = spawnLabeled(
      cloudflaredExecutable,
      ["tunnel", "--url", localFrontendTunnelTarget],
      "tunnel-frontend",
    );
    attachTunnelUrlExtractor(frontendTunnel, "frontend", handleTunnelUrl);
    children.push(frontendTunnel);
    frontendTunnel.on("exit", (code) => {
      if (!shuttingDown) {
        process.stderr.write(
          `[tunnel-frontend] exited with code ${code ?? "unknown"}, continuing...\n`,
        );
      }
    });

    const apiTunnel = spawnLabeled(
      cloudflaredExecutable,
      ["tunnel", "--url", localApiTunnelTarget],
      "tunnel-api",
    );
    attachTunnelUrlExtractor(apiTunnel, "api", handleTunnelUrl);
    children.push(apiTunnel);
    apiTunnel.on("exit", (code) => {
      if (!shuttingDown) {
        process.stderr.write(
          `[tunnel-api] exited with code ${code ?? "unknown"}, continuing...\n`,
        );
      }
    });
    return;
  }

  if (mode === "telegram") {
    process.stdout.write(
      `[tunnel] ${cloudflaredExecutable} not found, skipping tunnel auto-start\n`,
    );
    return;
  }

  process.stdout.write("[tunnel] browser mode, skipping HTTPS tunnels\n");
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
  startFrontend();
  startEdgeFunctions();
  startTunnels();
  await startContainerLogs();

  if (mode === "browser") {
    printBrowserStartupSummary();
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  process.stderr.write(`\nFailed to start local stack: ${error.message}\n`);
  process.exit(1);
});
