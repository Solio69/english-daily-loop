import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { sanitizeClientLogDetails } from '../src/services/clientLogger.ts'
import { getSafeErrorDetails } from '../supabase/functions/_shared/server.ts'
import {
  getSupportReportByteLength,
  prepareSupportReport,
  sanitizeSupportDiagnostics,
  sanitizeSupportDiagnosticString,
  SUPPORT_REPORT_MAX_BYTES,
} from '../supabase/functions/submit-support-report/sanitize-diagnostics.ts'

const readSource = (path: string): string => readFileSync(path, 'utf8')

const userTypeSource = readSource('src/types/user.ts')
const userServiceSource = readSource('src/services/userService.ts')
const supportContextSource = readSource('src/services/supportAppContext.ts')
const supportModalSource = readSource(
  'src/components/settings/SupportReportCard.tsx',
)
const authSource = readSource('supabase/functions/auth-telegram/index.ts')
const settingsSource = readSource(
  'supabase/functions/save-user-settings/index.ts',
)
const profileRepositorySource = readSource(
  'supabase/functions/_shared/user-profile-repository.ts',
)
const profileResponseSource = readSource(
  'supabase/functions/_shared/user-profile-response.ts',
)
const supportFunctionSource = readSource(
  'supabase/functions/submit-support-report/index.ts',
)
const serverSource = readSource('supabase/functions/_shared/server.ts')
const seedSource = readSource('supabase/seed.sql')
const migrationSource = readSource(
  'supabase/migrations/20260727120000_prepare_personal_data_minimization.sql',
)

const edgeLogSources = [
  'supabase/functions/_shared/app.ts',
  'supabase/functions/_shared/user-profile-repository.ts',
  'supabase/functions/activate-subscription/index.ts',
  'supabase/functions/approve-vocabulary-card/index.ts',
  'supabase/functions/approve-vocabulary-cards/index.ts',
  'supabase/functions/auth-telegram/index.ts',
  'supabase/functions/complete-reading-text/index.ts',
  'supabase/functions/dev-tools/index.ts',
  'supabase/functions/delete-pending-vocabulary-word/index.ts',
  'supabase/functions/generate-reading-text/index.ts',
  'supabase/functions/get-reading-history/index.ts',
  'supabase/functions/get-reading-state/index.ts',
  'supabase/functions/get-vocabulary-review-state/index.ts',
  'supabase/functions/get-vocabulary-state/index.ts',
  'supabase/functions/get-vocabulary-words/index.ts',
  'supabase/functions/prepare-vocabulary-cards/index.ts',
  'supabase/functions/review-vocabulary-word/index.ts',
  'supabase/functions/save-reading-position/index.ts',
  'supabase/functions/save-user-settings/index.ts',
  'supabase/functions/save-vocabulary-word/index.ts',
  'supabase/functions/submit-support-report/index.ts',
].map(readSource)

const getConsoleCalls = (source: string): string[] =>
  source.match(/console\.(?:log|info|warn|error)\([\s\S]*?\);/g) ?? []

test('frontend user contracts and mappings do not contain Telegram ids', () => {
  const frontendUserSources = `${userTypeSource}\n${userServiceSource}`

  assert.doesNotMatch(frontendUserSources, /telegramUserId|telegram_user_id/)
  assert.match(userServiceSource, /requireAuthProfile/)
  assert.match(userServiceSource, /\.\.\.response\.user/)
})

test('auth and settings responses expose the internal profile without Telegram ids', () => {
  assert.doesNotMatch(profileResponseSource, /telegramUserId|telegram_user_id/)
  assert.match(profileResponseSource, /firstName:\s*user\.first_name/)
  assert.match(authSource, /getAuthProfileResponse/)
  assert.match(settingsSource, /getSavedSettingsResponse/)
})

test('auth stores only the minimal Telegram profile', () => {
  const upsertStart = profileRepositorySource.indexOf('.upsert(')
  const upsertEnd = profileRepositorySource.indexOf(
    "onConflict: 'telegram_user_id'",
  )
  assert.ok(upsertStart >= 0)
  assert.ok(upsertEnd > upsertStart)

  const userUpsert = profileRepositorySource.slice(upsertStart, upsertEnd)
  assert.match(userUpsert, /telegram_user_id:\s*telegramUserId/)
  assert.match(userUpsert, /first_name:\s*firstName/)
  assert.match(userUpsert, /is_active:\s*true/)
  assert.doesNotMatch(userUpsert, /username|last_name|language_code/)

  assert.doesNotMatch(seedSource, /username|last_name|language_code/)
})

