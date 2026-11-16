import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  checkReleaseArtifacts,
  validateReleaseArtifacts,
} from '../scripts/release-check'
import { currentRelease } from '../src/constants/currentRelease'

const fixtureRelease = {
  version: '1.0.0',
  releasedAt: '2026-09-25',
  items: ['Пример изменения.'],
} as const
const validArtifacts = {
  packageVersion: '1.0.0',
  currentRelease: fixtureRelease,
  changelog: [
    '# Changelog',
    '',
    '## [Unreleased]',
    '',
    '## [1.0.0] - 2026-09-25',
  ].join('\n'),
}

test('current release exposes immutable user-facing entries', () => {
  assert.equal(Object.isFrozen(currentRelease), true)
  assert.equal(Object.isFrozen(currentRelease.items), true)
  assert.ok(currentRelease.items.every((item) => item.trim().length > 0))
})

test('published release matches its changelog entry', () => {
  const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
  )

  const changelog = readFileSync(path.join(projectRoot, 'CHANGELOG.md'), 'utf8')
  assert.deepEqual(
    validateReleaseArtifacts({
      packageVersion: currentRelease.version,
      currentRelease,
      changelog,
    }),
    [],
  )
})

test('release check requires the candidate version to be published', () => {
  const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
  )
  const packageJson = JSON.parse(
    readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
  ) as { version: string }
  const errors = checkReleaseArtifacts(projectRoot)

  if (packageJson.version === currentRelease.version) {
    assert.deepEqual(errors, [])
    return
  }

  assert.deepEqual(errors, [
    `src/constants/currentRelease.ts: version "${currentRelease.version}" не совпадает с package.json version "${packageJson.version}".`,
    `CHANGELOG.md: не найден heading "## [${packageJson.version}] - ${currentRelease.releasedAt}".`,
  ])
})

test('release check reports an invalid package version', () => {
  assert.match(
    validateReleaseArtifacts({
      ...validArtifacts,
      packageVersion: 'v0.1',
    }).join('\n'),
    /package\.json.*MAJOR\.MINOR\.PATCH/,
  )
})

test('release check reports a current release version mismatch', () => {
  assert.match(
    validateReleaseArtifacts({
      ...validArtifacts,
      currentRelease: { ...fixtureRelease, version: '1.0.1' },
    }).join('\n'),
    /currentRelease\.ts.*не совпадает/,
  )
})

test('release check reports an invalid release date', () => {
  assert.match(
    validateReleaseArtifacts({
      ...validArtifacts,
      currentRelease: { ...fixtureRelease, releasedAt: '24.07.2026' },
    }).join('\n'),
    /currentRelease\.ts.*YYYY-MM-DD/,
  )
})

test('release check rejects a day outside the calendar month', () => {
  assert.match(
    validateReleaseArtifacts({
      ...validArtifacts,
      currentRelease: { ...fixtureRelease, releasedAt: '2026-02-30' },
    }).join('\n'),
    /src\/constants\/currentRelease\.ts.*2026-02-30.*календарной датой/,
  )
})

test('release check rejects a month outside the calendar year', () => {
  assert.match(
    validateReleaseArtifacts({
      ...validArtifacts,
      currentRelease: { ...fixtureRelease, releasedAt: '2026-13-01' },
    }).join('\n'),
    /src\/constants\/currentRelease\.ts.*2026-13-01.*календарной датой/,
  )
})

test('release check reports invalid item count and blank items', () => {
  assert.match(
    validateReleaseArtifacts({
      ...validArtifacts,
      currentRelease: { ...fixtureRelease, items: [] },
    }).join('\n'),
    /от 1 до 5/,
  )
  assert.match(
    validateReleaseArtifacts({
      ...validArtifacts,
      currentRelease: { ...fixtureRelease, items: [' '] },
    }).join('\n'),
    /пустые пункты/,
  )
})

test('release check reports missing changelog release heading', () => {
  assert.match(
    validateReleaseArtifacts({
      ...validArtifacts,
      changelog: '## [Unreleased]\n\n## [1.0.0] - 2026-09-24',
    }).join('\n'),
    /CHANGELOG\.md.*1\.0\.0.*2026-09-25/,
  )
})

test('release check reports a missing Unreleased section', () => {
  assert.match(
    validateReleaseArtifacts({
      ...validArtifacts,
      changelog: '## [1.0.0] - 2026-09-25',
    }).join('\n'),
    /CHANGELOG\.md.*Unreleased/,
  )
})
