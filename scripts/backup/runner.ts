import { randomBytes } from "node:crypto";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  MANIFEST_SCHEMA_VERSION,
  STATUS_SCHEMA_VERSION,
  type BackupFailureStatus,
  type BackupStage,
  type BackupSuccessStatus,
  type SnapshotManifest,
  type SqlArtifactName,
  assertPathInside,
  buildSqlFileRecords,
  formatChecksums,
  parseExpectedPublicTableRowCounts,
  parseLatestMigrationVersion,
  sanitizeOperationalMessage,
  selectSnapshotRetention,
  validateChecksumsDocument,
  validateSnapshotDirectory,
  validateSnapshotManifest,
  COMPLETED_SNAPSHOT_NAME_PATTERN,
} from "./policy";

export type DumpArtifactDefinition = {
  name: SqlArtifactName;
  stage: BackupStage;
  args: string[];
};

export const DUMP_ARTIFACTS: DumpArtifactDefinition[] = [
  {
    name: "roles.sql",
    stage: "roles",
    args: ["db", "dump", "--linked", "--role-only"],
  },
  {
    name: "schema.sql",
    stage: "schema",
    args: ["db", "dump", "--linked"],
  },
  {
    name: "data.sql",
    stage: "data",
    args: [
      "db",
      "dump",
      "--linked",
      "--data-only",
      "--use-copy",
      "--exclude",
      "storage.buckets_vectors",
      "--exclude",
      "storage.vector_indexes",
    ],
  },
  {
    name: "history_schema.sql",
    stage: "migration_history",
    args: [
      "db",
      "dump",
      "--linked",
      "--schema",
      "supabase_migrations",
    ],
  },
  {
    name: "history_data.sql",
    stage: "migration_history",
    args: [
      "db",
      "dump",
      "--linked",
      "--data-only",
      "--use-copy",
      "--schema",
      "supabase_migrations",
    ],
  },
];

export type BackupRunnerOptions = {
  backupRoot: string;
  sourceProjectRef: string;
  tooling: SnapshotManifest["tooling"];
  dumpArtifact: (
    definition: DumpArtifactDefinition,
    outputPath: string,
  ) => void;
  now?: () => Date;
  createSnapshotId?: () => string;
  onStage?: (stage: BackupStage, message: string) => void;
  sensitiveValues?: string[];
};

export class BackupRunError extends Error {
  readonly code: string;
  readonly stage: BackupStage;

  constructor({
    code,
    stage,
    message,
    cause,
  }: {
    code: string;
    stage: BackupStage;
    message: string;
    cause?: unknown;
  }) {
    super(message, { cause });
    this.name = "BackupRunError";
    this.code = code;
    this.stage = stage;
  }
}

