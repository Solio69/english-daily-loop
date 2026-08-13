import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  COMPLETED_SNAPSHOT_NAME_PATTERN,
  EXPECTED_PUBLIC_TABLES,
  PROTECTED_PUBLIC_TABLES,
  REQUIRED_CRON_JOBS,
  REQUIRED_EXTENSIONS,
  REQUIRED_INDEXES,
  REQUIRED_SERVER_FUNCTIONS,
  REQUIRED_SQL_ARTIFACTS,
  REQUIRED_TRIGGERS,
  assertDirectCompletedSnapshotPath,
  assertPathInside,
  assertRecoveryTargetIsNotProduction,
  assertSafeBackupRoot,
  classifyBackupAge,
  getFailureAfterSuccess,
  parseBackupFailureStatus,
  parseBackupSuccessStatus,
  parseExpectedPublicTableRowCounts,
  parseLatestMigrationVersion,
  sanitizeOperationalMessage,
  selectSnapshotRetention,
  validateSnapshotDirectory,
  validateSnapshotManifest,
  type SnapshotManifest,
} from "../scripts/backup/policy";
import {
  DUMP_ARTIFACTS,
  runBackup,
  type BackupRunnerOptions,
} from "../scripts/backup/runner";
import {
  parseRecoveryDatabaseReport,
  validateRecoveryDatabaseReport,
  type RecoveryDatabaseReport,
} from "../scripts/backup/recovery";

const TEST_PROJECT_REF = "abcdefghijklmnopqrst";
const RECOVERY_PROJECT_REF = "zyxwvutsrqponmlkjihg";
const TEST_GIT_SHA = "a".repeat(40);
const TEST_PASSWORD = "fixture-password-value";

const buildDataSql = (): string =>
  EXPECTED_PUBLIC_TABLES.map((table, index) => {
    const rows =
      index === 0
        ? ["00000000-0000-0000-0000-000000000001", "second-user"]
        : index === 1
          ? ["sample-reading"]
          : [];
    return [
      `COPY public.${table} (value) FROM stdin;`,
      ...rows,
      "\\.",
    ].join("\n");
  }).join("\n\n");

const historyDataSql = [
  "COPY supabase_migrations.schema_migrations (version, statements, name) FROM stdin;",
  "20260407172310\t\\N\tcreate_users",
  "20260727120000\t\\N\tprepare_personal_data_minimization",
  "\\.",
  "",
].join("\n");

const artifactContent = (name: string): string => {
  if (name === "data.sql") {
    return buildDataSql();
  }
  if (name === "history_data.sql") {
    return historyDataSql;
  }
  return `-- safe fixture for ${name}\nselect 1;\n`;
};

const createTempBackupRoot = (): string =>
  mkdtempSync(path.join(os.tmpdir(), "edl-production-backup-test-"));

const removeTempBackupRoot = (tempRoot: string): void => {
  const resolvedTemp = path.resolve(tempRoot);
  const allowedRoot = `${path.resolve(os.tmpdir())}${path.sep}`;
  assert.ok(resolvedTemp.startsWith(allowedRoot));
  rmSync(resolvedTemp, { recursive: true, force: true });
};

const createRunnerOptions = ({
  backupRoot,
  snapshotId = "a1b2c3d4",
  startedAt = "2026-07-29T17:00:00.000Z",
  completedAt = "2026-07-29T17:00:05.000Z",
  dumpArtifact,
}: {
  backupRoot: string;
  snapshotId?: string;
  startedAt?: string;
  completedAt?: string;
  dumpArtifact?: BackupRunnerOptions["dumpArtifact"];
}): BackupRunnerOptions => {
  const dates = [new Date(startedAt), new Date(completedAt)];
  return {
    backupRoot,
    sourceProjectRef: TEST_PROJECT_REF,
    tooling: {
      packageVersion: "0.1.1",
      gitSha: TEST_GIT_SHA,
      supabaseCliVersion: "2.85.0",
    },
    sensitiveValues: [TEST_PASSWORD],
    now: () => dates.shift() ?? new Date(completedAt),
    createSnapshotId: () => snapshotId,
    dumpArtifact:
      dumpArtifact ??
      ((definition, outputPath) => {
        writeFileSync(
          outputPath,
          artifactContent(definition.name),
          "utf8",
        );
      }),
  };
};

