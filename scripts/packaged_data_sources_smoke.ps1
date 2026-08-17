param(
    [string]$ExePath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\pengbo-workbench.exe"),
    [string]$OutputPath = (Join-Path (Join-Path $PSScriptRoot "..") "logs\\data-sources-packaged-smoke-latest.json"),
    [int]$HealthTimeoutSeconds = 30,
    [int]$UiTimeoutSeconds = 60
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$baseUrl = "http://127.0.0.1:8765/api/v1"
$sidecarPath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\binaries\\pengbo-sidecar\\pengbo-sidecar.exe")
$expectedCatalogProviders = @("market", "fundamentals", "edgar", "binance", "worldbank", "dbnomics", "rss_events", "fred", "coingecko", "tushare", "hkma")
$expectedDataSourceProviders = @("worldbank", "dbnomics", "rss_events", "fred", "coingecko", "tushare", "hkma")
$result = [ordered]@{
    exe_path = ""
    started_at = (Get-Date).ToString("o")
    finished_at = $null
    health_ready = $false
    data_dir = $null
    log_dir = $null
    catalog_provider_count = 0
    provider_count = 0
    catalog_contracts_by_provider = [ordered]@{}
    status_by_provider = [ordered]@{}
    credential_state_by_provider = [ordered]@{}
    scenario_results = [ordered]@{}
    report_export_path = $null
    report_export_exists = $false
    report_source_count = 0
    ui_markers = [ordered]@{}
    preview_routes = New-Object System.Collections.Generic.List[string]
    source_safe_checks = [ordered]@{
        export_path_inside_repo = $false
        export_path_contains_secret_marker = $false
        smoke_log_contains_secret_marker = $false
    }
    failures = New-Object System.Collections.Generic.List[string]
}

$script:resolvedExePath = $null
$script:resolvedSidecarPath = $null
$script:resolvedOutputPath = $null
$script:dataDirPath = $null
$script:backupDirPath = $null
$script:dataDirBackedUp = $false
$script:originalPreferences = $null
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
    param([string]$SourcePath, [string]$DestinationPath)
    New-Item -ItemType Directory -Path $DestinationPath -Force | Out-Null
    foreach ($item in Get-ChildItem -LiteralPath $SourcePath -Force -ErrorAction SilentlyContinue) {
        Copy-Item -LiteralPath $item.FullName -Destination $DestinationPath -Recurse -Force
    }
}

function Backup-DataDirectory {
    param([string]$Path)
    $script:backupDirPath = New-TemporaryPath -Prefix "pengbo-t47-data-sources-backup"
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

function Stop-DesktopScenario {
    Stop-MatchingProcesses -ProcessName "pengbo-workbench" -ResolvedPath $script:resolvedExePath
    Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $script:resolvedSidecarPath
}

function Wait-ForHealth {
    param([string]$Url, [int]$TimeoutSeconds)
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        try {
            $health = Invoke-RestMethod -Uri "$Url/health" -TimeoutSec 3
            if ($health.status -eq "ok") {
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
        [int]$TimeoutSeconds = 90
    )
    $params = @{
        Method = $Method
        Uri = "$baseUrl$Path"
        TimeoutSec = $TimeoutSeconds
        UseBasicParsing = $true
    }
    if ($script:sessionHeaders.Count -gt 0) {
        $params.Headers = $script:sessionHeaders
    }
    if ($null -ne $Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 12)
        $params.ContentType = "application/json"
    }
    $response = Invoke-WebRequest @params
    if ([string]::IsNullOrWhiteSpace($response.Content)) {
        return $null
    }
    return ($response.Content | ConvertFrom-Json)
}

function Start-Desktop {
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $script:resolvedExePath
    $startInfo.UseShellExecute = $false
    $startInfo.WorkingDirectory = Split-Path -Parent $script:resolvedExePath
    $startInfo.Environment["NO_PROXY"] = "127.0.0.1,localhost"
    $process = [System.Diagnostics.Process]::Start($startInfo)
    if ($null -eq $process) {
        throw "Failed to start packaged desktop: $script:resolvedExePath"
    }
    return $process
}

function Wait-ForMainWindow {
    param([int]$TimeoutSeconds)
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        $processes = @(Get-ProcessSnapshot -ProcessName "pengbo-workbench" -ResolvedPath $script:resolvedExePath | Where-Object {
                $_.MainWindowHandle -ne 0
            })
        if ($processes.Count -gt 0) {
            $windowHandle = [System.IntPtr]$processes[0].MainWindowHandle
            $windowElement = [System.Windows.Automation.AutomationElement]::FromHandle($windowHandle)
            if ($null -ne $windowElement) {
                return $windowElement
            }
        }
        Start-Sleep -Milliseconds 300
    }
    throw "Desktop main window did not become available within $TimeoutSeconds seconds."
}

