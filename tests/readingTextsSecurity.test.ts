import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PROTECTED_PUBLIC_TABLES } from "../scripts/backup/policy";

const readSource = (path: string): string => readFileSync(path, "utf8");

const migrationSource = readSource(
  "supabase/migrations/20260731120000_harden_reading_texts_access.sql",
);
const recoveryValidationSource = readSource(
  "scripts/backup/recovery-validation.sql",
);

test("reading texts migration enforces the server-only table contract", () => {
  assert.match(
    migrationSource,
    /alter table public\.reading_texts\s+enable row level security;/i,
  );
  assert.match(
    migrationSource,
    /revoke all on table public\.reading_texts\s+from public, anon, authenticated;/i,
  );
  assert.match(
    migrationSource,
    /grant all on table public\.reading_texts\s+to service_role;/i,
  );
});

test("reading texts migration does not copy environment-managed drift", () => {
  assert.doesNotMatch(
    migrationSource,
    /\brls_auto_enable\b|\bensure_rls\b|\bpg_net\b/i,
  );
  assert.doesNotMatch(
    migrationSource,
    /\binsert\b|\bupdate\b|\bdelete\b|\btruncate\b|\bdrop\b/i,
  );
});

test("recovery validation treats reading texts as a protected table", () => {
  assert.ok(PROTECTED_PUBLIC_TABLES.includes("reading_texts"));
  assert.match(
    recoveryValidationSource,
    /protected_tables\(table_name\)[\s\S]*?\('reading_texts'\)/i,
  );
});
