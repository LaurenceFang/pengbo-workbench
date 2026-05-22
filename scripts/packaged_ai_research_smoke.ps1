param(
    [string]$ExePath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\target\release\pengbo-workbench.exe"),
    [string]$OutputPath = (Join-Path (Join-Path $PSScriptRoot "..") "logs\ai-research-packaged-smoke-latest.json"),
    [string]$Symbol = "AAPL",
    [string]$UnlockSecret = "ai-research-smoke-passphrase",
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
    sqlite_path = $null
    brief_id = $null
    symbol = $Symbol
    scenarios = [ordered]@{
        local_disabled = [ordered]@{}
        local_enabled = [ordered]@{}
        cloud_disabled = [ordered]@{}
        cloud_opt_in = [ordered]@{}
        stale_evidence = [ordered]@{}
        blocked_evidence = [ordered]@{}
        export = [ordered]@{}
    }
    audit_events = @()
    source_safe_checks = [ordered]@{
        preview_redacted = $false
        output_redacted = $false
        export_exists = $false
        export_contains_secret_marker = $false
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
    $script:backupDirPath = New-TemporaryPath -Prefix "pengbo-t84-ai-backup"
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

function Start-DesktopPhase {
    param([hashtable]$EnvVars = @{})
    Stop-DesktopScenario
    $script:sessionHeaders = @{}
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $script:resolvedExePath
    $startInfo.UseShellExecute = $false
    $startInfo.WorkingDirectory = Split-Path -Parent $script:resolvedExePath
    $startInfo.Environment["NO_PROXY"] = "127.0.0.1,localhost"
    foreach ($key in $EnvVars.Keys) {
        $startInfo.Environment[$key] = [string]$EnvVars[$key]
    }
    $process = [System.Diagnostics.Process]::Start($startInfo)
    if ($null -eq $process) {
        throw "Failed to start packaged desktop."
    }
    Wait-ForHealth
    $runtime = Invoke-ApiJson -Method Get -Path "/settings/runtime"
    $result.health_ready = $true
    $result.data_dir = [string]$runtime.data_dir
    $result.sqlite_path = [string]$runtime.sqlite_path
    $script:dataDirPath = [string]$runtime.data_dir
}

function New-Session {
    $session = Invoke-ApiJson -Method Post -Path "/security/session" -Body @{}
    $script:sessionHeaders = @{ "X-Pengbo-Session" = [string]$session.session_id }
}

function Ensure-Unlocked {
    $status = Invoke-ApiJson -Method Get -Path "/security/local/status"
    if (-not [bool]$status.initialized) {
        Invoke-ApiJson -Method Post -Path "/security/local/initialize" -Body @{ unlock_secret = $UnlockSecret } | Out-Null
        return
    }
    if ([bool]$status.locked) {
        Invoke-ApiJson -Method Post -Path "/security/local/unlock" -Body @{ unlock_secret = $UnlockSecret } | Out-Null
    }
}

function Assert-BlockedReason {
    param([object]$Payload, [string]$Reason, [string]$Scenario)
    Assert-Condition ($Payload.status -eq "blocked") "$Scenario did not return blocked status."
    Assert-Condition (@($Payload.blocked_reasons) -contains $Reason) "$Scenario did not include blocked reason '$Reason'."
}

function Set-BriefSnapshotStale {
    param([string]$SqlitePath, [string]$BriefId)
    $python = @'
import json
import sqlite3
import sys

db_path, brief_id = sys.argv[1], sys.argv[2]
con = sqlite3.connect(db_path)
row = con.execute("SELECT snapshot_json FROM research_briefs WHERE brief_id = ?", (brief_id,)).fetchone()
if row is None:
    raise SystemExit("brief not found")
snapshot = json.loads(row[0])
snapshot["stale"] = True
snapshot.setdefault("asset_snapshot", {})["stale"] = True
snapshot.setdefault("data_quality", {})["overall"] = "limited"
snapshot["data_quality"].setdefault("limitations", [])
if "Packaged T84 stale evidence fixture." not in snapshot["data_quality"]["limitations"]:
    snapshot["data_quality"]["limitations"].append("Packaged T84 stale evidence fixture.")
con.execute(
    "UPDATE research_briefs SET snapshot_json = ? WHERE brief_id = ?",
    (json.dumps(snapshot, ensure_ascii=False), brief_id),
)
con.commit()
con.close()
'@
    $python | py - $SqlitePath $BriefId
}

try {
    $script:resolvedExePath = (Resolve-Path $ExePath).Path
    $script:resolvedSidecarPath = (Resolve-Path $sidecarPath).Path
    $script:resolvedOutputPath = [System.IO.Path]::GetFullPath($OutputPath)
    $result.exe_path = $script:resolvedExePath

    Start-DesktopPhase
    Stop-DesktopScenario
    Backup-DataDirectory -Path $script:dataDirPath
    Clear-DataDirectory -Path $script:dataDirPath

    Start-DesktopPhase
    New-Session
    Ensure-Unlocked
    $brief = Invoke-ApiJson -Method Post -Path "/research/briefs" -Body @{ symbol = $Symbol } -TimeoutSeconds 180
    $result.brief_id = [string]$brief.brief_id
    $secretNote = "Packaged T84 preview note api_key=ai-smoke-secret and sk-smoke123456789012345."
    Invoke-ApiJson -Method Put -Path "/research/briefs/$($brief.brief_id)/notes" -Body @{ markdown = $secretNote } | Out-Null
    $preview = Invoke-ApiJson -Method Get -Path "/research/assistant/briefs/$($brief.brief_id)/context-preview"
    $result.source_safe_checks.preview_redacted = (
        ([string]$preview.prompt_context_preview -notmatch "ai-smoke-secret") -and
        ([string]$preview.prompt_context_preview -notmatch "sk-smoke")
    )
    Assert-Condition $result.source_safe_checks.preview_redacted "AI context preview did not redact secret-like note content."
    $disabled = Invoke-ApiJson -Method Post -Path "/research/assistant/briefs/$($brief.brief_id)/generate" -Body @{
        templateKey = "research_summary"
        providerMode = "local"
    }
    Assert-BlockedReason -Payload $disabled -Reason "ai_disabled" -Scenario "local-disabled"
    $result.scenarios.local_disabled = [ordered]@{
        status = $disabled.status
        provider = $disabled.provider
        blocked_reasons = @($disabled.blocked_reasons)
    }

    Stop-DesktopScenario
    Start-DesktopPhase -EnvVars @{
        PENGBO_AI_ASSISTANT_ENABLED = "1"
        PENGBO_AI_LOCAL_MODEL = "qwen3:8b"
    }
    New-Session
    Ensure-Unlocked
    $localPreview = Invoke-ApiJson -Method Get -Path "/research/assistant/briefs/$($brief.brief_id)/context-preview"
    $local = Invoke-ApiJson -Method Post -Path "/research/assistant/briefs/$($brief.brief_id)/generate" -Body @{
        templateKey = "provider_limitation"
        providerMode = "local"
    }
    Assert-Condition ($local.status -eq "completed") "Local enabled assistant generation did not complete."
    Assert-Condition ($local.provider -eq "local") "Local enabled assistant did not report local provider."
    Assert-Condition (@($local.citations).Count -ge 2) "Local assistant output did not include enough citations."
    $result.source_safe_checks.output_redacted = (
        ([string]$local.output_markdown -notmatch "ai-smoke-secret") -and
        ([string]$local.output_markdown -notmatch "sk-smoke")
    )
    Assert-Condition $result.source_safe_checks.output_redacted "Local assistant output leaked secret-like note content."
    $result.scenarios.local_enabled = [ordered]@{
        status = $local.status
        provider = $local.provider
        template_key = $local.template_key
        citation_count = @($local.citations).Count
        context_chars = [int]$localPreview.estimated_input_chars
    }

    $cloudNoConfirm = Invoke-ApiJson -Method Post -Path "/research/assistant/briefs/$($brief.brief_id)/generate" -Body @{
        templateKey = "research_summary"
        providerMode = "cloud"
    }
    Assert-BlockedReason -Payload $cloudNoConfirm -Reason "cloud_opt_in_required" -Scenario "cloud-no-confirm"
    $cloudDisabled = Invoke-ApiJson -Method Post -Path "/research/assistant/briefs/$($brief.brief_id)/generate" -Body @{
        templateKey = "research_summary"
        providerMode = "cloud"
        cloudOptInConfirmed = $true
        cloudContextAcknowledgedChars = [int]$localPreview.estimated_input_chars
    }
    Assert-BlockedReason -Payload $cloudDisabled -Reason "cloud_disabled" -Scenario "cloud-disabled"
    $result.scenarios.cloud_disabled = [ordered]@{
        no_confirm_reasons = @($cloudNoConfirm.blocked_reasons)
        disabled_reasons = @($cloudDisabled.blocked_reasons)
    }
    $result.scenarios.blocked_evidence = [ordered]@{
        local_disabled = @($disabled.blocked_reasons)
        cloud_no_confirm = @($cloudNoConfirm.blocked_reasons)
        cloud_disabled = @($cloudDisabled.blocked_reasons)
    }

    Stop-DesktopScenario
    Start-DesktopPhase -EnvVars @{
        PENGBO_AI_ASSISTANT_ENABLED = "1"
        PENGBO_AI_CLOUD_ENABLED = "1"
        PENGBO_AI_LOCAL_MODEL = "qwen3:8b"
    }
    New-Session
    Ensure-Unlocked
    $cloudStatus = Invoke-ApiJson -Method Get -Path "/ai/cloud/status"
    $cloudPreview = Invoke-ApiJson -Method Get -Path "/research/assistant/briefs/$($brief.brief_id)/context-preview"
    $cloudMissingKey = Invoke-ApiJson -Method Post -Path "/research/assistant/briefs/$($brief.brief_id)/generate" -Body @{
        templateKey = "research_summary"
        providerMode = "cloud"
        cloudOptInConfirmed = $true
        cloudContextAcknowledgedChars = [int]$cloudPreview.estimated_input_chars
    }
    Assert-BlockedReason -Payload $cloudMissingKey -Reason "cloud_credentials_missing" -Scenario "cloud-opt-in-missing-key"
    $result.scenarios.cloud_opt_in = [ordered]@{
        status_enabled = [bool]$cloudStatus.enabled
        configured = [bool]$cloudStatus.configured
        credential_configured = [bool]$cloudStatus.credential_configured
        blocked_reasons = @($cloudMissingKey.blocked_reasons)
    }

    Stop-DesktopScenario
    Set-BriefSnapshotStale -SqlitePath $result.sqlite_path -BriefId $result.brief_id
    Start-DesktopPhase -EnvVars @{
        PENGBO_AI_ASSISTANT_ENABLED = "1"
        PENGBO_AI_LOCAL_MODEL = "qwen3:8b"
    }
    New-Session
    Ensure-Unlocked
    $staleBrief = Invoke-ApiJson -Method Get -Path "/research/briefs/$($brief.brief_id)"
    Assert-Condition ([bool]$staleBrief.stale) "Stale fixture did not reload as stale."
    $stale = Invoke-ApiJson -Method Post -Path "/research/assistant/briefs/$($brief.brief_id)/generate" -Body @{
        templateKey = "provider_limitation"
        providerMode = "local"
    }
    Assert-Condition (@($stale.risks | Where-Object { $_ -match "cached|stale" }).Count -gt 0) "Stale assistant output did not preserve cached/stale risk language."
    $result.scenarios.stale_evidence = [ordered]@{
        brief_stale = [bool]$staleBrief.stale
        status = $stale.status
        stale_risks = @($stale.risks | Where-Object { $_ -match "cached|stale" })
        data_quality = if ($staleBrief.data_quality) { $staleBrief.data_quality.overall } else { $null }
    }

    Invoke-ApiJson -Method Put -Path "/research/briefs/$($brief.brief_id)/notes" -Body @{
        markdown = [string]$local.output_markdown
    } | Out-Null
    $export = Invoke-ApiJson -Method Post -Path "/research/briefs/$($brief.brief_id)/export" -TimeoutSeconds 120
    $result.scenarios.export = [ordered]@{
        export_path = [string]$export.export_path
        exists = [bool](Test-Path -LiteralPath $export.export_path)
    }
    $result.source_safe_checks.export_exists = $result.scenarios.export.exists
    Assert-Condition $result.source_safe_checks.export_exists "AI research export file was not created."
    $exportContents = Get-Content -LiteralPath $export.export_path -Raw -Encoding UTF8
    Assert-Condition ($exportContents -match "AI Research Assistant Draft") "Export did not include the saved assistant draft."
    $result.source_safe_checks.export_contains_secret_marker = Test-ContainsSecretMarker -Value $exportContents
    Assert-Condition (-not $result.source_safe_checks.export_contains_secret_marker) "Export contains a secret-like marker."

    $audit = Invoke-ApiJson -Method Get -Path "/security/audit?category=ai_assistant&limit=80"
    $result.audit_events = @($audit | ForEach-Object { $_.event_type } | Where-Object { $_ } | Select-Object -Unique)
    foreach ($required in @("ai_context_preview_created", "ai_generation_requested", "ai_generation_blocked", "ai_generation_completed")) {
        Assert-Condition ($result.audit_events -contains $required) "Missing AI audit event: $required"
    }
}
catch {
    Add-Failure $_.Exception.Message
}
finally {
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
    $result | ConvertTo-Json -Depth 12 | Set-Content -Path $script:resolvedOutputPath -Encoding UTF8
    try {
        $smokeLog = Get-Content -Path $script:resolvedOutputPath -Raw -Encoding UTF8
        $result.source_safe_checks.smoke_log_contains_secret_marker = Test-ContainsSecretMarker -Value $smokeLog
        $result | ConvertTo-Json -Depth 12 | Set-Content -Path $script:resolvedOutputPath -Encoding UTF8
    }
    catch {
    }
}

if ($result.failures.Count -gt 0) {
    exit 1
}
