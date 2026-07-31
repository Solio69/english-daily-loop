import process from "node:process";

import { commands, localProjectId } from "./config.mjs";
import { runCapture, runOnce } from "./process.mjs";

function pickContainer(names, marker) {
  return names.find(
    (name) =>
      name === marker || name.startsWith(`${marker}_`) || name.includes(marker),
  );
}

export async function getSupabaseContainers() {
  const output = await runCapture(commands.docker, [
    "ps",
    "--format",
    "{{.Names}}",
  ]);
  const names = output
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  return {
    db: pickContainer(names, "supabase_db"),
    api: pickContainer(names, "supabase_kong"),
  };
}

export async function startSupabase(processEnv) {
  process.stdout.write("Starting local Supabase...\n");
  try {
    await runOnce(commands.npx, ["supabase", "start"], "supabase start", {
      env: processEnv,
      replaceEnv: true,
    });
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
      commands.npx,
      ["supabase", "stop", "--project-id", localProjectId],
      "supabase stop",
      { env: processEnv, replaceEnv: true },
    );
    await runOnce(
      commands.npx,
      ["supabase", "start"],
      "supabase start",
      { env: processEnv, replaceEnv: true },
    );
  }

  process.stdout.write("\nSupabase is ready.\n");
  process.stdout.write("Studio: http://127.0.0.1:54323\n");
  process.stdout.write("API:    http://127.0.0.1:54321\n");
  process.stdout.write(
    "DB:     postgresql://postgres:postgres@127.0.0.1:54322/postgres\n\n",
  );
}

export function parseLocalSupabaseAnonKey(output) {
  const match = output.match(/^ANON_KEY="?([^"\r\n]+)"?$/m);
  if (!match?.[1]) {
    throw new Error("Local Supabase status did not return ANON_KEY.");
  }
  return match[1];
}

export async function getLocalSupabaseAnonKey(processEnv) {
  const output = await runCapture(commands.npx, [
    "supabase",
    "status",
    "-o",
    "env",
  ], {
    env: processEnv,
    replaceEnv: true,
  });
  return parseLocalSupabaseAnonKey(output);
}
