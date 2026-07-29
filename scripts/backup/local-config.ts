import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_BACKUP_ROOT,
  LOCAL_CONFIG_SCHEMA_VERSION,
  type LocalBackupConfig,
  assertSafeBackupRoot,
} from "./policy";

const requireConfigString = (
  value: unknown,
  fieldName: string,
): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Некорректное поле backup config: ${fieldName}.`);
  }
  return value;
};

export const loadLocalBackupConfig = (
  backupRoot = DEFAULT_BACKUP_ROOT,
): LocalBackupConfig => {
  const configPath = path.join(
    backupRoot,
    "config",
    "backup-config.json",
  );
  const rawConfig = JSON.parse(
    readFileSync(configPath, "utf8"),
  ) as Record<string, unknown>;

  if (rawConfig.schemaVersion !== LOCAL_CONFIG_SCHEMA_VERSION) {
    throw new Error("Неподдерживаемая schemaVersion backup config.");
  }
  if (rawConfig.environment !== "production") {
    throw new Error("Backup config должен относиться к production.");
  }

  const config: LocalBackupConfig = {
    schemaVersion: LOCAL_CONFIG_SCHEMA_VERSION,
    environment: "production",
    backupRoot: requireConfigString(
      rawConfig.backupRoot,
      "backupRoot",
    ),
    repositoryRoot: requireConfigString(
      rawConfig.repositoryRoot,
      "repositoryRoot",
    ),
    expectedProjectRef: requireConfigString(
      rawConfig.expectedProjectRef,
      "expectedProjectRef",
    ),
    windowsIdentity: requireConfigString(
      rawConfig.windowsIdentity,
      "windowsIdentity",
    ),
    nodeExecutable: requireConfigString(
      rawConfig.nodeExecutable,
      "nodeExecutable",
    ),
    dockerExecutable: requireConfigString(
      rawConfig.dockerExecutable,
      "dockerExecutable",
    ),
    scheduleLocalTime:
      rawConfig.scheduleLocalTime === "20:00"
        ? "20:00"
        : (() => {
            throw new Error(
              "Backup scheduleLocalTime должен быть равен 20:00.",
            );
          })(),
    createdAt: requireConfigString(rawConfig.createdAt, "createdAt"),
  };

  if (path.resolve(config.backupRoot) !== path.resolve(backupRoot)) {
    throw new Error("backupRoot в config не совпадает с config location.");
  }
  if (!/^[a-z0-9]{10,64}$/.test(config.expectedProjectRef)) {
    throw new Error("expectedProjectRef имеет некорректный формат.");
  }
  if (!Number.isFinite(Date.parse(config.createdAt))) {
    throw new Error("createdAt в backup config имеет некорректный формат.");
  }

  assertSafeBackupRoot(config.backupRoot, config.repositoryRoot);
  return config;
};

export const readLinkedProjectRef = (repositoryRoot: string): string => {
  const projectRef = readFileSync(
    path.join(repositoryRoot, "supabase", ".temp", "project-ref"),
    "utf8",
  ).trim();
  if (!/^[a-z0-9]{10,64}$/.test(projectRef)) {
    throw new Error("Linked Supabase project ref имеет некорректный формат.");
  }
  return projectRef;
};
