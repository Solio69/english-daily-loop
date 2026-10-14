import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { ESLint } from 'eslint'
import prettier from 'prettier'
import stylelint from 'stylelint'

const projectRoot = path.resolve(import.meta.dirname, '../..')
const baseline = JSON.parse(
  readFileSync(path.join(import.meta.dirname, 'quality-baseline.json'), 'utf8'),
)
const sourceRoots = ['src', 'tests', 'scripts']
const rootFiles = [
  'eslint.config.mjs',
  'package.json',
  '.prettierrc.json',
  '.stylelintrc.json',
  'vite.config.ts',
  'vitest.config.ts',
]

const relativePath = (filePath) =>
  path.relative(projectRoot, filePath).replaceAll('\\', '/')

const contentHash = (filePath) =>
  createHash('sha256')
    .update(readFileSync(filePath, 'utf8').replaceAll('\r\n', '\n'))
    .digest('hex')

const walk = (directory) =>
  readdirSync(path.join(projectRoot, directory), {
    withFileTypes: true,
  }).flatMap((entry) => {
    const next = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(next)
    return entry.isFile() ? [next.replaceAll('\\', '/')] : []
  })

const allFiles = [
  ...sourceRoots.flatMap(walk),
  ...walk('.github/workflows'),
  ...rootFiles,
]

const checkLint = async () => {
  const eslint = new ESLint()
  const results = await eslint.lintFiles([
    'src/**/*.{ts,tsx}',
    'tests/**/*.{ts,tsx}',
    'scripts/**/*.{ts,mjs}',
    'vite.config.ts',
    'vitest.config.ts',
    'eslint.config.mjs',
  ])
  const findings = results.filter((result) => {
    const file = relativePath(result.filePath)
    const knownHash = baseline.lintKnownIssues[file]
    return knownHash !== contentHash(result.filePath)
  })
  const formatter = await eslint.loadFormatter('stylish')
  const report = formatter.format(findings)
  if (report) process.stdout.write(report)
  if (findings.some((result) => result.errorCount > 0)) process.exitCode = 1
}

const checkFormat = async () => {
  const candidates = allFiles.filter((file) =>
    /\.(?:css|js|json|mjs|ts|tsx|ya?ml)$/.test(file),
  )
  const failures = []
  for (const file of candidates) {
    const absolutePath = path.join(projectRoot, file)
    if (baseline.formatUnchanged[file] === contentHash(absolutePath)) continue
    const options = (await prettier.resolveConfig(absolutePath)) ?? {}
    const valid = await prettier.check(readFileSync(absolutePath, 'utf8'), {
      ...options,
      filepath: absolutePath,
    })
    if (!valid) failures.push(file)
  }
  if (failures.length > 0) {
    process.stderr.write(
      `Prettier: исправить формат файлов:\n${failures.join('\n')}\n`,
    )
    process.exitCode = 1
  } else {
    process.stdout.write('Prettier: изменённые и новые файлы проверены\n')
  }
}

const checkStyles = async () => {
  const files = allFiles.filter(
    (file) => file.startsWith('src/') && file.endsWith('.css'),
  )
  const result = await stylelint.lint({ files })
  for (const fileResult of result.results) {
    for (const warning of fileResult.warnings) {
      process.stderr.write(
        `${relativePath(fileResult.source)}:${warning.line}:${warning.column} ${warning.text}\n`,
      )
    }
  }
  if (result.errored) process.exitCode = 1
  else
    process.stdout.write(`Stylelint: проверено CSS-файлов: ${files.length}\n`)
}

const checks = { lint: checkLint, format: checkFormat, styles: checkStyles }
const selectedCheck = checks[process.argv[2]]
if (!selectedCheck) throw new Error('Expected lint, format or styles')
await selectedCheck()