const createValidSnapshot = (
  backupRoot: string,
  options: Partial<{
    snapshotId: string;
    startedAt: string;
    completedAt: string;
  }> = {},
): SnapshotManifest =>
  runBackup(
    createRunnerOptions({
      backupRoot,
      ...options,
    }),
  );

test("COPY parser counts all expected public tables", () => {
  const counts = parseExpectedPublicTableRowCounts(buildDataSql());

  assert.equal(Object.keys(counts).length, 13);
  assert.equal(counts.users, 2);
  assert.equal(counts.reading_texts, 1);
  assert.equal(counts.support_reports, 0);
});

test("COPY parser rejects a missing expected table", () => {
  const incompleteSql = buildDataSql().replace(
    /COPY public\.support_reports[\s\S]*?\\\.\n?$/,
    "",
  );

  assert.throws(
    () => parseExpectedPublicTableRowCounts(incompleteSql),
    /support_reports/,
  );
});

test("migration history parser returns the latest restored version", () => {
  assert.equal(
    parseLatestMigrationVersion(historyDataSql),
    "20260727120000",
  );
});

test("runner publishes a complete validated snapshot", (context) => {
  const backupRoot = createTempBackupRoot();
  context.after(() => removeTempBackupRoot(backupRoot));

  const manifest = createValidSnapshot(backupRoot);
  const snapshotPath = path.join(
    backupRoot,
    "snapshots",
    manifest.snapshotName,
  );
  const validated = validateSnapshotDirectory(snapshotPath);

  assert.equal(validated.snapshotId, "a1b2c3d4");
  assert.deepEqual(
    validated.files.map(({ name }) => name),
    REQUIRED_SQL_ARTIFACTS,
  );
  assert.equal(validated.publicTableRowCounts.users, 2);
  assert.equal(
    validated.latestMigrationVersion,
    "20260727120000",
  );
  assert.equal(
    existsSync(`${snapshotPath}.partial`),
    false,
  );
  assert.equal(
    existsSync(path.join(backupRoot, "status", "last-success.json")),
    true,
  );
  assert.doesNotMatch(
    readFileSync(path.join(snapshotPath, "manifest.json"), "utf8"),
    new RegExp(TEST_PASSWORD),
  );
});

test("runner atomically replaces success status on the next backup", (context) => {
  const backupRoot = createTempBackupRoot();
  context.after(() => removeTempBackupRoot(backupRoot));
  createValidSnapshot(backupRoot);

  const nextManifest = createValidSnapshot(backupRoot, {
    snapshotId: "b1c2d3e4",
    startedAt: "2026-07-30T17:00:00.000Z",
    completedAt: "2026-07-30T17:00:05.000Z",
  });
  const statusDirectory = path.join(backupRoot, "status");
  const success = JSON.parse(
    readFileSync(path.join(statusDirectory, "last-success.json"), "utf8"),
  ) as { snapshotId: string };

  assert.equal(success.snapshotId, nextManifest.snapshotId);
  assert.equal(
    readdirSync(statusDirectory).some((name) => name.endsWith(".tmp")),
    false,
  );
});

test("runner safely replaces a stale lock", (context) => {
  const backupRoot = createTempBackupRoot();
  context.after(() => removeTempBackupRoot(backupRoot));
  const statusDirectory = path.join(backupRoot, "status");
  mkdirSync(statusDirectory, { recursive: true });
  const lockPath = path.join(statusDirectory, "backup.lock");
  writeFileSync(lockPath, '{"pid":1}\n', "utf8");
  const staleTime = new Date("2026-07-29T12:00:00.000Z");
  utimesSync(lockPath, staleTime, staleTime);

  createValidSnapshot(backupRoot);

  assert.equal(existsSync(lockPath), false);
  assert.equal(
    readdirSync(statusDirectory).some((name) => name.includes(".stale-")),
    false,
  );
});

