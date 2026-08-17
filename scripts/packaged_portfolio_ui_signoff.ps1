param(
    [string]$ExePath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\pengbo-workbench.exe"),
    [string]$OutputPath = (Join-Path (Join-Path $PSScriptRoot "..") "logs\\portfolio-ui-signoff-latest.json"),
    [int]$HealthTimeoutSeconds = 25,
    [int]$UiTimeoutSeconds = 25
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$baseUrl = "http://127.0.0.1:8765/api/v1"
$sidecarPath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\binaries\\pengbo-sidecar\\pengbo-sidecar.exe")
$offlineProxyUrl = "http://127.0.0.1:9"
$seedTransaction = [ordered]@{
    symbol = "AAPL"
    side = "buy"
    quantity = 2.0
    price = 175.0
    fees = 0.0
    traded_at = "2026-04-18T09:30:00Z"
    notes = "T22 seeded portfolio transaction"
}
$result = [ordered]@{
    exe_path = ""
    started_at = (Get-Date).ToString("o")
    finished_at = $null
    health_ready = $false
    data_dir = $null
    log_dir = $null
    bootstrap_log_path = $null
    failures = New-Object System.Collections.Generic.List[string]
    scenarios = [ordered]@{
        ready = [ordered]@{}
        cached = [ordered]@{}
        unavailable = [ordered]@{}
    }
}

$script:resolvedExePath = $null
$script:resolvedSidecarPath = $null
$script:resolvedOutputPath = $null
$script:dataDirPath = $null
$script:backupDirPath = $null
$script:dataDirBackedUp = $false
$script:originalPreferences = $null
$script:portfolioPreferencesApplied = $false

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
        PENGBO_MARKET_FIXTURES = $null
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

    $script:backupDirPath = New-TemporaryPath -Prefix "pengbo-t22-backup"
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
    $existingResponse = Invoke-ApiJson -Method Get -Path "/portfolio/transactions"
    $existing = @()
    if ($null -ne $existingResponse) {
        $existing = @($existingResponse)
    }
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

function Wait-ForPortfolioSnapshot {
    param(
        [scriptblock]$Condition,
        [string]$FailureMessage,
        [int]$TimeoutSeconds = 20
    )

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        $snapshot = Get-PortfolioSnapshot
        if (& $Condition $snapshot) {
            return $snapshot
        }
        Start-Sleep -Milliseconds 800
    }

    throw $FailureMessage
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

function Get-RenderedPortfolioPillState {
    param([object]$Snapshot)

    if ([bool]$Snapshot.summary.degraded) {
        return "degraded"
    }
    if ([bool]$Snapshot.summary.stale) {
        return "cached"
    }
    return "live"
}

function Set-ColdCacheState {
    param([string]$Path)

    $duckDir = Join-Path $Path "duckdb"
    if (Test-Path -LiteralPath $duckDir) {
        Remove-Item -LiteralPath $duckDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $duckDir -Force | Out-Null
}

function Ensure-PortfolioDefaultView {
    $preferences = Invoke-ApiJson -Method Get -Path "/settings/preferences"
    $script:originalPreferences = $preferences
    if ($preferences.default_view -eq "portfolio") {
        return
    }

    $payload = [ordered]@{
        default_view = "portfolio"
        quote_ttl_minutes = [int]$preferences.quote_ttl_minutes
        log_collection_enabled = [bool]$preferences.log_collection_enabled
        diagnostics_export_enabled = [bool]$preferences.diagnostics_export_enabled
    }
    Invoke-ApiJson -Method Put -Path "/settings/preferences" -Body $payload | Out-Null
    $script:portfolioPreferencesApplied = $true
}

function Wait-ForMainWindow {
    param(
        [string]$ResolvedExePath,
        [int]$TimeoutSeconds
    )

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        $processes = @(Get-ProcessSnapshot -ProcessName "pengbo-workbench" -ResolvedPath $ResolvedExePath | Where-Object {
                $_.MainWindowHandle -ne 0
            })
        if ($processes.Count -gt 0) {
            $windowProcess = $processes[0]
            $windowHandle = [System.IntPtr]$windowProcess.MainWindowHandle
            $windowElement = [System.Windows.Automation.AutomationElement]::FromHandle($windowHandle)
            if ($null -ne $windowElement) {
                return [ordered]@{
                    process = $windowProcess
                    window = $windowElement
                    seconds = [Math]::Round($stopwatch.Elapsed.TotalSeconds, 2)
                }
            }
        }

        Start-Sleep -Milliseconds 300
    }

    throw "Desktop main window did not become available within $TimeoutSeconds seconds."
}

function Get-ElementByName {
    param(
        [System.Windows.Automation.AutomationElement]$Root,
        [string]$Name
    )

    $condition = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::NameProperty,
        $Name
    )
    return $Root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
}

