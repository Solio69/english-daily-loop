import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

const readProjectFile = (...segments: string[]): string =>
  readFileSync(path.join(projectRoot, ...segments), 'utf8')

const migration = readProjectFile(
  'supabase',
  'migrations',
  '20260813120000_add_pending_vocabulary_word_deletion.sql',
)
const persistenceMigration = readProjectFile(
  'supabase',
  'migrations',
  '20260813150000_add_atomic_vocabulary_card_persistence.sql',
)
const originalVocabularyMigration = readProjectFile(
  'supabase',
  'migrations',
  '20260511120000_add_vocabulary_word_saving.sql',
)
const deleteFunction = readProjectFile(
  'supabase',
  'functions',
  'delete-pending-vocabulary-word',
  'index.ts',
)
const readingStateFunction = readProjectFile(
  'supabase',
  'functions',
  'get-reading-state',
  'reading-state-service.ts',
)
const readingStateRepository = readProjectFile(
  'supabase',
  'functions',
  'get-reading-state',
  'reading-state-repository.ts',
)
const cardPersistence = readProjectFile(
  'supabase',
  'functions',
  'prepare-vocabulary-cards',
  'card-persistence.ts',
)
const prepareFunction = readProjectFile(
  'supabase',
  'functions',
  'prepare-vocabulary-cards',
  'index.ts',
)
const devConfig = readProjectFile('scripts', 'dev', 'config.mjs')

test('pending vocabulary deletion RPC owns and locks the exact server-side target', () => {
  assert.match(
    migration,
    /create or replace function public\.delete_pending_vocabulary_word_with_sources\(\s*p_user_id uuid,\s*p_reading_text_id uuid,\s*p_word_index int\s*\)/i,
  )
  assert.match(migration, /security definer\s+set search_path = public/i)
  assert.match(
    migration,
    /pg_advisory_xact_lock\([\s\S]*'vocabulary-word-save'/i,
  )
  assert.match(
    migration,
    /from public\.user_active_reading_texts[\s\S]*user_id = p_user_id[\s\S]*reading_text_id = p_reading_text_id[\s\S]*for update/i,
  )
  assert.match(
    migration,
    /from public\.user_vocabulary_word_sources as source[\s\S]*join public\.user_vocabulary_words as vocabulary_word[\s\S]*source\.user_id = p_user_id[\s\S]*source\.word_index = p_word_index[\s\S]*for update of source, vocabulary_word/i,
  )
  assert.match(migration, /if v_card_status <> 'pending' then/i)
  assert.match(
    migration,
    /delete from public\.user_vocabulary_words[\s\S]*id = v_word_id[\s\S]*user_id = p_user_id[\s\S]*card_status = 'pending'/i,
  )
  assert.match(migration, /array_agg\(word_index order by word_index\)/i)
  assert.match(
    originalVocabularyMigration,
    /word_id uuid not null references public\.user_vocabulary_words\(id\) on delete cascade/i,
  )
})

test('pending vocabulary deletion RPC remains service-role only', () => {
  assert.match(
    migration,
    /revoke all on function public\.delete_pending_vocabulary_word_with_sources\([\s\S]*from public, anon, authenticated;/i,
  )
  assert.match(
    migration,
    /grant execute on function public\.delete_pending_vocabulary_word_with_sources\([\s\S]*to service_role;/i,
  )
})

test('delete Edge Function derives ownership and status on the server', () => {
  assert.match(deleteFunction, /getTelegramUserFromBody/)
  assert.match(deleteFunction, /getAppUserByTelegramId/)
  assert.match(deleteFunction, /\.eq\("user_id", appUser\.id\)/)
  assert.match(deleteFunction, /delete_pending_vocabulary_word_with_sources/)
  assert.match(deleteFunction, /p_user_id: params\.userId/)
  assert.match(deleteFunction, /p_reading_text_id: params\.readingTextId/)
  assert.match(deleteFunction, /p_word_index: params\.wordIndex/)
  assert.doesNotMatch(
    deleteFunction,
    /body\?\.(?:word(?!Index)|wordId|userId|cardStatus)/,
  )
})

test('local Telegram dev stack serves the delete Edge Function', () => {
  assert.match(
    devConfig,
    /edgeFunctionNames\s*=\s*\[[\s\S]*"delete-pending-vocabulary-word"/,
  )
})

test('delete Edge Function accepts only an explicit numeric word index', () => {
  assert.match(
    deleteFunction,
    /typeof value !== "number" \|\| !Number\.isInteger\(value\) \|\| value < 0/,
  )
  assert.doesNotMatch(deleteFunction, /Number\(value\)/)
})

test('reading state keeps saved indexes and adds optional pending indexes', () => {
  assert.match(readingStateFunction, /savedWordIndexes/)
  assert.match(readingStateFunction, /pendingSavedWordIndexes/)
  assert.match(readingStateRepository, /\.eq\(DB\.cardStatus, DB\.pending\)/)
})

test('generated card persistence is atomic and service-role only', () => {
  assert.match(
    persistenceMigration,
    /create or replace function public\.persist_generated_vocabulary_card\(/i,
  )
  assert.match(
    persistenceMigration,
    /security definer\s+set search_path = public/i,
  )
  assert.match(
    persistenceMigration,
    /pg_advisory_xact_lock\([\s\S]*'vocabulary-word-save'/i,
  )
  assert.match(
    persistenceMigration,
    /from public\.user_vocabulary_words[\s\S]*id = p_pending_word_id[\s\S]*for update/i,
  )
  assert.match(
    persistenceMigration,
    /if not found or v_pending_word\.card_status <> 'pending' then[\s\S]*'cancelled', true/i,
  )
  assert.match(
    persistenceMigration,
    /from public\.user_vocabulary_words[\s\S]*lower\(word\) = lower\(btrim\(p_word\)\)[\s\S]*for update/i,
  )
  assert.match(
    persistenceMigration,
    /update public\.user_vocabulary_word_sources[\s\S]*set word_id = v_existing_word\.id[\s\S]*delete from public\.user_vocabulary_words/i,
  )
  assert.match(
    persistenceMigration,
    /revoke all on function public\.persist_generated_vocabulary_card\([\s\S]*from public, anon, authenticated;/i,
  )
  assert.match(
    persistenceMigration,
    /grant execute on function public\.persist_generated_vocabulary_card\([\s\S]*to service_role;/i,
  )
  assert.match(cardPersistence, /\.rpc\(\s*"persist_generated_vocabulary_card"/)
  assert.doesNotMatch(
    cardPersistence,
    /\.from\("user_vocabulary_(?:words|word_sources)"\)/,
  )
  assert.match(
    prepareFunction,
    /if \(saveResult\.cancelled\)[\s\S]*cancelledCount \+= 1;[\s\S]*continue;/,
  )
  assert.match(prepareFunction, /cancelledCount,/)
})