test("failed run leaves partial data and preserves the previous success", (context) => {
  const backupRoot = createTempBackupRoot();
  context.after(() => removeTempBackupRoot(backupRoot));
  const firstManifest = createValidSnapshot(backupRoot);
  const successPath = path.join(
    backupRoot,
    "status",
    "last-success.json",
  );
  const firstSuccess = readFileSync(successPath, "utf8");

  assert.throws(
    () =>
      runBackup(
        createRunnerOptions({
          backupRoot,
          snapshotId: "b1c2d3e4",
          startedAt: "2026-07-30T17:00:00.000Z",
          completedAt: "2026-07-30T17:00:05.000Z",
          dumpArtifact: (definition, outputPath) => {
            if (definition.name === "data.sql") {
              throw new Error(`password=${TEST_PASSWORD}`);
            }
            writeFileSync(
              outputPath,
              artifactContent(definition.name),
              "utf8",
            );
          },
        }),
      ),
    /REDACTED/,
  );

  assert.equal(readFileSync(successPath, "utf8"), firstSuccess);
  assert.equal(
    existsSync(
      path.join(
        backupRoot,
        "snapshots",
        firstManifest.snapshotName,
      ),
    ),
    true,
  );
  assert.ok(
    readdirSync(path.join(backupRoot, "snapshots")).some((name) =>
      name.endsWith(".partial"),
    ),
  );
  const failureStatus = readFileSync(
    path.join(backupRoot, "status", "last-failure.json"),
    "utf8",
  );
  assert.doesNotMatch(failureStatus, new RegExp(TEST_PASSWORD));
  assert.match(failureStatus, /\[REDACTED\]/);
});

test("retention keeps seven latest snapshots and four completed ISO weeks", () => {
  const candidates = [
    "2026-07-29",
    "2026-07-28",
    "2026-07-27",
    "2026-07-26",
    "2026-07-25",
    "2026-07-24",
    "2026-07-23",
    "2026-07-19",
    "2026-07-12",
    "2026-07-05",
    "2026-06-28",
  ].map((date, index) => ({
    name: `${date}T170000Z_${index.toString(16).padStart(8, "0")}`,
    completedAt: `${date}T17:00:00.000Z`,
  }));

  const result = selectSnapshotRetention(
    candidates,
    new Date("2026-07-29T18:00:00.000Z"),
  );

  assert.equal(result.keep.length, 10);
  assert.deepEqual(result.remove, [
    "2026-06-28T170000Z_0000000a",
  ]);
  assert.ok(result.keep.includes("2026-07-05T170000Z_00000009"));
});

test("retention uses completed ISO weeks at the Monday boundary", () => {
  const candidates = [
    {
      name: "2026-07-27T000000Z_00000001",
      completedAt: "2026-07-27T00:00:00.000Z",
    },
    {
      name: "2026-07-26T235959Z_00000002",
      completedAt: "2026-07-26T23:59:59.000Z",
    },
    {
      name: "2026-07-20T000000Z_00000003",
      completedAt: "2026-07-20T00:00:00.000Z",
    },
  ];

  const result = selectSnapshotRetention(
    candidates,
    new Date("2026-08-10T00:00:00.000Z"),
  );

  assert.ok(result.keep.includes("2026-07-26T235959Z_00000002"));
  assert.ok(result.keep.includes("2026-07-27T000000Z_00000001"));
});

