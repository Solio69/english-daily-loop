import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  'supabase/migrations/20261020120000_atomic_support_report_submission.sql',
  'utf8',
)
const handler = readFileSync(
  'supabase/functions/submit-support-report/index.ts',
  'utf8',
)
const repository = readFileSync(
  'supabase/functions/submit-support-report/support-report-repository.ts',
  'utf8',
)

test('support report RPC locks one user before the rolling count and insert', () => {
  const lock = migration.indexOf('for update;')
  const timestamp = migration.indexOf('v_now := clock_timestamp();')
  const count = migration.indexOf('select count(*)')
  const insert = migration.indexOf('insert into public.support_reports')

  assert.ok(lock >= 0)
  assert.ok(lock < timestamp)
  assert.ok(timestamp < count)
  assert.ok(count < insert)
  assert.match(migration, /created_at > v_now - interval '1 hour'/)
  assert.match(migration, /created_at <= v_now/)
  assert.match(migration, /if v_report_count >= 5 then/)
  assert.match(migration, /\(v_now at time zone 'Europe\/Moscow'\)::date/)
  assert.match(migration, /v_now\s*\)\s*returning id/)
})

test('support report RPC remains service-only and the handler makes one save call', () => {
  assert.match(migration, /security definer\s+set search_path = ''/)
  assert.match(
    migration,
    /revoke all on function public\.submit_support_report\([\s\S]*?from public, anon, authenticated;/,
  )
  assert.match(
    migration,
    /grant execute on function public\.submit_support_report\([\s\S]*?to service_role;/,
  )
  assert.match(repository, /\.rpc\('submit_support_report'/)
  assert.match(repository, /p_user_id: user\.id/)
  assert.doesNotMatch(handler, /\.from\('support_reports'\)|\.insert\(/)
  assert.doesNotMatch(repository, /\.from\('support_reports'\)|\.insert\(/)
})
