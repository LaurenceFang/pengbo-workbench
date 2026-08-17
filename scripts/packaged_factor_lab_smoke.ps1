param(
    [string]$ExePath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\pengbo-workbench.exe"),
    [string]$OutputPath = (Join-Path (Join-Path $PSScriptRoot "..") "logs\\factor-lab-smoke-latest.json"),
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
    failures = New-Object System.Collections.Generic.List[string]
    data_dir = $null
    log_dir = $null
    run_id = $null
    family = "composite"
    universe_source = "expanded"
    evaluated_count = 0
    result_count = 0
    ranked_count = 0
    selected_symbol = $Symbol
    selected_rank = $null
    selected_percentile = $null
    selected_bucket = $null
    selected_score = $null
    selected_contribution_count = 0
    selected_missing_data = @()
    restored_after_restart = $false
    research_brief_id = $null
    research_factor_context = $false
    export_path = $null
    export_exists = $false
}

$script:resolvedExePath = $null
$script:resolvedSidecarPath = $null
$script:resolvedOutputPath = $null
$script:dataDirPath = $null
$script:backupDirPath = $null
$script:dataDirBackedUp = $false
$script:sessionHeaders = @{}

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
                return
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
        [int]$TimeoutSeconds = 180
    )

    $params = @{
        Method = $Method
        Uri = "$baseUrl$Path"
        TimeoutSec = $TimeoutSeconds
    }
    if ($script:sessionHeaders.Count -gt 0) {
        $params.Headers = $script:sessionHeaders
    }
    if ($null -ne $Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 12)
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
}

function Start-DesktopPhase {
    param([string]$ResolvedExePath)

    Stop-MatchingProcesses -ProcessName "pengbo-workbench" -ResolvedPath $ResolvedExePath
    Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $script:resolvedSidecarPath
    Start-Desktop -ResolvedExePath $ResolvedExePath
    Wait-ForHealth -Url $baseUrl -TimeoutSeconds $HealthTimeoutSeconds
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

    $script:backupDirPath = New-TemporaryPath -Prefix "pengbo-t34-backup"
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
    $families = Invoke-ApiJson -Method Get -Path "/factors/families"
    if (@($families | Where-Object { $_.key -eq "composite" }).Count -ne 1) {
        throw "Factor family catalog did not include composite."
    }

    $run = Invoke-ApiJson -Method Post -Path "/factors/runs" -Body @{
        universeSource = "expanded"
        assetType = "equity"
        family = "composite"
    }
    $result.run_id = $run.run_id
    $result.evaluated_count = [int]$run.evaluated_count
    $result.result_count = [int]$run.result_count
    $result.ranked_count = [int]$run.diagnostics.ranked_count
    if ($result.result_count -lt 1 -or $result.ranked_count -lt 1) {
        throw "Packaged factor run did not produce ranked results."
    }

    $selected = @($run.results | Where-Object { $_.symbol -eq $Symbol } | Select-Object -First 1)
    if (@($selected).Count -eq 0) {
        $selected = @($run.results | Select-Object -First 1)
    }
    $selected = $selected[0]
    $result.selected_symbol = $selected.symbol
    $result.selected_rank = $selected.rank
    $result.selected_percentile = $selected.percentile
    $result.selected_bucket = $selected.bucket
    $result.selected_score = $selected.composite_score
    $result.selected_contribution_count = @($selected.contributions).Count
    $result.selected_missing_data = @($selected.missing_data)
    if ($result.selected_contribution_count -lt 1) {
        throw "Selected factor row did not include contribution detail."
    }

    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath
    Start-DesktopPhase -ResolvedExePath $script:resolvedExePath
    $restored = Invoke-ApiJson -Method Get -Path "/factors/runs/$($result.run_id)"
    $result.restored_after_restart = ($restored.run_id -eq $result.run_id -and @($restored.results).Count -eq $result.result_count)
    if (-not $result.restored_after_restart) {
        throw "Factor run snapshot did not restore after packaged restart."
    }

    $brief = Invoke-ApiJson -Method Post -Path "/research/briefs" -Body @{
        symbol = $result.selected_symbol
        factorRunId = $result.run_id
        sourceUniverseSource = "expanded"
    }
    $result.research_brief_id = $brief.brief_id
    $result.research_factor_context = ($null -ne $brief.factor_context -and $brief.factor_context.run_id -eq $result.run_id)
    if (-not $result.research_factor_context) {
        throw "Research brief did not include factor context."
    }

    $session = Invoke-ApiJson -Method Post -Path "/security/session" -Body @{}
    $script:sessionHeaders = @{ "X-Pengbo-Session" = [string]$session.session_id }
    $export = Invoke-ApiJson -Method Post -Path "/research/briefs/$($brief.brief_id)/export"
    $result.export_path = $export.export_path
    $result.export_exists = Test-Path -LiteralPath $export.export_path
    if (-not $result.export_exists) {
        throw "Factor handoff research export was not created."
    }
    $contents = Get-Content -LiteralPath $export.export_path -Raw
    if ($contents -notmatch "## Factor Context" -or $contents -notmatch "research-only") {
        throw "Exported research markdown is missing factor context."
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
    $result | ConvertTo-Json -Depth 10 | Set-Content -Path $script:resolvedOutputPath -Encoding UTF8
}

if ($result.failures.Count -gt 0) {
    exit 1
}
