#requires -Version 7.0
$ErrorActionPreference = 'Stop'

$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$sandbox = Join-Path ([IO.Path]::GetTempPath()) ('edl-spec-kit-' + [Guid]::NewGuid().ToString('N'))
$feature = Join-Path $sandbox 'specs/001-test-feature'
$outside = Join-Path ([IO.Path]::GetTempPath()) ('edl-spec-outside-' + [Guid]::NewGuid().ToString('N'))
$pwsh = Join-Path $PSHOME 'pwsh.exe'

function Invoke-Kit([string]$Name, [string[]]$Arguments) {
    $path = Join-Path $sandbox ".specify/scripts/powershell/$Name"
    $output = & $pwsh -NoProfile -File $path @Arguments 2>&1 | Out-String
    return [pscustomobject]@{ Exit = $LASTEXITCODE; Output = $output }
}
function Assert-Result([bool]$Condition, [string]$Description) {
    if (-not $Condition) { throw $Description }
}

try {
    $null = [IO.Directory]::CreateDirectory($sandbox)
    $null = [IO.Directory]::CreateDirectory($outside)
    Copy-Item -LiteralPath (Join-Path $project '.specify') -Destination (Join-Path $sandbox '.specify') -Recurse
    Set-Location -LiteralPath $sandbox
    $env:SPECIFY_FEATURE_DIRECTORY = 'specs/001-test-feature'

    $result = Invoke-Kit 'check-prerequisites.ps1' @('-Json','-PathsOnly','-ExpectedFeatureDirectory',$feature)
    Assert-Result ($result.Exit -eq 0) "PathsOnly should pass: $($result.Output)"
    $result = Invoke-Kit 'setup-spec.ps1' @('-Json','-ExpectedFeatureDirectory',$feature)
    Assert-Result ($result.Exit -eq 0 -and (Test-Path -LiteralPath (Join-Path $feature 'spec.md'))) "setup-spec should create spec: $($result.Output)"

    $spec = Join-Path $feature 'spec.md'
    [IO.File]::WriteAllText($spec, 'filled spec')
    $result = Invoke-Kit 'setup-spec.ps1' @('-Json','-ExpectedFeatureDirectory',$feature)
    Assert-Result ($result.Exit -eq 0 -and [IO.File]::ReadAllText($spec) -eq 'filled spec') 'Repeated setup-spec overwrote filled spec'
    $result = Invoke-Kit 'setup-plan.ps1' @('-Json','-ExpectedFeatureDirectory',$feature)
    Assert-Result ($result.Exit -eq 0 -and (Test-Path -LiteralPath (Join-Path $feature 'plan.md'))) "setup-plan should create plan: $($result.Output)"
    $result = Invoke-Kit 'setup-tasks.ps1' @('-Json','-ExpectedFeatureDirectory',$feature)
    Assert-Result ($result.Exit -eq 0) "setup-tasks should report paths: $($result.Output)"
    [IO.File]::WriteAllText((Join-Path $feature 'tasks.md'), 'filled tasks')
    $result = Invoke-Kit 'check-prerequisites.ps1' @('-Json','-RequireTasks','-ExpectedFeatureDirectory',$feature)
    Assert-Result ($result.Exit -eq 0) "RequireTasks should pass: $($result.Output)"

    $result = Invoke-Kit 'check-prerequisites.ps1' @('-Json','-PathsOnly','-ExpectedFeatureDirectory',(Join-Path $sandbox 'specs/002-other'))
    Assert-Result ($result.Exit -ne 0) 'Mismatched expected path was accepted'
    $env:SPECIFY_FEATURE_DIRECTORY = $outside
    $result = Invoke-Kit 'check-prerequisites.ps1' @('-Json','-PathsOnly','-ExpectedFeatureDirectory',$outside)
    Assert-Result ($result.Exit -ne 0) 'Outside path was accepted'
    $env:SPECIFY_FEATURE_DIRECTORY = 'specs/002-link'
    $junction = Join-Path $sandbox 'specs/002-link'
    $null = New-Item -ItemType Junction -Path $junction -Target $outside
    $result = Invoke-Kit 'check-prerequisites.ps1' @('-Json','-PathsOnly','-ExpectedFeatureDirectory',$junction)
    Assert-Result ($result.Exit -ne 0) 'Reparse point was accepted'

    Write-Output 'Spec Kit: positive, idempotence, mismatch, outside-path and reparse-point checks passed.'
} finally {
    Set-Location -LiteralPath $project
    Remove-Item Env:SPECIFY_FEATURE_DIRECTORY -ErrorAction SilentlyContinue
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\','/')
    foreach ($target in @($sandbox, $outside)) {
        $resolved = [IO.Path]::GetFullPath($target).TrimEnd('\','/')
        if (-not $resolved.StartsWith($tempRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to delete outside temp root: $resolved"
        }
        if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
    }
}
