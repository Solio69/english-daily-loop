import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { loadLocalBackupConfig, readLinkedProjectRef } from "./local-config";
import {
  BackupRunError,
  recordBackupFailure,
  runBackup,
  type DumpArtifactDefinition,
} from "./runner";
import {
  DEFAULT_BACKUP_ROOT,
  assertSafeBackupRoot,
  sanitizeOperationalMessage,
} from "./policy";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const runReadOnlyCommand = ({
  executable,
  args,
  cwd = repositoryRoot,
  timeout = 30_000,
  sensitiveValues = [],
  env = process.env,
}: {
  executable: string;
  args: string[];
  cwd?: string;
  timeout?: number;
  sensitiveValues?: string[];
  env?: NodeJS.ProcessEnv;
}): string => {
  const result = spawnSync(executable, args, {
    cwd,
    env,
    encoding: "utf8",
    timeout,
    windowsHide: true,
  });

  if (result.error || result.status !== 0) {
    const details = sanitizeOperationalMessage(
      result.error ?? result.stderr ?? "Command failed.",
      sensitiveValues,
    );
    throw new Error(
      `${path.basename(executable)} завершился с кодом ${result.status ?? "unknown"}: ${details}`,
    );
  }

  return result.stdout.trim();
};

const preflight = () => {
  if (
    process.platform !== "win32" ||
    process.env.ENGLISH_DAILY_LOOP_PRODUCTION_BACKUP !==
      "read-only-confirmed"
  ) {
    throw new BackupRunError({
      code: "OWNER_WRAPPER_REQUIRED",
      stage: "preflight",
      message:
        "Production backup разрешён только через owner PowerShell wrapper на Windows.",
    });
  }

  const databasePassword = process.env.SUPABASE_DB_PASSWORD;
  if (!databasePassword) {
    throw new BackupRunError({
      code: "DATABASE_PASSWORD_MISSING",
      stage: "preflight",
      message: "SUPABASE_DB_PASSWORD не передан защищённым wrapper.",
    });
  }

  const config = loadLocalBackupConfig(DEFAULT_BACKUP_ROOT);
  assertSafeBackupRoot(config.backupRoot, config.repositoryRoot);
  const nonDatabaseEnvironment = { ...process.env };
  delete nonDatabaseEnvironment.SUPABASE_DB_PASSWORD;

  if (path.resolve(config.repositoryRoot) !== repositoryRoot) {
    throw new BackupRunError({
      code: "REPOSITORY_PATH_MISMATCH",
      stage: "preflight",
      message:
        "Репозиторий перемещён после настройки backup. Повтори setup.",
    });
  }
  if (
    process.env.ENGLISH_DAILY_LOOP_WINDOWS_IDENTITY !==
    config.windowsIdentity
  ) {
    throw new BackupRunError({
      code: "WINDOWS_IDENTITY_MISMATCH",
      stage: "preflight",
      message:
        "Windows-пользователь не совпадает с владельцем backup credential.",
    });
  }

  const linkedProjectRef = readLinkedProjectRef(repositoryRoot);
  if (linkedProjectRef !== config.expectedProjectRef) {
    throw new BackupRunError({
      code: "PROJECT_REF_MISMATCH",
      stage: "preflight",
      message:
        "Linked Supabase project ref не совпадает с production backup config.",
    });
  }

  const supabaseExecutable = path.join(
    repositoryRoot,
    "node_modules",
    "supabase",
    "bin",
    "supabase.exe",
  );
  for (const executable of [
    config.nodeExecutable,
    config.dockerExecutable,
    supabaseExecutable,
  ]) {
    if (!existsSync(executable)) {
      throw new BackupRunError({
        code: "REQUIRED_EXECUTABLE_MISSING",
        stage: "preflight",
        message: `Не найден executable: ${executable}.`,
      });
    }
  }

  runReadOnlyCommand({
    executable: config.dockerExecutable,
    args: ["info", "--format", "{{.ServerVersion}}"],
    timeout: 15_000,
    sensitiveValues: [databasePassword],
    env: nonDatabaseEnvironment,
  });
  const supabaseCliVersion = runReadOnlyCommand({
    executable: supabaseExecutable,
    args: ["--version"],
    sensitiveValues: [databasePassword],
    env: nonDatabaseEnvironment,
  });
  const gitSha = runReadOnlyCommand({
    executable: "git.exe",
    args: ["rev-parse", "HEAD"],
    sensitiveValues: [databasePassword],
    env: nonDatabaseEnvironment,
  });
  const packageJson = JSON.parse(
    readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
  ) as { version?: unknown };
  if (typeof packageJson.version !== "string") {
    throw new BackupRunError({
      code: "PACKAGE_VERSION_MISSING",
      stage: "preflight",
      message: "package.json не содержит version.",
    });
  }

  return {
    config,
    databasePassword,
    supabaseExecutable,
    tooling: {
      packageVersion: packageJson.version,
      gitSha,
      supabaseCliVersion,
    },
  };
};

const runSupabaseDump = ({
  definition,
  outputPath,
  supabaseExecutable,
  databasePassword,
}: {
  definition: DumpArtifactDefinition;
  outputPath: string;
  supabaseExecutable: string;
  databasePassword: string;
}): void => {
  try {
    runReadOnlyCommand({
      executable: supabaseExecutable,
      args: [...definition.args, "--file", outputPath],
      timeout: 30 * 60_000,
      sensitiveValues: [databasePassword],
    });
  } catch (error) {
    throw new BackupRunError({
      code: "SUPABASE_DUMP_FAILED",
      stage: definition.stage,
      message: sanitizeOperationalMessage(error, [databasePassword]),
      cause: error,
    });
  }
};

const resolveFailureBackupRoot = (): string => {
  try {
    return loadLocalBackupConfig(DEFAULT_BACKUP_ROOT).backupRoot;
  } catch {
    return DEFAULT_BACKUP_ROOT;
  }
};

const main = (): void => {
  const sensitiveValues = process.env.SUPABASE_DB_PASSWORD
    ? [process.env.SUPABASE_DB_PASSWORD]
    : [];
  try {
    let prepared: ReturnType<typeof preflight>;
    try {
      prepared = preflight();
    } catch (error) {
      recordBackupFailure({
        backupRoot: resolveFailureBackupRoot(),
        stage: error instanceof BackupRunError ? error.stage : "preflight",
        code:
          error instanceof BackupRunError ? error.code : "PREFLIGHT_FAILED",
        error,
        sensitiveValues,
      });
      throw error;
    }
    const {
      config,
      databasePassword,
      supabaseExecutable,
      tooling,
    } = prepared;

    const manifest = runBackup({
      backupRoot: config.backupRoot,
      sourceProjectRef: config.expectedProjectRef,
      tooling,
      sensitiveValues,
      onStage: (stage, message) => {
        process.stdout.write(`[backup:${stage}] ${message}\n`);
      },
      dumpArtifact: (definition, outputPath) =>
        runSupabaseDump({
          definition,
          outputPath,
          supabaseExecutable,
          databasePassword,
        }),
    });

    process.stdout.write(
      `Backup завершён: ${manifest.snapshotName}, таблиц: ${Object.keys(manifest.publicTableRowCounts).length}.\n`,
    );
  } catch (error) {
    process.stderr.write(
      `Backup не выполнен: ${sanitizeOperationalMessage(error, sensitiveValues)}\n`,
    );
    process.exitCode = 1;
  } finally {
    delete process.env.SUPABASE_DB_PASSWORD;
    delete process.env.ENGLISH_DAILY_LOOP_PRODUCTION_BACKUP;
  }
};

main();
