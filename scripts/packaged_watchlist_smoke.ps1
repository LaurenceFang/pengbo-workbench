param(
    [string]$ExePath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\target\release\pengbo-workbench.exe"),
    [string]$OutputPath = (Join-Path (Join-Path $PSScriptRoot "..") "logs\watchlist-packaged-smoke-latest.json"),
    [int]$HealthTimeoutSeconds = 35,
    [int]$UiTimeoutSeconds = 60
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

$baseUrl = "http://127.0.0.1:8765/api/v1"
$sidecarPath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\target\release\pengbo-sidecar.exe")
$result = [ordered]@{
    exe_path = ""
    started_at = (Get-Date).ToString("o")
    finished_at = $null
    health_ready = $false
    watchlist_loaded = $false
    remove_button_visible = $false
    search_result_add_button_visible = $false
    add_clicked_persisted = $false
    remove_clicked_persisted = $false
    restored_original_watchlist = $false
    ui_markers = [ordered]@{}
    api_symbols_after_add = @()
    api_symbols_after_remove = @()
    failures = New-Object System.Collections.Generic.List[string]
}

$script:resolvedExePath = $null
$script:resolvedSidecarPath = $null
$script:originalSymbols = @()

function Add-Failure {
    param([string]$Message)
    $result.failures.Add($Message)
    Write-Warning $Message
}

function Invoke-ApiJson {
    param(
        [ValidateSet("Get", "Post", "Put", "Delete")]
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [int]$TimeoutSeconds = 30
    )
    $params = @{
        Method = $Method
        Uri = "$baseUrl$Path"
        TimeoutSec = $TimeoutSeconds
        UseBasicParsing = $true
    }
    if ($null -ne $Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 12)
        $params.ContentType = "application/json"
    }
    return Invoke-RestMethod @params
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
        Start-Sleep -Milliseconds 900
    }
}

function Stop-DesktopScenario {
    Stop-MatchingProcesses -ProcessName "pengbo-workbench" -ResolvedPath $script:resolvedExePath
    Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $script:resolvedSidecarPath
    Get-Process -Name "pengbo-workbench" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process -Name "pengbo-sidecar" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    $listeners = @(netstat -ano | Select-String "127.0.0.1:8765\s+" | ForEach-Object {
            ($_ -split "\s+")[-1]
        } | Where-Object { $_ -match "^\d+$" } | Select-Object -Unique)
    foreach ($pidText in $listeners) {
        $process = Get-Process -Id ([int]$pidText) -ErrorAction SilentlyContinue
        if ($null -ne $process -and $process.ProcessName -in @("python", "pythonw", "pengbo-sidecar")) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Milliseconds 500
}

function Wait-ForHealth {
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $HealthTimeoutSeconds) {
        try {
            $health = Invoke-ApiJson -Method Get -Path "/health" -TimeoutSeconds 3
            if ($health.status -eq "ok") {
                return
            }
        }
        catch {
        }
        Start-Sleep -Milliseconds 300
    }
    throw "Health check did not become ready within $HealthTimeoutSeconds seconds."
}

function Wait-ForMainWindow {
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $UiTimeoutSeconds) {
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
    throw "Desktop main window did not become available within $UiTimeoutSeconds seconds."
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
        Start-Sleep -Milliseconds 500
        return
    }
    $selectionPattern = $null
    if ($Element.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$selectionPattern)) {
        $selectionPattern.Select()
        Start-Sleep -Milliseconds 500
        return
    }
    throw "Element '$($Element.Current.Name)' does not support Invoke or SelectionItem."
}

function Set-ElementValue {
    param([System.Windows.Automation.AutomationElement]$Element, [string]$Value)
    $valuePattern = $null
    if ($Element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$valuePattern)) {
        $valuePattern.SetValue($Value)
        Start-Sleep -Milliseconds 500
        return
    }
    $Element.SetFocus()
    Start-Sleep -Milliseconds 200
    [System.Windows.Forms.SendKeys]::SendWait("^a")
    [System.Windows.Forms.SendKeys]::SendWait($Value)
    Start-Sleep -Milliseconds 800
}