function Open-PortfolioView {
    param(
        [System.Windows.Automation.AutomationElement]$Root,
        [int]$TimeoutSeconds
    )

    $portfolioButton = Wait-ForElementByName -Root $Root -Name "nav-portfolio" -TimeoutSeconds $TimeoutSeconds

    $invoke = $portfolioButton.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $invoke.Invoke()
}

function Wait-ForElementByName {
    param(
        [System.Windows.Automation.AutomationElement]$Root,
        [string]$Name,
        [int]$TimeoutSeconds
    )

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        $match = Get-ElementByName -Root $Root -Name $Name
        if ($null -ne $match) {
            return $match
        }
        Start-Sleep -Milliseconds 300
    }

    throw "UI element '$Name' did not appear within $TimeoutSeconds seconds."
}

function Invoke-PortfolioElement {
    param([System.Windows.Automation.AutomationElement]$Element)

    $invoke = $null
    if ($Element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$invoke)) {
        $invoke.Invoke()
        return
    }
    $selection = $null
    if ($Element.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$selection)) {
        $selection.Select()
        return
    }
    throw "Element '$($Element.Current.Name)' does not expose an actionable automation pattern."
}

function Wait-ForAnyElementByName {
    param(
        [System.Windows.Automation.AutomationElement]$Root,
        [string[]]$Names,
        [int]$TimeoutSeconds
    )

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        foreach ($name in $Names) {
            $match = Get-ElementByName -Root $Root -Name $name
            if ($null -ne $match) {
                return [ordered]@{
                    name = $name
                    element = $match
                }
            }
        }
        Start-Sleep -Milliseconds 300
    }

    throw "None of the expected UI elements appeared within $TimeoutSeconds seconds: $($Names -join ', ')"
}

function Get-AllAutomationNames {
    param([System.Windows.Automation.AutomationElement]$Root)

    $names = New-Object System.Collections.Generic.List[string]
    $elements = $Root.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.Condition]::TrueCondition
    )

    for ($index = 0; $index -lt $elements.Count; $index++) {
        $name = $elements[$index].Current.Name
        if (-not [string]::IsNullOrWhiteSpace($name)) {
            $names.Add($name)
        }
    }

    return @($names | Select-Object -Unique)
}

function Invoke-PortfolioUiSignoff {
    param(
        [string]$ResolvedExePath,
        [string]$ScenarioName,
        [object]$Snapshot,
        [string[]]$ExpectedPillStates,
        [string]$ExpectedHoldingStatus
    )

    $windowState = Wait-ForMainWindow -ResolvedExePath $ResolvedExePath -TimeoutSeconds $UiTimeoutSeconds
    $window = $windowState.window
    $scenarioResult = $result.scenarios[$ScenarioName]
    $scenarioResult.window_title = $window.Current.Name
    $scenarioResult.window_pid = $windowState.process.Id
    $scenarioResult.window_ready_seconds = $windowState.seconds

    Open-PortfolioView -Root $window -TimeoutSeconds $UiTimeoutSeconds
    $viewMarker = Wait-ForAnyElementByName -Root $window -Names @(
        "portfolio-view state=ready",
        "portfolio-view state=degraded",
        "portfolio-view state=empty",
        "portfolio-view state=connecting"
    ) -TimeoutSeconds $UiTimeoutSeconds

    $pillOptions = @($ExpectedPillStates | ForEach-Object { "portfolio-status-pill state=$_" })
    $pillMarker = (Wait-ForAnyElementByName -Root $window -Names $pillOptions -TimeoutSeconds $UiTimeoutSeconds).name
    $holdingMarker = "portfolio-holding symbol=AAPL valuation=$ExpectedHoldingStatus"
    $transactionMarker = "portfolio-transaction-submit mode=add enabled=true"

    $noteMarkers = @()
    foreach ($note in @($Snapshot.summary.notes)) {
        $noteMarkers += "portfolio-note text=$note"
    }

    foreach ($noteMarker in $noteMarkers) {
        Wait-ForElementByName -Root $window -Name $noteMarker -TimeoutSeconds $UiTimeoutSeconds | Out-Null
    }

    $holdingsSubroute = Wait-ForElementByName -Root $window -Name "subroute:/portfolio/holdings" -TimeoutSeconds $UiTimeoutSeconds
    Invoke-PortfolioElement -Element $holdingsSubroute
    Wait-ForElementByName -Root $window -Name $holdingMarker -TimeoutSeconds $UiTimeoutSeconds | Out-Null

    $transactionSubroute = Wait-ForElementByName -Root $window -Name "subroute:/portfolio/transactions/new" -TimeoutSeconds $UiTimeoutSeconds
    Invoke-PortfolioElement -Element $transactionSubroute
    $transactionButton = Wait-ForElementByName -Root $window -Name $transactionMarker -TimeoutSeconds $UiTimeoutSeconds
    Assert-Condition ([bool]$transactionButton.Current.IsEnabled) "$ScenarioName scenario did not keep the transaction submit action enabled."

    $scenarioResult.ui_signoff = [ordered]@{
        heading_ok = $true
        view_marker = $viewMarker.name
        pill_marker = $pillMarker
        holding_marker = $holdingMarker
        transaction_marker = $transactionMarker
        note_markers = $noteMarkers
        automation_names = Get-AllAutomationNames -Root $window
    }
}

