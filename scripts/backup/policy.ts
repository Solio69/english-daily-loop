import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  statSync,
} from "node:fs";
import path from "node:path";

export const DEFAULT_BACKUP_ROOT =
  "D:\\Backups\\english-daily-loop\\production";
export const MANIFEST_SCHEMA_VERSION = 1 as const;
export const LOCAL_CONFIG_SCHEMA_VERSION = 1 as const;
export const STATUS_SCHEMA_VERSION = 1 as const;
export const BACKUP_STAGES = [
  "preflight",
  "roles",
  "schema",
  "data",
  "migration_history",
  "validate",
  "publish",
  "retention",
] as const;

export const EXPECTED_PUBLIC_TABLES = [
  "users",
  "reading_texts",
  "user_settings",
  "reading_generation_attempts",
  "user_active_reading_texts",
  "user_daily_reading_completions",
  "user_subscriptions",
  "user_completed_reading_texts",
  "user_vocabulary_words",
  "user_vocabulary_word_sources",
  "vocabulary_card_generation_attempts",
  "user_daily_vocabulary_review_completions",
  "support_reports",
] as const;

export const PROTECTED_PUBLIC_TABLES = [
  "users",
  "reading_texts",
  "user_settings",
  "reading_generation_attempts",
  "user_active_reading_texts",
  "user_daily_reading_completions",
  "user_subscriptions",
  "user_completed_reading_texts",
  "user_vocabulary_words",
  "user_vocabulary_word_sources",
  "vocabulary_card_generation_attempts",
  "user_daily_vocabulary_review_completions",
  "support_reports",
] as const;

export const REQUIRED_SERVER_FUNCTIONS = [
  "get_random_reading_text",
  "claim_reading_generation_attempt",
  "complete_daily_reading_text",
  "activate_mvp_subscription",
  "save_vocabulary_word_with_source",
  "save_pending_vocabulary_word_with_source",
  "delete_pending_vocabulary_word_with_sources",
  "persist_generated_vocabulary_card",
  "claim_vocabulary_card_generation_attempt",
  "get_moscow_study_date",
  "get_or_create_vocabulary_review_state",
  "review_vocabulary_word",
  "dev_complete_vocabulary_reviews_at_step",
] as const;

export const REQUIRED_EXTENSIONS = ["pgcrypto", "pg_cron"] as const;

export const REQUIRED_CRON_JOBS = [
  "cleanup_ai_generation_attempts",
  "cleanup_vocabulary_card_generation_attempts",
  "cleanup_support_reports",
] as const;

export const REQUIRED_INDEXES = [
  "idx_reading_generation_attempts_user_date",
  "idx_user_completed_reading_texts_user_completed",
  "idx_user_vocabulary_words_review_queue",
  "idx_user_daily_vocabulary_review_completions_user_date",
  "idx_vocabulary_card_generation_attempts_user_date",
  "idx_support_reports_user_created_at",
] as const;

export const REQUIRED_TRIGGERS = [
  "trg_users_set_updated_at",
  "trg_reading_texts_set_updated_at",
  "trg_user_settings_set_updated_at",
  "trg_reading_generation_attempts_set_updated_at",
  "trg_user_active_reading_texts_set_updated_at",
  "trg_user_subscriptions_set_updated_at",
  "trg_user_vocabulary_words_set_updated_at",
  "trg_vocabulary_card_generation_attempts_set_updated_at",
] as const;

export const REQUIRED_SQL_ARTIFACTS = [
  "roles.sql",
  "schema.sql",
  "data.sql",
  "history_schema.sql",
  "history_data.sql",
] as const;

export type ExpectedPublicTable = (typeof EXPECTED_PUBLIC_TABLES)[number];
export type BackupPolicyState = "healthy" | "degraded" | "violated";
export type BackupStage = (typeof BACKUP_STAGES)[number];

export type SqlArtifactName = (typeof REQUIRED_SQL_ARTIFACTS)[number];