test("path guards reject paths outside the allowed backup roots", () => {
  assert.throws(
    () =>
      assertPathInside(
        path.join(os.tmpdir(), "allowed-backups"),
        path.join(os.tmpdir(), "outside-backups"),
      ),
    /вне разрешённого root/,
  );
  assert.throws(
    () =>
      assertSafeBackupRoot(
        path.join(process.cwd(), "backups"),
        process.cwd(),
      ),
    /Production backup root|внутри репозитория/,
  );
});

test("backup age policy keeps exact 24h and 72h boundaries", () => {
  const now = new Date("2026-07-29T20:00:00.000Z");
  assert.equal(
    classifyBackupAge("2026-07-28T20:00:00.000Z", now).state,
    "healthy",
  );
  assert.equal(
    classifyBackupAge("2026-07-26T20:00:00.000Z", now).state,
    "degraded",
  );
  assert.equal(
    classifyBackupAge("2026-07-26T19:59:59.000Z", now).state,
    "violated",
  );
  assert.equal(classifyBackupAge(undefined, now).state, "violated");
});

test("status parsers expose only a failure newer than the last success", () => {
  const success = parseBackupSuccessStatus({
    schemaVersion: 1,
    snapshotId: "a1b2c3d4",
    snapshotName: "2026-07-29T170000Z_a1b2c3d4",
    completedAt: "2026-07-29T17:00:00.000Z",
  });
  const oldFailure = parseBackupFailureStatus({
    schemaVersion: 1,
    failedAt: "2026-07-29T16:00:00.000Z",
    stage: "data",
    code: "SUPABASE_DUMP_FAILED",
    message: "safe failure",
  });
  const newFailure = parseBackupFailureStatus({
    schemaVersion: 1,
    failedAt: "2026-07-29T18:00:00.000Z",
    stage: "data",
    code: "SUPABASE_DUMP_FAILED",
    message: "safe failure",
  });

  assert.equal(getFailureAfterSuccess(success, oldFailure), null);
  assert.equal(getFailureAfterSuccess(success, newFailure), newFailure);
});

test("manifest rejects secret-like fields", (context) => {
  const backupRoot = createTempBackupRoot();
  context.after(() => removeTempBackupRoot(backupRoot));
  const manifest = createValidSnapshot(backupRoot);

  assert.throws(
    () =>
      validateSnapshotManifest({
        ...manifest,
        databasePassword: TEST_PASSWORD,
      }),
    /запрещённое поле/,
  );
});

test("recovery target guard rejects production and mismatched targets", () => {
  assert.doesNotThrow(() =>
    assertRecoveryTargetIsNotProduction({
      productionProjectRef: TEST_PROJECT_REF,
      targetProjectRef: RECOVERY_PROJECT_REF,
      targetDbHost: `db.${RECOVERY_PROJECT_REF}.supabase.co`,
      targetDbUser: "postgres",
    }),
  );

  assert.throws(
    () =>
      assertRecoveryTargetIsNotProduction({
        productionProjectRef: TEST_PROJECT_REF,
        targetProjectRef: TEST_PROJECT_REF,
        targetDbHost: `db.${TEST_PROJECT_REF}.supabase.co`,
        targetDbUser: "postgres",
      }),
    /production/,
  );
  assert.throws(
    () =>
      assertRecoveryTargetIsNotProduction({
        productionProjectRef: TEST_PROJECT_REF,
        targetProjectRef: RECOVERY_PROJECT_REF,
        targetDbHost: `db.${TEST_PROJECT_REF}.supabase.com`,
        targetDbUser: "postgres",
      }),
    /production/,
  );
  assert.throws(
    () =>
      assertRecoveryTargetIsNotProduction({
        productionProjectRef: TEST_PROJECT_REF,
        targetProjectRef: RECOVERY_PROJECT_REF,
        targetDbHost: "aws-0-eu-central-1.pooler.supabase.com",
        targetDbUser: "postgres",
      }),
    /pooler DB user/,
  );
  assert.throws(
    () =>
      assertRecoveryTargetIsNotProduction({
        productionProjectRef: TEST_PROJECT_REF,
        targetProjectRef: RECOVERY_PROJECT_REF,
        targetDbHost: `db.${TEST_PROJECT_REF}.supabase.co`,
        targetDbUser: "postgres",
      }),
    /production/,
  );
  assert.throws(
    () =>
      assertRecoveryTargetIsNotProduction({
        productionProjectRef: TEST_PROJECT_REF,
        targetProjectRef: RECOVERY_PROJECT_REF,
        targetDbHost: `db.${TEST_PROJECT_REF}.supabase.co`,
        targetDbUser: `postgres.${RECOVERY_PROJECT_REF}`,
      }),
    /production/,
  );
});

