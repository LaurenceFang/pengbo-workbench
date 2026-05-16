param(
    [string]$ExePath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\pengbo-workbench.exe"),
    [string]$OutputPath = (Join-Path (Join-Path $PSScriptRoot "..") "logs\\evidence-report-smoke-latest.json"),
    [int]$HealthTimeoutSeconds = 25
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$baseUrl = "http://127.0.0.1:8765/api/v1"
$sidecarPath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\pengbo-sidecar.exe")
$result = [ordered]@{
    exe_path = ""
    started_at = (Get-Date).ToString("o")
    finished_at = $null
    health_ready = $false
    failures = New-Object System.Collections.Generic.List[string]
    data_dir = $null
    factor_run_id = $null
    backtest_run_id = $null
    paper_session_id = $null
    intent_id = $null
    brief_id = $null
    evidence_factor_linked = $false
    evidence_backtest_linked = $false
    evidence_paper_linked = $false
    evidence_execution_linked = $false
    evidence_audit_count = 0
    export_path = $null
    export_exists = $false
    restored_after_restart = $false
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
    $script:dataDirPath = [string]$runtime.data_dir
}

function Stop-DesktopScenario {
    param([string]$ResolvedExePath)
    Stop-MatchingProcesses -ProcessName "pengbo-workbench" -ResolvedPath $ResolvedExePath
    Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $script:resolvedSidecarPath
}

function Backup-DataDirectory {
    param([string]$Path)
    $script:backupDirPath = New-TemporaryPath -Prefix "pengbo-t37-backup"
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

    $paper = Invoke-ApiJson -Method Post -Path "/strategies/paper/sessions" -Body @{
        backtestRunId = $backtest.run_id
        label = "Packaged evidence report smoke"
    }
    $result.paper_session_id = $paper.session_id

    $intent = Invoke-ApiJson -Method Post -Path "/execution/binance/intents" -Body @{
        symbol = "BTC/USDT"
        side = "buy"
        quantity = 0.001
        orderType = "market"
        strategyRunId = $backtest.run_id
        paperSessionId = $paper.session_id
        clientOrderId = "packaged-t37-evidence"
        notes = "Packaged evidence report smoke."
    }
    $result.intent_id = $intent.intent_id
    $submitted = Invoke-ApiJson -Method Post -Path "/execution/binance/intents/$($intent.intent_id)/submit"
    if ($submitted.status -ne "blocked") {
        throw "Evidence smoke expected the default-off Binance intent to be blocked."
    }

    $evidencePath = "/research/evidence/AAPL?factorRunId=$($factorRun.run_id)&backtestRunId=$($backtest.run_id)&paperSessionId=$($paper.session_id)&intentId=$($intent.intent_id)"
    $evidence = Invoke-ApiJson -Method Get -Path $evidencePath
    $result.evidence_factor_linked = ($evidence.factor.run_id -eq $factorRun.run_id)
    $result.evidence_backtest_linked = ($evidence.backtest.run_id -eq $backtest.run_id)
    $result.evidence_paper_linked = ($evidence.paper_session.session_id -eq $paper.session_id)
    $result.evidence_execution_linked = ($evidence.execution.intent_id -eq $intent.intent_id)
    $result.evidence_audit_count = [int]$evidence.audit.event_count
    if (-not ($result.evidence_factor_linked -and $result.evidence_backtest_linked -and $result.evidence_paper_linked -and $result.evidence_execution_linked)) {
        throw "Evidence snapshot did not link the full factor/backtest/paper/execution chain."
    }
    if ($result.evidence_audit_count -lt 2) {
        throw "Evidence snapshot did not include the expected execution audit events."
    }

    $brief = Invoke-ApiJson -Method Post -Path "/research/briefs" -Body @{
        symbol = "AAPL"
        factorRunId = $factorRun.run_id
        backtestRunId = $backtest.run_id
        paperSessionId = $paper.session_id
        intentId = $intent.intent_id
    }
    $result.brief_id = $brief.brief_id
    if ($brief.evidence_context.execution.intent_id -ne $intent.intent_id) {
        throw "Research brief did not persist execution evidence context."
    }

    $export = Invoke-ApiJson -Method Post -Path "/research/briefs/$($brief.brief_id)/export"
    $result.export_path = $export.export_path
    $result.export_exists = Test-Path -LiteralPath $export.export_path
    if (-not $result.export_exists) {
        throw "Evidence-backed research export was not created."
    }
    $contents = Get-Content -LiteralPath $export.export_path -Raw
    if ($contents -notmatch "Evidence Chain" -or $contents -notmatch "Binance intent") {
        throw "Evidence-backed research export is missing the evidence chain."
    }

    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath
    Start-DesktopPhase -ResolvedExePath $script:resolvedExePath
    $restored = Invoke-ApiJson -Method Get -Path "/research/briefs/$($result.brief_id)"
    $result.restored_after_restart = ($restored.evidence_context.execution.intent_id -eq $result.intent_id)
    if (-not $result.restored_after_restart) {
        throw "Evidence-backed research brief did not restore after packaged restart."
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