function Get-ElementByName {
    param([System.Windows.Automation.AutomationElement]$Root, [string]$Name)
    $condition = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::NameProperty,
        $Name
    )
    return $Root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
}

function Get-ElementNameStartsWith {
    param([System.Windows.Automation.AutomationElement]$Root, [string]$Prefix)
    $elements = $Root.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.Condition]::TrueCondition
    )
    for ($index = 0; $index -lt $elements.Count; $index++) {
        $name = $elements[$index].Current.Name
        if (-not [string]::IsNullOrWhiteSpace($name) -and $name.StartsWith($Prefix)) {
            return [ordered]@{
                name = $name
                element = $elements[$index]
            }
        }
    }
    return $null
}

function Wait-ForElementByName {
    param([System.Windows.Automation.AutomationElement]$Root, [string]$Name, [int]$TimeoutSeconds)
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        $match = Get-ElementByName -Root $Root -Name $Name
        if ($null -ne $match) {
            return $match
        }
        Start-Sleep -Milliseconds 300
    }
    throw "Could not find UI element named '$Name' within $TimeoutSeconds seconds."
}

function Wait-ForElementNameStartsWith {
    param([System.Windows.Automation.AutomationElement]$Root, [string]$Prefix, [int]$TimeoutSeconds)
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        $match = Get-ElementNameStartsWith -Root $Root -Prefix $Prefix
        if ($null -ne $match) {
            return $match
        }
        Start-Sleep -Milliseconds 300
    }
    throw "Could not find UI element starting with '$Prefix' within $TimeoutSeconds seconds."
}

function Invoke-UiElement {
    param([System.Windows.Automation.AutomationElement]$Element)
    $invokePattern = $null
    if ($Element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$invokePattern)) {
        $invokePattern.Invoke()
        return
    }
    $selectionPattern = $null
    if ($Element.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$selectionPattern)) {
        $selectionPattern.Select()
        return
    }
    throw "Element '$($Element.Current.Name)' does not support Invoke or SelectionItem."
}

function Assert-Condition {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) {
        throw $Message
    }
}

function Test-ContainsSecretMarker {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $false
    }
    return $Value -match '(?i)(api[_-]?key=|secret=|token=|password=|x-cg-demo-api-key|x-cg-pro-api-key)'
}

function Ensure-DataSourcesDefaultView {
    $preferences = Invoke-ApiJson -Method Get -Path "/settings/preferences"
    $script:originalPreferences = $preferences
    $payload = [ordered]@{
        default_view = "dataSources"
        quote_ttl_minutes = [int]$preferences.quote_ttl_minutes
        log_collection_enabled = [bool]$preferences.log_collection_enabled
        diagnostics_export_enabled = [bool]$preferences.diagnostics_export_enabled
        language = [string]$preferences.language
        density = [string]$preferences.density
    }
    Invoke-ApiJson -Method Put -Path "/settings/preferences" -Body $payload | Out-Null
}

function Restore-Preferences {
    if ($null -eq $script:originalPreferences) {
        return
    }
    $payload = [ordered]@{
        default_view = [string]$script:originalPreferences.default_view
        quote_ttl_minutes = [int]$script:originalPreferences.quote_ttl_minutes
        log_collection_enabled = [bool]$script:originalPreferences.log_collection_enabled
        diagnostics_export_enabled = [bool]$script:originalPreferences.diagnostics_export_enabled
        language = [string]$script:originalPreferences.language
        density = [string]$script:originalPreferences.density
    }
    Invoke-ApiJson -Method Put -Path "/settings/preferences" -Body $payload | Out-Null
}

