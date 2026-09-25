import process from "node:process";
import { loadLocalBackupConfig } from "./local-config";
import {
  DEFAULT_BACKUP_ROOT,
  parseRecordFailureArgs,
  sanitizeOperationalMessage,
} from "./policy";
import { recordBackupFailure } from "./runner";

const resolveBackupRoot = (): string => {
  try {
    return loadLocalBackupConfig(DEFAULT_BACKUP_ROOT).backupRoot;
  } catch {
    return DEFAULT_BACKUP_ROOT;
  }
};

const main = (): void => {
  try {
    const { code, message } = parseRecordFailureArgs(process.argv.slice(2));
    recordBackupFailure({
      backupRoot: resolveBackupRoot(),
      stage: "preflight",
      code,
      error: message,
    });
    process.stdout.write(`Backup failure зафиксирован: preflight/${code}.\n`);
  } catch (error) {
    process.stderr.write(
      `Не удалось зафиксировать backup failure: ${sanitizeOperationalMessage(error)}\n`,
    );
    process.exitCode = 1;
  }
};

main();