test('support reports use only the internal user id for identity', () => {
  assert.match(supportFunctionSource, /\.select\("id, app_role"\)/)
  assert.match(supportFunctionSource, /user_id:\s*appUser\.id/)
  assert.doesNotMatch(supportFunctionSource, /telegram_user_id:\s*appUser/)
  assert.doesNotMatch(supportContextSource, /telegramUserId/)
})

test('support diagnostics remove direct Telegram ids before persistence', () => {
  const telegramUserId = 987654321
  const sanitized = sanitizeSupportDiagnostics(
    {
      appContext: {
        appVersion: '1.2.3',
        appUserId: 'app-user-uuid',
        telegramColorScheme: 'dark',
        telegramUserId,
        unexpectedTopLevel: 'dropped by whitelist',
        settings: {
          telegram_user_id: String(telegramUserId),
          arbitraryValue: telegramUserId,
          englishLevel: 'B1',
        },
      },
      events: [
        {
          type: 'navigation',
          telegramUserId,
          nested: {
            telegram_user_id: telegramUserId,
            arbitraryValue: `user=${telegramUserId}`,
            safeValue: 'reading',
          },
        },
      ],
      requestIds: [
        'req_safe-request',
        String(telegramUserId),
        `req_${telegramUserId}`,
      ],
      aiDiagnostics: [
        {
          stage: 'provider_request',
          nested: [{ telegram_user_id: telegramUserId }],
          arbitraryValue: telegramUserId,
        },
      ],
    },
    telegramUserId,
  )
  const currentScreen = sanitizeSupportDiagnosticString(
    `reading/${telegramUserId}`,
    telegramUserId,
    80,
  )

  const serialized = JSON.stringify({ ...sanitized, currentScreen })
  assert.doesNotMatch(serialized, new RegExp(String(telegramUserId)))
  assert.doesNotMatch(serialized, /telegramUserId|telegram_user_id/)
  assert.equal(sanitized.appContext.appUserId, 'app-user-uuid')
  assert.equal(sanitized.appContext.telegramColorScheme, 'dark')
  assert.equal(sanitized.appContext.unexpectedTopLevel, undefined)
  assert.deepEqual(sanitized.requestIds, ['req_safe-request'])
})

test('client diagnostics keep prompt version and redact prompt content', () => {
  const sanitized = sanitizeClientLogDetails({
    requestId: 'req_safe-request',
    diagnostics: {
      promptVersion: 'vocabulary-card-v1',
      prompt: 'synthetic full prompt',
      rawPrompt: 'synthetic raw prompt',
      promptText: 'synthetic prompt text',
      promptVersions: 'must not use the safe-key exception',
      token: 'synthetic-token',
    },
  })
  const diagnostics = sanitized?.diagnostics as Record<string, unknown>

  assert.equal(diagnostics.promptVersion, 'vocabulary-card-v1')
  assert.equal(diagnostics.prompt, '[redacted]')
  assert.equal(diagnostics.rawPrompt, '[redacted]')
  assert.equal(diagnostics.promptText, '[redacted]')
  assert.equal(diagnostics.promptVersions, '[redacted]')
  assert.equal(diagnostics.token, '[redacted]')
  assert.equal(sanitized?.requestId, 'req_safe-request')
})

test('server diagnostics keep prompt version and redact prompt content', () => {
  const sanitized = sanitizeSupportDiagnostics(
    {
      appContext: {},
      events: [],
      requestIds: ['req_safe-request'],
      aiDiagnostics: [
        {
          promptVersion: 'vocabulary-card-v1',
          prompt: 'synthetic full prompt',
          rawPrompt: 'synthetic raw prompt',
          promptText: 'synthetic prompt text',
          promptVersions: 'must not use the safe-key exception',
          secret: 'synthetic-secret',
        },
      ],
    },
    987654321,
  )
  const diagnostics = sanitized.aiDiagnostics[0] as Record<string, unknown>

  assert.equal(diagnostics.promptVersion, 'vocabulary-card-v1')
  assert.equal(diagnostics.prompt, '[redacted]')
  assert.equal(diagnostics.rawPrompt, '[redacted]')
  assert.equal(diagnostics.promptText, '[redacted]')
  assert.equal(diagnostics.promptVersions, '[redacted]')
  assert.equal(diagnostics.secret, '[redacted]')
  assert.deepEqual(sanitized.requestIds, ['req_safe-request'])
})

