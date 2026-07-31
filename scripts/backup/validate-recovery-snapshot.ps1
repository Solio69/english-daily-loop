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
    $toolingMount,
    $context.PostgresImage,
    "psql"
  ) + $connectionArguments + @(
    "--tuples-only",
    "--no-align",
    "--quiet",
    "--file",
    "/tooling/recovery-validation.sql"
  )

  $validationOutput = @(
    & $context.Config.dockerExecutable @dockerArguments 2>&1
  )
  if ($LASTEXITCODE -ne 0) {
    $validationOutput | ForEach-Object { Write-Host $_ }
    throw "Read-only recovery database validation query failed."
  }

  $resultLine = $validationOutput |
    Where-Object {
      $_.ToString().StartsWith("EDL_RECOVERY_VALIDATION=")
    } |
    Select-Object -Last 1
  if ($null -eq $resultLine) {
    throw "Recovery validation query did not return the expected result."
  }
  $resultJson = $resultLine.ToString().Substring(
    "EDL_RECOVERY_VALIDATION=".Length
  )

  $snapshotName = Split-Path -Leaf $context.SnapshotPath
  $snapshotId = $snapshotName.Substring(
    $snapshotName.LastIndexOf("_") + 1
  )
  $drillsDirectory = Join-Path `
    $script:RecoveryBackupRoot `
    "drills"
  [System.IO.Directory]::CreateDirectory($drillsDirectory) | Out-Null
  $resultPath = Join-Path `
    $drillsDirectory `
    (
      (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd") +
      "_" +
      $snapshotId +
      ".validation.json"
    )
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText(
    $resultPath,
    $resultJson + [Environment]::NewLine,
    $encoding
  )

  $tsxCli = Join-Path `
    $context.RepositoryRoot `
    "node_modules\tsx\dist\cli.mjs"
  $resultValidator = Join-Path $PSScriptRoot "recovery-result.ts"
  & $context.Config.nodeExecutable `
    $tsxCli `
    $resultValidator `
    "--snapshot=$($context.SnapshotPath)" `
    "--result=$resultPath"
  if ($LASTEXITCODE -ne 0) {
    throw "Recovery database does not match the snapshot contract."
  }

  Write-Host "Safe validation result saved to $resultPath"
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
