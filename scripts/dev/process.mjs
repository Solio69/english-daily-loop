import { spawn } from "node:child_process";
import process from "node:process";

import { isWindows } from "./config.mjs";
import { color, formatLogLine, labelColors, withColor } from "./logging.mjs";

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

export function runOnce(command, args, label, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(toSpawnCommand(command, args), toSpawnArgs(args), {
      stdio: "inherit",
      shell: isWindows,
      env: options.replaceEnv
        ? options.env
        : { ...process.env, ...(options.env ?? {}) },
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

export function runCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(toSpawnCommand(command, args), toSpawnArgs(args), {
      stdio: ["ignore", "pipe", "pipe"],
      shell: isWindows,
      env: options.replaceEnv
        ? options.env
        : { ...process.env, ...(options.env ?? {}) },
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

export function spawnLabeled(command, args, label, options = {}) {
  const child = spawn(toSpawnCommand(command, args), toSpawnArgs(args), {
    stdio: ["ignore", "pipe", "pipe"],
    shell: isWindows,
    env: options.replaceEnv
      ? options.env
      : { ...process.env, ...(options.env ?? {}) },
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

export function stopChildProcess(child) {
  if (!child || child.killed) {
    return;
  }

  if (isWindows && child.pid) {
    // TODO: Avoid "Terminate batch file (Y/N)" prompt when stopping shell-based children.
    spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      shell: false,
      env: process.env,
    });
    return;
  }

  child.kill("SIGINT");
}