const writeJson = (filePath: string, value: unknown): void => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const writeJsonAtomically = (
  filePath: string,
  value: unknown,
): void => {
  const temporaryPath =
    `${filePath}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  writeJson(temporaryPath, value);
  renameSync(temporaryPath, filePath);
};

const formatSnapshotTimestamp = (date: Date): string =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
    .replace(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
      "$1-$2-$3T$4$5$6Z",
    );

const createLock = (lockPath: string, now: Date): (() => void) => {
  const tryCreate = (): number =>
    openSync(lockPath, "wx");

  const getErrorCode = (error: unknown): string =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";
  const lockToken = randomBytes(16).toString("hex");
  let descriptor: number | undefined;

  for (let attempt = 0; attempt < 3 && descriptor === undefined; attempt += 1) {
    try {
      descriptor = tryCreate();
    } catch (error) {
      if (getErrorCode(error) !== "EEXIST") {
        throw error;
      }

      let ageMs: number;
      try {
        ageMs = now.getTime() - statSync(lockPath).mtimeMs;
      } catch (statError) {
        if (getErrorCode(statError) === "ENOENT") {
          continue;
        }
        throw statError;
      }
      if (ageMs <= 3 * 60 * 60 * 1000) {
        throw new BackupRunError({
          code: "BACKUP_ALREADY_RUNNING",
          stage: "preflight",
          message: "Другой backup уже выполняется.",
          cause: error,
        });
      }

      const staleLockPath =
        `${lockPath}.stale-${process.pid}-${randomBytes(4).toString("hex")}`;
      try {
        renameSync(lockPath, staleLockPath);
        unlinkSync(staleLockPath);
      } catch (staleError) {
        if (getErrorCode(staleError) !== "ENOENT") {
          throw staleError;
        }
      }
    }
  }

  if (descriptor === undefined) {
    throw new BackupRunError({
      code: "BACKUP_LOCK_RACE",
      stage: "preflight",
      message: "Не удалось безопасно получить backup lock.",
    });
  }

  try {
    writeFileSync(
      descriptor,
      `${JSON.stringify({
        pid: process.pid,
        startedAt: now.toISOString(),
        token: lockToken,
      })}\n`,
      "utf8",
    );
  } catch (error) {
    closeSync(descriptor);
    try {
      unlinkSync(lockPath);
    } catch {
      // Исходная ошибка записи lock важнее ошибки cleanup.
    }
    throw error;
  }
  closeSync(descriptor);

  return () => {
    if (!existsSync(lockPath)) {
      return;
    }
    try {
      const lockValue = JSON.parse(
        readFileSync(lockPath, "utf8"),
      ) as { token?: unknown };
      if (lockValue.token === lockToken) {
        unlinkSync(lockPath);
      }
    } catch {
      // Не удаляем чужой или повреждённый lock: через 3 часа он станет stale.
    }
  };
};

const writeFailureStatus = ({
  statusDirectory,
  failedAt,
  stage,
  code,
  error,
  sensitiveValues,
}: {
  statusDirectory: string;
  failedAt: Date;
  stage: BackupStage;
  code: string;
  error: unknown;
  sensitiveValues: string[];
}): void => {
  mkdirSync(statusDirectory, { recursive: true });
  const status: BackupFailureStatus = {
    schemaVersion: STATUS_SCHEMA_VERSION,
    failedAt: failedAt.toISOString(),
    stage,
    code,
    message: sanitizeOperationalMessage(error, sensitiveValues),
  };
  writeJsonAtomically(
    path.join(statusDirectory, "last-failure.json"),
    status,
  );
};

export const recordBackupFailure = ({
  backupRoot,
  stage,
  code,
  error,
  sensitiveValues = [],
  failedAt = new Date(),
}: {
  backupRoot: string;
  stage: BackupStage;
  code: string;
  error: unknown;
  sensitiveValues?: string[];
  failedAt?: Date;
}): void => {
  writeFailureStatus({
    statusDirectory: path.join(backupRoot, "status"),
    failedAt,
    stage,
    code,
    error,
    sensitiveValues,
  });
};

const loadRetentionCandidates = (
  snapshotsDirectory: string,
): { name: string; completedAt: string }[] => {
  const candidates: { name: string; completedAt: string }[] = [];

  for (const entry of readdirSync(snapshotsDirectory, {
    withFileTypes: true,
  })) {
    if (
      !entry.isDirectory() ||
      !COMPLETED_SNAPSHOT_NAME_PATTERN.test(entry.name)
    ) {
      continue;
    }

    const snapshotPath = path.join(snapshotsDirectory, entry.name);
    if (lstatSync(snapshotPath).isSymbolicLink()) {
      continue;
    }

    try {
      const manifest = validateSnapshotDirectory(snapshotPath);
      candidates.push({
        name: entry.name,
        completedAt: manifest.completedAt,
      });
    } catch {
      // Invalid folders are preserved for manual inspection and never removed.
    }
  }

  return candidates;
};

const applyRetention = (
  snapshotsDirectory: string,
  now: Date,
): string[] => {
  const candidates = loadRetentionCandidates(snapshotsDirectory);
  const retention = selectSnapshotRetention(candidates, now);

  for (const snapshotName of retention.remove) {
    const snapshotPath = path.resolve(
      snapshotsDirectory,
      snapshotName,
    );
    assertPathInside(snapshotsDirectory, snapshotPath);
    if (
      !COMPLETED_SNAPSHOT_NAME_PATTERN.test(
        path.basename(snapshotPath),
      ) ||
      lstatSync(snapshotPath).isSymbolicLink()
    ) {
      throw new Error(
        `Retention отказался удалить ${snapshotName}.`,
      );
    }
    rmSync(snapshotPath, { recursive: true });
  }

  return retention.remove;
};

export const runBackup = (
  options: BackupRunnerOptions,
): SnapshotManifest => {
  const now = options.now ?? (() => new Date());
  const createSnapshotId =
    options.createSnapshotId ??
    (() => randomBytes(4).toString("hex"));
  const snapshotsDirectory = path.join(
    options.backupRoot,
    "snapshots",
  );
  const statusDirectory = path.join(options.backupRoot, "status");
  mkdirSync(snapshotsDirectory, { recursive: true });
  mkdirSync(statusDirectory, { recursive: true });

  const startedAt = now();
  const snapshotId = createSnapshotId();
  if (!/^[a-f0-9]{8}$/.test(snapshotId)) {
    throw new Error("Snapshot id имеет некорректный формат.");
  }
  const snapshotName = `${formatSnapshotTimestamp(startedAt)}_${snapshotId}`;
  const partialDirectory = path.join(
    snapshotsDirectory,
    `${snapshotName}.partial`,
  );
  const completedDirectory = path.join(
    snapshotsDirectory,
    snapshotName,
  );
  const lockPath = path.join(statusDirectory, "backup.lock");
  let currentStage: BackupStage = "preflight";
  let releaseLock: (() => void) | undefined;

  try {
    releaseLock = createLock(lockPath, startedAt);
    if (
      existsSync(partialDirectory) ||
      existsSync(completedDirectory)
    ) {
      throw new BackupRunError({
        code: "SNAPSHOT_PATH_COLLISION",
        stage: "preflight",
        message: "Snapshot path уже существует.",
      });
    }
    mkdirSync(partialDirectory);

    for (const definition of DUMP_ARTIFACTS) {
      currentStage = definition.stage;
      options.onStage?.(
        definition.stage,
        `Создаётся ${definition.name}.`,
      );
      const outputPath = path.join(
        partialDirectory,
        definition.name,
      );
      options.dumpArtifact(definition, outputPath);
      if (!existsSync(outputPath) || statSync(outputPath).size <= 0) {
        throw new BackupRunError({
          code: "EMPTY_DUMP_ARTIFACT",
          stage: definition.stage,
          message: `${definition.name} не создан или пустой.`,
        });
      }
    }

    currentStage = "validate";
    options.onStage?.("validate", "Проверяются snapshot artifacts.");
    const publicTableRowCounts = parseExpectedPublicTableRowCounts(
      readFileSync(path.join(partialDirectory, "data.sql"), "utf8"),
    );
    const latestMigrationVersion = parseLatestMigrationVersion(
      readFileSync(
        path.join(partialDirectory, "history_data.sql"),
        "utf8",
      ),
    );
    const files = buildSqlFileRecords(partialDirectory);
    const checksumsDocument = formatChecksums(files);
    writeFileSync(
      path.join(partialDirectory, "checksums.sha256"),
      checksumsDocument,
      "utf8",
    );
    validateChecksumsDocument(files, checksumsDocument);

    const completedAt = now();
    const manifest = validateSnapshotManifest({
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      snapshotId,
      snapshotName,
      environment: "production",
      sourceProjectRef: options.sourceProjectRef,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      tooling: options.tooling,
      files,
      publicTableRowCounts,
      latestMigrationVersion,
      checks: {
        artifactsValid: true,
        rowCountsComplete: true,
        checksumsValid: true,
      },
    });
    writeJson(path.join(partialDirectory, "manifest.json"), manifest);

    currentStage = "publish";
    options.onStage?.("publish", "Публикуется completed snapshot.");
    renameSync(partialDirectory, completedDirectory);
    try {
      validateSnapshotDirectory(completedDirectory);
    } catch (error) {
      renameSync(completedDirectory, partialDirectory);
      throw error;
    }

    const successStatus: BackupSuccessStatus = {
      schemaVersion: STATUS_SCHEMA_VERSION,
      snapshotId,
      snapshotName,
      completedAt: manifest.completedAt,
    };
    writeJsonAtomically(
      path.join(statusDirectory, "last-success.json"),
      successStatus,
    );

    currentStage = "retention";
    options.onStage?.("retention", "Применяется retention policy.");
    applyRetention(snapshotsDirectory, completedAt);

    return manifest;
  } catch (error) {
    const backupError =
      error instanceof BackupRunError
        ? error
        : new BackupRunError({
            code: "BACKUP_STAGE_FAILED",
            stage: currentStage,
            message: sanitizeOperationalMessage(
              error,
              options.sensitiveValues,
            ),
            cause: error,
          });
    writeFailureStatus({
      statusDirectory,
      failedAt: now(),
      stage: backupError.stage,
      code: backupError.code,
      error: backupError,
      sensitiveValues: options.sensitiveValues ?? [],
    });
    throw backupError;
  } finally {
    releaseLock?.();
  }
};
