import {
  EXPECTED_PUBLIC_TABLES,
  PROTECTED_PUBLIC_TABLES,
  REQUIRED_CRON_JOBS,
  REQUIRED_EXTENSIONS,
  REQUIRED_INDEXES,
  REQUIRED_SERVER_FUNCTIONS,
  REQUIRED_TRIGGERS,
  type ExpectedPublicTable,
  type SnapshotManifest,
} from "./policy";

export type RecoveryDatabaseReport = {
  publicTableRowCounts: Record<string, number>;
  publicTables: string[];
  rlsEnabledTables: string[];
  protectedRolePrivileges: string[];
  serviceRoleMissingTablePrivileges: string[];
  serverFunctions: string[];
  insecureServerFunctions: string[];
  serviceRoleMissingFunctions: string[];
  extensions: string[];
  cronJobs: { name: string; schedule: string; active: boolean }[];
  indexes: string[];
  triggers: string[];
  foreignKeyCount: number;
  latestMigrationVersion: string | null;
};

const CRON_SCHEDULES: Record<string, string> = {
  cleanup_ai_generation_attempts: "20 3 * * *",
  cleanup_vocabulary_card_generation_attempts: "25 3 * * *",
  cleanup_support_reports: "35 3 * * *",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readStringArray = (
  value: unknown,
  fieldName: string,
): string[] => {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string")
  ) {
    throw new Error(`${fieldName} должен быть массивом строк.`);
  }
  return value;
};

export const parseRecoveryDatabaseReport = (
  value: unknown,
): RecoveryDatabaseReport => {
  if (!isRecord(value) || !isRecord(value.publicTableRowCounts)) {
    throw new Error("Recovery validation report имеет некорректный формат.");
  }

  const publicTableRowCounts: Record<string, number> = {};
  for (const [table, count] of Object.entries(
    value.publicTableRowCounts,
  )) {
    if (
      typeof count !== "number" ||
      !Number.isSafeInteger(count) ||
      count < 0
    ) {
      throw new Error(`Некорректный recovery row count: ${table}.`);
    }
    publicTableRowCounts[table] = count;
  }

  if (!Array.isArray(value.cronJobs)) {
    throw new Error("cronJobs должен быть массивом.");
  }
  const cronJobs = value.cronJobs.map((job) => {
    if (
      !isRecord(job) ||
      typeof job.name !== "string" ||
      typeof job.schedule !== "string" ||
      typeof job.active !== "boolean"
    ) {
      throw new Error("Некорректная запись cronJobs.");
    }
    return {
      name: job.name,
      schedule: job.schedule,
      active: job.active,
    };
  });

  if (
    typeof value.foreignKeyCount !== "number" ||
    !Number.isSafeInteger(value.foreignKeyCount) ||
    value.foreignKeyCount < 0
  ) {
    throw new Error("foreignKeyCount имеет некорректный формат.");
  }
  let latestMigrationVersion: string | null;
  if (value.latestMigrationVersion === null) {
    latestMigrationVersion = null;
  } else if (
    typeof value.latestMigrationVersion === "string" &&
    /^\d+$/.test(value.latestMigrationVersion)
  ) {
    latestMigrationVersion = value.latestMigrationVersion;
  } else {
    throw new Error("latestMigrationVersion имеет некорректный формат.");
  }

  return {
    publicTableRowCounts,
    publicTables: readStringArray(value.publicTables, "publicTables"),
    rlsEnabledTables: readStringArray(
      value.rlsEnabledTables,
      "rlsEnabledTables",
    ),
    protectedRolePrivileges: readStringArray(
      value.protectedRolePrivileges,
      "protectedRolePrivileges",
    ),
    serviceRoleMissingTablePrivileges: readStringArray(
      value.serviceRoleMissingTablePrivileges,
      "serviceRoleMissingTablePrivileges",
    ),
    serverFunctions: readStringArray(
      value.serverFunctions,
      "serverFunctions",
    ),
    insecureServerFunctions: readStringArray(
      value.insecureServerFunctions,
      "insecureServerFunctions",
    ),
    serviceRoleMissingFunctions: readStringArray(
      value.serviceRoleMissingFunctions,
      "serviceRoleMissingFunctions",
    ),
    extensions: readStringArray(value.extensions, "extensions"),
    cronJobs,
    indexes: readStringArray(value.indexes, "indexes"),
    triggers: readStringArray(value.triggers, "triggers"),
    foreignKeyCount: value.foreignKeyCount,
    latestMigrationVersion,
  };
};