export type SnapshotFileRecord = {
  name: SqlArtifactName;
  sizeBytes: number;
  sha256: string;
};

export type SnapshotManifest = {
  schemaVersion: typeof MANIFEST_SCHEMA_VERSION;
  snapshotId: string;
  snapshotName: string;
  environment: "production";
  sourceProjectRef: string;
  startedAt: string;
  completedAt: string;
  tooling: {
    packageVersion: string;
    gitSha: string;
    supabaseCliVersion: string;
  };
  files: SnapshotFileRecord[];
  publicTableRowCounts: Record<ExpectedPublicTable, number>;
  latestMigrationVersion: string;
  checks: {
    artifactsValid: true;
    rowCountsComplete: true;
    checksumsValid: true;
  };
};

export type LocalBackupConfig = {
  schemaVersion: typeof LOCAL_CONFIG_SCHEMA_VERSION;
  environment: "production";
  backupRoot: string;
  repositoryRoot: string;
  expectedProjectRef: string;
  windowsIdentity: string;
  nodeExecutable: string;
  dockerExecutable: string;
  scheduleLocalTime: "20:00";
  createdAt: string;
};

export type BackupSuccessStatus = {
  schemaVersion: typeof STATUS_SCHEMA_VERSION;
  snapshotId: string;
  snapshotName: string;
  completedAt: string;
};

export type BackupFailureStatus = {
  schemaVersion: typeof STATUS_SCHEMA_VERSION;
  failedAt: string;
  stage: BackupStage;
  code: string;
  message: string;
};

export type SnapshotCandidate = {
  name: string;
  completedAt: string;
};

export const COMPLETED_SNAPSHOT_NAME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{6}Z_[a-f0-9]{8}$/;

type CopyBlock = {
  schema: string;
  table: string;
  columns: string[];
  rows: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireString = (
  value: unknown,
  fieldName: string,
  pattern?: RegExp,
): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    (pattern && !pattern.test(value))
  ) {
    throw new Error(`Некорректное поле ${fieldName}.`);
  }
  return value;
};