test("recovery accepts only a direct completed snapshot directory", (context) => {
  const backupRoot = createTempBackupRoot();
  context.after(() => removeTempBackupRoot(backupRoot));
  const snapshotsRoot = path.join(backupRoot, "snapshots");
  const directSnapshot = path.join(
    snapshotsRoot,
    "2026-07-29T170000Z_a1b2c3d4",
  );
  mkdirSync(directSnapshot, { recursive: true });

  assert.doesNotThrow(() =>
    assertDirectCompletedSnapshotPath(snapshotsRoot, directSnapshot),
  );

  const nestedSnapshot = path.join(
    snapshotsRoot,
    "nested",
    "2026-07-29T170000Z_b1c2d3e4",
  );
  mkdirSync(nestedSnapshot, { recursive: true });
  assert.throws(
    () =>
      assertDirectCompletedSnapshotPath(snapshotsRoot, nestedSnapshot),
    /непосредственным completed-каталогом/,
  );
});

const createRecoveryReport = (
  manifest: SnapshotManifest,
): RecoveryDatabaseReport => ({
  publicTableRowCounts: { ...manifest.publicTableRowCounts },
  publicTables: [...EXPECTED_PUBLIC_TABLES],
  columns: [
    {
      table: "user_active_reading_texts",
      name: "last_read_paragraph_index",
      nullable: true,
    },
    {
      table: "support_reports",
      name: "telegram_user_id",
      nullable: true,
    },
  ],
  rlsEnabledTables: [...PROTECTED_PUBLIC_TABLES],
  protectedRolePrivileges: [],
  serviceRoleMissingTablePrivileges: [],
  serverFunctions: [...REQUIRED_SERVER_FUNCTIONS],
  insecureServerFunctions: [],
  serviceRoleFunctions: [...REQUIRED_SERVER_FUNCTIONS],
  extensions: [...REQUIRED_EXTENSIONS],
  cronJobs: REQUIRED_CRON_JOBS.map((name) => ({
    name,
    schedule:
      name === "cleanup_ai_generation_attempts"
        ? "20 3 * * *"
        : name === "cleanup_vocabulary_card_generation_attempts"
          ? "25 3 * * *"
          : "35 3 * * *",
    active: false,
  })),
  indexes: [...REQUIRED_INDEXES],
  triggers: [...REQUIRED_TRIGGERS],
  foreignKeyCount: 12,
  latestMigrationVersion: manifest.latestMigrationVersion,
});

test("recovery validator accepts a database matching the manifest", (context) => {
  const backupRoot = createTempBackupRoot();
  context.after(() => removeTempBackupRoot(backupRoot));
  const manifest = createValidSnapshot(backupRoot);
  const report = parseRecoveryDatabaseReport(
    createRecoveryReport(manifest),
  );

  assert.deepEqual(
    validateRecoveryDatabaseReport(manifest, report),
    [],
  );
});

