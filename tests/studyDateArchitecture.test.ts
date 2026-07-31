import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const migrationPath = path.join(
  projectRoot,
  "supabase",
  "migrations",
  "20260723120000_add_moscow_study_day_and_carry_active_text.sql",
);

const readProjectFile = (...segments: string[]): string =>
  readFileSync(path.join(projectRoot, ...segments), "utf8");

const listSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? listSourceFiles(entryPath)
      : /\.(?:ts|tsx)$/.test(entry.name)
        ? [entryPath]
        : [];
  });

const getSqlFunctionDefinition = (
  migration: string,
  functionName: string,
): string => {
  const escapedName = functionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = migration.match(
    new RegExp(
      `create or replace function public\\.${escapedName}\\([\\s\\S]*?\\n\\$\\$;`,
      "i",
    ),
  );

  assert.ok(match, `SQL definition ${functionName} must exist`);
  return match[0];
};

test("production TypeScript does not use the legacy calendar-date helper", () => {
  const sourceFiles = [
    ...listSourceFiles(path.join(projectRoot, "src")),
    ...listSourceFiles(path.join(projectRoot, "supabase", "functions")),
  ];

  for (const sourcePath of sourceFiles) {
    const source = readFileSync(sourcePath, "utf8");
    const relativePath = path.relative(projectRoot, sourcePath);
    assert.doesNotMatch(source, /getMoscowDate|moscow-date/);
    assert.ok(
      !source.includes('.eq("reading_date"'),
      `${relativePath} must not scope active text by generation date`,
    );
  }
});

test("study-date SQL formula has one server-only source of truth", () => {
  const migration = readFileSync(migrationPath, "utf8");
  const formulaOccurrences =
    migration.match(/at time zone 'Europe\/Moscow'/gi)?.length ?? 0;

  assert.equal(formulaOccurrences, 1);
  assert.match(
    migration,
    /revoke all on function public\.get_moscow_study_date\(timestamptz\)\s+from public, anon, authenticated;/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.get_moscow_study_date\(timestamptz\)\s+to service_role;/i,
  );

  const databaseClockContracts = [
    {
      functionName: "complete_daily_reading_text",
      expected:
        /v_completed_date := public\.get_moscow_study_date\(v_completed_at\)/i,
    },
    {
      functionName: "get_or_create_vocabulary_review_state",
      expected: /v_review_date := public\.get_moscow_study_date\(v_now\)/i,
    },
    {
      functionName: "review_vocabulary_word",
      expected: /v_review_date := public\.get_moscow_study_date\(v_now\)/i,
    },
    {
      functionName: "dev_complete_vocabulary_reviews_at_step",
      expected: /v_review_date := public\.get_moscow_study_date\(v_now\)/i,
    },
  ] as const;

  for (const { functionName, expected } of databaseClockContracts) {
    const definition = getSqlFunctionDefinition(migration, functionName);
    assert.match(definition, expected);
  }

  for (const functionName of [
    "get_or_create_vocabulary_review_state",
    "review_vocabulary_word",
    "dev_complete_vocabulary_reviews_at_step",
  ]) {
    const definition = getSqlFunctionDefinition(migration, functionName);
    assert.match(
      definition,
      /public\.get_moscow_study_date\(last_reviewed_at\) = v_review_date/i,
    );
    assert.doesNotMatch(
      definition,
      /last_reviewed_at at time zone 'Europe\/Moscow'/i,
    );
    assert.doesNotMatch(definition, /review_date = p_review_date/i);
  }
});

test("active-text RPCs preserve ownership, row locks, and date-independent carry", () => {
  const migration = readFileSync(migrationPath, "utf8");
  const completion = getSqlFunctionDefinition(
    migration,
    "complete_daily_reading_text",
  );
  const vocabularySave = getSqlFunctionDefinition(
    migration,
    "save_pending_vocabulary_word_with_source",
  );

  for (const definition of [completion, vocabularySave]) {
    assert.match(definition, /pg_advisory_xact_lock/i);
    assert.match(definition, /where user_id = p_user_id/i);
    assert.match(definition, /for update;/i);
  }

  assert.doesNotMatch(completion, /reading_date = p_completed_date/i);
  assert.match(
    completion,
    /and reading_text_id = v_active_text\.reading_text_id/i,
  );
  assert.match(
    vocabularySave,
    /and reading_text_id = p_reading_text_id/i,
  );
  assert.doesNotMatch(vocabularySave, /reading_date = p_reading_date/i);
});

test("generation replaces active text only after a valid AI result", () => {
  const source = readProjectFile(
    "supabase",
    "functions",
    "generate-reading-text",
    "index.ts",
  );
  const generationIndex = source.indexOf(
    "await generateReadingTextWithOpenRouter",
  );
  const upsertIndex = source.indexOf('.from("user_active_reading_texts")');

  assert.ok(generationIndex >= 0);
  assert.ok(upsertIndex > generationIndex);
  assert.doesNotMatch(
    source.slice(0, upsertIndex),
    /\.from\("user_active_reading_texts"\)[\s\S]*?\.delete\(/,
  );
});

test("mutation responses keep post-processing on the database study date", () => {
  const completionSource = readProjectFile(
    "supabase",
    "functions",
    "complete-reading-text",
    "index.ts",
  );
  const reviewSource = readProjectFile(
    "supabase",
    "functions",
    "review-vocabulary-word",
    "index.ts",
  );

  assert.match(
    completionSource,
    /getPostReadingCompletionMetrics\(\s*supabase,\s*appUser\.id,\s*completion\.completedDate,/,
  );
  assert.match(reviewSource, /reviewDate:\s*result\.reviewDate/);
});
