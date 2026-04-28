import { existsSync, readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

import { envFilePath } from "./config.mjs";

export function syncEnvValues(values) {
  if (!existsSync(envFilePath)) {
    process.stdout.write(`[env] ${envFilePath} not found, skip auto-update\n`);
    return false;
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
    process.stderr.write(`[env] failed to update ${envFilePath}: ${message}\n`);
    return false;
  }
}
