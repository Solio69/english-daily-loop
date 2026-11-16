# Owner-run only: this command inserts a synthetic user inside pgTAP's rollback transaction.
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$configPath = Join-Path $projectRoot 'supabase\config.toml'
$config = Get-Content -LiteralPath $configPath -Raw
if ($config -notmatch '(?m)^project_id\s*=\s*"english-daily-loop"\s*$') {
  throw 'Supabase project_id is not english-daily-loop; DB test not started.'
}
if ($config -notmatch '(?ms)^\[db\]\s*\r?\n(?:(?!^\[).)*?^port\s*=\s*54322\s*$') {
  throw 'Supabase local DB port is not 54322; DB test not started.'
}

$supabaseCli = Join-Path $projectRoot 'node_modules\.bin\supabase.cmd'
if (-not (Test-Path -LiteralPath $supabaseCli)) {
  throw 'Local Supabase CLI is missing; DB test not started.'
}

Push-Location $projectRoot
try {
  # Supabase may warn about optional stopped services on stderr even when the DB is running.
  # PowerShell 5 treats native stderr as an error when ErrorActionPreference is Stop.
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $statusText = & $supabaseCli status -o json 2>$null
    $statusExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($statusExitCode -ne 0) {
    throw 'Local Supabase stack is not running; DB test not started.'
  }
  $status = ($statusText -join "`n") | ConvertFrom-Json
  $dbUrl = [Uri]$status.DB_URL
  $isExpectedTarget = $dbUrl.Scheme -eq 'postgresql' -and
    $dbUrl.Host -eq '127.0.0.1' -and
    $dbUrl.Port -eq 54322 -and
    $dbUrl.AbsolutePath -eq '/postgres'
  if (-not $isExpectedTarget) {
    throw 'Supabase DB_URL is not the expected local 127.0.0.1:54322/postgres; DB test not started.'
  }

  Write-Output 'Target verified: local english-daily-loop DB on 127.0.0.1:54322.'
  & $supabaseCli test db --local supabase/tests/database/f02_rls.sql
  if ($LASTEXITCODE -ne 0) {
    throw 'Local DB/RLS test failed.'
  }
} finally {
  Pop-Location
}