test("recovery validator reports data and security mismatches", (context) => {
  const backupRoot = createTempBackupRoot();
  context.after(() => removeTempBackupRoot(backupRoot));
  const manifest = createValidSnapshot(backupRoot);
  const report = createRecoveryReport(manifest);
  report.publicTableRowCounts.users += 1;
  report.rlsEnabledTables = report.rlsEnabledTables.filter(
    (table) => table !== "users",
  );
  report.insecureServerFunctions = ["complete_daily_reading_text"];
  report.cronJobs = [];

  const errors = validateRecoveryDatabaseReport(manifest, report).join(
    "\n",
  );
  assert.match(errors, /public\.users/);
  assert.match(errors, /RLS выключен: users/);
  assert.match(errors, /server-only functions/);
  assert.match(errors, /cron job/);
});

test(
  "recovery validator selects requirements by snapshot migration",
  (context) => {
    const backupRoot = createTempBackupRoot();
    context.after(() => removeTempBackupRoot(backupRoot));
    const currentManifest = createValidSnapshot(backupRoot);
    const productionManifest = {
      ...currentManifest,
      latestMigrationVersion: "20260707120000",
    };
    const productionReport = createRecoveryReport(productionManifest);
    productionReport.serverFunctions =
      productionReport.serverFunctions.filter(
        (name) => name !== "get_moscow_study_date",
      );
    productionReport.serviceRoleFunctions =
      productionReport.serviceRoleFunctions.filter(
        (name) => name !== "get_moscow_study_date",
      );
    productionReport.columns = productionReport.columns
      .filter(({ name }) => name !== "last_read_paragraph_index")
      .map((column) =>
        column.name === "telegram_user_id"
          ? { ...column, nullable: false }
          : column,
      );

    assert.deepEqual(
      validateRecoveryDatabaseReport(
        productionManifest,
        productionReport,
      ),
      [],
    );

    const moscowManifest = {
      ...currentManifest,
      latestMigrationVersion: "20260723120000",
    };
    const moscowReport = createRecoveryReport(moscowManifest);
    moscowReport.serverFunctions = moscowReport.serverFunctions.filter(
      (name) => name !== "get_moscow_study_date",
    );
    moscowReport.serviceRoleFunctions =
      moscowReport.serviceRoleFunctions.filter(
        (name) => name !== "get_moscow_study_date",
      );
    moscowReport.columns = moscowReport.columns
      .filter(({ name }) => name !== "last_read_paragraph_index")
      .map((column) =>
        column.name === "telegram_user_id"
          ? { ...column, nullable: false }
          : column,
      );

    const errors = validateRecoveryDatabaseReport(
      moscowManifest,
      moscowReport,
    ).join("\n");
    assert.match(errors, /get_moscow_study_date/);

    const deletionManifest = {
      ...currentManifest,
      latestMigrationVersion: "20260813120000",
    };
    const deletionReport = createRecoveryReport(deletionManifest);
    deletionReport.serverFunctions =
      deletionReport.serverFunctions.filter(
        (name) =>
          name !== "delete_pending_vocabulary_word_with_sources",
      );
    deletionReport.serviceRoleFunctions =
      deletionReport.serviceRoleFunctions.filter(
        (name) =>
          name !== "delete_pending_vocabulary_word_with_sources",
      );

    const deletionErrors = validateRecoveryDatabaseReport(
      deletionManifest,
      deletionReport,
    ).join("\n");
    assert.match(
      deletionErrors,
      /delete_pending_vocabulary_word_with_sources/,
    );

    const persistenceManifest = {
      ...currentManifest,
      latestMigrationVersion: "20260813150000",
    };
    const persistenceReport = createRecoveryReport(persistenceManifest);
    persistenceReport.serverFunctions =
      persistenceReport.serverFunctions.filter(
        (name) => name !== "persist_generated_vocabulary_card",
      );
    persistenceReport.serviceRoleFunctions =
      persistenceReport.serviceRoleFunctions.filter(
        (name) => name !== "persist_generated_vocabulary_card",
      );

    const persistenceErrors = validateRecoveryDatabaseReport(
      persistenceManifest,
      persistenceReport,
    ).join("\n");
    assert.match(persistenceErrors, /persist_generated_vocabulary_card/);
  },
);

