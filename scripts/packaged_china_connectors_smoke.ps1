param(
    [string]$ExePath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\target\release\pengbo-workbench.exe"),
    [string]$OutputPath = (Join-Path (Join-Path $PSScriptRoot "..") "logs\china-connectors-packaged-smoke-latest.json"),
    [int]$HealthTimeoutSeconds = 30
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$baseUrl = "http://127.0.0.1:8765/api/v1"
$sidecarPath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\target\release\binaries\pengbo-sidecar\pengbo-sidecar.exe")
$result = [ordered]@{
    exe_path = ""
    started_at = (Get-Date).ToString("o")
    finished_at = $null
    health_ready = $false
    data_dir = $null
    log_dir = $null
    no_key = [ordered]@{}
    manifest = [ordered]@{}
    connectors = [ordered]@{}
    workflow = [ordered]@{}
    research = [ordered]@{}
    export = [ordered]@{}
    offline_cache = [ordered]@{}
    license_blocked = [ordered]@{}
    read_only_boundary = [ordered]@{}
    source_safe_checks = [ordered]@{
        export_exists = $false
        export_path_inside_repo = $false
        export_content_contains_secret_marker = $false
        smoke_log_contains_secret_marker = $false
        no_live_trading = $false
        read_only = $false
    }
    failures = New-Object System.Collections.Generic.List[string]
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
    return $Value -match '(?i)(api[_ -]?key\s*[:=]|secret\s*[:=]|token\s*[:=]|password\s*[:=]|sk-[A-Za-z0-9_-]{10,})'
}

function New-TemporaryPath {
    param([string]$Prefix)
    return Join-Path ([System.IO.Path]::GetTempPath()) "$Prefix-$([guid]::NewGuid().ToString("N"))"
}

function Copy-Directory {
    param([string]$SourcePath, [string]$DestinationPath)
    New-Item -ItemType Directory -Path $DestinationPath -Force | Out-Null
    foreach ($item in Get-ChildItem -LiteralPath $SourcePath -Force -ErrorAction SilentlyContinue) {
        Copy-Item -LiteralPath $item.FullName -Destination $DestinationPath -Recurse -Force
    }
}

function Assert-SafeRuntimeDataPath {
    param([string]$Path)
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $driveRoot = [System.IO.Path]::GetPathRoot($fullPath)
    $normalized = $fullPath.ToLowerInvariant()
    Assert-Condition ($fullPath.Length -gt ($driveRoot.Length + 12)) "Runtime data path is too broad to mutate: $fullPath"
    Assert-Condition (
        $normalized.Contains(".pengbo-runtime") -or
        $normalized.EndsWith("appdata\roaming\com.pengbo.workbench")
    ) "Runtime data path is not an expected packaged runtime path: $fullPath"
}

function Backup-DataDirectory {
    param([string]$Path)
    Assert-SafeRuntimeDataPath -Path $Path
    $script:backupDirPath = New-TemporaryPath -Prefix "pengbo-t85-china-backup"
    if (Test-Path -LiteralPath $Path) {
        Copy-Directory -SourcePath $Path -DestinationPath $script:backupDirPath
        $script:dataDirBackedUp = $true
        return
    }
    New-Item -ItemType Directory -Path $script:backupDirPath -Force | Out-Null
    $script:dataDirBackedUp = $false
}

function Clear-DataDirectory {
    param([string]$Path)
    Assert-SafeRuntimeDataPath -Path $Path
    if (Test-Path -LiteralPath $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
}

function Restore-DataDirectory {
    if (-not $script:dataDirPath) {
        return
    }
    Clear-DataDirectory -Path $script:dataDirPath
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
    if ($targets.Count -gt 0) {
        Start-Sleep -Milliseconds 800
    }
}

function Stop-DesktopScenario {
    if ($script:resolvedExePath) {
        Stop-MatchingProcesses -ProcessName "pengbo-workbench" -ResolvedPath $script:resolvedExePath
    }
    if ($script:resolvedSidecarPath) {
        Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $script:resolvedSidecarPath
    }
}

function Start-Desktop {
    param([hashtable]$Environment = @{})
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $script:resolvedExePath
    $startInfo.UseShellExecute = $false
    $startInfo.WorkingDirectory = Split-Path -Parent $script:resolvedExePath
    $startInfo.Environment["NO_PROXY"] = "127.0.0.1,localhost"
    foreach ($key in $Environment.Keys) {
        $startInfo.Environment[[string]$key] = [string]$Environment[$key]
    }
    $process = [System.Diagnostics.Process]::Start($startInfo)
    if ($null -eq $process) {
        throw "Failed to start packaged desktop: $script:resolvedExePath"
    }
    return $process
}

function Wait-ForHealth {
    $deadline = (Get-Date).AddSeconds($HealthTimeoutSeconds)
    do {
        try {
            $health = Invoke-RestMethod -Method Get -Uri "$baseUrl/health" -TimeoutSec 3
            if ($health.status -eq "ok") {
                return
            }
        }
        catch {
        }
        Start-Sleep -Milliseconds 300
    } while ((Get-Date) -lt $deadline)
    throw "Packaged sidecar health did not become ready."
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

function Get-Provider {
    param([object[]]$Items, [string]$Provider)
    $matches = @($Items | Where-Object {
            $names = @($_.PSObject.Properties.Name)
            (($names -contains "provider") -and $_.provider -eq $Provider) -or
            (($names -contains "provider_key") -and $_.provider_key -eq $Provider)
        })
    if ($matches.Count -lt 1) {
        throw "Provider '$Provider' was not returned."
    }
    return $matches[0]
}

try {
    $script:resolvedExePath = (Resolve-Path $ExePath).Path
    $script:resolvedSidecarPath = (Resolve-Path $sidecarPath).Path
    $script:resolvedOutputPath = [System.IO.Path]::GetFullPath($OutputPath)
    $result.exe_path = $script:resolvedExePath

    Stop-DesktopScenario
    Start-Desktop | Out-Null
    Wait-ForHealth
    $runtime = Invoke-ApiJson -Method Get -Path "/settings/runtime"
    $result.data_dir = $runtime.data_dir
    $result.log_dir = $runtime.log_dir
    $script:dataDirPath = [string]$runtime.data_dir

    Stop-DesktopScenario
    Backup-DataDirectory -Path $script:dataDirPath
    Clear-DataDirectory -Path $script:dataDirPath

    Start-Desktop | Out-Null
    Wait-ForHealth
    $status = Invoke-ApiJson -Method Get -Path "/data-sources/status"
    $tushareStatus = Get-Provider -Items @($status.providers) -Provider "tushare"
    $hkmaStatus = Get-Provider -Items @($status.providers) -Provider "hkma"
    $result.no_key.tushare_health = $tushareStatus.health
    $result.no_key.tushare_requires_credentials = [bool]$tushareStatus.requires_credentials
    $result.no_key.hkma_health = $hkmaStatus.health
    Assert-Condition ($tushareStatus.health -eq "missing_credentials") "No-key phase did not mark Tushare as missing_credentials."
    Assert-Condition ([bool]$tushareStatus.requires_credentials) "No-key phase did not require Tushare credentials."
    Assert-Condition ($hkmaStatus.health -eq "ok") "No-key phase did not keep HKMA available."
    Stop-DesktopScenario

    Start-Desktop -Environment @{ PENGBO_CHINA_CONNECTOR_FIXTURES = "1" } | Out-Null
    Wait-ForHealth
    $result.health_ready = $true

    $manifests = Invoke-ApiJson -Method Get -Path "/data-sources/manifests"
    $tushareManifest = Get-Provider -Items @($manifests.manifests) -Provider "tushare"
    $hkmaManifest = Get-Provider -Items @($manifests.manifests) -Provider "hkma"
    $result.manifest.tushare = [ordered]@{
        family = $tushareManifest.family
        credential_model = $tushareManifest.credential_model
        license_status = $tushareManifest.license_status
        redistribution_risk = $tushareManifest.redistribution_risk
        read_only = $tushareManifest.read_only
        live_trading = $tushareManifest.live_trading
        write_status = $tushareManifest.write_status
    }
    $result.manifest.hkma = [ordered]@{
        family = $hkmaManifest.family
        credential_model = $hkmaManifest.credential_model
        license_status = $hkmaManifest.license_status
        redistribution_risk = $hkmaManifest.redistribution_risk
        read_only = $hkmaManifest.read_only
        live_trading = $hkmaManifest.live_trading
        write_status = $hkmaManifest.write_status
    }
    Assert-Condition ($tushareManifest.family -eq "china_market") "Tushare manifest did not use china_market family."
    Assert-Condition ($tushareManifest.credential_model -eq "user_token") "Tushare manifest did not expose user_token credential model."
    Assert-Condition ($tushareManifest.license_status -eq "approved_cautious_v1") "Tushare manifest license status is not cautious-v1."
    Assert-Condition ($tushareManifest.redistribution_risk -eq "high") "Tushare manifest did not expose high redistribution risk."
    Assert-Condition ($hkmaManifest.credential_model -eq "none") "HKMA manifest should be no-key."

    $search = Invoke-ApiJson -Method Get -Path "/data-sources/equities/search?provider=tushare&query=600519&limit=1"
    $quote = Invoke-ApiJson -Method Get -Path "/data-sources/equities/quote?provider=tushare&symbol=600519.SH"
    $profile = Invoke-ApiJson -Method Get -Path "/data-sources/equities/profile?provider=tushare&symbol=600519.SH"
    $hkma = Invoke-ApiJson -Method Get -Path "/data-sources/macro/series?provider=hkma&seriesId=monetary_base_total&country=HK&limit=2"
    $result.connectors.tushare_search_symbol = $search.results[0].symbol
    $result.connectors.tushare_quote_price = $quote.price
    $result.connectors.tushare_profile_name = $profile.name
    $result.connectors.hkma_observation_count = @($hkma.observations).Count
    Assert-Condition ($search.results[0].symbol -eq "600519.SH") "Tushare search fixture did not return 600519.SH."
    Assert-Condition ($quote.symbol -eq "600519.SH" -and $quote.price -gt 0) "Tushare quote fixture did not return a positive quote."
    Assert-Condition ($profile.symbol -eq "600519.SH" -and -not [string]::IsNullOrWhiteSpace([string]$profile.name)) "Tushare profile fixture did not return a profile."
    Assert-Condition (@($hkma.observations).Count -eq 2) "HKMA fixture did not return two observations."

    $cached = Invoke-ApiJson -Method Get -Path "/data-sources/equities/quote?provider=tushare&symbol=600519.SH&scenario=timeout"
    $result.offline_cache.stale = [bool]$cached.provenance.stale
    $result.offline_cache.freshness_state = $cached.provenance.freshness_state
    $result.offline_cache.unavailable_reason = $cached.provenance.unavailable_reason
    Assert-Condition ([bool]$cached.provenance.stale) "Tushare cached fallback did not mark stale after timeout scenario."
    Assert-Condition ($cached.provenance.freshness_state -eq "refresh_failed") "Tushare cached fallback did not report refresh_failed."

    $blocked = Invoke-ApiJson -Method Get -Path "/data-sources/equities/quote?provider=tushare&symbol=600519.SH&scenario=license_blocked"
    $result.license_blocked.freshness_state = $blocked.provenance.freshness_state
    $result.license_blocked.quality = $blocked.provenance.data_quality.overall
    $result.license_blocked.unavailable_reason = $blocked.provenance.unavailable_reason
    Assert-Condition ($blocked.provenance.freshness_state -eq "unsupported") "License-blocked Tushare scenario did not report unsupported freshness."
    Assert-Condition ($blocked.provenance.data_quality.overall -eq "blocked") "License-blocked Tushare scenario did not report blocked data quality."
    Assert-Condition ([string]$blocked.provenance.unavailable_reason -match "license_blocked") "License-blocked Tushare scenario did not include the reason."

    $workflow = Invoke-ApiJson -Method Post -Path "/workflows/runs" -Body @{
        templateKey = "data_sources_to_research"
        input = @{
            dataSourceKind = "equity"
            dataSourceProvider = "tushare"
            symbol = "600519.SH"
            limit = 1
        }
    } -TimeoutSeconds 120
    $result.workflow.run_id = $workflow.run_id
    $result.workflow.status = $workflow.status
    $result.workflow.research_artifacts = @($workflow.artifact_refs | Where-Object { $_.artifact_type -eq "research_brief" }).Count
    Assert-Condition ($workflow.status -eq "completed") "China-market data_sources_to_research workflow did not complete."
    Assert-Condition ($result.workflow.research_artifacts -ge 1) "China-market workflow did not create a research brief artifact."

    $brief = Invoke-ApiJson -Method Post -Path "/research/briefs" -Body @{
        symbol = "600519.SH"
        dataSourceProvider = "tushare"
        dataSourceKind = "equity"
        dataSourceQuery = "600519.SH"
    } -TimeoutSeconds 120
    $result.research.brief_id = $brief.brief_id
    $result.research.template_key = $brief.decision_review.template_key
    $result.research.title = $brief.title
    Assert-Condition ($brief.decision_review.template_key -eq "china_market") "Research brief did not use china_market template."
    Assert-Condition ([string]$brief.title -match "China Market Research Brief") "Research brief title did not identify China-market template."
    $briefExport = Invoke-ApiJson -Method Post -Path "/research/briefs/$($brief.brief_id)/export" -TimeoutSeconds 120
    $result.research.export_path = $briefExport.export_path
    Assert-Condition (Test-Path -LiteralPath $briefExport.export_path) "China-market research export was not created."

    $session = Invoke-ApiJson -Method Post -Path "/security/session" -Body @{}
    $script:sessionHeaders = @{ "X-Pengbo-Session" = [string]$session.session_id }
    $report = Invoke-ApiJson -Method Post -Path "/data-sources/reports/export" -Body @{
        macroProvider = "hkma"
        macroSeriesId = "monetary_base_total"
        macroCountry = "HK"
        newsQuery = "China A-share policy liquidity"
        cryptoIds = "bitcoin"
        equityProvider = "tushare"
        equitySymbol = "600519.SH"
    } -TimeoutSeconds 120
    $result.export.path = $report.export_path
    $result.export.source_count = @($report.included_sources).Count
    $result.export.providers = @($report.included_sources | ForEach-Object { $_.provider })
    $result.source_safe_checks.export_exists = [bool](Test-Path -LiteralPath $report.export_path)
    Assert-Condition $result.source_safe_checks.export_exists "China-market data source report export was not created."
    $reportText = Get-Content -Path $report.export_path -Raw -Encoding UTF8
    Assert-Condition ($reportText -match "Connector Manifest Summary") "Report export did not include connector manifest summary."
    Assert-Condition ($reportText -match "China-market connectors are research-only") "Report export did not include China-market research-only boundary."
    Assert-Condition ($reportText -match "tushare") "Report export did not include Tushare evidence."
    Assert-Condition ($reportText -match "hkma") "Report export did not include HKMA evidence."
    $repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
    $resolvedReportPath = [System.IO.Path]::GetFullPath([string]$report.export_path)
    $result.source_safe_checks.export_path_inside_repo = $resolvedReportPath.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)
    $result.source_safe_checks.export_content_contains_secret_marker = Test-ContainsSecretMarker -Value $reportText
    Assert-Condition (-not $result.source_safe_checks.export_path_inside_repo) "Data source report export should not be written inside the repository."
    Assert-Condition (-not $result.source_safe_checks.export_content_contains_secret_marker) "Data source report export contained a secret-like marker."

    $catalog = Invoke-ApiJson -Method Get -Path "/connections/catalog"
    $chinaProviders = @($catalog.providers | Where-Object { $_.provider -in @("tushare", "hkma") })
    $result.read_only_boundary.providers = @($chinaProviders | ForEach-Object {
            [ordered]@{
                provider = $_.provider
                read_only = $_.read_only
                live_trading = $_.live_trading
                write_status = $_.write_status
            }
        })
    $result.source_safe_checks.no_live_trading = -not [bool](@($chinaProviders | Where-Object { $_.live_trading }).Count)
    $result.source_safe_checks.read_only = -not [bool](@($chinaProviders | Where-Object { -not $_.read_only -or $_.write_status -ne "read_only" }).Count)
    Assert-Condition $result.source_safe_checks.no_live_trading "China-market providers exposed live_trading."
    Assert-Condition $result.source_safe_checks.read_only "China-market providers violated read-only write_status."
}
catch {
    Add-Failure $_.Exception.Message
}
finally {
    Stop-DesktopScenario
    try { Restore-DataDirectory } catch { Add-Failure $_.Exception.Message }
    if ($script:backupDirPath -and (Test-Path -LiteralPath $script:backupDirPath)) {
        Remove-Item -LiteralPath $script:backupDirPath -Recurse -Force
    }
    $result.finished_at = (Get-Date).ToString("o")
    $outputDirectory = Split-Path -Parent $script:resolvedOutputPath
    if (-not (Test-Path -LiteralPath $outputDirectory)) {
        New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    }
    $result | ConvertTo-Json -Depth 14 | Set-Content -Path $script:resolvedOutputPath -Encoding UTF8
    try {
        $smokeLog = Get-Content -Path $script:resolvedOutputPath -Raw -Encoding UTF8
        $result.source_safe_checks.smoke_log_contains_secret_marker = Test-ContainsSecretMarker -Value $smokeLog
        $result | ConvertTo-Json -Depth 14 | Set-Content -Path $script:resolvedOutputPath -Encoding UTF8
    }
    catch {
    }
}

if ($result.failures.Count -gt 0 -or $result.source_safe_checks.smoke_log_contains_secret_marker) {
    exit 1
}
