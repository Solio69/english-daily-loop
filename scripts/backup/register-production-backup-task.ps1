param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$backupRoot = "D:\Backups\english-daily-loop\production"
$configPath = Join-Path $backupRoot "config\backup-config.json"
$taskName = "English Daily Loop Production Backup"

if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
  throw "Backup config is missing. Run the backup setup first."
}

$config = (
  Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 |
    ConvertFrom-Json
)
$currentIdentity = (
  [System.Security.Principal.WindowsIdentity]::GetCurrent()
).Name
if ($config.windowsIdentity -ne $currentIdentity) {
  throw "Current Windows user differs from the backup config owner."
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

$existingTask = Get-ScheduledTask `
  -TaskName $taskName `
  -ErrorAction SilentlyContinue
if ($null -ne $existingTask -and -not $Force) {
  throw (
    "Scheduled task already exists. Use -Force only when you " +
    "intentionally replace its definition."
  )
}

$wrapperPath = Join-Path $PSScriptRoot "run-production-backup.ps1"
$actionArguments = (
  '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' +
  $wrapperPath +
  '"'
)
$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument $actionArguments `
  -WorkingDirectory $repositoryRoot
$triggerTime = [DateTime]::ParseExact(
  $config.scheduleLocalTime,
  "HH:mm",
  [Globalization.CultureInfo]::InvariantCulture
)
$trigger = New-ScheduledTaskTrigger -Daily -At $triggerTime
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 30) `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
  -MultipleInstances IgnoreNew `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -RunOnlyIfNetworkAvailable
$principal = New-ScheduledTaskPrincipal `
  -UserId $currentIdentity `
  -LogonType Interactive `
  -RunLevel Limited

$registerArguments = @{
  TaskName = $taskName
  Action = $action
  Trigger = $trigger
  Settings = $settings
  Principal = $principal
  Description = (
    "Creates a read-only logical backup of the English Daily Loop " +
    "production Supabase database."
  )
}
if ($Force) {
  $registerArguments.Force = $true
}

Register-ScheduledTask @registerArguments | Out-Null
Write-Host (
  "Scheduled task registered: $taskName at " +
  "$($config.scheduleLocalTime)."
)
Write-Host "StartWhenAvailable and three 30-minute retries are enabled."
