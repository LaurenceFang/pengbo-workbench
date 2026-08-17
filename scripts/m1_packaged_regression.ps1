param(
    [string[]]$SmokeScripts = @(
        "smoke:research-workspace",
        "smoke:portfolio-ui-signoff",
        "smoke:screener-variant-signoff",
        "smoke:factor-lab",
        "smoke:strategy-lab",
        "smoke:workflow-studio:packaged",
        "smoke:data-sources:packaged",
        "smoke:binance-execution",
        "smoke:ai-research:packaged"
    ),
    [int]$HealthTimeoutSeconds = 30,
    [string]$OutputPath = (Join-Path (Join-Path $PSScriptRoot "..") "logs\m1-packaged-regression-latest.json")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$exePath = (Resolve-Path (Join-Path $repoRoot "src-tauri\target\release\pengbo-workbench.exe")).Path
$sidecarPath = (Resolve-Path (Join-Path $repoRoot "src-tauri\target\release\binaries\pengbo-sidecar\pengbo-sidecar.exe")).Path
$profilePath = [System.IO.Path]::GetFullPath((Join-Path $env:APPDATA "com.pengbo.workbench"))
$expectedProfilePath = [System.IO.Path]::GetFullPath((Join-Path $env:APPDATA "com.pengbo.workbench"))
$backupRoot = Join-Path $env:USERPROFILE (".codex\backups\pengbo-m1\packaged-profile-{0}" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
$backupProfilePath = Join-Path $backupRoot "original-profile"
$baseUrl = "http://127.0.0.1:8765/api/v1"
$unlockSecret = "m1-packaged-regression-passphrase"
$env:PENGBO_MARKET_FIXTURES = "1"
$env:PENGBO_CHINA_CONNECTOR_FIXTURES = "1"
$env:PENGBO_AUTOMATION_WINDOW_MODE = "hidden"
$hadOriginalProfile = Test-Path -LiteralPath $profilePath
$uiAutomationSmokes = @(
    "smoke:portfolio-ui-signoff",
    "smoke:screener-variant-signoff",
    "smoke:workflow-studio:packaged",
    "smoke:data-sources:packaged"
)

$result = [ordered]@{
    started_at = (Get-Date).ToString("o")
    finished_at = $null
    profile_path = $profilePath
    backup_path = $backupProfilePath
    original_profile_present = $hadOriginalProfile
    explicit_market_fixtures = $true
    explicit_china_connector_fixtures = $true
    foreground_policy = "API-only smoke uses hidden; UIAutomation smoke uses minimized"
    original_manifest_sha256 = $null
    backup_manifest_sha256 = $null
    restored_manifest_sha256 = $null
    backup_verified = $false
    restore_verified = $false
    smoke_results = New-Object System.Collections.Generic.List[object]
    failures = New-Object System.Collections.Generic.List[string]
}

function Get-ProfileManifest {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return @()
    }
    $root = [System.IO.Path]::GetFullPath($Path).TrimEnd("\")
    return @(Get-ChildItem -LiteralPath $root -File -Recurse -Force | Sort-Object FullName | ForEach-Object {
        [ordered]@{
            relative_path = $_.FullName.Substring($root.Length).TrimStart("\").Replace("\", "/")
            size_bytes = $_.Length
            sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
        }
    })
}

function Get-ManifestDigest {
    param([object[]]$Manifest)

    $joined = @($Manifest | ForEach-Object { "{0}`0{1}`0{2}" -f $_.relative_path, $_.size_bytes, $_.sha256 }) -join "`n"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($joined)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "")
    }
    finally {
        $sha.Dispose()
    }
}

function Get-ProcessSnapshot {
    param([string]$ProcessName, [string]$ResolvedPath)

    return @(Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | Where-Object {
        try { $_.Path -and ((Resolve-Path $_.Path).Path -eq $ResolvedPath) } catch { $false }
    })
}

function Stop-MatchingProcesses {
    param([string]$ProcessName, [string]$ResolvedPath)

    foreach ($process in @(Get-ProcessSnapshot -ProcessName $ProcessName -ResolvedPath $ResolvedPath)) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 800
}

function Stop-PackagedRuntime {
    Stop-MatchingProcesses -ProcessName "pengbo-workbench" -ResolvedPath $exePath
    Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $sidecarPath
}

function Wait-ForHealth {
    $deadline = (Get-Date).AddSeconds($HealthTimeoutSeconds)
    do {
        try {
            $health = Invoke-RestMethod -Uri "$baseUrl/health" -TimeoutSec 3
            if ($health.status -eq "ok") { return }
        }
        catch {
        }
        Start-Sleep -Milliseconds 300
    } while ((Get-Date) -lt $deadline)
    throw "Packaged runtime health did not become ready within $HealthTimeoutSeconds seconds."
}

function Assert-SafeProfilePath {
    if ($profilePath -ne $expectedProfilePath) {
        throw "Refusing to replace unexpected profile path: $profilePath"
    }
    $parent = [System.IO.Path]::GetFullPath((Split-Path -Parent $profilePath))
    if ($parent -ne [System.IO.Path]::GetFullPath($env:APPDATA)) {
        throw "Refusing to replace profile outside APPDATA: $profilePath"
    }
}

function Remove-TestProfile {
    Assert-SafeProfilePath
    if (Test-Path -LiteralPath $profilePath) {
        Remove-Item -LiteralPath $profilePath -Recurse -Force
    }
}

$originalManifest = @()
try {
    Stop-PackagedRuntime
    New-Item -ItemType Directory -Path $backupProfilePath -Force | Out-Null
    $originalManifest = Get-ProfileManifest -Path $profilePath
    if ($hadOriginalProfile) {
        foreach ($item in @(Get-ChildItem -LiteralPath $profilePath -Force)) {
            Copy-Item -LiteralPath $item.FullName -Destination $backupProfilePath -Recurse -Force
        }
    }
    $backupManifest = Get-ProfileManifest -Path $backupProfilePath
    $result.original_manifest_sha256 = Get-ManifestDigest -Manifest $originalManifest
    $result.backup_manifest_sha256 = Get-ManifestDigest -Manifest $backupManifest
    $result.backup_verified = ($result.original_manifest_sha256 -eq $result.backup_manifest_sha256)
    if (-not $result.backup_verified) {
        throw "Packaged regression profile backup manifest did not match the original."
    }

    Remove-TestProfile
    New-Item -ItemType Directory -Path $profilePath -Force | Out-Null
    $desktop = Start-Process -FilePath $exePath -PassThru
    Wait-ForHealth
    $body = @{ unlock_secret = $unlockSecret } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "$baseUrl/security/local/initialize" -Body $body -ContentType "application/json" -TimeoutSec 10 | Out-Null
    Stop-PackagedRuntime

    foreach ($smokeScript in $SmokeScripts) {
        $env:PENGBO_AUTOMATION_WINDOW_MODE = "hidden"
        $desktop = Start-Process -FilePath $exePath -PassThru
        Wait-ForHealth
        $body = @{ unlock_secret = $unlockSecret } | ConvertTo-Json
        Invoke-RestMethod -Method Post -Uri "$baseUrl/security/local/unlock" -Body $body -ContentType "application/json" -TimeoutSec 10 | Out-Null
        Stop-PackagedRuntime
        $automationWindowMode = if ($uiAutomationSmokes -contains $smokeScript) { "minimized" } else { "hidden" }
        $env:PENGBO_AUTOMATION_WINDOW_MODE = $automationWindowMode
        $started = Get-Date
        & npm.cmd run $smokeScript
        $exitCode = $LASTEXITCODE
        $entry = [ordered]@{
            script = $smokeScript
            exit_code = $exitCode
            duration_seconds = [Math]::Round(((Get-Date) - $started).TotalSeconds, 2)
            automation_window_mode = $automationWindowMode
            passed = ($exitCode -eq 0)
        }
        $result.smoke_results.Add($entry)
        if ($exitCode -ne 0) {
            $result.failures.Add("$smokeScript exited with code $exitCode.")
        }
    }
}
catch {
    $result.failures.Add($_.Exception.Message)
}
finally {
    Stop-PackagedRuntime
    try {
        Remove-TestProfile
        if ($hadOriginalProfile) {
            New-Item -ItemType Directory -Path $profilePath -Force | Out-Null
            foreach ($item in @(Get-ChildItem -LiteralPath $backupProfilePath -Force)) {
                Copy-Item -LiteralPath $item.FullName -Destination $profilePath -Recurse -Force
            }
        }
        $restoredManifest = Get-ProfileManifest -Path $profilePath
        $result.restored_manifest_sha256 = Get-ManifestDigest -Manifest $restoredManifest
        $result.restore_verified = ($result.original_manifest_sha256 -eq $result.restored_manifest_sha256)
        if (-not $result.restore_verified) {
            $result.failures.Add("Restored packaged profile manifest did not match the original.")
        }
    }
    catch {
        $result.failures.Add("Profile restore failed: $($_.Exception.Message)")
    }

    $result.finished_at = (Get-Date).ToString("o")
    $resolvedOutputPath = [System.IO.Path]::GetFullPath($OutputPath)
    New-Item -ItemType Directory -Path (Split-Path -Parent $resolvedOutputPath) -Force | Out-Null
    $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvedOutputPath -Encoding UTF8
}

if ($result.failures.Count -gt 0) {
    exit 1
}
