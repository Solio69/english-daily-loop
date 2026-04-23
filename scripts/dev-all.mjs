import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const isWindows = process.platform === "win32";
const npxCmd = "npx";
const pnpmCmd = "pnpm";
const dockerCmd = "docker";
const localProjectId = "english-daily-loop";
const cloudflaredExecutable = isWindows
  ? ".\\tools\\cloudflared.exe"
  : "./tools/cloudflared";
const envFilePath = ".env.local";
// TODO: Local launch UX helpers for terminal readability only.
const color = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[96m",
  green: "\x1b[92m",
  yellow: "\x1b[93m",
  blue: "\x1b[94m",
  magenta: "\x1b[95m",
  red: "\x1b[91m",
  gray: "\x1b[90m",
};
const useColor = Boolean(process.stdout.isTTY);
const labelColors = {
  frontend: color.magenta,
  edge: color.blue,
  db: color.yellow,
  api: color.red,
  "tunnel-frontend": color.green,
  "tunnel-api": color.cyan,
  tunnel: color.gray,
  env: color.gray,
};
const methodColor = color.magenta;

function withColor(text, tone) {
  if (!useColor) return text;
  return `${tone}${text}${color.reset}`;
}

function statusColor(codeText) {
  const code = Number(codeText);
  if (code >= 500) return color.red;
  if (code >= 400) return color.red;
  if (code >= 300) return color.yellow;
  if (code >= 200) return color.green;
  return color.cyan;
}

function hasErrorMarkers(line) {
  return /\b(error|failed|exception|panic|unhandled)\b/i.test(line);
}

function colorizeHttpTokens(line) {
  let next = line;
  next = next.replace(/\b(GET|POST|PUT|PATCH|DELETE|HEAD)\b/g, (method) =>
    withColor(method, `${color.bold}${methodColor}`),
  );
  next = next.replace(/"\s([1-5]\d{2})\b/g, (full, code) =>
    full.replace(code, withColor(code, `${color.bold}${statusColor(code)}`)),
  );
  next = next.replace(/\bstatus(?:=|:)\s*([1-5]\d{2})\b/gi, (full, code) =>
    full.replace(code, withColor(code, `${color.bold}${statusColor(code)}`)),
  );
  return next;
}

function formatLogLine(rawLine, isErr) {
  let line = colorizeHttpTokens(rawLine);
  if (isErr || hasErrorMarkers(rawLine)) {
    line = withColor(line, color.red);
  }
  return line;
}
let shuttingDown = false;
const children = [];
const tunnelUrls = {
  frontend: null,
  api: null,
};
let startupSummaryPrinted = false;
let frontendRestartRequired = false;

function runOnce(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(toSpawnCommand(command, args), toSpawnArgs(args), {
      stdio: "inherit",
      shell: isWindows,
      env: process.env,
    });

    child.on("error", (error) => reject(error));
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} exited with code ${code ?? "unknown"}`));
      }
    });
  });
}

function runCapture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(toSpawnCommand(command, args), toSpawnArgs(args), {
      stdio: ["ignore", "pipe", "pipe"],
      shell: isWindows,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => reject(error));
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(
          new Error(
            `Command failed (${command} ${args.join(" ")}): ${stderr || stdout}`,
          ),
        );
      }
    });
  });
}

function spawnLabeled(command, args, label) {
  const child = spawn(toSpawnCommand(command, args), toSpawnArgs(args), {
    stdio: ["ignore", "pipe", "pipe"],
    shell: isWindows,
    env: process.env,
  });

  const prefix = withColor(
    `[${label}]`,
    `${color.bold}${labelColors[label] ?? color.cyan}`,
  );
  let stdoutBuffer = "";
  let stderrBuffer = "";

  const writeChunk = (target, chunk, isErr) => {
    const current = (isErr ? stderrBuffer : stdoutBuffer) + chunk.toString();
    const lines = current.split(/\r?\n/);
    const nextBuffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = formatLogLine(rawLine, isErr);
      target.write(`${prefix} ${line}\n`);
    }

    if (isErr) {
      stderrBuffer = nextBuffer;
    } else {
      stdoutBuffer = nextBuffer;
    }
  };

  child.stdout.on("data", (chunk) => {
    writeChunk(process.stdout, chunk, false);
  });

  child.stderr.on("data", (chunk) => {
    writeChunk(process.stderr, chunk, true);
  });

  child.on("exit", () => {
    if (stdoutBuffer) {
      process.stdout.write(`${prefix} ${formatLogLine(stdoutBuffer, false)}\n`);
      stdoutBuffer = "";
    }
    if (stderrBuffer) {
      process.stderr.write(`${prefix} ${formatLogLine(stderrBuffer, true)}\n`);
      stderrBuffer = "";
    }
  });

  child.on("error", (error) => {
    process.stderr.write(`${prefix} failed to start: ${error.message}\n`);
  });

  return child;
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

function syncApiUrlToEnv(apiUrl) {
  // TODO: Local run helper. Auto-sync API tunnel URL into .env.local for mobile Telegram testing.
  if (!existsSync(envFilePath)) {
    process.stdout.write(`[env] ${envFilePath} not found, skip auto-update\n`);
    return;
  }

  try {
    const content = readFileSync(envFilePath, "utf8");
    const next = content.match(/^VITE_SUPABASE_URL=/m)
      ? content.replace(
          /^VITE_SUPABASE_URL=.*$/m,
          `VITE_SUPABASE_URL="${apiUrl}"`,
        )
      : `${content.trimEnd()}\nVITE_SUPABASE_URL="${apiUrl}"\n`;

    if (next !== content) {
      writeFileSync(envFilePath, next, "utf8");
      frontendRestartRequired = true;
      process.stdout.write(
        `[env] updated VITE_SUPABASE_URL in ${envFilePath}\n`,
      );
      process.stdout.write(
        "[env] frontend restart required for new API URL.\n",
      );
    } else {
      process.stdout.write(
        `[env] VITE_SUPABASE_URL already up to date in ${envFilePath}\n`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[env] failed to update ${envFilePath}: ${message}\n`);
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
      "   Action: stop this run (Ctrl+C) and start `npm run dev:all` again.\n\n",
    );
  } else {
    process.stdout.write("   Action: continue, no restart needed.\n\n");
  }
}

