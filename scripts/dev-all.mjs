import { spawn } from "node:child_process";
import process from "node:process";

const isWindows = process.platform === "win32";
const npxCmd = "npx";
const pnpmCmd = "pnpm";
const dockerCmd = "docker";
const localProjectId = "english-daily-loop";

let shuttingDown = false;
const children = [];

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
        reject(new Error(`Command failed (${command} ${args.join(" ")}): ${stderr || stdout}`));
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

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${label}] ${chunk.toString()}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${label}] ${chunk.toString()}`);
  });

  child.on("error", (error) => {
    process.stderr.write(`[${label}] failed to start: ${error.message}\n`);
  });

  return child;
}

function pickContainer(names, marker) {
  return names.find((name) => name === marker || name.startsWith(`${marker}_`) || name.includes(marker));
}

async function getSupabaseContainers() {
  const output = await runCapture(dockerCmd, ["ps", "--format", "{{.Names}}"]);
  const names = output.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
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
  process.stdout.write("DB:     postgresql://postgres:postgres@127.0.0.1:55422/postgres\n\n");

  const containers = await getSupabaseContainers();

  const frontend = spawnLabeled(pnpmCmd, ["dev"], "frontend");
  children.push(frontend);

  if (containers.db) {
    const dbLogs = spawnLabeled(dockerCmd, ["logs", "-f", containers.db], "db");
    children.push(dbLogs);
    dbLogs.on("exit", (code) => {
      if (!shuttingDown) {
        process.stderr.write(`[db] log stream ended with code ${code ?? "unknown"}, continuing...\n`);
      }
    });
  } else {
    process.stdout.write("[db] container not found, skipping DB logs\n");
  }

  if (containers.api) {
    const apiLogs = spawnLabeled(dockerCmd, ["logs", "-f", containers.api], "api");
    children.push(apiLogs);
    apiLogs.on("exit", (code) => {
      if (!shuttingDown) {
        process.stderr.write(`[api] log stream ended with code ${code ?? "unknown"}, continuing...\n`);
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
      process.stderr.write(`\n[frontend] exited with code ${code ?? "unknown"}.\n`);
    }
    shutdown();
  });
}

main().catch((error) => {
  process.stderr.write(`\nFailed to start local stack: ${error.message}\n`);
  process.exit(1);
});
