param(
  [switch]$RotateCredential
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$backupRoot = "D:\Backups\english-daily-loop\production"
$repositoryRoot = [System.IO.Path]::GetFullPath(
  (Join-Path $PSScriptRoot "..\..")
)
$configDirectory = Join-Path $backupRoot "config"
$configPath = Join-Path $configDirectory "backup-config.json"
$credentialPath = Join-Path $configDirectory "database-password.dpapi"
$linkedProjectRefPath = Join-Path $repositoryRoot "supabase\.temp\project-ref"

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)]
    [string]$LiteralPath,
    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($LiteralPath, $Value, $encoding)
}

function Set-OwnerOnlyDirectoryAcl {
  param(
    [Parameter(Mandatory = $true)]
    [string]$LiteralPath,
    [Parameter(Mandatory = $true)]
    [string]$WindowsIdentity
  )

  $acl = New-Object System.Security.AccessControl.DirectorySecurity
  $acl.SetAccessRuleProtection($true, $false)
  $inheritanceFlags = (
    [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
    [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
  )
  $propagationFlags =
    [System.Security.AccessControl.PropagationFlags]::None
  $allow = [System.Security.AccessControl.AccessControlType]::Allow
  $fullControl =
    [System.Security.AccessControl.FileSystemRights]::FullControl

  $ownerRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    $WindowsIdentity,
    $fullControl,
    $inheritanceFlags,
    $propagationFlags,
    $allow
  )
  $systemRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    "NT AUTHORITY\SYSTEM",
    $fullControl,
    $inheritanceFlags,
    $propagationFlags,
    $allow
  )
  $acl.AddAccessRule($ownerRule)
  $acl.AddAccessRule($systemRule)
  [System.IO.Directory]::SetAccessControl($LiteralPath, $acl)
}

if (-not (Test-Path -LiteralPath $linkedProjectRefPath -PathType Leaf)) {
  throw "Supabase project is not linked. Missing $linkedProjectRefPath."
}

$linkedProjectRef = (
  Get-Content -LiteralPath $linkedProjectRefPath -Raw -Encoding UTF8
).Trim()
if ($linkedProjectRef -notmatch "^[a-z0-9]{10,64}$") {
  throw "Linked Supabase project ref has an invalid format."
}

$resolvedRepository = [System.IO.Path]::GetFullPath($repositoryRoot)
$resolvedBackupRoot = [System.IO.Path]::GetFullPath($backupRoot)
$repositoryPrefix = $resolvedRepository.TrimEnd("\") + "\"
if (
  $resolvedBackupRoot -eq $resolvedRepository -or
  $resolvedBackupRoot.StartsWith(
    $repositoryPrefix,
    [System.StringComparison]::OrdinalIgnoreCase
  )
) {
  throw "Backup root must stay outside the repository."
}
if ($resolvedBackupRoot -match "\\(OneDrive|Google Drive|Dropbox)(\\|$)") {
  throw "Backup root must not be inside a cloud sync folder."
}

$nodeCommand = Get-Command node.exe -ErrorAction Stop
$dockerCommand = Get-Command docker.exe -ErrorAction Stop
$windowsIdentity = (
  [System.Security.Principal.WindowsIdentity]::GetCurrent()
).Name

if (
  (Test-Path -LiteralPath $configPath) -or
  (Test-Path -LiteralPath $credentialPath)
) {
  if (-not $RotateCredential) {
    throw (
      "Backup config already exists. Use -RotateCredential only when " +
      "you intentionally replace the stored database password."
    )
  }

  if (Test-Path -LiteralPath $configPath -PathType Leaf) {
    $existingConfig = (
      Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 |
        ConvertFrom-Json
    )
    if ($existingConfig.expectedProjectRef -ne $linkedProjectRef) {
      throw (
        "Linked project ref differs from existing production backup config."
      )
    }
  }
}

Write-Host "Production project ref: $linkedProjectRef"
Write-Host "Backup root: $resolvedBackupRoot"
$confirmation = Read-Host (
  "Paste the production project ref shown above to confirm"
)
if ($confirmation.Trim() -ne $linkedProjectRef) {
  throw "Project ref confirmation failed. Nothing was changed."
}

$securePassword = Read-Host (
  "Enter the production database password (input is hidden)"
) -AsSecureString
if ($securePassword.Length -eq 0) {
  throw "Database password cannot be empty."
}

[System.IO.Directory]::CreateDirectory($resolvedBackupRoot) | Out-Null
Set-OwnerOnlyDirectoryAcl `
  -LiteralPath $resolvedBackupRoot `
  -WindowsIdentity $windowsIdentity

foreach ($directoryName in @("config", "snapshots", "status", "drills")) {
  [System.IO.Directory]::CreateDirectory(
    (Join-Path $resolvedBackupRoot $directoryName)
  ) | Out-Null
}

$encryptedPassword = ConvertFrom-SecureString -SecureString $securePassword
Write-Utf8NoBom `
  -LiteralPath $credentialPath `
  -Value ($encryptedPassword + [Environment]::NewLine)

$config = [ordered]@{
  schemaVersion = 1
  environment = "production"
  backupRoot = $resolvedBackupRoot
  repositoryRoot = $resolvedRepository
  expectedProjectRef = $linkedProjectRef
  windowsIdentity = $windowsIdentity
  nodeExecutable = $nodeCommand.Source
  dockerExecutable = $dockerCommand.Source
  scheduleLocalTime = "20:00"
  createdAt = (Get-Date).ToUniversalTime().ToString("o")
}
$configJson = $config | ConvertTo-Json -Depth 4
Write-Utf8NoBom `
  -LiteralPath $configPath `
  -Value ($configJson + [Environment]::NewLine)

Write-Host "Production backup credential and local config are ready."
Write-Host "No database connection was made."
