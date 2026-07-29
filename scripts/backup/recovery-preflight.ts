import path from "node:path";
import process from "node:process";
import {
  DEFAULT_BACKUP_ROOT,
  assertDirectCompletedSnapshotPath,
  assertRecoveryTargetIsNotProduction,
  sanitizeOperationalMessage,
  validateSnapshotDirectory,
} from "./policy";
import { loadLocalBackupConfig } from "./local-config";

const readArguments = (): Record<string, string> => {
  const argumentsMap: Record<string, string> = {};
  for (const argument of process.argv.slice(2)) {
    const separatorIndex = argument.indexOf("=");
    if (!argument.startsWith("--") || separatorIndex < 3) {
      throw new Error(`Некорректный argument: ${argument}.`);
    }
    argumentsMap[argument.slice(2, separatorIndex)] = argument.slice(
      separatorIndex + 1,
    );
  }
  return argumentsMap;
};

const main = (): void => {
  try {
    const args = readArguments();
    const snapshotPath = path.resolve(args.snapshot ?? "");
    const targetProjectRef = args["target-project-ref"] ?? "";
    const targetDbHost = args["target-db-host"] ?? "";
    const targetDbUser = args["target-db-user"] ?? "";
    const config = loadLocalBackupConfig(DEFAULT_BACKUP_ROOT);
    const snapshotsRoot = path.join(config.backupRoot, "snapshots");

    assertDirectCompletedSnapshotPath(snapshotsRoot, snapshotPath);
    const manifest = validateSnapshotDirectory(snapshotPath);
    if (manifest.sourceProjectRef !== config.expectedProjectRef) {
      throw new Error(
        "Snapshot sourceProjectRef не совпадает с production config.",
      );
    }
    assertRecoveryTargetIsNotProduction({
      productionProjectRef: config.expectedProjectRef,
      targetProjectRef,
      targetDbHost,
      targetDbUser,
    });

    process.stdout.write(
      `Recovery preflight пройден: ${manifest.snapshotName}; target ${targetProjectRef} не совпадает с production.\n`,
    );
  } catch (error) {
    process.stderr.write(
      `Recovery preflight не пройден: ${sanitizeOperationalMessage(error)}\n`,
    );
    process.exitCode = 1;
  }
};

main();
