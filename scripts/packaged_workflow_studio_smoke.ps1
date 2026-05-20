param(
    [string]$ExePath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\pengbo-workbench.exe"),
    [string]$OutputPath = (Join-Path (Join-Path $PSScriptRoot "..") "logs\\workflow-studio-packaged-smoke-latest.json"),
    [int]$HealthTimeoutSeconds = 30,
    [int]$UiTimeoutSeconds = 90
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$baseUrl = "http://127.0.0.1:8765/api/v1"
$sidecarPath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\binaries\\pengbo-sidecar\\pengbo-sidecar.exe")
$result = [ordered]@{
    exe_path = ""
    started_at = (Get-Date).ToString("o")
    finished_at = $null
    health_ready = $false
    data_dir = $null
    log_dir = $null
    window_title = $null
    template_count = 0
    run_id = $null
    run_status = $null
    manual_required = $false
    manual_policy = $null
    binance_intent_artifact_count = 0
    evidence_export_run_id = $null
    evidence_export_status = $null
    evidence_export_path = $null
    evidence_export_exists = $false
    data_source_run_id = $null
    data_source_run_status = $null
    data_source_research_artifact_count = 0
    recent_restored_after_restart = $false
    ui_markers = [ordered]@{}
    failures = New-Object System.Collections.Generic.List[string]
}

$script:resolvedExePath = $null
$script:resolvedSidecarPath = $null
$script:resolvedOutputPath = $null
$script:dataDirPath = $null
$script:backupDirPath = $null
$script:dataDirBackedUp = $false
$script:originalPreferences = $null

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
        UseBasicParsing = $true
    }
    if ($null -ne $Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 16)
        $params.ContentType = "application/json"
    }
    $response = Invoke-WebRequest @params
    if ([string]::IsNullOrWhiteSpace($response.Content)) {
        return $null
    }
    return ($response.Content | ConvertFrom-Json)
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
    $process = Start-Desktop -ResolvedExePath $ResolvedExePath
    Wait-ForHealth -Url $baseUrl -TimeoutSeconds $HealthTimeoutSeconds
    $runtime = Invoke-ApiJson -Method Get -Path "/settings/runtime"
    $result.health_ready = $true
    $result.data_dir = $runtime.data_dir
    $result.log_dir = $runtime.log_dir
    $script:dataDirPath = [string]$runtime.data_dir
    return $process
}

function Stop-DesktopScenario {
    param([string]$ResolvedExePath)
    Stop-MatchingProcesses -ProcessName "pengbo-workbench" -ResolvedPath $ResolvedExePath
    Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $script:resolvedSidecarPath
}

function Backup-DataDirectory {
    param([string]$Path)
    $script:backupDirPath = New-TemporaryPath -Prefix "pengbo-t44-workflow-backup"
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

function Ensure-WorkflowDefaultView {
    $preferences = Invoke-ApiJson -Method Get -Path "/settings/preferences"
    $script:originalPreferences = $preferences
    $payload = [ordered]@{
        default_view = "workflowStudio"
        quote_ttl_minutes = [int]$preferences.quote_ttl_minutes
        log_collection_enabled = [bool]$preferences.log_collection_enabled
        diagnostics_export_enabled = [bool]$preferences.diagnostics_export_enabled
        language = [string]$preferences.language
        density = [string]$preferences.density
    }
    Invoke-ApiJson -Method Put -Path "/settings/preferences" -Body $payload | Out-Null
}

function Wait-ForMainWindow {
    param([string]$ResolvedExePath, [int]$TimeoutSeconds)
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
    throw "UI element '$Name' did not appear within $TimeoutSeconds seconds."
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
    throw "UI element starting with '$Prefix' did not appear within $TimeoutSeconds seconds."
}

function Invoke-UiElement {
    param([System.Windows.Automation.AutomationElement]$Element)
    $invoke = $Element.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $invoke.Invoke()
}

function Wait-ForRecentWorkflowRun {
    param([string]$RunId, [int]$TimeoutSeconds)
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        $recent = @(Invoke-ApiJson -Method Get -Path "/workflows/runs/recent?limit=12")
        $match = @($recent | Where-Object { $_.run_id -eq $RunId })
        if ($match.Count -gt 0) {
            return $match[0]
        }
        Start-Sleep -Milliseconds 500
    }
    throw "Workflow run '$RunId' did not appear in recent packaged runs."
}

