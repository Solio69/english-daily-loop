import {
  readFileSync,
} from "node:fs";
import process from "node:process";
import {
  sanitizeOperationalMessage,
  validateSnapshotDirectory,
} from "./policy";
import {
  parseRecoveryDatabaseReport,
  validateRecoveryDatabaseReport,
} from "./recovery";

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
    if (!args.snapshot || !args.result) {
      throw new Error("Нужны --snapshot и --result.");
    }
    const manifest = validateSnapshotDirectory(args.snapshot);
    const report = parseRecoveryDatabaseReport(
      JSON.parse(readFileSync(args.result, "utf8")),
    );
    const errors = validateRecoveryDatabaseReport(manifest, report);
    if (errors.length > 0) {
      process.stderr.write(
        `Recovery validation обнаружила ошибки:\n${errors.map((error) => `- ${error}`).join("\n")}\n`,
      );
      process.exitCode = 1;
      return;
    }

    process.stdout.write(
      `Recovery DB соответствует snapshot ${manifest.snapshotName}: таблицы, row counts, security contract, migrations, extensions и cron проверены.\n`,
    );
  } catch (error) {
    process.stderr.write(
      `Recovery validation не выполнена: ${sanitizeOperationalMessage(error)}\n`,
    );
    process.exitCode = 1;
  }
};

main();