function attachTunnelUrlExtractor(child, kind) {
  const pipe = (stream) => {
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const match = line.match(/https:\/\/[a-z0-9.-]+\.trycloudflare\.com/i);
        if (!match) continue;
        const url = match[0];
        if (kind === "frontend" && !tunnelUrls.frontend) {
          tunnelUrls.frontend = url;
          highlightTunnelUrl("frontend", url);
        }
        if (kind === "api" && !tunnelUrls.api) {
          tunnelUrls.api = url;
          highlightTunnelUrl("api", url);
        }
      }
    });
  };

  pipe(child.stdout);
  pipe(child.stderr);
}

function pickContainer(names, marker) {
  return names.find(
    (name) =>
      name === marker || name.startsWith(`${marker}_`) || name.includes(marker),
  );
}

async function getSupabaseContainers() {
  const output = await runCapture(dockerCmd, ["ps", "--format", "{{.Names}}"]);
  const names = output
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  return {
    db: pickContainer(names, "supabase_db"),
    api: pickContainer(names, "supabase_kong"),
  };
}

function quoteForShell(arg) {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(arg)) {
    return arg;
  }
  return `"${arg.replace(/"/g, '\\"')}"`;
}

function toSpawnCommand(command, args) {
  if (!isWindows) {
    return command;
  }
  return [command, ...args].map(quoteForShell).join(" ");
}

function toSpawnArgs(args) {
  if (isWindows) {
    return [];
  }
  return args;
}

function stopChildProcess(child) {
  if (!child || child.killed) {
    return;
  }

  if (isWindows && child.pid) {
    // Avoid "Terminate batch file (Y/N)" prompt when stopping shell-based children.
    spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      shell: false,
      env: process.env,
    });
    return;
  }

  child.kill("SIGINT");
}

function terminateChildren() {
  for (const child of children) {
    if (!child) {
      continue;
    }
    stopChildProcess(child);
  }
}

async function main() {
  process.stdout.write("Starting local Supabase...\n");
  try {
    await runOnce(npxCmd, ["supabase", "start"], "supabase start");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const hasConflict = /already in use|Conflict\./i.test(message);
    if (!hasConflict) {
      throw error;
    }

    process.stdout.write(
      "\nDetected stale Supabase containers with conflicting names. Stopping local project and retrying...\n",
    );
    await runOnce(
      npxCmd,
      ["supabase", "stop", "--project-id", localProjectId],
      "supabase stop",
    );
    await runOnce(npxCmd, ["supabase", "start"], "supabase start");
  }

  process.stdout.write("\nSupabase is ready.\n");
  process.stdout.write("Studio: http://127.0.0.1:55423\n");
  process.stdout.write("API:    http://127.0.0.1:55421\n");
  process.stdout.write(
    "DB:     postgresql://postgres:postgres@127.0.0.1:55422/postgres\n\n",
  );

  const containers = await getSupabaseContainers();

  const frontend = spawnLabeled(pnpmCmd, ["dev"], "frontend");
  children.push(frontend);

  const edgeFunctions = spawnLabeled(
    npxCmd,
    [
      "supabase",
      "functions",
      "serve",
      "auth-telegram",
      // TODO: Keep subscription Edge Functions available in local Telegram Mini App runs.
      "activate-subscription",
      // TODO: Keep this local Edge Function list in sync with reading flow functions.
      "complete-reading-text",
      "get-reading-state",
      "generate-reading-text",
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

  if (existsSync(cloudflaredExecutable)) {
    // TODO: Local launch helper. Auto-start temporary HTTPS tunnels for Telegram Mini App access.
    process.stdout.write(
      "[tunnel] starting frontend tunnel (localhost:3000) and api tunnel (localhost:55421)...\n",
    );

    const frontendTunnel = spawnLabeled(
      cloudflaredExecutable,
      ["tunnel", "--url", "http://localhost:3000"],
      "tunnel-frontend",
    );
    attachTunnelUrlExtractor(frontendTunnel, "frontend");
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
      ["tunnel", "--url", "http://localhost:55421"],
      "tunnel-api",
    );
    attachTunnelUrlExtractor(apiTunnel, "api");
    children.push(apiTunnel);
    apiTunnel.on("exit", (code) => {
      if (!shuttingDown) {
        process.stderr.write(
          `[tunnel-api] exited with code ${code ?? "unknown"}, continuing...\n`,
        );
      }
    });
  } else {
    process.stdout.write(
      `[tunnel] ${cloudflaredExecutable} not found, skipping tunnel auto-start\n`,
    );
  }

  if (containers.db) {
    const dbLogs = spawnLabeled(dockerCmd, ["logs", "-f", containers.db], "db");
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
      dockerCmd,
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

  const shutdown = () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    process.stdout.write("\nStopping foreground processes...\n");
    terminateChildren();
    setTimeout(() => process.exit(0), 300);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

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

main().catch((error) => {
  process.stderr.write(`\nFailed to start local stack: ${error.message}\n`);
  process.exit(1);
});