try {
    $script:resolvedExePath = (Resolve-Path $ExePath).Path
    $script:resolvedSidecarPath = (Resolve-Path $sidecarPath).Path
    $script:resolvedOutputPath = [System.IO.Path]::GetFullPath($OutputPath)
    $result.exe_path = $script:resolvedExePath

    Start-DesktopPhase -ResolvedExePath $script:resolvedExePath | Out-Null
    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath
    Backup-DataDirectory -Path $script:dataDirPath

    Start-DesktopPhase -ResolvedExePath $script:resolvedExePath | Out-Null
    Ensure-WorkflowDefaultView
    $templates = @(Invoke-ApiJson -Method Get -Path "/workflows/templates")
    $result.template_count = $templates.Count
    if ($result.template_count -lt 6) {
        throw "Packaged workflow template catalog returned fewer than six templates."
    }
    $dataSourceTemplate = @($templates | Where-Object { $_.template_key -eq "data_sources_to_research" })
    if ($dataSourceTemplate.Count -lt 1) {
        throw "Packaged workflow template catalog did not include data_sources_to_research."
    }
    $dataSourceRun = Invoke-ApiJson -Method Post -Path "/workflows/runs" -Body @{
        templateKey = "data_sources_to_research"
        input = @{
            dataSourceKind = "macro"
            dataSourceProvider = "worldbank"
            seriesId = "NY.GDP.MKTP.CD"
            country = "CN"
            symbol = "AAPL"
            limit = 3
        }
    }
    $result.data_source_run_id = $dataSourceRun.run_id
    $result.data_source_run_status = $dataSourceRun.status
    $result.data_source_research_artifact_count = @($dataSourceRun.artifact_refs | Where-Object { $_.artifact_type -eq "research_brief" }).Count
    if ($result.data_source_run_status -ne "completed" -or $result.data_source_research_artifact_count -lt 1) {
        throw "Packaged data_sources_to_research workflow did not complete with a research_brief artifact."
    }
    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath

    Start-DesktopPhase -ResolvedExePath $script:resolvedExePath | Out-Null
    $windowState = Wait-ForMainWindow -ResolvedExePath $script:resolvedExePath -TimeoutSeconds $UiTimeoutSeconds
    $window = $windowState.window
    $result.window_title = $window.Current.Name

    $initialMarker = Wait-ForElementNameStartsWith -Root $window -Prefix "workflow-studio-view template=screener_to_research" -TimeoutSeconds $UiTimeoutSeconds
    $result.ui_markers.initial_view = $initialMarker.name

    $templateButton = Wait-ForElementByName -Root $window -Name "workflow-template key=paper_to_binance_intent selected=false" -TimeoutSeconds $UiTimeoutSeconds
    Invoke-UiElement -Element $templateButton
    $selectedMarker = Wait-ForElementNameStartsWith -Root $window -Prefix "workflow-studio-view template=paper_to_binance_intent" -TimeoutSeconds $UiTimeoutSeconds
    $result.ui_markers.selected_template = $selectedMarker.name

    $submitButton = Wait-ForElementByName -Root $window -Name "workflow-run-submit template=paper_to_binance_intent" -TimeoutSeconds $UiTimeoutSeconds
    $result.ui_markers.submit_enabled = [bool]$submitButton.Current.IsEnabled
    if (-not $submitButton.Current.IsEnabled) {
        throw "Workflow Studio submit button was not enabled in the packaged desktop UI."
    }
    Invoke-UiElement -Element $submitButton

    $blockedMarker = Wait-ForElementNameStartsWith -Root $window -Prefix "workflow-studio-view template=paper_to_binance_intent run=workflow-" -TimeoutSeconds $UiTimeoutSeconds
    $result.ui_markers.blocked_view = $blockedMarker.name
    if ($blockedMarker.name -notmatch "status=blocked") {
        throw "Workflow Studio UI did not render the blocked run state."
    }
    if ($blockedMarker.name -notmatch "run=(workflow-[^ ]+)") {
        throw "Workflow Studio UI marker did not expose the packaged run id."
    }
    $result.run_id = $Matches[1]

    $manualStep = Wait-ForElementNameStartsWith -Root $window -Prefix "workflow-step key=await_user_confirmation status=manual_required" -TimeoutSeconds $UiTimeoutSeconds
    $artifact = Wait-ForElementNameStartsWith -Root $window -Prefix "workflow-artifact type=binance_intent id=intent-" -TimeoutSeconds $UiTimeoutSeconds
    $manualBoundary = Wait-ForElementNameStartsWith -Root $window -Prefix "workflow-manual-boundary run=$($result.run_id) policy=user_confirmed_binance_submit" -TimeoutSeconds $UiTimeoutSeconds
    $result.ui_markers.manual_step = $manualStep.name
    $result.ui_markers.binance_intent_artifact = $artifact.name
    $result.ui_markers.manual_boundary = $manualBoundary.name

    $run = Invoke-ApiJson -Method Get -Path "/workflows/runs/$($result.run_id)"
    $result.run_status = $run.status
    $result.manual_required = [bool]$run.manual_confirmation_required
    $result.manual_policy = $run.manual_confirmation_policy
    $result.binance_intent_artifact_count = @($run.artifact_refs | Where-Object { $_.artifact_type -eq "binance_intent" }).Count
    if ($result.run_status -ne "blocked" -or -not $result.manual_required -or $result.manual_policy -ne "user_confirmed_binance_submit" -or $result.binance_intent_artifact_count -lt 1) {
        throw "Packaged workflow run did not preserve the expected blocked/manual-required Binance intent boundary."
    }

    $paperArtifacts = @($run.artifact_refs | Where-Object { $_.artifact_type -eq "paper_session" })
    if ($paperArtifacts.Count -lt 1) {
        throw "Packaged workflow run did not expose a paper_session artifact for evidence export."
    }
    $evidenceRun = Invoke-ApiJson -Method Post -Path "/workflows/runs" -Body @{
        templateKey = "evidence_report_export"
        input = @{
            artifactId = [string]$paperArtifacts[0].artifact_id
            artifactType = "paper_session"
        }
    }
    $result.evidence_export_run_id = $evidenceRun.run_id
    $result.evidence_export_status = $evidenceRun.status
    $evidenceArtifacts = @($evidenceRun.artifact_refs | Where-Object { $_.artifact_type -eq "evidence_report" })
    if ($result.evidence_export_status -ne "completed" -or $evidenceArtifacts.Count -lt 1) {
        throw "Packaged workflow evidence export did not complete with an evidence_report artifact."
    }
    $exportSteps = @($evidenceRun.steps | Where-Object { $_.step_key -eq "export_evidence_report" })
    if ($exportSteps.Count -lt 1 -or -not $exportSteps[0].output.PSObject.Properties["export_path"]) {
        throw "Packaged workflow evidence export did not expose an export_path in the export_evidence_report step output."
    }
    $result.evidence_export_path = [string]$exportSteps[0].output.export_path
    $result.evidence_export_exists = Test-Path -LiteralPath $result.evidence_export_path
    if (-not $result.evidence_export_exists) {
        throw "Packaged workflow evidence export path does not exist: $($result.evidence_export_path)"
    }

    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath
    Start-DesktopPhase -ResolvedExePath $script:resolvedExePath | Out-Null
    $windowState = Wait-ForMainWindow -ResolvedExePath $script:resolvedExePath -TimeoutSeconds $UiTimeoutSeconds
    $window = $windowState.window
    Wait-ForElementNameStartsWith -Root $window -Prefix "workflow-studio-view template=screener_to_research" -TimeoutSeconds $UiTimeoutSeconds | Out-Null
    $restoredRecent = Wait-ForRecentWorkflowRun -RunId $result.run_id -TimeoutSeconds $UiTimeoutSeconds
    $recentMarker = Wait-ForElementByName -Root $window -Name "workflow-recent-run id=$($result.run_id) status=blocked" -TimeoutSeconds $UiTimeoutSeconds
    $result.recent_restored_after_restart = ($restoredRecent.run_id -eq $result.run_id -and $null -ne $recentMarker)
    $result.ui_markers.recent_after_restart = $recentMarker.Current.Name
    if (-not $result.recent_restored_after_restart) {
        throw "Packaged Workflow Studio did not restore the recent run after restart."
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
