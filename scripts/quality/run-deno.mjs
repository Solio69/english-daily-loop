import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const localDeno = path.resolve('tools/deno/deno.exe')
const executable =
  process.platform === 'win32' && existsSync(localDeno) ? localDeno : 'deno'

const result = spawnSync(
  executable,
  ['test', '--no-prompt', 'supabase/functions/_shared'],
  { stdio: 'inherit', shell: false },
)

if (result.error) throw result.error
process.exitCode = result.status ?? 1
