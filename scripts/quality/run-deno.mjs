import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

const localDeno = path.resolve('tools/deno/deno.exe')
const executable =
  process.platform === 'win32' && existsSync(localDeno) ? localDeno : 'deno'

const functionsDirectory = path.resolve('supabase/functions')
const functionDirectories = readdirSync(functionsDirectory, {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(functionsDirectory, entry.name))
  .filter((directory) => existsSync(path.join(directory, 'index.ts')))
  .sort()

const checks = [
  ...functionDirectories.map((directory) => ({
    args: ['check', '--node-modules-dir=manual', 'index.ts'],
    cwd: directory,
  })),
  { args: ['lint', 'supabase/functions'] },
  { args: ['test', '--no-prompt', 'supabase/functions/_shared'] },
]

for (const { args, cwd } of checks) {
  const result = spawnSync(executable, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1
    break
  }
}
