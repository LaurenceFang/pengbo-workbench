param(
    [string]$ExePath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\pengbo-workbench.exe"),
    [string]$OutputPath = (Join-Path (Join-Path $PSScriptRoot "..") "logs\\provider-capability-signoff-latest.json"),
    [int]$HealthTimeoutSeconds = 30,
    [int]$UiTimeoutSeconds = 30,
    [int]$ResearchTimeoutSeconds = 120,
    [string]$EdgarIdentity = "Pengbo Signoff signoff@example.com"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class PengboMouseInput {
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int x, int y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    public const uint LeftDown = 0x0002;
    public const uint LeftUp = 0x0004;
}
"@

$baseUrl = "http://127.0.0.1:8765/api/v1"
$sidecarPath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\pengbo-sidecar.exe")
$result = [ordered]@{
    exe_path = ""
    started_at = (Get-Date).ToString("o")
    finished_at = $null
    health_ready = $false
    data_dir = $null
    log_dir = $null
    stronghold_dir = $null
    bootstrap_log_path = $null
    failures = New-Object System.Collections.Generic.List[string]
    stages = [ordered]@{
        baseline = [ordered]@{}
        after_identity_save = [ordered]@{}
        after_identity_clear = [ordered]@{}
    }
    credential_input_adapter = [ordered]@{
        mode = "webview_dom_ref_fallback"
        input_anchor = "connection-secret provider=edgar field=identity"
        save_anchor = "connection-save provider=edgar"
        value_verified = $false
    }
}

$script:resolvedExePath = $null
$script:resolvedSidecarPath = $null
$script:resolvedOutputPath = $null
$script:dataDirPath = $null
$script:strongholdDirPath = $null
$script:dataBackupDirPath = $null
$script:strongholdBackupDirPath = $null
$script:dataDirBackedUp = $false
$script:strongholdDirBackedUp = $false

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

function Backup-Directory {
    param(
        [string]$SourcePath,
        [string]$BackupPath,
        [ref]$BackedUpFlag
    )

    if (Test-Path -LiteralPath $SourcePath) {
        Copy-Directory -SourcePath $SourcePath -DestinationPath $BackupPath
        $BackedUpFlag.Value = $true
        return
    }

    New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null
    $BackedUpFlag.Value = $false
}

function Restore-Directory {
    param(
        [string]$TargetPath,
        [string]$BackupPath,
        [bool]$WasBackedUp
    )

    if (Test-Path -LiteralPath $TargetPath) {
        Remove-Item -LiteralPath $TargetPath -Recurse -Force
    }

    if ($WasBackedUp -and (Test-Path -LiteralPath $BackupPath)) {
        Copy-Directory -SourcePath $BackupPath -DestinationPath $TargetPath
    }
}

function Reset-Directory {
    param([string]$TargetPath)

    if (Test-Path -LiteralPath $TargetPath) {
        Remove-Item -LiteralPath $TargetPath -Recurse -Force
    }
    New-Item -ItemType Directory -Path $TargetPath -Force | Out-Null
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

function Stop-DesktopScenario {
    param([string]$ResolvedExePath)

    Stop-MatchingProcesses -ProcessName "pengbo-workbench" -ResolvedPath $ResolvedExePath
    if ($script:resolvedSidecarPath) {
        Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $script:resolvedSidecarPath
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
        [int]$TimeoutSeconds = 60
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

function Get-OnlineEnvironmentOverrides {
    return @{
        HTTP_PROXY = $null
        HTTPS_PROXY = $null
        ALL_PROXY = $null
        NO_PROXY = "127.0.0.1,localhost"
        EDGAR_IDENTITY = $null
        PENGBO_BINANCE_API_KEY = $null
        PENGBO_BINANCE_SECRET = $null
        PENGBO_BINANCE_PASSWORD = $null
    }
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

function Start-DesktopPhase {
    param(
        [string]$ResolvedExePath,
        [hashtable]$EnvironmentOverrides = @{}
    )

    Stop-DesktopScenario -ResolvedExePath $ResolvedExePath
    $mergedEnvironmentOverrides = Get-OnlineEnvironmentOverrides
    foreach ($key in $EnvironmentOverrides.Keys) {
        $mergedEnvironmentOverrides[$key] = $EnvironmentOverrides[$key]
    }

    $null = Start-DesktopWithEnv -ResolvedExePath $ResolvedExePath -EnvironmentOverrides $mergedEnvironmentOverrides
    $health = Wait-ForHealth -Url $baseUrl -TimeoutSeconds $HealthTimeoutSeconds
    $runtime = Invoke-ApiJson -Method Get -Path "/settings/runtime"

    $result.health_ready = $true
    $result.data_dir = $runtime.data_dir
    $result.log_dir = $runtime.log_dir
    $result.bootstrap_log_path = $runtime.sidecar_bootstrap_path
    if (-not $script:dataDirPath) {
        $script:dataDirPath = [string]$runtime.data_dir
    }
    if (-not $script:strongholdDirPath) {
        $script:strongholdDirPath = Join-Path (Split-Path -Parent $runtime.log_dir) "stronghold"
        $result.stronghold_dir = $script:strongholdDirPath
    }

    return [ordered]@{
        runtime = $runtime
        health_seconds = $health.seconds
    }
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

function Get-ElementByNameLike {
    param(
        [System.Windows.Automation.AutomationElement]$Root,
        [string]$Pattern
    )

    $elements = $Root.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.Condition]::TrueCondition
    )

    for ($index = 0; $index -lt $elements.Count; $index++) {
        $name = $elements[$index].Current.Name
        if (-not [string]::IsNullOrWhiteSpace($name) -and $name -like $Pattern) {
            return $elements[$index]
        }
    }

    return $null
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

function Wait-ForElementByNameLike {
    param(
        [System.Windows.Automation.AutomationElement]$Root,
        [string]$Pattern,
        [int]$TimeoutSeconds
    )

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        $match = Get-ElementByNameLike -Root $Root -Pattern $Pattern
        if ($null -ne $match) {
            return $match
        }
        Start-Sleep -Milliseconds 300
    }

    throw "UI element matching '$Pattern' did not appear within $TimeoutSeconds seconds."
}

function Invoke-Element {
    param([System.Windows.Automation.AutomationElement]$Element)

    $invoke = $Element.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $invoke.Invoke()
}

function Click-Element {
    param([System.Windows.Automation.AutomationElement]$Element)

    $Element.SetFocus()
    if ($Element.Current.NativeWindowHandle -ne 0) {
        [PengboMouseInput]::SetForegroundWindow([IntPtr]$Element.Current.NativeWindowHandle) | Out-Null
    }
    Start-Sleep -Milliseconds 100
    $rectangle = $Element.Current.BoundingRectangle
    if ($rectangle.Width -le 0 -or $rectangle.Height -le 0) {
        Invoke-Element -Element $Element
        return
    }

    $x = [int]($rectangle.Left + ($rectangle.Width / 2))
    $y = [int]($rectangle.Top + ($rectangle.Height / 2))
    [PengboMouseInput]::SetCursorPos($x, $y) | Out-Null
    Start-Sleep -Milliseconds 100
    [PengboMouseInput]::mouse_event([PengboMouseInput]::LeftDown, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 60
    [PengboMouseInput]::mouse_event([PengboMouseInput]::LeftUp, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 300
}

function Set-ElementValue {
    param(
        [System.Windows.Automation.AutomationElement]$Element,
        [string]$Value
    )

    $Element.SetFocus()
    Start-Sleep -Milliseconds 200
    try {
        $valuePattern = $Element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
        $valuePattern.SetValue($Value)
        Start-Sleep -Milliseconds 200
    }
    catch {
    }

    [System.Windows.Forms.SendKeys]::SendWait("^a")
    Start-Sleep -Milliseconds 100
    [System.Windows.Forms.SendKeys]::SendWait("{BACKSPACE}")
    Start-Sleep -Milliseconds 100
    try {
        Set-Clipboard -Value $Value
        Start-Sleep -Milliseconds 100
        [System.Windows.Forms.SendKeys]::SendWait("^v")
        Start-Sleep -Milliseconds 300
        $valuePattern = $Element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
        if ([string]$valuePattern.Current.Value -eq $Value) {
            return
        }
    }
    catch {
    }

    foreach ($character in $Value.ToCharArray()) {
        $key = switch -Regex ($character) {
            "\+" { "{+}"; break }
            "\^" { "{^}"; break }
            "%" { "{%}"; break }
            "~" { "{~}"; break }
            "\(" { "{(}"; break }
            "\)" { "{)}"; break }
            "\{" { "{{}"; break }
            "\}" { "{}}"; break }
            "\[" { "{[}"; break }
            "\]" { "{]}"; break }
            default { [string]$character; break }
        }
        [System.Windows.Forms.SendKeys]::SendWait($key)
        Start-Sleep -Milliseconds 20
    }

    Start-Sleep -Milliseconds 300
}

function Get-ElementValue {
    param([System.Windows.Automation.AutomationElement]$Element)

    try {
        $valuePattern = $Element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
        return [string]$valuePattern.Current.Value
    }
    catch {
        return ""
    }
}

function Open-View {
    param(
        [System.Windows.Automation.AutomationElement]$Root,
        [string]$ViewKey
    )

    $button = Wait-ForElementByName -Root $Root -Name "nav-$ViewKey" -TimeoutSeconds $UiTimeoutSeconds
    Invoke-Element -Element $button
}

function Open-WatchlistAsset {
    param(
        [System.Windows.Automation.AutomationElement]$Root,
        [string]$Symbol
    )

    $button = Wait-ForElementByName -Root $Root -Name "watchlist-asset symbol=$Symbol" -TimeoutSeconds $UiTimeoutSeconds
    Invoke-Element -Element $button
}

function Assert-ConnectionMarker {
    param(
        [System.Windows.Automation.AutomationElement]$Root,
        [string]$Provider,
        [string]$Capability,
        [string]$Status
    )

    Wait-ForElementByName -Root $Root -Name "provider-capability provider=$Provider capability=$Capability status=$Status" -TimeoutSeconds $UiTimeoutSeconds | Out-Null
}

function Assert-AssetMarker {
    param(
        [System.Windows.Automation.AutomationElement]$Root,
        [string]$Symbol,
        [string]$Capability,
        [string]$Status
    )

    Wait-ForElementByName -Root $Root -Name "asset-capability symbol=$Symbol capability=$Capability status=$Status" -TimeoutSeconds $UiTimeoutSeconds | Out-Null
}

function Assert-ResearchBriefState {
    param(
        [System.Windows.Automation.AutomationElement]$Root,
        [string]$BriefId,
        [string]$Symbol,
        [string]$FundamentalsStatus,
        [string]$FilingsStatus
    )

    $briefButton = Wait-ForElementByName -Root $Root -Name "research-brief-item id=$BriefId symbol=$Symbol" -TimeoutSeconds $UiTimeoutSeconds
    Invoke-Element -Element $briefButton
    Wait-ForElementByNameLike -Root $Root -Pattern "research-export brief=* symbol=$Symbol fundamentals=$FundamentalsStatus filings=$FilingsStatus" -TimeoutSeconds $UiTimeoutSeconds | Out-Null
}

function Refresh-ResearchList {
    param([System.Windows.Automation.AutomationElement]$Root)

    $refreshButton = Wait-ForElementByName -Root $Root -Name "research-refresh" -TimeoutSeconds $UiTimeoutSeconds
    Invoke-Element -Element $refreshButton
}

function Ensure-ResearchBrief {
    param(
        [string]$Symbol,
        [int]$TimeoutSeconds
    )

    $requestTimeoutSeconds = [Math]::Max($TimeoutSeconds, 120)
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        $recent = Invoke-ApiJson -Method Get -Path "/research/briefs/recent?limit=20"
        $brief = $recent | Where-Object { $_.symbol -eq $Symbol } | Select-Object -First 1
        if ($null -ne $brief) {
            return $brief
        }
        Invoke-ApiJson -Method Post -Path "/research/briefs" -Body @{ symbol = $Symbol } -TimeoutSeconds $requestTimeoutSeconds | Out-Null
        Start-Sleep -Milliseconds 500
    }

    throw "Research brief for '$Symbol' could not be created within $TimeoutSeconds seconds."
}

function Wait-ForProviderCapabilityStatusApi {
    param(
        [string]$Provider,
        [string]$Capability,
        [string]$ExpectedStatus,
        [int]$TimeoutSeconds = 60
    )

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        try {
            $catalog = Invoke-ApiJson -Method Get -Path "/connections/catalog"
            $providerItem = $catalog.providers | Where-Object { $_.provider -eq $Provider } | Select-Object -First 1
            if ($null -ne $providerItem) {
                $capabilityItem = $providerItem.capabilities | Where-Object { $_.key -eq $Capability } | Select-Object -First 1
                if ($null -ne $capabilityItem -and $capabilityItem.status_hint -eq $ExpectedStatus) {
                    return
                }
            }
        }
        catch {
        }
        Start-Sleep -Milliseconds 500
    }

    throw "Provider capability '$Provider/$Capability' did not reach '$ExpectedStatus' within $TimeoutSeconds seconds."
}

function Test-ProviderCapabilityStatusApi {
    param(
        [string]$Provider,
        [string]$Capability,
        [string]$ExpectedStatus,
        [int]$TimeoutSeconds = 15
    )

    try {
        Wait-ForProviderCapabilityStatusApi `
            -Provider $Provider `
            -Capability $Capability `
            -ExpectedStatus $ExpectedStatus `
            -TimeoutSeconds $TimeoutSeconds
        return $true
    }
    catch {
        return $false
    }
}

function New-StageResult {
    return [ordered]@{}
}

function Capture-ConnectionStage {
    param(
        [System.Windows.Automation.AutomationElement]$Root,
        [System.Collections.IDictionary]$StageResult,
        [string]$ExpectedEdgarStatus
    )

    Open-View -Root $Root -ViewKey "connections"
    Assert-ConnectionMarker -Root $Root -Provider "market" -Capability "quotes" -Status "available"
    Assert-ConnectionMarker -Root $Root -Provider "edgar" -Capability "filings" -Status $ExpectedEdgarStatus
    Assert-ConnectionMarker -Root $Root -Provider "binance" -Capability "filings" -Status "unsupported"

    $catalog = Invoke-ApiJson -Method Get -Path "/connections/catalog"
    $status = Invoke-ApiJson -Method Get -Path "/connections/status"
    $edgarProvider = @($status.providers | Where-Object { $_.provider -eq "edgar" })[0]
    $edgarCatalog = @($catalog.providers | Where-Object { $_.provider -eq "edgar" })[0]
    $edgarFilings = @($edgarCatalog.capabilities | Where-Object { $_.key -eq "filings" })[0]

    $StageResult.connections = [ordered]@{
        markers = @(
            "provider-capability provider=market capability=quotes status=available",
            "provider-capability provider=edgar capability=filings status=$ExpectedEdgarStatus",
            "provider-capability provider=binance capability=filings status=unsupported"
        )
        credential_flow_source = "ui_stronghold"
        edgar_health = $edgarProvider.health
        edgar_configured = $edgarProvider.configured
        edgar_credential_summary = $edgarProvider.credential_summary
        edgar_filings_status = $edgarFilings.status_hint
    }
}

function Capture-AssetStage {
    param(
        [System.Collections.IDictionary]$StageResult,
        [string]$ExpectedAaplFilingsStatus
    )

    $aapl = Invoke-ApiJson -Method Get -Path "/assets/AAPL/workspace"
    $unsupportedSymbol = "BTC/USDT"
    $unsupportedResult = [ordered]@{
        symbol = $unsupportedSymbol
        quote_state = "available"
        workspace_loaded = $false
        fundamentals_status = $null
        filings_status = $null
        filings_count = 0
        error = $null
    }

    try {
        $unsupportedWorkspace = Invoke-ApiJson -Method Get -Path "/assets/$([System.Uri]::EscapeDataString($unsupportedSymbol))/workspace"
        $unsupportedResult.workspace_loaded = $true
        $unsupportedResult.fundamentals_status = $unsupportedWorkspace.capabilities.fundamentals_status
        $unsupportedResult.filings_status = $unsupportedWorkspace.capabilities.filings_status
        $unsupportedResult.filings_count = @($unsupportedWorkspace.filings).Count
    }
    catch {
        $unsupportedResult.quote_state = "temporarily_unavailable"
        $unsupportedResult.error = $_.Exception.Message
    }

    $StageResult.asset = [ordered]@{
        expected_markers = @(
            "asset-capability symbol=AAPL capability=fundamentals status=available",
            "asset-capability symbol=AAPL capability=filings status=$ExpectedAaplFilingsStatus",
            "asset-capability symbol=BTC/USDT capability=fundamentals status=unsupported",
            "asset-capability symbol=BTC/USDT capability=filings status=unsupported"
        )
        aapl = [ordered]@{
            fundamentals_status = $aapl.capabilities.fundamentals_status
            filings_status = $aapl.capabilities.filings_status
            filings_count = @($aapl.filings).Count
        }
        unsupported_sample = $unsupportedResult
    }
}

function Capture-ResearchStage {
    param(
        [System.Collections.IDictionary]$StageResult,
        [string]$ExpectedAaplFilingsStatus
    )

    $aaplBrief = Ensure-ResearchBrief -Symbol "AAPL" -TimeoutSeconds $ResearchTimeoutSeconds
    $unsupportedSymbol = "BTC/USDT"
    $unsupportedQuoteState = "available"
    $unsupportedError = $null

    try {
        $null = Ensure-ResearchBrief -Symbol $unsupportedSymbol -TimeoutSeconds $ResearchTimeoutSeconds
    }
    catch {
        $unsupportedQuoteState = "temporarily_unavailable"
        $unsupportedError = $_.Exception.Message
    }

    $recent = Invoke-ApiJson -Method Get -Path "/research/briefs/recent?limit=10"
    $aaplBrief = $recent | Where-Object { $_.symbol -eq "AAPL" } | Select-Object -First 1
    $unsupportedBrief = $recent | Where-Object { $_.symbol -eq $unsupportedSymbol } | Select-Object -First 1
    if ($null -eq $aaplBrief) {
        throw "Expected an AAPL research brief to exist after packaged navigation."
    }

    $aaplDetail = Invoke-ApiJson -Method Get -Path "/research/briefs/$($aaplBrief.brief_id)"
    $unsupportedDetail = $null
    if ($null -ne $unsupportedBrief) {
        $unsupportedDetail = Invoke-ApiJson -Method Get -Path "/research/briefs/$($unsupportedBrief.brief_id)"
    }

    $StageResult.research = [ordered]@{
        expected_markers = @(
            "research-export brief=$($aaplBrief.brief_id) symbol=AAPL fundamentals=available filings=$ExpectedAaplFilingsStatus"
        )
        aapl_brief_id = $aaplBrief.brief_id
        unsupported_symbol = $unsupportedSymbol
        unsupported_brief_id = if ($unsupportedBrief) { $unsupportedBrief.brief_id } else { $null }
        aapl = [ordered]@{
            fundamentals_status = $aaplDetail.asset_snapshot.capabilities.fundamentals_status
            filings_status = $aaplDetail.asset_snapshot.capabilities.filings_status
            filings_count = @($aaplDetail.asset_snapshot.filings).Count
        }
        unsupported_sample = [ordered]@{
            symbol = $unsupportedSymbol
            quote_state = $unsupportedQuoteState
            workspace_loaded = ($null -ne $unsupportedDetail)
            error = $unsupportedError
            fundamentals_status = if ($unsupportedDetail) { $unsupportedDetail.asset_snapshot.capabilities.fundamentals_status } else { $null }
            filings_status = if ($unsupportedDetail) { $unsupportedDetail.asset_snapshot.capabilities.filings_status } else { $null }
            filings_count = if ($unsupportedDetail) { @($unsupportedDetail.asset_snapshot.filings).Count } else { 0 }
        }
    }

    if ($null -ne $unsupportedBrief) {
        $StageResult.research.expected_markers +=
            "research-export brief=$($unsupportedBrief.brief_id) symbol=$unsupportedSymbol fundamentals=unsupported filings=unsupported"
    }
}

function Run-StageCapture {
    param(
        [string]$StageName,
        [string]$ExpectedAaplFilingsStatus,
        [hashtable]$EnvironmentOverrides = @{}
    )

    $phase = Start-DesktopPhase -ResolvedExePath $script:resolvedExePath -EnvironmentOverrides $EnvironmentOverrides
    $windowState = Wait-ForMainWindow -ResolvedExePath $script:resolvedExePath -TimeoutSeconds $UiTimeoutSeconds
    $window = $windowState.window
    $stageResult = New-StageResult
    $result.stages[$StageName] = $stageResult
    $stageResult.health_ready_seconds = $phase.health_seconds
    $stageResult.window_ready_seconds = $windowState.seconds
    $stageResult.window_title = $window.Current.Name

    Capture-ConnectionStage -Root $window -StageResult $stageResult -ExpectedEdgarStatus $ExpectedAaplFilingsStatus
    Capture-AssetStage -StageResult $stageResult -ExpectedAaplFilingsStatus $ExpectedAaplFilingsStatus
    Capture-ResearchStage -StageResult $stageResult -ExpectedAaplFilingsStatus $ExpectedAaplFilingsStatus
}

function Capture-ExistingStage {
    param(
        [System.Collections.IDictionary]$StageResult,
        [System.Windows.Automation.AutomationElement]$Window,
        [double]$HealthSeconds,
        [double]$WindowSeconds,
        [string]$ExpectedAaplFilingsStatus
    )

    $StageResult.health_ready_seconds = $HealthSeconds
    $StageResult.window_ready_seconds = $WindowSeconds
    $StageResult.window_title = $Window.Current.Name

    Capture-ConnectionStage -Root $Window -StageResult $StageResult -ExpectedEdgarStatus $ExpectedAaplFilingsStatus
    Capture-AssetStage -StageResult $StageResult -ExpectedAaplFilingsStatus $ExpectedAaplFilingsStatus
    Capture-ResearchStage -StageResult $StageResult -ExpectedAaplFilingsStatus $ExpectedAaplFilingsStatus
}

function Save-EdgarIdentityThroughUi {
    param(
        [System.Windows.Automation.AutomationElement]$Root,
        [string]$Identity
    )

    Open-View -Root $Root -ViewKey "connections"
    $input = Wait-ForElementByName -Root $Root -Name "connection-secret provider=edgar field=identity" -TimeoutSeconds $UiTimeoutSeconds
    Set-ElementValue -Element $input -Value $Identity
    $currentInputValue = Get-ElementValue -Element $input
    $adapterResult = [ordered]@{
        mode = "webview_dom_ref_fallback"
        input_anchor = "connection-secret provider=edgar field=identity"
        save_anchor = "connection-save provider=edgar"
        value_length = $currentInputValue.Length
        value_matches_expected = ($currentInputValue -eq $Identity)
        value_verified = ($currentInputValue -eq $Identity)
    }
    $result.credential_input_adapter = $adapterResult
    if (-not $adapterResult.value_verified) {
        throw "EDGAR identity input automation did not verify the current control value before save."
    }
    $input.SetFocus()
    Start-Sleep -Milliseconds 100
    [System.Windows.Forms.SendKeys]::SendWait("{TAB}")
    Start-Sleep -Milliseconds 150
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 500
    if (Test-ProviderCapabilityStatusApi -Provider "edgar" -Capability "filings" -ExpectedStatus "available" -TimeoutSeconds 15) {
        return $adapterResult
    }
    $saveButton = Wait-ForElementByName -Root $Root -Name "connection-save provider=edgar" -TimeoutSeconds $UiTimeoutSeconds
    $adapterResult.save_button_enabled = $saveButton.Current.IsEnabled
    if ($saveButton.Current.IsEnabled) {
        Click-Element -Element $saveButton
    }
    Wait-ForProviderCapabilityStatusApi -Provider "edgar" -Capability "filings" -ExpectedStatus "available"
    return $adapterResult
}

function Clear-EdgarIdentityThroughUi {
    param([System.Windows.Automation.AutomationElement]$Root)

    Open-View -Root $Root -ViewKey "connections"
    $clearButton = Wait-ForElementByName -Root $Root -Name "connection-clear provider=edgar" -TimeoutSeconds $UiTimeoutSeconds
    Click-Element -Element $clearButton
    Wait-ForProviderCapabilityStatusApi -Provider "edgar" -Capability "filings" -ExpectedStatus "credential_required"
}

try {
    $script:resolvedExePath = (Resolve-Path $ExePath).Path
    $script:resolvedSidecarPath = (Resolve-Path $sidecarPath).Path
    $script:resolvedOutputPath = [System.IO.Path]::GetFullPath($OutputPath)
    $result.exe_path = $script:resolvedExePath

    $null = Start-DesktopPhase -ResolvedExePath $script:resolvedExePath
    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath

    $script:dataBackupDirPath = New-TemporaryPath -Prefix "pengbo-t30-data-backup"
    $script:strongholdBackupDirPath = New-TemporaryPath -Prefix "pengbo-t30-stronghold-backup"
    Backup-Directory -SourcePath $script:dataDirPath -BackupPath $script:dataBackupDirPath -BackedUpFlag ([ref]$script:dataDirBackedUp)
    Backup-Directory -SourcePath $script:strongholdDirPath -BackupPath $script:strongholdBackupDirPath -BackedUpFlag ([ref]$script:strongholdDirBackedUp)

    Reset-Directory -TargetPath $script:dataDirPath
    Reset-Directory -TargetPath $script:strongholdDirPath

    Run-StageCapture -StageName "baseline" -ExpectedAaplFilingsStatus "credential_required"
    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath

    $savePhase = Start-DesktopPhase -ResolvedExePath $script:resolvedExePath
    $saveWindowState = Wait-ForMainWindow -ResolvedExePath $script:resolvedExePath -TimeoutSeconds $UiTimeoutSeconds
    $afterSaveStage = New-StageResult
    $afterSaveStage.credential_flow_source = "ui_stronghold"
    $afterSaveStage.unsupported_symbol = "BTC/USDT"
    $result.stages.after_identity_save = $afterSaveStage
    $afterSaveStage.credential_input_adapter = Save-EdgarIdentityThroughUi -Root $saveWindowState.window -Identity $EdgarIdentity
    Capture-ExistingStage `
        -StageResult $afterSaveStage `
        -Window $saveWindowState.window `
        -HealthSeconds $savePhase.health_seconds `
        -WindowSeconds $saveWindowState.seconds `
        -ExpectedAaplFilingsStatus "available"
    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath

    $restartPhase = Start-DesktopPhase -ResolvedExePath $script:resolvedExePath
    $restartWindowState = Wait-ForMainWindow -ResolvedExePath $script:resolvedExePath -TimeoutSeconds $UiTimeoutSeconds
    $afterSaveStage.post_restart = New-StageResult
    Capture-ExistingStage `
        -StageResult $afterSaveStage.post_restart `
        -Window $restartWindowState.window `
        -HealthSeconds $restartPhase.health_seconds `
        -WindowSeconds $restartWindowState.seconds `
        -ExpectedAaplFilingsStatus "available"
    $afterSaveStage.post_restart_edgar_status = $afterSaveStage.post_restart["connections"]["edgar_filings_status"]

    $afterClearStage = New-StageResult
    $afterClearStage.credential_flow_source = "ui_stronghold"
    $afterClearStage.unsupported_symbol = "BTC/USDT"
    $result.stages.after_identity_clear = $afterClearStage
    Clear-EdgarIdentityThroughUi -Root $restartWindowState.window
    Capture-ExistingStage `
        -StageResult $afterClearStage `
        -Window $restartWindowState.window `
        -HealthSeconds $restartPhase.health_seconds `
        -WindowSeconds $restartWindowState.seconds `
        -ExpectedAaplFilingsStatus "credential_required"
}
catch {
    Add-Failure $_.Exception.Message
}
finally {
    if ($script:resolvedExePath) {
        Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath
    }
    if ($script:dataDirPath -and $script:dataBackupDirPath) {
        Restore-Directory -TargetPath $script:dataDirPath -BackupPath $script:dataBackupDirPath -WasBackedUp $script:dataDirBackedUp
    }
    if ($script:strongholdDirPath -and $script:strongholdBackupDirPath) {
        Restore-Directory -TargetPath $script:strongholdDirPath -BackupPath $script:strongholdBackupDirPath -WasBackedUp $script:strongholdDirBackedUp
    }
    foreach ($path in @($script:dataBackupDirPath, $script:strongholdBackupDirPath)) {
        if ($path -and (Test-Path -LiteralPath $path)) {
            Remove-Item -LiteralPath $path -Recurse -Force
        }
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