test('support diagnostics cap object keys and reject malformed request ids', () => {
  const telegramUserId = 987654321
  const oversizedEvent = Object.fromEntries([
    [`owner_${telegramUserId}`, `user=${telegramUserId}`],
    ...Array.from({ length: 100 }, (_, index) => [
      `safeField${index}`,
      `value-${index}`,
    ]),
  ])
  const sanitized = sanitizeSupportDiagnostics(
    {
      appContext: {},
      events: [oversizedEvent],
      requestIds: [
        'short',
        'request id with spaces',
        'req_safe-request',
        `req_${telegramUserId}`,
      ],
      aiDiagnostics: [],
    },
    telegramUserId,
  )

  assert.equal(
    Object.keys(sanitized.events[0] as Record<string, unknown>).length,
    50,
  )
  assert.deepEqual(sanitized.requestIds, ['req_safe-request'])
  assert.doesNotMatch(
    JSON.stringify(sanitized),
    new RegExp(String(telegramUserId)),
  )
})

test('prepared support report always fits the persistence budget', () => {
  const telegramUserId = 987654321
  const largeDiagnostic = Object.fromEntries(
    Array.from({ length: 50 }, (_, index) => [
      `safeField${index}`,
      'x'.repeat(500),
    ]),
  )
  const prepared = prepareSupportReport({
    currentScreen: `reading/${telegramUserId}`,
    userComment: 'Проверка большого отчета',
    appContext: {
      appVersion: '1.2.3',
      settings: largeDiagnostic,
    },
    events: Array.from({ length: 10 }, () => largeDiagnostic),
    requestIds: Array.from(
      { length: 50 },
      (_, index) => `req_safe-request-${index}`,
    ),
    aiDiagnostics: Array.from({ length: 10 }, () => largeDiagnostic),
    telegramUserId,
  })

  assert.ok(getSupportReportByteLength(prepared) <= SUPPORT_REPORT_MAX_BYTES)
  assert.doesNotMatch(
    JSON.stringify(prepared),
    new RegExp(String(telegramUserId)),
  )
})

test('preparation migration is compatible and does not remove data', () => {
  assert.match(
    migrationSource,
    /alter table public\.support_reports\s+alter column telegram_user_id drop not null;/,
  )
  assert.doesNotMatch(
    migrationSource,
    /\bdrop\s+column\b|\bdelete\s+from\b|\bupdate\b|\btruncate\b/i,
  )
})

test('application console calls do not include direct Telegram ids', () => {
  const consoleCalls = edgeLogSources.flatMap(getConsoleCalls)
  assert.ok(consoleCalls.length > 0)

  for (const consoleCall of consoleCalls) {
    assert.doesNotMatch(consoleCall, /(?:telegramUserId|telegram_user_id)\s*:/)

    if (/failed to (?:load|find|create) user["`]/.test(consoleCall)) {
      assert.match(consoleCall, /requestId/)
      assert.match(consoleCall, /stage:/)
      assert.match(consoleCall, /getSafeErrorDetails/)
    }
  }

  assert.match(serverSource, /errorCode:/)
  assert.match(serverSource, /errorMessage:/)
})

test('safe server diagnostics keep the DB reason and redact Telegram ids', () => {
  const telegramUserId = 987654321
  const details = getSafeErrorDetails(
    {
      code: 'PGRST116',
      message: `Database lookup failed for telegram_user_id=${telegramUserId}`,
    },
    [telegramUserId],
  )

  assert.equal(details.errorCode, 'PGRST116')
  assert.match(details.errorMessage, /Database lookup failed/)
  assert.doesNotMatch(
    JSON.stringify(details),
    new RegExp(String(telegramUserId)),
  )
})

test('support modal shows the agreed personal data warning', () => {
  const normalizedSource = supportModalSource.replace(/\s+/g, ' ')
  assert.match(
    normalizedSource,
    /Не указывай пароли, контакты и другие личные данные\. Отправим технический отчет без токенов и полного текста\./,
  )
})