const requireIsoDate = (value: unknown, fieldName: string): string => {
  const dateValue = requireString(value, fieldName);
  const parsed = Date.parse(dateValue);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Поле ${fieldName} должно содержать ISO timestamp.`);
  }
  return dateValue;
};

export const parseBackupSuccessStatus = (
  value: unknown,
): BackupSuccessStatus => {
  if (!isRecord(value) || value.schemaVersion !== STATUS_SCHEMA_VERSION) {
    throw new Error("last-success.json имеет некорректный формат.");
  }
  const snapshotId = requireString(
    value.snapshotId,
    "snapshotId",
    /^[a-f0-9]{8}$/,
  );
  const snapshotName = requireString(
    value.snapshotName,
    "snapshotName",
    COMPLETED_SNAPSHOT_NAME_PATTERN,
  );
  if (!snapshotName.endsWith(`_${snapshotId}`)) {
    throw new Error("last-success snapshotName не соответствует snapshotId.");
  }

  return {
    schemaVersion: STATUS_SCHEMA_VERSION,
    snapshotId,
    snapshotName,
    completedAt: requireIsoDate(value.completedAt, "completedAt"),
  };
};

export const parseBackupFailureStatus = (
  value: unknown,
): BackupFailureStatus => {
  if (!isRecord(value) || value.schemaVersion !== STATUS_SCHEMA_VERSION) {
    throw new Error("last-failure.json имеет некорректный формат.");
  }
  const stage = requireString(value.stage, "stage") as BackupStage;
  if (!BACKUP_STAGES.includes(stage)) {
    throw new Error("last-failure stage имеет некорректный формат.");
  }

  return {
    schemaVersion: STATUS_SCHEMA_VERSION,
    failedAt: requireIsoDate(value.failedAt, "failedAt"),
    stage,
    code: requireString(value.code, "code", /^[A-Z0-9_]{3,100}$/),
    message: requireString(value.message, "message"),
  };
};

export const getFailureAfterSuccess = (
  success: BackupSuccessStatus,
  failure: BackupFailureStatus | null,
): BackupFailureStatus | null =>
  failure &&
  Date.parse(failure.failedAt) > Date.parse(success.completedAt)
    ? failure
    : null;

const parseQualifiedCopyIdentifier = (
  value: string,
): { schema: string; table: string } | null => {
  const match =
    /^(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_$]*))\.(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_$]*))$/.exec(
      value,
    );
  if (!match) {
    return null;
  }

  return {
    schema: match[1] ?? match[2],
    table: match[3] ?? match[4],
  };
};

const parseCopyColumns = (value: string): string[] =>
  value.split(",").map((column) => {
    const trimmed = column.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1).replaceAll('""', '"');
    }
    return trimmed;
  });

export const parseCopyBlocks = (sql: string): CopyBlock[] => {
  const blocks: CopyBlock[] = [];
  let activeBlock: CopyBlock | null = null;

  for (const line of sql.split(/\r?\n/)) {
    if (activeBlock) {
      if (line === "\\.") {
        blocks.push(activeBlock);
        activeBlock = null;
      } else {
        activeBlock.rows.push(line);
      }
      continue;
    }

    const headerMatch = /^COPY (.+?) \((.+)\) FROM stdin;$/.exec(line);
    if (!headerMatch) {
      continue;
    }

    const identifier = parseQualifiedCopyIdentifier(headerMatch[1]);
    if (!identifier) {
      throw new Error(`Не удалось разобрать COPY identifier: ${headerMatch[1]}`);
    }

    activeBlock = {
      ...identifier,
      columns: parseCopyColumns(headerMatch[2]),
      rows: [],
    };
  }

  if (activeBlock) {
    throw new Error(
      `COPY block ${activeBlock.schema}.${activeBlock.table} не завершён.`,
    );
  }

  return blocks;
};

export const parseExpectedPublicTableRowCounts = (
  dataSql: string,
): Record<ExpectedPublicTable, number> => {
  const counts = Object.fromEntries(
    EXPECTED_PUBLIC_TABLES.map((table) => [table, 0]),
  ) as Record<ExpectedPublicTable, number>;
  const seenTables = new Set<string>();

  for (const block of parseCopyBlocks(dataSql)) {
    if (
      block.schema !== "public" ||
      !EXPECTED_PUBLIC_TABLES.includes(block.table as ExpectedPublicTable)
    ) {
      continue;
    }

    const table = block.table as ExpectedPublicTable;
    counts[table] += block.rows.length;
    seenTables.add(table);
  }

  const missingTables = EXPECTED_PUBLIC_TABLES.filter(
    (table) => !seenTables.has(table),
  );
  if (missingTables.length > 0) {
    throw new Error(
      `В data.sql отсутствуют COPY blocks: ${missingTables.join(", ")}.`,
    );
  }

  return counts;
};

const compareMigrationVersions = (left: string, right: string): number =>
  left.length === right.length
    ? left.localeCompare(right)
    : left.length - right.length;

export const parseLatestMigrationVersion = (
  historyDataSql: string,
): string => {
  const versions: string[] = [];

  for (const block of parseCopyBlocks(historyDataSql)) {
    if (
      block.schema !== "supabase_migrations" ||
      block.table !== "schema_migrations"
    ) {
      continue;
    }

    const versionIndex = block.columns.indexOf("version");
    if (versionIndex < 0) {
      throw new Error(
        "COPY block supabase_migrations.schema_migrations не содержит version.",
      );
    }

    for (const row of block.rows) {
      const version = row.split("\t")[versionIndex];
      if (version && /^\d+$/.test(version)) {
        versions.push(version);
      }
    }
  }

  if (versions.length === 0) {
    throw new Error("В history_data.sql не найдена migration history.");
  }

  return versions.sort(compareMigrationVersions).at(-1) as string;
};

export const sha256File = (filePath: string): string =>
  createHash("sha256").update(readFileSync(filePath)).digest("hex");

export const buildSqlFileRecords = (
  snapshotDirectory: string,
): SnapshotFileRecord[] =>
  REQUIRED_SQL_ARTIFACTS.map((name) => {
    const filePath = path.join(snapshotDirectory, name);
    const sizeBytes = statSync(filePath).size;
    if (sizeBytes <= 0) {
      throw new Error(`${name} пустой.`);
    }

    return {
      name,
      sizeBytes,
      sha256: sha256File(filePath),
    };
  });

export const formatChecksums = (
  files: SnapshotFileRecord[],
): string =>
  `${files.map((file) => `${file.sha256}  ${file.name}`).join("\n")}\n`;

export const validateChecksumsDocument = (
  files: SnapshotFileRecord[],
  document: string,
): void => {
  const expected = formatChecksums(files).trimEnd();
  if (document.trimEnd() !== expected) {
    throw new Error("checksums.sha256 не соответствует manifest.");
  }
};

const assertNoSecretFieldNames = (
  value: unknown,
  currentPath = "manifest",
): void => {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoSecretFieldNames(item, `${currentPath}[${index}]`),
    );
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (/password|secret|token|connection|string|databaseurl/i.test(key)) {
      throw new Error(
        `Manifest содержит запрещённое поле ${currentPath}.${key}.`,
      );
    }
    assertNoSecretFieldNames(nestedValue, `${currentPath}.${key}`);
  }
};

export const validateSnapshotManifest = (
  value: unknown,
): SnapshotManifest => {
  if (!isRecord(value)) {
    throw new Error("manifest.json должен содержать JSON object.");
  }

  assertNoSecretFieldNames(value);

  if (value.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw new Error("Неподдерживаемая schemaVersion manifest.");
  }
  if (value.environment !== "production") {
    throw new Error("Manifest должен относиться к production.");
  }

  const snapshotId = requireString(
    value.snapshotId,
    "snapshotId",
    /^[a-f0-9]{8}$/,
  );
  const snapshotName = requireString(
    value.snapshotName,
    "snapshotName",
    COMPLETED_SNAPSHOT_NAME_PATTERN,
  );
  if (!snapshotName.endsWith(`_${snapshotId}`)) {
    throw new Error("snapshotName не соответствует snapshotId.");
  }

  const startedAt = requireIsoDate(value.startedAt, "startedAt");
  const completedAt = requireIsoDate(value.completedAt, "completedAt");
  if (Date.parse(completedAt) < Date.parse(startedAt)) {
    throw new Error("completedAt не может быть раньше startedAt.");
  }

  const sourceProjectRef = requireString(
    value.sourceProjectRef,
    "sourceProjectRef",
    /^[a-z0-9]{10,64}$/,
  );

  if (!isRecord(value.tooling)) {
    throw new Error("Manifest не содержит tooling.");
  }
  const tooling = {
    packageVersion: requireString(
      value.tooling.packageVersion,
      "tooling.packageVersion",
    ),
    gitSha: requireString(
      value.tooling.gitSha,
      "tooling.gitSha",
      /^[a-f0-9]{40}$/,
    ),
    supabaseCliVersion: requireString(
      value.tooling.supabaseCliVersion,
      "tooling.supabaseCliVersion",
    ),
  };

  if (!Array.isArray(value.files)) {
    throw new Error("Manifest не содержит files.");
  }
  const files = value.files.map((fileValue) => {
    if (!isRecord(fileValue)) {
      throw new Error("Некорректная запись manifest.files.");
    }
    const name = requireString(
      fileValue.name,
      "files.name",
    ) as SqlArtifactName;
    if (!REQUIRED_SQL_ARTIFACTS.includes(name)) {
      throw new Error(`Неожиданный SQL artifact ${name}.`);
    }
    if (
      typeof fileValue.sizeBytes !== "number" ||
      !Number.isSafeInteger(fileValue.sizeBytes) ||
      fileValue.sizeBytes <= 0
    ) {
      throw new Error(`Некорректный размер ${name}.`);
    }
    const sha256 = requireString(
      fileValue.sha256,
      `files.${name}.sha256`,
      /^[a-f0-9]{64}$/,
    );
    return { name, sizeBytes: fileValue.sizeBytes, sha256 };
  });

  const fileNames = files.map((file) => file.name);
  if (
    files.length !== REQUIRED_SQL_ARTIFACTS.length ||
    REQUIRED_SQL_ARTIFACTS.some((name) => !fileNames.includes(name))
  ) {
    throw new Error("Manifest содержит неполный набор SQL artifacts.");
  }

  const rowCountsValue = value.publicTableRowCounts;
  if (!isRecord(rowCountsValue)) {
    throw new Error("Manifest не содержит publicTableRowCounts.");
  }
  const publicTableRowCounts = Object.fromEntries(
    EXPECTED_PUBLIC_TABLES.map((table) => {
      const count = rowCountsValue[table];
      if (
        typeof count !== "number" ||
        !Number.isSafeInteger(count) ||
        count < 0
      ) {
        throw new Error(`Некорректный row count public.${table}.`);
      }
      return [table, count];
    }),
  ) as Record<ExpectedPublicTable, number>;

  const countKeys = Object.keys(rowCountsValue);
  if (
    countKeys.length !== EXPECTED_PUBLIC_TABLES.length ||
    countKeys.some(
      (key) =>
        !EXPECTED_PUBLIC_TABLES.includes(key as ExpectedPublicTable),
    )
  ) {
    throw new Error("publicTableRowCounts содержит неожиданные таблицы.");
  }

  const latestMigrationVersion = requireString(
    value.latestMigrationVersion,
    "latestMigrationVersion",
    /^\d+$/,
  );

  if (
    !isRecord(value.checks) ||
    value.checks.artifactsValid !== true ||
    value.checks.rowCountsComplete !== true ||
    value.checks.checksumsValid !== true
  ) {
    throw new Error("Manifest checks не подтверждены.");
  }

  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    snapshotId,
    snapshotName,
    environment: "production",
    sourceProjectRef,
    startedAt,
    completedAt,
    tooling,
    files,
    publicTableRowCounts,
    latestMigrationVersion,
    checks: {
      artifactsValid: true,
      rowCountsComplete: true,
      checksumsValid: true,
    },
  };
};

export const validateSnapshotDirectory = (
  snapshotDirectory: string,
): SnapshotManifest => {
  const snapshotName = path.basename(path.resolve(snapshotDirectory));
  if (!COMPLETED_SNAPSHOT_NAME_PATTERN.test(snapshotName)) {
    throw new Error("Snapshot directory не имеет completed-формат.");
  }

  const manifest = validateSnapshotManifest(
    JSON.parse(
      readFileSync(path.join(snapshotDirectory, "manifest.json"), "utf8"),
    ),
  );
  if (manifest.snapshotName !== snapshotName) {
    throw new Error("Имя snapshot directory не совпадает с manifest.");
  }

  const actualFiles = buildSqlFileRecords(snapshotDirectory);
  for (const expectedFile of manifest.files) {
    const actualFile = actualFiles.find(
      (file) => file.name === expectedFile.name,
    );
    if (
      !actualFile ||
      actualFile.sizeBytes !== expectedFile.sizeBytes ||
      actualFile.sha256 !== expectedFile.sha256
    ) {
      throw new Error(
        `${expectedFile.name} не соответствует manifest checksum.`,
      );
    }
  }

  validateChecksumsDocument(
    manifest.files,
    readFileSync(path.join(snapshotDirectory, "checksums.sha256"), "utf8"),
  );

  return manifest;
};

export const classifyBackupAge = (
  completedAt: string | undefined,
  now = new Date(),
): { state: BackupPolicyState; ageHours: number | null } => {
  if (!completedAt) {
    return { state: "violated", ageHours: null };
  }

  const completedAtMs = Date.parse(completedAt);
  if (!Number.isFinite(completedAtMs) || completedAtMs > now.getTime()) {
    return { state: "violated", ageHours: null };
  }

  const ageHours = (now.getTime() - completedAtMs) / 3_600_000;
  if (ageHours <= 24) {
    return { state: "healthy", ageHours };
  }
  if (ageHours <= 72) {
    return { state: "degraded", ageHours };
  }
  return { state: "violated", ageHours };
};

const getIsoWeekStartUtc = (date: Date): Date => {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
};

export const selectSnapshotRetention = (
  candidates: SnapshotCandidate[],
  now = new Date(),
): { keep: string[]; remove: string[] } => {
  const uniqueNames = new Set<string>();
  const normalized = candidates.map((candidate) => {
    if (
      !COMPLETED_SNAPSHOT_NAME_PATTERN.test(candidate.name) ||
      uniqueNames.has(candidate.name)
    ) {
      throw new Error(`Некорректный retention candidate ${candidate.name}.`);
    }
    uniqueNames.add(candidate.name);

    const completedAtMs = Date.parse(candidate.completedAt);
    if (
      !Number.isFinite(completedAtMs) ||
      completedAtMs > now.getTime()
    ) {
      throw new Error(
        `Некорректный completedAt для ${candidate.name}.`,
      );
    }

    return { ...candidate, completedAtMs };
  });

  normalized.sort((left, right) => right.completedAtMs - left.completedAtMs);
  const keep = new Set(normalized.slice(0, 7).map((item) => item.name));
  const currentWeekStart = getIsoWeekStartUtc(now).getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  for (let completedWeek = 1; completedWeek <= 4; completedWeek += 1) {
    const weekStart = currentWeekStart - completedWeek * weekMs;
    const weekEnd = currentWeekStart - (completedWeek - 1) * weekMs;
    const latestInWeek = normalized.find(
      (item) =>
        item.completedAtMs >= weekStart && item.completedAtMs < weekEnd,
    );
    if (latestInWeek) {
      keep.add(latestInWeek.name);
    }
  }

  return {
    keep: normalized
      .filter((item) => keep.has(item.name))
      .map((item) => item.name),
    remove: normalized
      .filter((item) => !keep.has(item.name))
      .map((item) => item.name),
  };
};

export const isPathInside = (
  parentPath: string,
  candidatePath: string,
): boolean => {
  const relative = path.relative(
    path.resolve(parentPath),
    path.resolve(candidatePath),
  );
  return (
    relative.length > 0 &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative)
  );
};

export const assertSafeBackupRoot = (
  backupRoot: string,
  repositoryRoot: string,
): void => {
  if (!path.isAbsolute(backupRoot)) {
    throw new Error("Backup root должен быть абсолютным путём.");
  }
  if (path.resolve(backupRoot) !== path.resolve(DEFAULT_BACKUP_ROOT)) {
    throw new Error(
      `Production backup root должен быть ${DEFAULT_BACKUP_ROOT}.`,
    );
  }
  if (
    path.resolve(backupRoot) === path.resolve(repositoryRoot) ||
    isPathInside(repositoryRoot, backupRoot)
  ) {
    throw new Error("Backup root не может находиться внутри репозитория.");
  }
  if (/\\(?:OneDrive|Google Drive|Dropbox)(?:\\|$)/i.test(backupRoot)) {
    throw new Error(
      "Backup root не может находиться в автоматически синхронизируемой папке.",
    );
  }
};

export const assertPathInside = (
  parentPath: string,
  candidatePath: string,
): void => {
  if (!isPathInside(parentPath, candidatePath)) {
    throw new Error(
      `Операция с путём вне разрешённого root запрещена: ${candidatePath}.`,
    );
  }
};

export const assertDirectCompletedSnapshotPath = (
  snapshotsRoot: string,
  snapshotPath: string,
): void => {
  const resolvedRoot = path.resolve(snapshotsRoot);
  const resolvedSnapshot = path.resolve(snapshotPath);
  const normalizeForComparison = (value: string): string =>
    process.platform === "win32" ? value.toLowerCase() : value;

  if (
    normalizeForComparison(path.dirname(resolvedSnapshot)) !==
      normalizeForComparison(resolvedRoot) ||
    !COMPLETED_SNAPSHOT_NAME_PATTERN.test(
      path.basename(resolvedSnapshot),
    )
  ) {
    throw new Error(
      "Snapshot должен быть непосредственным completed-каталогом snapshots root.",
    );
  }
  if (lstatSync(resolvedSnapshot).isSymbolicLink()) {
    throw new Error("Symlink/junction нельзя использовать как recovery snapshot.");
  }
};

export const assertRecoveryTargetIsNotProduction = ({
  productionProjectRef,
  targetProjectRef,
  targetDbHost,
  targetDbUser,
}: {
  productionProjectRef: string;
  targetProjectRef: string;
  targetDbHost: string;
  targetDbUser: string;
}): void => {
  const normalizedProductionRef = productionProjectRef.trim().toLowerCase();
  const normalizedTargetRef = targetProjectRef.trim().toLowerCase();
  const normalizedHost = targetDbHost.trim().toLowerCase();
  const normalizedUser = targetDbUser.trim().toLowerCase();

  if (
    !/^[a-z0-9]{10,64}$/.test(normalizedProductionRef) ||
    !/^[a-z0-9]{10,64}$/.test(normalizedTargetRef)
  ) {
    throw new Error("Project ref имеет некорректный формат.");
  }
  if (normalizedTargetRef === normalizedProductionRef) {
    throw new Error("Recovery target совпадает с production project ref.");
  }
  if (
    normalizedHost.includes(normalizedProductionRef) ||
    normalizedUser.includes(normalizedProductionRef)
  ) {
    throw new Error("Recovery connection указывает на production project.");
  }
  if (
    !normalizedHost.endsWith(".supabase.co") &&
    !normalizedHost.endsWith(".supabase.com")
  ) {
    throw new Error("Recovery DB host должен принадлежать Supabase.");
  }

  const directHostMatch =
    /^db\.([a-z0-9]+)\.supabase\.(?:co|com)$/.exec(
      normalizedHost,
    );
  if (directHostMatch && directHostMatch[1] !== normalizedTargetRef) {
    throw new Error("Target project ref не совпадает с direct DB host.");
  }

  const poolerUserMatch = /^postgres\.([a-z0-9]+)$/.exec(normalizedUser);
  if (normalizedHost.includes(".pooler.supabase.")) {
    if (
      !poolerUserMatch ||
      poolerUserMatch[1] !== normalizedTargetRef
    ) {
      throw new Error(
        "Target project ref не совпадает с pooler DB user.",
      );
    }
  } else if (
    poolerUserMatch &&
    poolerUserMatch[1] !== normalizedTargetRef
  ) {
    throw new Error("Target project ref не совпадает с DB user.");
  }
};

export const sanitizeOperationalMessage = (
  value: unknown,
  sensitiveValues: string[] = [],
): string => {
  let message =
    value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : "Неизвестная operational ошибка.";

  for (const sensitiveValue of sensitiveValues) {
    if (sensitiveValue) {
      message = message.replaceAll(sensitiveValue, "[REDACTED]");
    }
  }

  return message
    .replace(
      /\bpostgres(?:ql)?:\/\/[^\s]+/gi,
      "[REDACTED_DATABASE_URL]",
    )
    .replace(
      /\b(password|token|secret|api[_-]?key)\s*[=:]\s*[^\s,;]+/gi,
      "$1=[REDACTED]",
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
};
