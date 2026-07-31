$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$backupRoot = "D:\Backups\english-daily-loop\production"
$configPath = Join-Path $backupRoot "config\backup-config.json"
$credentialPath = Join-Path $backupRoot "config\database-password.dpapi"
$bstr = [IntPtr]::Zero
$plainPassword = $null

try {
  if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
    throw "Backup config is missing. Run the backup setup first."
  }
  if (-not (Test-Path -LiteralPath $credentialPath -PathType Leaf)) {
    throw "DPAPI database credential is missing."
  }

  $config = (
    Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 |
      ConvertFrom-Json
  )
  $currentIdentity = (
    [System.Security.Principal.WindowsIdentity]::GetCurrent()
  ).Name
  if ($config.windowsIdentity -ne $currentIdentity) {
    throw "Current Windows user cannot decrypt this backup credential."
  }

  $repositoryRoot = [System.IO.Path]::GetFullPath(
    (Join-Path $PSScriptRoot "..\..")
  )
  if (
    [System.IO.Path]::GetFullPath($config.repositoryRoot) -ne
    $repositoryRoot
  ) {
    throw "Repository path differs from the backup config."
  }

  foreach ($executable in @(
    $config.nodeExecutable,
    $config.dockerExecutable
  )) {
    if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
      throw "Required executable is missing: $executable"
    }
  }

  $encryptedPassword = (
    Get-Content -LiteralPath $credentialPath -Raw -Encoding UTF8
  ).Trim()
  $securePassword = ConvertTo-SecureString -String $encryptedPassword
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
    $securePassword
  )
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
    $bstr
  )

  $nodeDirectory = Split-Path -Parent $config.nodeExecutable
  $dockerDirectory = Split-Path -Parent $config.dockerExecutable
  $env:PATH = (
    $nodeDirectory +
    [IO.Path]::PathSeparator +
    $dockerDirectory +
    [IO.Path]::PathSeparator +
    $env:PATH
  )
  $env:SUPABASE_DB_PASSWORD = $plainPassword
  $env:ENGLISH_DAILY_LOOP_PRODUCTION_BACKUP = "read-only-confirmed"
  $env:ENGLISH_DAILY_LOOP_WINDOWS_IDENTITY = $currentIdentity

  $tsxCli = Join-Path $repositoryRoot "node_modules\tsx\dist\cli.mjs"
  $backupWorker = Join-Path $PSScriptRoot "production-backup.ts"
  if (-not (Test-Path -LiteralPath $tsxCli -PathType Leaf)) {
    throw "tsx CLI is missing. Project dependencies are not ready."
  }

  & $config.nodeExecutable $tsxCli $backupWorker
  $workerExitCode = $LASTEXITCODE
  if ($workerExitCode -ne 0) {
    exit $workerExitCode
  }
}
catch {
  Write-Error $_.Exception.Message
  exit 1
}
finally {
  Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item `
    Env:ENGLISH_DAILY_LOOP_PRODUCTION_BACKUP `
    -ErrorAction SilentlyContinue
  Remove-Item `
    Env:ENGLISH_DAILY_LOOP_WINDOWS_IDENTITY `
    -ErrorAction SilentlyContinue
  $plainPassword = $null
  if ($bstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}
