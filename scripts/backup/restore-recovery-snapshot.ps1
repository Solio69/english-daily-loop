param(
  [Parameter(Mandatory = $true)]
  [string]$SnapshotPath,
  [Parameter(Mandatory = $true)]
  [string]$TargetProjectRef,
  [Parameter(Mandatory = $true)]
  [string]$TargetDbHost,
  [Parameter(Mandatory = $true)]
  [string]$TargetDbUser,
  [int]$TargetDbPort = 5432,
  [string]$TargetDbName = "postgres"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot "recovery-common.ps1")

$password = $null
try {
  $context = Get-RecoveryContext `
    -SnapshotPath $SnapshotPath `
    -TargetProjectRef $TargetProjectRef `
    -TargetDbHost $TargetDbHost `
    -TargetDbUser $TargetDbUser `
    -TargetDbPort $TargetDbPort `
    -TargetDbName $TargetDbName
  $password = Get-RecoveryPlainPassword
  $env:PGPASSWORD = $password.Value

  $snapshotMount = (
    "type=bind,source=" +
    $context.SnapshotPath +
    ",target=/backup,readonly"
  )
  $toolingMount = (
    "type=bind,source=" +
    $PSScriptRoot +
    ",target=/tooling,readonly"
  )
  $connectionArguments = Get-RecoveryPsqlArguments -Context $context
  $dockerArguments = @(
    "run",
    "--rm",
    "--pull=never",
    "--env",
    "PGPASSWORD",
    "--mount",
    $snapshotMount,
    "--mount",
    $toolingMount,
    $context.PostgresImage,
    "psql"
  ) + $connectionArguments

  Write-Host "Restoring roles, schema and application data."
  & $context.Config.dockerExecutable @dockerArguments `
    "--quiet" `
    "--single-transaction" `
    "--file" "/backup/roles.sql" `
    "--command" `
    "ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated" `
    "--file" "/backup/schema.sql" `
    "--command" "SET session_replication_role = replica" `
    "--file" "/backup/data.sql"
  if ($LASTEXITCODE -ne 0) {
    throw "Recovery restore failed before migration history."
  }

  Write-Host "Restoring Supabase migration history."
  & $context.Config.dockerExecutable @dockerArguments `
    "--quiet" `
    "--single-transaction" `
    "--file" "/backup/history_schema.sql" `
    "--file" "/backup/history_data.sql"
  if ($LASTEXITCODE -ne 0) {
    throw "Recovery migration history restore failed."
  }

  Write-Host "Creating disabled recovery cron jobs."
  & $context.Config.dockerExecutable @dockerArguments `
    "--quiet" `
    "--single-transaction" `
    "--file" "/tooling/recovery-cron-jobs.sql"
  if ($LASTEXITCODE -ne 0) {
    throw "Recovery cron job reconciliation failed."
  }

  Write-Host (
    "Recovery snapshot was restored to the isolated target. " +
    "It is not considered verified until read-only validation passes."
  )
}
catch {
  Write-Error $_.Exception.Message
  exit 1
}
finally {
  if ($null -ne $password) {
    Clear-RecoveryPlainPassword -Password $password
  }
}