function Set-Watchlist {
    param([string[]]$Symbols)
    Invoke-ApiJson -Method Put -Path "/watchlist/default" -Body @{ symbols = @($Symbols) } | Out-Null
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null

try {
    $script:resolvedExePath = (Resolve-Path $ExePath).Path
    $script:resolvedSidecarPath = (Resolve-Path $sidecarPath).Path
    $result.exe_path = $script:resolvedExePath

    Stop-DesktopScenario
    Start-Process -FilePath $script:resolvedExePath -PassThru -WindowStyle Hidden | Out-Null
    Wait-ForHealth
    $result.health_ready = $true

    $original = Invoke-ApiJson -Method Get -Path "/watchlist/default"
    $script:originalSymbols = @($original.symbols)
    Set-Watchlist -Symbols @("AAPL", "SPY", "BTC/USDT", "NVDA")

    $window = Wait-ForMainWindow
    $nav = Wait-ForElementByName -Root $window -Name "nav-watchlist" -TimeoutSeconds $UiTimeoutSeconds
    Invoke-UiElement -Element $nav
    $result.watchlist_loaded = $true

    $remove = Wait-ForElementByName -Root $window -Name "watchlist-remove symbol=AAPL" -TimeoutSeconds $UiTimeoutSeconds
    $result.remove_button_visible = $true
    $result.ui_markers.remove = $remove.Current.Name

    $search = Wait-ForElementByName -Root $window -Name "watchlist-candidate-search" -TimeoutSeconds $UiTimeoutSeconds
    Set-ElementValue -Element $search -Value "AMZN"

    $candidate = Wait-ForElementNameStartsWith -Root $window -Prefix "watchlist-candidate symbol=AMZN" -TimeoutSeconds $UiTimeoutSeconds
    $add = Wait-ForElementByName -Root $window -Name "watchlist-add-option symbol=AMZN" -TimeoutSeconds $UiTimeoutSeconds
    $result.search_result_add_button_visible = $true
    $result.ui_markers.candidate = $candidate.name
    $result.ui_markers.add = $add.Current.Name

    Invoke-UiElement -Element $add
    Start-Sleep -Seconds 2
    $afterAdd = Invoke-ApiJson -Method Get -Path "/watchlist/default"
    $result.api_symbols_after_add = @($afterAdd.symbols)
    $result.add_clicked_persisted = @($afterAdd.symbols) -contains "AMZN"

    $removeAfterAdd = Wait-ForElementByName -Root $window -Name "watchlist-remove symbol=AAPL" -TimeoutSeconds $UiTimeoutSeconds
    Invoke-UiElement -Element $removeAfterAdd
    Start-Sleep -Seconds 2
    $afterRemove = Invoke-ApiJson -Method Get -Path "/watchlist/default"
    $result.api_symbols_after_remove = @($afterRemove.symbols)
    $result.remove_clicked_persisted = -not (@($afterRemove.symbols) -contains "AAPL")

    if (-not $result.add_clicked_persisted) { Add-Failure "Clicking the AMZN search-result add button did not persist AMZN." }
    if (-not $result.remove_clicked_persisted) { Add-Failure "Clicking the AAPL remove button did not persist removal." }
}
catch {
    Add-Failure $_.Exception.Message
}
finally {
    try {
        if ($script:originalSymbols.Count -gt 0) {
            Set-Watchlist -Symbols $script:originalSymbols
            $restored = Invoke-ApiJson -Method Get -Path "/watchlist/default"
            $result.restored_original_watchlist = (@($restored.symbols) -join "|") -eq ($script:originalSymbols -join "|")
        }
    }
    catch {
        Add-Failure "Failed to restore original watchlist: $($_.Exception.Message)"
    }
    $result.finished_at = (Get-Date).ToString("o")
    $result | ConvertTo-Json -Depth 8 | Set-Content -Path $OutputPath -Encoding UTF8
    Stop-DesktopScenario
    if ($result.failures.Count -gt 0) {
        Write-Error "Packaged watchlist smoke failed. See $OutputPath"
    }
    else {
        Write-Output "Packaged watchlist smoke passed: $OutputPath"
    }
}
