param(
    [string]$ExePath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\pengbo-workbench.exe"),
    [string]$OutputPath = (Join-Path (Join-Path $PSScriptRoot "..") "logs\\strategy-lab-smoke-latest.json"),
    [int]$HealthTimeoutSeconds = 25
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
    factor_run_id = $null
    backtest_run_id = $null
    backtest_restored_after_restart = $false
    equity_curve_count = 0
    trade_count = 0
    position_count = 0
    warning_count = 0
    no_live_orders = $false
    paper_session_id = $null
    paper_order_count = 0
    paper_fill_count = 0
    paper_ledger_count = 0
    paper_no_live_orders = $false
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
    param([string]$SourcePath, [string]$DestinationPath)
    New-Item -ItemType Directory -Path $DestinationPath -Force | Out-Null
    foreach ($item in Get-ChildItem -LiteralPath $SourcePath -Force -ErrorAction SilentlyContinue) {
        Copy-Item -LiteralPath $item.FullName -Destination $DestinationPath -Recurse -Force
    }
}

function Get-ProcessSnapshot {
    param([string]$ProcessName, [string]$ResolvedPath)
    return @(Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | Where-Object {
            try { $_.Path -and ((Resolve-Path $_.Path).Path -eq $ResolvedPath) }
            catch { $false }
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
    if ($null -ne $Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 16)
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
    $script:backupDirPath = New-TemporaryPath -Prefix "pengbo-t35-backup"
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
    $templates = Invoke-ApiJson -Method Get -Path "/strategies/templates"
    if (@($templates | Where-Object { $_.key -eq "top_n_factor_rotation" }).Count -ne 1) {
        throw "Strategy template catalog did not include top_n_factor_rotation."
    }

    $factorRun = Invoke-ApiJson -Method Post -Path "/factors/runs" -Body @{
        universeSource = "expanded"
        assetType = "equity"
        family = "composite"
    }
    $result.factor_run_id = $factorRun.run_id

    $backtest = Invoke-ApiJson -Method Post -Path "/strategies/backtests" -Body @{
        templateKey = "top_n_factor_rotation"
        factorRunId = $factorRun.run_id
        topN = 5
        rebalanceInterval = "monthly"
        initialCapital = 100000
        maxPositionWeight = 0.25
        cashReservePct = 0.05
        benchmarkSymbol = "SPY"
        transactionCostBps = 5
        slippageBps = 10
    }
    $result.backtest_run_id = $backtest.run_id
    $result.equity_curve_count = @($backtest.equity_curve).Count
    $result.trade_count = @($backtest.trades).Count
    $result.position_count = @($backtest.positions).Count
    $result.warning_count = @($backtest.diagnostics.warnings).Count
    $result.no_live_orders = [bool]$backtest.diagnostics.no_live_orders
    if ($result.equity_curve_count -lt 2 -or $result.trade_count -lt 1 -or -not $result.no_live_orders) {
        throw "Packaged strategy backtest did not produce simulated evidence."
    }

    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath
    Start-DesktopPhase -ResolvedExePath $script:resolvedExePath
    $restored = Invoke-ApiJson -Method Get -Path "/strategies/backtests/$($result.backtest_run_id)"
    $result.backtest_restored_after_restart = ($restored.run_id -eq $result.backtest_run_id -and @($restored.trades).Count -eq $result.trade_count)
    if (-not $result.backtest_restored_after_restart) {
        throw "Strategy backtest snapshot did not restore after packaged restart."
    }

    $paper = Invoke-ApiJson -Method Post -Path "/strategies/paper/sessions" -Body @{
        backtestRunId = $result.backtest_run_id
        label = "Packaged strategy smoke"
    }
    $result.paper_session_id = $paper.session_id
    $result.paper_order_count = @($paper.orders).Count
    $result.paper_fill_count = @($paper.fills).Count
    $result.paper_ledger_count = @($paper.cash_ledger).Count
    $result.paper_no_live_orders = [bool]$paper.no_live_orders
    if ($result.paper_order_count -lt 1 -or $result.paper_fill_count -lt 1 -or $result.paper_ledger_count -lt 2 -or -not $result.paper_no_live_orders) {
        throw "Paper session did not include simulated orders, fills, ledger, and no-live-order evidence."
    }

    $export = Invoke-ApiJson -Method Post -Path "/strategies/reports/$($paper.session_id)/export"
    $result.export_path = $export.export_path
    $result.export_exists = Test-Path -LiteralPath $export.export_path
    if (-not $result.export_exists) {
        throw "Strategy report export was not created."
    }
    $contents = Get-Content -LiteralPath $export.export_path -Raw
    if ($contents -notmatch "Live orders: ``none``" -or $contents -notmatch "Paper Session") {
        throw "Exported strategy markdown is missing paper/no-live-order evidence."
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
