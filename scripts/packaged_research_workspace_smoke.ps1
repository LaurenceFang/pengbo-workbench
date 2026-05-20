param(
    [string]$ExePath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\pengbo-workbench.exe"),
    [string]$OutputPath = (Join-Path (Join-Path $PSScriptRoot "..") "logs\\research-workspace-smoke-latest.json"),
    [int]$HealthTimeoutSeconds = 25,
    [string]$Symbol = "AAPL"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$baseUrl = "http://127.0.0.1:8765/api/v1"
$sidecarPath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\binaries\\pengbo-sidecar\\pengbo-sidecar.exe")
$result = [ordered]@{
    exe_path = ""
    started_at = (Get-Date).ToString("o")
    finished_at = $null
    health_ready = $false
    data_dir = $null
    log_dir = $null
    failures = New-Object System.Collections.Generic.List[string]
    created_brief_id = $null
    created_symbol = $Symbol
    analysis_module_count = 0
    analysis_module_keys = @()
    notes_saved = $false
    notes_after_restart = $null
    export_path = $null
    export_exists = $false
}

$script:resolvedExePath = $null
$script:resolvedSidecarPath = $null
$script:resolvedOutputPath = $null
$script:dataDirPath = $null
$script:backupDirPath = $null
$script:dataDirBackedUp = $false

function Add-Failure {
    param([string]$Message)

    $result.failures.Add($Message)
    Write-Warning $Message
}

function New-TemporaryPath {
    param([string]$Prefix)

    $guid = [guid]::NewGuid().ToString("N")
    return Join-Path ([System.IO.Path]::GetTempPath()) "$Prefix-$guid"
}

function Copy-Directory {
    param(
        [string]$SourcePath,
        [string]$DestinationPath
    )

    New-Item -ItemType Directory -Path $DestinationPath -Force | Out-Null
    foreach ($item in Get-ChildItem -LiteralPath $SourcePath -Force -ErrorAction SilentlyContinue) {
        Copy-Item -LiteralPath $item.FullName -Destination $DestinationPath -Recurse -Force
    }
}

function Get-ProcessSnapshot {
    param([string]$ProcessName, [string]$ResolvedPath)

    return @(Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | Where-Object {
            try {
                $_.Path -and ((Resolve-Path $_.Path).Path -eq $ResolvedPath)
            }
            catch {
                $false
            }
        })
}

function Stop-MatchingProcesses {
    param([string]$ProcessName, [string]$ResolvedPath)

    $targets = @(Get-ProcessSnapshot -ProcessName $ProcessName -ResolvedPath $ResolvedPath)
    foreach ($target in $targets) {
        Stop-Process -Id $target.Id -Force -ErrorAction SilentlyContinue
    }

    if (@($targets).Count -gt 0) {
        Start-Sleep -Milliseconds 800
    }
}

function Wait-ForHealth {
    param([string]$Url, [int]$TimeoutSeconds)

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        try {
            $health = Invoke-RestMethod -Uri "$Url/health" -TimeoutSec 3
            if ($health.status -eq "ok") {
                $stopwatch.Stop()
                return [ordered]@{
                    ok = $true
                    seconds = [Math]::Round($stopwatch.Elapsed.TotalSeconds, 2)
                }
            }
        }
        catch {
        }

        Start-Sleep -Milliseconds 300
    }

    throw "Health check did not become ready within $TimeoutSeconds seconds."
}

function Invoke-ApiJson {
    param(
        [ValidateSet("Get", "Post", "Put", "Delete")]
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [int]$TimeoutSeconds = 120
    )

    $params = @{
        Method = $Method
        Uri = "$baseUrl$Path"
        TimeoutSec = $TimeoutSeconds
    }
    if ($null -ne $Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 8)
        $params.ContentType = "application/json"
    }
    return Invoke-RestMethod @params
}

function Start-Desktop {
    param([string]$ResolvedExePath)

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $ResolvedExePath
    $startInfo.UseShellExecute = $false
    $startInfo.WorkingDirectory = Split-Path -Parent $ResolvedExePath
    $startInfo.Environment["NO_PROXY"] = "127.0.0.1,localhost"

    $process = [System.Diagnostics.Process]::Start($startInfo)
    if ($null -eq $process) {
        throw "Failed to start packaged desktop: $ResolvedExePath"
    }
    return $process
}

function Start-DesktopPhase {
    param([string]$ResolvedExePath)

    Stop-MatchingProcesses -ProcessName "pengbo-workbench" -ResolvedPath $ResolvedExePath
    Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $script:resolvedSidecarPath

    $null = Start-Desktop -ResolvedExePath $ResolvedExePath
    $health = Wait-ForHealth -Url $baseUrl -TimeoutSeconds $HealthTimeoutSeconds
    $runtime = Invoke-ApiJson -Method Get -Path "/settings/runtime"
    $result.health_ready = $true
    $result.data_dir = $runtime.data_dir
    $result.log_dir = $runtime.log_dir
    $script:dataDirPath = [string]$runtime.data_dir
}