try {
    $script:resolvedExePath = (Resolve-Path $ExePath).Path
    $script:resolvedSidecarPath = (Resolve-Path $sidecarPath).Path
    $script:resolvedOutputPath = [System.IO.Path]::GetFullPath($OutputPath)
    $result.exe_path = $script:resolvedExePath

    Stop-DesktopScenario
    Start-Desktop | Out-Null
    Wait-ForHealth -Url $baseUrl -TimeoutSeconds $HealthTimeoutSeconds
    $runtime = Invoke-ApiJson -Method Get -Path "/settings/runtime"
    $result.data_dir = $runtime.data_dir
    $result.log_dir = $runtime.log_dir
    $script:dataDirPath = [string]$runtime.data_dir

    Stop-DesktopScenario
    Backup-DataDirectory -Path $script:dataDirPath

    Start-Desktop | Out-Null
    Wait-ForHealth -Url $baseUrl -TimeoutSeconds $HealthTimeoutSeconds
    $result.health_ready = $true

    Ensure-DataSourcesDefaultView
    Stop-DesktopScenario
    Start-Desktop | Out-Null
    Wait-ForHealth -Url $baseUrl -TimeoutSeconds $HealthTimeoutSeconds
    $window = Wait-ForMainWindow -TimeoutSeconds $UiTimeoutSeconds

    $viewMarker = Wait-ForElementNameStartsWith -Root $window -Prefix "data-sources-view providers=$($expectedDataSourceProviders.Count)" -TimeoutSeconds $UiTimeoutSeconds
    $result.ui_markers.view = $viewMarker.name
    $catalogSummary = Wait-ForElementNameStartsWith -Root $window -Prefix "data-source-catalog-summary providers=" -TimeoutSeconds $UiTimeoutSeconds
    $result.ui_markers.catalog_summary = $catalogSummary.name
    foreach ($provider in $expectedDataSourceProviders) {
        $marker = Wait-ForElementNameStartsWith -Root $window -Prefix "data-source-provider provider=$provider health=" -TimeoutSeconds $UiTimeoutSeconds
        $result.ui_markers[$provider] = $marker.name
    }
    foreach ($provider in @("fred", "coingecko", "tushare")) {
        $marker = Wait-ForElementNameStartsWith -Root $window -Prefix "data-source-provider provider=$provider health=" -TimeoutSeconds $UiTimeoutSeconds
        Invoke-UiElement -Element $marker.element
        $credentialPanel = Wait-ForElementNameStartsWith -Root $window -Prefix "data-source-credential-panel provider=$provider" -TimeoutSeconds $UiTimeoutSeconds
        $result.ui_markers["$provider`_credential_panel"] = $credentialPanel.name
        if ($provider -ne "tushare") {
            $catalogSubroute = Wait-ForElementByName -Root $window -Name "subroute:/markets/data-sources/catalog" -TimeoutSeconds $UiTimeoutSeconds
            Invoke-UiElement -Element $catalogSubroute
        }
    }
    $catalogSubroute = Wait-ForElementByName -Root $window -Name "subroute:/markets/data-sources/catalog" -TimeoutSeconds $UiTimeoutSeconds
    Invoke-UiElement -Element $catalogSubroute
    $worldbankProvider = Wait-ForElementNameStartsWith -Root $window -Prefix "data-source-provider provider=worldbank health=" -TimeoutSeconds $UiTimeoutSeconds
    Invoke-UiElement -Element $worldbankProvider.element
    $previewSubroute = Wait-ForElementByName -Root $window -Name "subroute:/markets/data-sources/:provider/preview" -TimeoutSeconds $UiTimeoutSeconds
    Invoke-UiElement -Element $previewSubroute
    $macro = Wait-ForElementNameStartsWith -Root $window -Prefix "data-source-preview kind=macro" -TimeoutSeconds $UiTimeoutSeconds
    $result.preview_routes.Add("/markets/data-sources/worldbank/preview")

    $catalogSubroute = Wait-ForElementByName -Root $window -Name "subroute:/markets/data-sources/catalog" -TimeoutSeconds $UiTimeoutSeconds
    Invoke-UiElement -Element $catalogSubroute
    $coingeckoProvider = Wait-ForElementNameStartsWith -Root $window -Prefix "data-source-provider provider=coingecko health=" -TimeoutSeconds $UiTimeoutSeconds
    Invoke-UiElement -Element $coingeckoProvider.element
    $previewSubroute = Wait-ForElementByName -Root $window -Name "subroute:/markets/data-sources/:provider/preview" -TimeoutSeconds $UiTimeoutSeconds
    Invoke-UiElement -Element $previewSubroute
    $crypto = Wait-ForElementNameStartsWith -Root $window -Prefix "data-source-preview kind=crypto" -TimeoutSeconds $UiTimeoutSeconds
    $result.preview_routes.Add("/markets/data-sources/coingecko/preview")

    $selectedPreview = Wait-ForElementNameStartsWith -Root $window -Prefix "data-sources-view providers=$($expectedDataSourceProviders.Count) selected=coingecko section=dataSourcePreview" -TimeoutSeconds $UiTimeoutSeconds
    $result.ui_markers.selected_preview = $selectedPreview.name
    $result.ui_markers.macro_preview = $macro.name
    $result.ui_markers.crypto_preview = $crypto.name

    $status = Invoke-ApiJson -Method Get -Path "/data-sources/status"
    $result.provider_count = @($status.providers).Count
    foreach ($providerStatus in $status.providers) {
        $result.status_by_provider[$providerStatus.provider] = [ordered]@{
            health = $providerStatus.health
            configured = $providerStatus.configured
            requires_credentials = $providerStatus.requires_credentials
            freshness_state = $providerStatus.freshness_state
            stale = $providerStatus.stale
            cache_age_seconds = $providerStatus.cache_age_seconds
            cache_ttl_seconds = if ($providerStatus.freshness) { $providerStatus.freshness.cache_ttl_seconds } else { $null }
            data_quality = if ($providerStatus.data_quality) { $providerStatus.data_quality.overall } else { $null }
        }
    }
    Assert-Condition (@($status.providers).Count -eq $expectedDataSourceProviders.Count) "Data Sources runtime status did not return the expected source provider count."
    foreach ($provider in $expectedDataSourceProviders) {
        Assert-Condition ($null -ne $result.status_by_provider[$provider]) "Data Sources runtime status omitted '$provider'."
    }

    $catalog = Invoke-ApiJson -Method Get -Path "/connections/catalog"
    $result.catalog_provider_count = @($catalog.providers).Count
    Assert-Condition ($result.catalog_provider_count -eq $expectedCatalogProviders.Count) "Connections catalog returned $($result.catalog_provider_count) providers instead of $($expectedCatalogProviders.Count)."
    foreach ($provider in $expectedCatalogProviders) {
        $catalogItem = @($catalog.providers | Where-Object { $_.provider -eq $provider })[0]
        if ($null -eq $catalogItem) {
            throw "Catalog did not include provider '$provider'."
        }
        if (-not $catalogItem.read_only -or $catalogItem.live_trading) {
            throw "Provider '$provider' violated the read-only/no-live-trading contract."
        }
        Assert-Condition ($catalogItem.write_status -eq "read_only") "Provider '$provider' did not expose read_only write_status."
        Assert-Condition ($catalogItem.freshness -and $catalogItem.freshness.cache_ttl_seconds) "Provider '$provider' did not expose freshness metadata."
        Assert-Condition ($catalogItem.provenance -and $catalogItem.provenance.source_url) "Provider '$provider' did not expose provenance metadata."
        $capabilities = @($catalogItem.capabilities)
        Assert-Condition ($capabilities.Count -ge 7) "Provider '$provider' did not expose the full capability matrix."
        $result.catalog_contracts_by_provider[$provider] = [ordered]@{
            label = $catalogItem.label
            read_only = $catalogItem.read_only
            live_trading = $catalogItem.live_trading
            write_status = $catalogItem.write_status
            testable = $catalogItem.testable
            test_mode = $catalogItem.test_mode
            freshness_ttl_seconds = $catalogItem.freshness.cache_ttl_seconds
            provenance_source_url = $catalogItem.provenance.source_url
            credential_gated_capabilities = @($capabilities | Where-Object { $_.requires_credentials } | ForEach-Object { $_.key })
            unsupported_capabilities = @($capabilities | Where-Object { -not $_.supported } | ForEach-Object { $_.key })
        }
    }
    $credentialStatus = Invoke-ApiJson -Method Get -Path "/connections/status"
    foreach ($providerStatus in $credentialStatus.providers) {
        $result.credential_state_by_provider[$providerStatus.provider] = [ordered]@{
            configured = $providerStatus.configured
            health = $providerStatus.health
            requires_credentials = $providerStatus.requires_credentials
            credential_state = $providerStatus.credential_state
            credential_action_kind = $providerStatus.credential_action_kind
            has_credential_summary = -not [string]::IsNullOrWhiteSpace([string]$providerStatus.credential_summary)
            stale = $providerStatus.stale
        }
    }
    $result.scenario_results.no_key_or_missing_credentials = @(
        $credentialStatus.providers | Where-Object { -not $_.configured -and ($_.requires_credentials -or $_.credential_state -eq "missing") } | ForEach-Object { $_.provider }
    )
    $result.scenario_results.configured_key_or_identity = @(
        $credentialStatus.providers | Where-Object { $_.configured -and -not [string]::IsNullOrWhiteSpace([string]$_.credential_summary) } | ForEach-Object { $_.provider }
    )
    $result.scenario_results.offline_or_stale_ready = @(
        $status.providers | Where-Object { $_.freshness -and $_.freshness.offline_behavior } | ForEach-Object { $_.provider }
    )
    $result.scenario_results.blocked_or_unsupported_capabilities = @(
        $catalog.providers |
            ForEach-Object {
                $provider = $_.provider
                @($_.capabilities | Where-Object { -not $_.supported } | ForEach-Object { "$provider/$($_.key)" })
            }
    )

    $session = Invoke-ApiJson -Method Post -Path "/security/session" -Body @{}
    $script:sessionHeaders = @{ "X-Pengbo-Session" = [string]$session.session_id }
    $report = Invoke-ApiJson -Method Post -Path "/data-sources/reports/export" -Body @{
        macroProvider = "worldbank"
        macroSeriesId = "NY.GDP.MKTP.CD"
        macroCountry = "CN"
        newsQuery = "market OR earnings"
        cryptoIds = "bitcoin,ethereum,solana"
    } -TimeoutSeconds 120
    $result.report_export_path = $report.export_path
    $result.report_export_exists = [bool](Test-Path -LiteralPath $report.export_path)
    $result.report_source_count = @($report.included_sources).Count
    if (-not $result.report_export_exists) {
        throw "Data source report export file was not created."
    }
    if ($result.report_source_count -lt 5) {
        throw "Data source report did not include the expected source summaries."
    }
    $repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
    $resolvedReportPath = [System.IO.Path]::GetFullPath([string]$report.export_path)
    $result.source_safe_checks.export_path_inside_repo = $resolvedReportPath.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)
    $result.source_safe_checks.export_path_contains_secret_marker = Test-ContainsSecretMarker -Value $resolvedReportPath
    Assert-Condition (-not $result.source_safe_checks.export_path_inside_repo) "Data source report export should not be written inside the repository."
    Assert-Condition (-not $result.source_safe_checks.export_path_contains_secret_marker) "Data source report export path contains a secret-like marker."

    Restore-Preferences
}
catch {
    Add-Failure $_.Exception.Message
}
finally {
    try { Restore-Preferences } catch {}
    Stop-DesktopScenario
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
    try {
        $smokeLog = Get-Content -Path $script:resolvedOutputPath -Raw -Encoding UTF8
        $result.source_safe_checks.smoke_log_contains_secret_marker = Test-ContainsSecretMarker -Value $smokeLog
        $result | ConvertTo-Json -Depth 10 | Set-Content -Path $script:resolvedOutputPath -Encoding UTF8
    }
    catch {
    }
}

if ($result.failures.Count -gt 0) {
    exit 1
}
