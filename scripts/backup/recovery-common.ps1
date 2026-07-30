$script:RecoveryBackupRoot =
  "D:\Backups\english-daily-loop\production"
$script:RecoveryPostgresImage = "postgres:17"

function Get-RecoveryContext {
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

  $configPath = Join-Path `
    $script:RecoveryBackupRoot `
    "config\backup-config.json"
  if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
    throw "Backup config is missing."
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
  if (
    $TargetDbPort -lt 1 -or
    $TargetDbPort -gt 65535
  ) {
    throw "TargetDbPort is outside the allowed range."
  }
  if ($TargetDbName -notmatch "^[A-Za-z0-9_-]+$") {
    throw "TargetDbName has an invalid format."
  }
  if ($TargetDbUser -notmatch "^[A-Za-z0-9_.-]+$") {
    throw "TargetDbUser has an invalid format."
  }

  $resolvedSnapshotPath = [System.IO.Path]::GetFullPath($SnapshotPath)
  $repositoryRoot = [System.IO.Path]::GetFullPath(
    (Join-Path $PSScriptRoot "..\..")
  )
  if (
    [System.IO.Path]::GetFullPath($config.repositoryRoot) -ne
    $repositoryRoot
  ) {
    throw "Repository path differs from the backup config."
  }

  $tsxCli = Join-Path $repositoryRoot "node_modules\tsx\dist\cli.mjs"
  $preflightScript = Join-Path $PSScriptRoot "recovery-preflight.ts"
  if (-not (Test-Path -LiteralPath $tsxCli -PathType Leaf)) {
    throw "tsx CLI is missing. Project dependencies are not ready."
  }
  foreach ($executable in @(
    $config.nodeExecutable,
    $config.dockerExecutable
  )) {
    if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
      throw "Required executable is missing: $executable"
    }
  }

  $preflightOutput = & $config.nodeExecutable `
    $tsxCli `
    $preflightScript `
    "--snapshot=$resolvedSnapshotPath" `
    "--target-project-ref=$TargetProjectRef" `
    "--target-db-host=$TargetDbHost" `
    "--target-db-user=$TargetDbUser"
  if ($LASTEXITCODE -ne 0) {
    throw "Recovery preflight rejected the target."
  }
  if ($null -ne $preflightOutput) {
    $preflightOutput | ForEach-Object { Write-Host $_ }
  }

  & $config.dockerExecutable `
    image `
    inspect `
    $script:RecoveryPostgresImage `
    *> $null
  if ($LASTEXITCODE -ne 0) {
    throw (
      "Docker image $script:RecoveryPostgresImage is not available " +
      "locally. The script will not download it automatically."
    )
  }

  return [PSCustomObject]@{
    Config = $config
    RepositoryRoot = $repositoryRoot
    SnapshotPath = $resolvedSnapshotPath
    TargetProjectRef = $TargetProjectRef
    TargetDbHost = $TargetDbHost
    TargetDbUser = $TargetDbUser
    TargetDbPort = $TargetDbPort
    TargetDbName = $TargetDbName
    PostgresImage = $script:RecoveryPostgresImage
  }
}

function Get-RecoveryPsqlArguments {
  param(
    [Parameter(Mandatory = $true)]
    [PSCustomObject]$Context
  )

  return @(
    "--host", $Context.TargetDbHost,
    "--port", $Context.TargetDbPort.ToString(),
    "--username", $Context.TargetDbUser,
    "--dbname", $Context.TargetDbName,
    "--variable", "ON_ERROR_STOP=1"
  )
}

function Get-RecoveryPlainPassword {
  $securePassword = Read-Host (
    "Enter the recovery database password (input is hidden)"
  ) -AsSecureString
  if ($securePassword.Length -eq 0) {
    throw "Recovery database password cannot be empty."
  }

  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
    $securePassword
  )
  return [PSCustomObject]@{
    Bstr = $bstr
    Value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  }
}

function Clear-RecoveryPlainPassword {
  param(
    [Parameter(Mandatory = $true)]
    [PSCustomObject]$Password
  )

  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  $Password.Value = $null
  if ($Password.Bstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Password.Bstr)
    $Password.Bstr = [IntPtr]::Zero
  }
}