function Summarize-Holdings {
    param([object[]]$Holdings)

    return @($Holdings | ForEach-Object {
            $holdingNotes = @()
            if ($_.PSObject.Properties["notes"]) {
                $holdingNotes = @($_.notes)
            }
            [ordered]@{
                symbol = $_.symbol
                valuation_status = $_.valuation_status
                market_value = $_.market_value
                stale = $_.stale
                notes = $holdingNotes
            }
        })
}

try {
    $script:resolvedExePath = (Resolve-Path $ExePath).Path
    $script:resolvedSidecarPath = (Resolve-Path $sidecarPath).Path
    $script:resolvedOutputPath = [System.IO.Path]::GetFullPath($OutputPath)
    $result.exe_path = $script:resolvedExePath

    Stop-MatchingProcesses -ProcessName "pengbo-workbench" -ResolvedPath $script:resolvedExePath
    Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $script:resolvedSidecarPath

    $null = Start-Scenario -ResolvedExePath $script:resolvedExePath -ScenarioName "ready" -EnvironmentOverrides (Get-OnlineEnvironmentOverrides)
    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath

    Backup-DataDirectory -Path $script:dataDirPath

    $null = Start-Scenario -ResolvedExePath $script:resolvedExePath -ScenarioName "ready" -EnvironmentOverrides (Get-OnlineEnvironmentOverrides)
    Ensure-PortfolioDefaultView
    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath

    $null = Start-Scenario -ResolvedExePath $script:resolvedExePath -ScenarioName "ready" -EnvironmentOverrides (Get-OnlineEnvironmentOverrides)
    $seededTransaction = Reset-SeedTransactions
    $readySnapshot = Wait-ForPortfolioSnapshot -TimeoutSeconds 20 -FailureMessage "Ready scenario did not converge to a live holding snapshot." -Condition {
        param($snapshot)

        if ($snapshot.transactions.Count -ne 1) {
            return $false
        }
        if ($snapshot.holdings.Count -ne 1) {
            return $false
        }
        if ($snapshot.holdings[0].valuation_status -ne "live") {
            return $false
        }
        return $true
    }
    Assert-Condition ($readySnapshot.transactions.Count -eq 1) "Ready scenario did not keep exactly one seeded portfolio transaction."
    Assert-Condition ($readySnapshot.holdings.Count -eq 1) "Ready scenario did not produce exactly one holding."
    Assert-Condition ($readySnapshot.holdings[0].valuation_status -eq "live") "Ready scenario should keep the holding live."
    Invoke-PortfolioUiSignoff -ResolvedExePath $script:resolvedExePath -ScenarioName "ready" -Snapshot $readySnapshot -ExpectedPillStates @("live", "degraded", "cached") -ExpectedHoldingStatus "live"
    $result.scenarios.ready.seeded_transaction_id = $seededTransaction.id
    $result.scenarios.ready.holdings = Summarize-Holdings -Holdings $readySnapshot.holdings
    $result.scenarios.ready.degraded = $readySnapshot.summary.degraded
    $result.scenarios.ready.notes = @($readySnapshot.summary.notes)
    $result.scenarios.ready.missing_symbols = @($readySnapshot.summary.missing_symbols)
    $result.scenarios.ready.benchmark_status = $readySnapshot.summary.benchmark_status
    $result.scenarios.ready.transactions_count = $readySnapshot.transactions.Count
    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath

    $null = Start-Scenario -ResolvedExePath $script:resolvedExePath -ScenarioName "cached" -EnvironmentOverrides (Get-OfflineEnvironmentOverrides)
    $cachedSnapshot = Get-PortfolioSnapshot
    Assert-Condition ($cachedSnapshot.transactions.Count -eq 1) "Cached scenario lost the seeded transaction."
    Assert-Condition ($cachedSnapshot.holdings.Count -eq 1) "Cached scenario did not return the seeded holding."
    Assert-Condition ($cachedSnapshot.holdings[0].valuation_status -eq "cached") "Cached scenario did not downgrade the holding to cached."
    Assert-Condition ([bool]$cachedSnapshot.summary.degraded) "Cached scenario should mark summary as degraded."
    Assert-Condition (@($cachedSnapshot.summary.missing_symbols).Count -eq 0) "Cached scenario unexpectedly reported missing symbols."
    Assert-Condition ((Get-BenchmarkStatus -BenchmarkStatus $cachedSnapshot.summary.benchmark_status -Symbol "SPY") -eq "cached") "Cached scenario expected SPY benchmark cache fallback."
    Assert-Condition ((Get-BenchmarkStatus -BenchmarkStatus $cachedSnapshot.summary.benchmark_status -Symbol "BTC/USDT") -eq "cached") "Cached scenario expected BTC/USDT benchmark cache fallback."
    Invoke-PortfolioUiSignoff -ResolvedExePath $script:resolvedExePath -ScenarioName "cached" -Snapshot $cachedSnapshot -ExpectedPillStates @((Get-RenderedPortfolioPillState -Snapshot $cachedSnapshot)) -ExpectedHoldingStatus "cached"
    $result.scenarios.cached.holdings = Summarize-Holdings -Holdings $cachedSnapshot.holdings
    $result.scenarios.cached.degraded = $cachedSnapshot.summary.degraded
    $result.scenarios.cached.notes = @($cachedSnapshot.summary.notes)
    $result.scenarios.cached.missing_symbols = @($cachedSnapshot.summary.missing_symbols)
    $result.scenarios.cached.benchmark_status = $cachedSnapshot.summary.benchmark_status
    $result.scenarios.cached.transactions_count = $cachedSnapshot.transactions.Count
    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath

    Set-ColdCacheState -Path $script:dataDirPath
    $null = Start-Scenario -ResolvedExePath $script:resolvedExePath -ScenarioName "unavailable" -EnvironmentOverrides (Get-OfflineEnvironmentOverrides)
    $unavailableSnapshot = Get-PortfolioSnapshot
    Assert-Condition ($unavailableSnapshot.transactions.Count -eq 1) "Unavailable scenario lost the seeded transaction."
    Assert-Condition ($unavailableSnapshot.holdings.Count -eq 1) "Unavailable scenario did not return the seeded holding."
    Assert-Condition ($unavailableSnapshot.holdings[0].valuation_status -eq "unavailable") "Unavailable scenario should mark the holding as unavailable."
    Assert-Condition ([bool]$unavailableSnapshot.summary.degraded) "Unavailable scenario should mark summary as degraded."
    Assert-Condition (@($unavailableSnapshot.summary.missing_symbols) -contains "AAPL") "Unavailable scenario should report AAPL as missing."
    Assert-Condition ((Get-BenchmarkStatus -BenchmarkStatus $unavailableSnapshot.summary.benchmark_status -Symbol "SPY") -eq "unavailable") "Unavailable scenario should mark SPY benchmark unavailable."
    Assert-Condition ((Get-BenchmarkStatus -BenchmarkStatus $unavailableSnapshot.summary.benchmark_status -Symbol "BTC/USDT") -eq "unavailable") "Unavailable scenario should mark BTC/USDT benchmark unavailable."
    Invoke-PortfolioUiSignoff -ResolvedExePath $script:resolvedExePath -ScenarioName "unavailable" -Snapshot $unavailableSnapshot -ExpectedPillStates @((Get-RenderedPortfolioPillState -Snapshot $unavailableSnapshot)) -ExpectedHoldingStatus "unavailable"
    $result.scenarios.unavailable.holdings = Summarize-Holdings -Holdings $unavailableSnapshot.holdings
    $result.scenarios.unavailable.degraded = $unavailableSnapshot.summary.degraded
    $result.scenarios.unavailable.notes = @($unavailableSnapshot.summary.notes)
    $result.scenarios.unavailable.missing_symbols = @($unavailableSnapshot.summary.missing_symbols)
    $result.scenarios.unavailable.benchmark_status = $unavailableSnapshot.summary.benchmark_status
    $result.scenarios.unavailable.transactions_count = $unavailableSnapshot.transactions.Count
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