test(
  "recovery validator checks versioned column contracts",
  (context) => {
    const backupRoot = createTempBackupRoot();
    context.after(() => removeTempBackupRoot(backupRoot));
    const currentManifest = createValidSnapshot(backupRoot);

    const positionManifest = {
      ...currentManifest,
      latestMigrationVersion: "20260724120000",
    };
    const positionReport = createRecoveryReport(positionManifest);
    positionReport.columns = positionReport.columns
      .filter(({ name }) => name !== "last_read_paragraph_index")
      .map((column) =>
        column.name === "telegram_user_id"
          ? { ...column, nullable: false }
          : column,
      );
    assert.match(
      validateRecoveryDatabaseReport(
        positionManifest,
        positionReport,
      ).join("\n"),
      /last_read_paragraph_index/,
    );

    const nullableReport = createRecoveryReport(currentManifest);
    nullableReport.columns = nullableReport.columns.map((column) =>
      column.name === "telegram_user_id"
        ? { ...column, nullable: false }
        : column,
    );
    assert.match(
      validateRecoveryDatabaseReport(
        currentManifest,
        nullableReport,
      ).join("\n"),
      /nullability/,
    );
  },
);

test("operational message sanitizer redacts credentials and database URLs", () => {
  const sanitized = sanitizeOperationalMessage(
    `password=${TEST_PASSWORD} postgresql://postgres:${TEST_PASSWORD}@db.example`,
    [TEST_PASSWORD],
  );

  assert.doesNotMatch(sanitized, new RegExp(TEST_PASSWORD));
  assert.doesNotMatch(sanitized, /postgresql:\/\//);
  assert.match(sanitized, /REDACTED/);
});

test("production backup definitions contain only Supabase db dump", () => {
  for (const definition of DUMP_ARTIFACTS) {
    assert.deepEqual(definition.args.slice(0, 2), ["db", "dump"]);
    assert.doesNotMatch(
      definition.args.join(" "),
      /\b(push|reset|migration|seed|restore)\b/i,
    );
  }
});

test("backup and recovery source contracts do not contain production writes", () => {
  const productionSource = readFileSync(
    "scripts/backup/production-backup.ts",
    "utf8",
  );
  const recoveryValidationSql = readFileSync(
    "scripts/backup/recovery-validation.sql",
    "utf8",
  );
  const wrapperSource = readFileSync(
    "scripts/backup/run-production-backup.ps1",
    "utf8",
  );

  assert.doesNotMatch(
    productionSource,
    /\bdb\s+(push|reset)|\bmigration\s+up|\bfunctions\s+deploy/i,
  );
  assert.doesNotMatch(
    recoveryValidationSql,
    /^\s*(insert\s+into|update\s+\S+\s+set|delete\s+from|truncate|alter\s+table|drop\s+table|create\s+table)\b/im,
  );
  assert.match(
    recoveryValidationSql,
    /p\.prorettype <> 'event_trigger'::regtype/,
  );
  assert.match(wrapperSource, /SUPABASE_DB_PASSWORD/);
  assert.doesNotMatch(wrapperSource, /--password/);
  assert.match(
    productionSource,
    /delete nonDatabaseEnvironment\.SUPABASE_DB_PASSWORD/,
  );
});

test("scheduled task contract catches missed runs and retries", () => {
  const taskSource = readFileSync(
    "scripts/backup/register-production-backup-task.ps1",
    "utf8",
  );

  assert.match(taskSource, /StartWhenAvailable/);
  assert.match(taskSource, /RestartCount 3/);
  assert.match(taskSource, /New-TimeSpan -Minutes 30/);
  assert.match(taskSource, /LogonType Interactive/);
  assert.match(taskSource, /RunLevel Limited/);
});

test("isolated restore follows the Supabase safe restore sequence", () => {
  const restoreSource = readFileSync(
    "scripts/backup/restore-recovery-snapshot.ps1",
    "utf8",
  );
  const recoveryCronSource = readFileSync(
    "scripts/backup/recovery-cron-jobs.sql",
    "utf8",
  );

  assert.match(
    restoreSource,
    /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated/,
  );
  assert.match(
    restoreSource,
    /SET session_replication_role = replica/,
  );
  assert.match(restoreSource, /recovery-cron-jobs\.sql/);
  assert.match(
    recoveryCronSource,
    /cron\.alter_job\(jobid, active := false\)/,
  );
  assert.doesNotMatch(recoveryCronSource, /update\s+cron\.job/i);
});

test("restore and validation require owner and isolated-target preflight", () => {
  const commonSource = readFileSync(
    "scripts/backup/recovery-common.ps1",
    "utf8",
  );
  const commandSources = [
    readFileSync(
      "scripts/backup/restore-recovery-snapshot.ps1",
      "utf8",
    ),
    readFileSync(
      "scripts/backup/validate-recovery-snapshot.ps1",
      "utf8",
    ),
  ];

  assert.match(commonSource, /config\.windowsIdentity/);
  assert.match(commonSource, /recovery-preflight\.ts/);
  assert.match(
    commonSource,
    /\$preflightOutput = & \$config\.nodeExecutable/,
  );
  assert.match(
    commonSource,
    /\$preflightOutput \| ForEach-Object \{ Write-Host \$_ \}/,
  );
  for (const source of commandSources) {
    const preflightIndex = source.indexOf("Get-RecoveryContext");
    const passwordIndex = source.indexOf("Get-RecoveryPlainPassword");
    assert.ok(preflightIndex >= 0);
    assert.ok(passwordIndex > preflightIndex);
  }
});

test(
  "PowerShell backup scripts pass the built-in parser",
  { skip: process.platform !== "win32" },
  () => {
    const scripts = [
      "initialize-production-backup.ps1",
      "register-production-backup-task.ps1",
      "run-production-backup.ps1",
      "recovery-common.ps1",
      "restore-recovery-snapshot.ps1",
      "validate-recovery-snapshot.ps1",
    ];

    for (const scriptName of scripts) {
      const scriptPath = path.resolve("scripts", "backup", scriptName);
      const result = spawnSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          [
            "$tokens = $null",
            "$errors = $null",
            "[System.Management.Automation.Language.Parser]::ParseFile(",
            "  $env:EDL_POWERSHELL_FILE,",
            "  [ref]$tokens,",
            "  [ref]$errors",
            ") | Out-Null",
            "if ($errors.Count -gt 0) {",
            "  $errors | ForEach-Object { Write-Error $_.Message }",
            "  exit 1",
            "}",
          ].join("\n"),
        ],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            EDL_POWERSHELL_FILE: scriptPath,
          },
        },
      );

      assert.equal(
        result.status,
        0,
        `${scriptName}: ${result.stderr || result.stdout}`,
      );
    }
  },
);

test("package scripts expose setup, schedule, production backup and status", () => {
  const packageJson = JSON.parse(
    readFileSync("package.json", "utf8"),
  ) as { scripts?: Record<string, string> };

  assert.match(packageJson.scripts?.["backup:setup"] ?? "", /initialize/);
  assert.match(
    packageJson.scripts?.["backup:schedule"] ?? "",
    /register/,
  );
  assert.match(
    packageJson.scripts?.["backup:production"] ?? "",
    /run-production-backup/,
  );
  assert.match(packageJson.scripts?.["backup:status"] ?? "", /status\.ts/);
});

test("completed snapshot name contract rejects partial folders", () => {
  assert.match(
    "2026-07-29T170000Z_a1b2c3d4",
    COMPLETED_SNAPSHOT_NAME_PATTERN,
  );
  assert.doesNotMatch(
    "2026-07-29T170000Z_a1b2c3d4.partial",
    COMPLETED_SNAPSHOT_NAME_PATTERN,
  );
});
