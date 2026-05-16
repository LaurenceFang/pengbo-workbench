param(
    [string]$ExePath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\pengbo-workbench.exe"),
    [string]$OutputPath = (Join-Path (Join-Path $PSScriptRoot "..") "logs\\portfolio-offline-smoke-latest.json"),
    [int]$HealthTimeoutSeconds = 25
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$baseUrl = "http://127.0.0.1:8765/api/v1"
$sidecarPath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\pengbo-sidecar.exe")
$seedTransaction = [ordered]@{
    symbol = "AAPL"
    side = "buy"
    quantity = 2.0
    price = 175.0
    fees = 0.0
    traded_at = "2026-04-18T09:30:00Z"
    notes = "T19 seeded portfolio transaction"
}
$offlineProxyUrl = "http://127.0.0.1:9"
$result = [ordered]@{
    exe_path = ""
    started_at = (Get-Date).ToString("o")
    finished_at = $null
    health_ready = $false
    data_dir = $null
    log_dir = $null
    bootstrap_log_path = $null
    seed_symbols = @("AAPL")
    failures = New-Object System.Collections.Generic.List[string]
    scenarios = [ordered]@{
        online = [ordered]@{}
        offline_with_cache = [ordered]@{}
        offline_cold_cache = [ordered]@{}
    }
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
                    payload = $health
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
        [int]$TimeoutSeconds = 25
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

function Start-DesktopWithEnv {
    param(
        [string]$ResolvedExePath,
        [hashtable]$EnvironmentOverrides
    )

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $ResolvedExePath
    $startInfo.UseShellExecute = $false
    $startInfo.WorkingDirectory = Split-Path -Parent $ResolvedExePath

    foreach ($entry in [System.Environment]::GetEnvironmentVariables().GetEnumerator()) {
        $startInfo.Environment[$entry.Key] = [string]$entry.Value
    }
    foreach ($key in $EnvironmentOverrides.Keys) {
        $value = $EnvironmentOverrides[$key]
        if ($null -eq $value -or "$value" -eq "") {
            $startInfo.Environment.Remove($key)
            continue
        }
        $startInfo.Environment[$key] = [string]$value
    }

    $process = [System.Diagnostics.Process]::Start($startInfo)
    if ($null -eq $process) {
        throw "Failed to start packaged desktop: $ResolvedExePath"
    }
    return $process
}

function Get-OfflineEnvironmentOverrides {
    return @{
        HTTP_PROXY = $offlineProxyUrl
        HTTPS_PROXY = $offlineProxyUrl
        ALL_PROXY = $offlineProxyUrl
        NO_PROXY = "127.0.0.1,localhost"
    }
}

function Get-OnlineEnvironmentOverrides {
    return @{
        HTTP_PROXY = $null
        HTTPS_PROXY = $null
        ALL_PROXY = $null
        NO_PROXY = "127.0.0.1,localhost"
    }
}

function Start-Scenario {
    param(
        [string]$ResolvedExePath,
        [string]$ScenarioName,
        [hashtable]$EnvironmentOverrides
    )

    Stop-MatchingProcesses -ProcessName "pengbo-workbench" -ResolvedPath $ResolvedExePath
    if ($script:resolvedSidecarPath) {
        Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $script:resolvedSidecarPath
    }
    $process = Start-DesktopWithEnv -ResolvedExePath $ResolvedExePath -EnvironmentOverrides $EnvironmentOverrides
    $health = Wait-ForHealth -Url $baseUrl -TimeoutSeconds $HealthTimeoutSeconds
    $runtime = Invoke-ApiJson -Method Get -Path "/settings/runtime"
    $workbenchProcesses = @(Get-ProcessSnapshot -ProcessName "pengbo-workbench" -ResolvedPath $ResolvedExePath)
    $workbenchPid = $null
    if ($process -and $process.PSObject.Properties["Id"]) {
        $workbenchPid = $process.Id
    }
    elseif ($workbenchProcesses.Count -gt 0) {
        $workbenchPid = $workbenchProcesses[0].Id
    }
    $result.health_ready = $true
    $result.scenarios[$ScenarioName].health_ready_seconds = $health.seconds
    $result.scenarios[$ScenarioName].workbench_pid = $workbenchPid
    $result.scenarios[$ScenarioName].runtime_mode = $runtime.runtime_mode
    $result.scenarios[$ScenarioName].base_url = $runtime.base_url
    $result.scenarios[$ScenarioName].log_dir = $runtime.log_dir
    $result.scenarios[$ScenarioName].bootstrap_log_path = $runtime.sidecar_bootstrap_path
    $result.log_dir = $runtime.log_dir
    $result.bootstrap_log_path = $runtime.sidecar_bootstrap_path
    if (-not $script:dataDirPath) {
        $script:dataDirPath = [string]$runtime.data_dir
        $result.data_dir = $script:dataDirPath
    }
    return $runtime
}

function Stop-DesktopScenario {
    param([string]$ResolvedExePath)

    Stop-MatchingProcesses -ProcessName "pengbo-workbench" -ResolvedPath $ResolvedExePath
    if ($script:resolvedSidecarPath) {
        Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $script:resolvedSidecarPath
    }
}

function Backup-DataDirectory {
    param([string]$Path)

    $script:backupDirPath = New-TemporaryPath -Prefix "pengbo-t19-backup"
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

function Reset-SeedTransactions {
    $existing = @(Invoke-ApiJson -Method Get -Path "/portfolio/transactions")
    foreach ($transaction in $existing) {
        Invoke-ApiJson -Method Delete -Path "/portfolio/transactions/$($transaction.id)" | Out-Null
    }

    $created = Invoke-ApiJson -Method Post -Path "/portfolio/transactions" -Body $seedTransaction
    return $created
}

function Get-PortfolioSnapshot {
    return [ordered]@{
        summary = Invoke-ApiJson -Method Get -Path "/portfolio/summary"
        holdings = @(Invoke-ApiJson -Method Get -Path "/portfolio/holdings")
        transactions = @(Invoke-ApiJson -Method Get -Path "/portfolio/transactions")
    }
}

function Assert-Condition {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Assert-AnalyticsPresent {
    param(
        [object]$Summary,
        [string]$ScenarioName
    )

    Assert-Condition ($null -ne $Summary.analytics) "$ScenarioName scenario missing additive analytics payload."
    Assert-Condition ($null -ne $Summary.analytics.pnl) "$ScenarioName scenario missing analytics PnL payload."
    Assert-Condition (@($Summary.analytics.windows).Count -ge 5) "$ScenarioName scenario missing analytics time windows."
    Assert-Condition ($null -ne $Summary.analytics.allocation) "$ScenarioName scenario missing analytics allocation payload."
}

function Get-BenchmarkStatus {
    param(
        [object]$BenchmarkStatus,
        [string]$Symbol
    )

    $property = $BenchmarkStatus.PSObject.Properties[$Symbol]
    if ($null -eq $property) {
        return $null
    }
    return [string]$property.Value
}

function Get-BenchmarkKeys {
    param([object]$BenchmarkStatus)

    return @($BenchmarkStatus.PSObject.Properties | ForEach-Object { $_.Name })
}

function Update-TransactionNotes {
    param(
        [object]$Transaction,
        [string]$ScenarioTag
    )

    $payload = [ordered]@{
        symbol = $Transaction.symbol
        side = $Transaction.side
        quantity = [double]$Transaction.quantity
        price = [double]$Transaction.price
        fees = [double]$Transaction.fees
        traded_at = $Transaction.traded_at
        notes = "$($Transaction.notes) [$ScenarioTag]"
    }
    return Invoke-ApiJson -Method Put -Path "/portfolio/transactions/$($Transaction.id)" -Body $payload
}

function Summarize-Holdings {
    param([object[]]$Holdings)

    return @($Holdings | ForEach-Object {
            [ordered]@{
                symbol = $_.symbol
                valuation_status = $_.valuation_status
                market_value = $_.market_value
                stale = $_.stale
            }
        })
}

function Set-ColdCacheState {
    param([string]$Path)

    $duckDir = Join-Path $Path "duckdb"
    if (Test-Path -LiteralPath $duckDir) {
        Remove-Item -LiteralPath $duckDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $duckDir -Force | Out-Null
}

try {
    $script:resolvedExePath = (Resolve-Path $ExePath).Path
    $script:resolvedSidecarPath = (Resolve-Path $sidecarPath).Path
    $script:resolvedOutputPath = [System.IO.Path]::GetFullPath($OutputPath)
    $result.exe_path = $script:resolvedExePath

    Stop-MatchingProcesses -ProcessName "pengbo-workbench" -ResolvedPath $script:resolvedExePath
    Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $script:resolvedSidecarPath

    $discoveryRuntime = Start-Scenario -ResolvedExePath $script:resolvedExePath -ScenarioName "online" -EnvironmentOverrides (Get-OnlineEnvironmentOverrides)
    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath

    Backup-DataDirectory -Path $script:dataDirPath

    $null = Start-Scenario -ResolvedExePath $script:resolvedExePath -ScenarioName "online" -EnvironmentOverrides (Get-OnlineEnvironmentOverrides)
    $seededTransaction = Reset-SeedTransactions
    $onlineSnapshot = Get-PortfolioSnapshot
    Assert-Condition ($onlineSnapshot.transactions.Count -eq 1) "Online scenario did not keep exactly one seeded portfolio transaction."
    Assert-Condition ($onlineSnapshot.transactions[0].symbol -eq "AAPL") "Online scenario returned an unexpected transaction symbol."
    Assert-Condition ($onlineSnapshot.holdings.Count -eq 1) "Online scenario did not produce exactly one holding."
    Assert-Condition ($onlineSnapshot.holdings[0].valuation_status -ne "unavailable") "Online scenario failed to value the seeded holding."
    Assert-Condition ($onlineSnapshot.summary.positions -eq 1) "Online scenario summary did not report one open position."
    Assert-AnalyticsPresent -Summary $onlineSnapshot.summary -ScenarioName "Online"
    $onlineBenchmarkKeys = Get-BenchmarkKeys -BenchmarkStatus $onlineSnapshot.summary.benchmark_status
    Assert-Condition ($onlineBenchmarkKeys -contains "SPY") "Online scenario missing SPY benchmark status."
    Assert-Condition ($onlineBenchmarkKeys -contains "BTC/USDT") "Online scenario missing BTC/USDT benchmark status."
    $result.scenarios.online = [ordered]@{
        health_ready_seconds = $result.scenarios.online.health_ready_seconds
        workbench_pid = $result.scenarios.online.workbench_pid
        runtime_mode = $result.scenarios.online.runtime_mode
        base_url = $result.scenarios.online.base_url
        log_dir = $result.scenarios.online.log_dir
        bootstrap_log_path = $result.scenarios.online.bootstrap_log_path
        seeded_transaction_id = $seededTransaction.id
        holdings = Summarize-Holdings -Holdings $onlineSnapshot.holdings
        benchmark_status = $onlineSnapshot.summary.benchmark_status
        analytics_windows_count = @($onlineSnapshot.summary.analytics.windows).Count
        analytics_pnl_method = $onlineSnapshot.summary.analytics.pnl.method
        degraded = $onlineSnapshot.summary.degraded
        missing_symbols = @($onlineSnapshot.summary.missing_symbols)
        transactions_count = $onlineSnapshot.transactions.Count
    }
    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath

    $null = Start-Scenario -ResolvedExePath $script:resolvedExePath -ScenarioName "offline_with_cache" -EnvironmentOverrides (Get-OfflineEnvironmentOverrides)
    $offlineCachedSnapshot = Get-PortfolioSnapshot
    Assert-Condition ($offlineCachedSnapshot.transactions.Count -eq 1) "Offline-with-cache scenario lost the seeded transaction."
    $updatedCachedTx = Update-TransactionNotes -Transaction $offlineCachedSnapshot.transactions[0] -ScenarioTag "offline_with_cache"
    Assert-Condition ($offlineCachedSnapshot.holdings.Count -eq 1) "Offline-with-cache scenario did not return the seeded holding."
    Assert-Condition ($offlineCachedSnapshot.holdings[0].valuation_status -eq "cached") "Offline-with-cache scenario did not downgrade the holding to cached."
    Assert-Condition ([bool]$offlineCachedSnapshot.summary.degraded) "Offline-with-cache scenario should mark summary as degraded."
    Assert-Condition (@($offlineCachedSnapshot.summary.missing_symbols).Count -eq 0) "Offline-with-cache scenario unexpectedly reported missing symbols."
    Assert-AnalyticsPresent -Summary $offlineCachedSnapshot.summary -ScenarioName "Offline-with-cache"
    Assert-Condition ((Get-BenchmarkStatus -BenchmarkStatus $offlineCachedSnapshot.summary.benchmark_status -Symbol "SPY") -eq "cached") "Offline-with-cache scenario expected SPY benchmark cache fallback."
    Assert-Condition ((Get-BenchmarkStatus -BenchmarkStatus $offlineCachedSnapshot.summary.benchmark_status -Symbol "BTC/USDT") -eq "cached") "Offline-with-cache scenario expected BTC/USDT benchmark cache fallback."
    $result.scenarios.offline_with_cache = [ordered]@{
        health_ready_seconds = $result.scenarios.offline_with_cache.health_ready_seconds
        workbench_pid = $result.scenarios.offline_with_cache.workbench_pid
        runtime_mode = $result.scenarios.offline_with_cache.runtime_mode
        base_url = $result.scenarios.offline_with_cache.base_url
        log_dir = $result.scenarios.offline_with_cache.log_dir
        bootstrap_log_path = $result.scenarios.offline_with_cache.bootstrap_log_path
        holdings = Summarize-Holdings -Holdings $offlineCachedSnapshot.holdings
        benchmark_status = $offlineCachedSnapshot.summary.benchmark_status
        analytics_windows_count = @($offlineCachedSnapshot.summary.analytics.windows).Count
        analytics_pnl_method = $offlineCachedSnapshot.summary.analytics.pnl.method
        degraded = $offlineCachedSnapshot.summary.degraded
        missing_symbols = @($offlineCachedSnapshot.summary.missing_symbols)
        transactions_count = $offlineCachedSnapshot.transactions.Count
        updated_transaction_notes = $updatedCachedTx.notes
    }
    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath

    Set-ColdCacheState -Path $script:dataDirPath
    $null = Start-Scenario -ResolvedExePath $script:resolvedExePath -ScenarioName "offline_cold_cache" -EnvironmentOverrides (Get-OfflineEnvironmentOverrides)
    $offlineColdSnapshot = Get-PortfolioSnapshot
    Assert-Condition ($offlineColdSnapshot.transactions.Count -eq 1) "Offline-cold-cache scenario lost the seeded transaction."
    $updatedColdTx = Update-TransactionNotes -Transaction $offlineColdSnapshot.transactions[0] -ScenarioTag "offline_cold_cache"
    Assert-Condition ($offlineColdSnapshot.holdings.Count -eq 1) "Offline-cold-cache scenario did not return the seeded holding."
    Assert-Condition ($offlineColdSnapshot.holdings[0].valuation_status -eq "unavailable") "Offline-cold-cache scenario should mark the holding as unavailable."
    Assert-Condition ([bool]$offlineColdSnapshot.summary.degraded) "Offline-cold-cache scenario should mark summary as degraded."
    Assert-Condition (@($offlineColdSnapshot.summary.missing_symbols) -contains "AAPL") "Offline-cold-cache scenario should report AAPL as missing."
    Assert-AnalyticsPresent -Summary $offlineColdSnapshot.summary -ScenarioName "Offline-cold-cache"
    Assert-Condition ((Get-BenchmarkStatus -BenchmarkStatus $offlineColdSnapshot.summary.benchmark_status -Symbol "SPY") -eq "unavailable") "Offline-cold-cache scenario should mark SPY benchmark unavailable."
    Assert-Condition ((Get-BenchmarkStatus -BenchmarkStatus $offlineColdSnapshot.summary.benchmark_status -Symbol "BTC/USDT") -eq "unavailable") "Offline-cold-cache scenario should mark BTC/USDT benchmark unavailable."
    $result.scenarios.offline_cold_cache = [ordered]@{
        health_ready_seconds = $result.scenarios.offline_cold_cache.health_ready_seconds
        workbench_pid = $result.scenarios.offline_cold_cache.workbench_pid
        runtime_mode = $result.scenarios.offline_cold_cache.runtime_mode
        base_url = $result.scenarios.offline_cold_cache.base_url
        log_dir = $result.scenarios.offline_cold_cache.log_dir
        bootstrap_log_path = $result.scenarios.offline_cold_cache.bootstrap_log_path
        holdings = Summarize-Holdings -Holdings $offlineColdSnapshot.holdings
        benchmark_status = $offlineColdSnapshot.summary.benchmark_status
        analytics_windows_count = @($offlineColdSnapshot.summary.analytics.windows).Count
        analytics_pnl_method = $offlineColdSnapshot.summary.analytics.pnl.method
        degraded = $offlineColdSnapshot.summary.degraded
        missing_symbols = @($offlineColdSnapshot.summary.missing_symbols)
        transactions_count = $offlineColdSnapshot.transactions.Count
        updated_transaction_notes = $updatedColdTx.notes
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
