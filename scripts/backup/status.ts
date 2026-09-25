import {
  existsSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  DEFAULT_BACKUP_ROOT,
  STATUS_SCHEMA_VERSION,
  assertDirectCompletedSnapshotPath,
  classifyBackupAge,
  getFailureAfterSuccess,
  parseBackupFailureStatus,
  parseBackupSuccessStatus,
  resolveBackupStatusState,
  sanitizeOperationalMessage,
  validateSnapshotDirectory,
  type BackupFailureStatus,
  type BackupSuccessStatus,
} from "./policy";
import { loadLocalBackupConfig } from "./local-config";

const readSuccessStatus = (
  statusPath: string,
): BackupSuccessStatus =>
  parseBackupSuccessStatus(
    JSON.parse(readFileSync(statusPath, "utf8")),
  );

const readFailureStatus = (
  statusPath: string,
): BackupFailureStatus | null => {
  if (!existsSync(statusPath)) {
    return null;
  }
  return parseBackupFailureStatus(
    JSON.parse(readFileSync(statusPath, "utf8")),
  );
};

const stateLabels = {
  healthy: "штатный режим",
  degraded: "деградированный режим",
  violated: "нарушение backup policy",
} as const;

const main = (): void => {
  try {
    const config = loadLocalBackupConfig(DEFAULT_BACKUP_ROOT);
    const statusDirectory = path.join(config.backupRoot, "status");
    const successPath = path.join(
      statusDirectory,
      "last-success.json",
    );
    if (!existsSync(successPath)) {
      process.stderr.write(
        "Успешный production backup ещё не найден.\n",
      );
      process.exitCode = 1;
      return;
    }

    const success = readSuccessStatus(successPath);
    const snapshotPath = path.join(
      config.backupRoot,
      "snapshots",
      success.snapshotName,
    );
    assertDirectCompletedSnapshotPath(
      path.join(config.backupRoot, "snapshots"),
      snapshotPath,
    );
    const manifest = validateSnapshotDirectory(snapshotPath);
    if (
      manifest.snapshotId !== success.snapshotId ||
      manifest.completedAt !== success.completedAt ||
      manifest.sourceProjectRef !== config.expectedProjectRef
    ) {
      throw new Error(
        "last-success.json не соответствует последнему snapshot.",
      );
    }

    const policy = classifyBackupAge(success.completedAt);
    const failure = getFailureAfterSuccess(
      success,
      readFailureStatus(
        path.join(statusDirectory, "last-failure.json"),
      ),
    );
    const state = resolveBackupStatusState(policy.state, failure);
    const ageText =
      policy.ageHours === null
        ? "неизвестно"
        : `${policy.ageHours.toFixed(1)} ч`;
    process.stdout.write(
      `Production backup: ${stateLabels[state]}.\n`,
    );
    process.stdout.write(
      `Последний snapshot: ${success.snapshotName}, возраст ${ageText}.\n`,
    );
    process.stdout.write(
      `Проверены ${manifest.files.length} SQL-файлов и SHA-256 checksums.\n`,
    );

    if (failure) {
      process.stdout.write(
        `После последнего успеха была ошибка: ${failure.stage}/${failure.code} — ${failure.message}\n`,
      );
    }

    if (state === "degraded") {
      process.exitCode = 2;
    } else if (state === "violated") {
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(
      `Не удалось проверить backup: ${sanitizeOperationalMessage(error)}\n`,
    );
    process.exitCode = 1;
  }
};

main();