const missingValues = (
  expected: readonly string[],
  actual: string[],
): string[] => expected.filter((value) => !actual.includes(value));

export const validateRecoveryDatabaseReport = (
  manifest: SnapshotManifest,
  report: RecoveryDatabaseReport,
): string[] => {
  const errors: string[] = [];
  const missingTables = missingValues(
    EXPECTED_PUBLIC_TABLES,
    report.publicTables,
  );
  if (missingTables.length > 0) {
    errors.push(
      `Не восстановлены public tables: ${missingTables.join(", ")}.`,
    );
  }

  for (const table of EXPECTED_PUBLIC_TABLES) {
    const actualCount = report.publicTableRowCounts[table];
    const expectedCount =
      manifest.publicTableRowCounts[table as ExpectedPublicTable];
    if (actualCount !== expectedCount) {
      errors.push(
        `public.${table}: ожидалось ${expectedCount} строк, получено ${actualCount ?? "missing"}.`,
      );
    }
  }

  const missingRls = missingValues(
    PROTECTED_PUBLIC_TABLES,
    report.rlsEnabledTables,
  );
  if (missingRls.length > 0) {
    errors.push(`RLS выключен: ${missingRls.join(", ")}.`);
  }
  if (report.protectedRolePrivileges.length > 0) {
    errors.push(
      `anon/authenticated имеют доступ к protected tables: ${report.protectedRolePrivileges.join(", ")}.`,
    );
  }
  if (report.serviceRoleMissingTablePrivileges.length > 0) {
    errors.push(
      `service_role не имеет полного table access: ${report.serviceRoleMissingTablePrivileges.join(", ")}.`,
    );
  }

  const missingFunctions = missingValues(
    REQUIRED_SERVER_FUNCTIONS,
    report.serverFunctions,
  );
  if (missingFunctions.length > 0) {
    errors.push(
      `Не восстановлены server functions: ${missingFunctions.join(", ")}.`,
    );
  }
  if (report.insecureServerFunctions.length > 0) {
    errors.push(
      `anon/authenticated могут вызвать server-only functions: ${report.insecureServerFunctions.join(", ")}.`,
    );
  }
  if (report.serviceRoleMissingFunctions.length > 0) {
    errors.push(
      `service_role не может вызвать functions: ${report.serviceRoleMissingFunctions.join(", ")}.`,
    );
  }

  const missingExtensions = missingValues(
    REQUIRED_EXTENSIONS,
    report.extensions,
  );
  if (missingExtensions.length > 0) {
    errors.push(
      `Не восстановлены extensions: ${missingExtensions.join(", ")}.`,
    );
  }

  for (const jobName of REQUIRED_CRON_JOBS) {
    const job = report.cronJobs.find(({ name }) => name === jobName);
    if (!job) {
      errors.push(`Не восстановлен cron job ${jobName}.`);
    } else if (job.schedule !== CRON_SCHEDULES[jobName]) {
      errors.push(
        `${jobName}: ожидалось расписание ${CRON_SCHEDULES[jobName]}, получено ${job.schedule}.`,
      );
    } else if (job.active) {
      errors.push(
        `${jobName} должен оставаться inactive во время recovery-drill.`,
      );
    }
  }

  const missingIndexes = missingValues(REQUIRED_INDEXES, report.indexes);
  if (missingIndexes.length > 0) {
    errors.push(`Не восстановлены indexes: ${missingIndexes.join(", ")}.`);
  }
  const missingTriggers = missingValues(
    REQUIRED_TRIGGERS,
    report.triggers,
  );
  if (missingTriggers.length > 0) {
    errors.push(
      `Не восстановлены triggers: ${missingTriggers.join(", ")}.`,
    );
  }
  if (report.foreignKeyCount < 1) {
    errors.push("В public schema не найдены foreign keys.");
  }
  if (
    report.latestMigrationVersion !== manifest.latestMigrationVersion
  ) {
    errors.push(
      `Migration history не совпадает: ожидалось ${manifest.latestMigrationVersion}, получено ${report.latestMigrationVersion ?? "missing"}.`,
    );
  }

  return errors;
};