function Stop-DesktopScenario {
    param([string]$ResolvedExePath)

    Stop-MatchingProcesses -ProcessName "pengbo-workbench" -ResolvedPath $ResolvedExePath
    Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $script:resolvedSidecarPath
}

function Backup-DataDirectory {
    param([string]$Path)

    $script:backupDirPath = New-TemporaryPath -Prefix "pengbo-t26-backup"
    if (Test-Path -LiteralPath $Path) {
        Copy-Directory -SourcePath $Path -DestinationPath $script:backupDirPath
        $script:dataDirBackedUp = $true
        return
    }

    New-Item -ItemType Directory -Path $script:backupDirPath -Force | Out-Null
    $script:dataDirBackedUp = $false
}

function Restore-DataDirectory {
    if (-not $script:dataDirPath) {
        return
    }

    if (Test-Path -LiteralPath $script:dataDirPath) {
        Remove-Item -LiteralPath $script:dataDirPath -Recurse -Force
    }

    if ($script:dataDirBackedUp -and $script:backupDirPath -and (Test-Path -LiteralPath $script:backupDirPath)) {
        Copy-Directory -SourcePath $script:backupDirPath -DestinationPath $script:dataDirPath
    }
}

try {
    $script:resolvedExePath = (Resolve-Path $ExePath).Path
    $script:resolvedSidecarPath = (Resolve-Path $sidecarPath).Path
    $script:resolvedOutputPath = [System.IO.Path]::GetFullPath($OutputPath)
    $result.exe_path = $script:resolvedExePath

    Start-DesktopPhase -ResolvedExePath $script:resolvedExePath
    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath

    Backup-DataDirectory -Path $script:dataDirPath

    Start-DesktopPhase -ResolvedExePath $script:resolvedExePath
    $brief = Invoke-ApiJson -Method Post -Path "/research/briefs" -Body @{
        symbol = $Symbol
        sourcePresetKey = "quality-equities"
        sourceVariantKey = "default"
        sourceUniverseSource = "expanded"
    }
    $result.created_brief_id = $brief.brief_id
    $result.analysis_module_count = @($brief.analysis_modules).Count
    $result.analysis_module_keys = @($brief.analysis_modules | ForEach-Object { $_.key })
    if ($result.analysis_module_count -lt 4) {
        throw "Research brief did not include the expected analysis module set."
    }

    $notes = "Packaged T26 smoke note $(Get-Date -Format o)"
    $updated = Invoke-ApiJson -Method Put -Path "/research/briefs/$($brief.brief_id)/notes" -Body @{
        markdown = $notes
    }
    if ($updated.notes.markdown -ne $notes) {
        throw "Saved research notes did not round-trip before restart."
    }
    $result.notes_saved = $true
    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath

    Start-DesktopPhase -ResolvedExePath $script:resolvedExePath
    $reloaded = Invoke-ApiJson -Method Get -Path "/research/briefs/$($brief.brief_id)"
    if (@($reloaded.analysis_modules).Count -lt 4) {
        throw "Research brief lost analysis modules after restart."
    }
    $result.notes_after_restart = $reloaded.notes.markdown
    if ($reloaded.notes.markdown -ne $notes) {
        throw "Research notes were not restored after restart."
    }

    $export = Invoke-ApiJson -Method Post -Path "/research/briefs/$($brief.brief_id)/export"
    $result.export_path = $export.export_path
    $result.export_exists = Test-Path -LiteralPath $export.export_path
    if (-not $result.export_exists) {
        throw "Research export file was not created."
    }
    $exportContents = Get-Content -LiteralPath $export.export_path -Raw
    if ($exportContents -notmatch "## Analysis Modules") {
        throw "Exported research markdown is missing the analysis modules section."
    }
}
catch {
    Add-Failure $_.Exception.Message
}
finally {
    if ($script:resolvedExePath) {
        Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath
    }
    Restore-DataDirectory
    if ($script:backupDirPath -and (Test-Path -LiteralPath $script:backupDirPath)) {
        Remove-Item -LiteralPath $script:backupDirPath -Recurse -Force
    }
    $result.finished_at = (Get-Date).ToString("o")
    $outputDirectory = Split-Path -Parent $script:resolvedOutputPath
    if (-not (Test-Path -LiteralPath $outputDirectory)) {
        New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    }
    $result | ConvertTo-Json -Depth 8 | Set-Content -Path $script:resolvedOutputPath -Encoding UTF8
}

if ($result.failures.Count -gt 0) {
    exit 1
}
