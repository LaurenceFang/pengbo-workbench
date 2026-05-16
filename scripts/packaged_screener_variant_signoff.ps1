param(
    [string]$ExePath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\pengbo-workbench.exe"),
    [string]$OutputPath = (Join-Path (Join-Path $PSScriptRoot "..") "logs\\screener-variant-signoff-latest.json"),
    [int]$HealthTimeoutSeconds = 25,
    [int]$UiTimeoutSeconds = 25,
    [int]$RunTimeoutSeconds = 90,
    [string]$PresetKey = "quality-equities",
    [string]$UniverseSource = "expanded"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$baseUrl = "http://127.0.0.1:8765/api/v1"
$sidecarPath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\pengbo-sidecar.exe")
$result = [ordered]@{
    exe_path = ""
    started_at = (Get-Date).ToString("o")
    finished_at = $null
    health_ready = $false
    data_dir = $null
    log_dir = $null
    bootstrap_log_path = $null
    failures = New-Object System.Collections.Generic.List[string]
    preset_key = $PresetKey
    created_variant_key = $null
    created_variant_name = $null
    initial_run = [ordered]@{}
    after_restart = [ordered]@{}
    after_delete = [ordered]@{}
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

function Get-OnlineEnvironmentOverrides {
    return @{
        HTTP_PROXY = $null
        HTTPS_PROXY = $null
        ALL_PROXY = $null
        NO_PROXY = "127.0.0.1,localhost"
    }
}

function Start-DesktopPhase {
    param(
        [string]$ResolvedExePath,
        [string]$PhaseName
    )

    Stop-MatchingProcesses -ProcessName "pengbo-workbench" -ResolvedPath $ResolvedExePath
    if ($script:resolvedSidecarPath) {
        Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $script:resolvedSidecarPath
    }

    $process = Start-DesktopWithEnv -ResolvedExePath $ResolvedExePath -EnvironmentOverrides (Get-OnlineEnvironmentOverrides)
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
    $result.log_dir = $runtime.log_dir
    $result.bootstrap_log_path = $runtime.sidecar_bootstrap_path
    if (-not $script:dataDirPath) {
        $script:dataDirPath = [string]$runtime.data_dir
        $result.data_dir = $script:dataDirPath
    }

    if ($PhaseName -and $result.Contains($PhaseName)) {
        $result[$PhaseName].health_ready_seconds = $health.seconds
        $result[$PhaseName].workbench_pid = $workbenchPid
        $result[$PhaseName].runtime_mode = $runtime.runtime_mode
        $result[$PhaseName].base_url = $runtime.base_url
        $result[$PhaseName].log_dir = $runtime.log_dir
        $result[$PhaseName].bootstrap_log_path = $runtime.sidecar_bootstrap_path
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

    $script:backupDirPath = New-TemporaryPath -Prefix "pengbo-t25-backup"
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

function Get-RelevantAutomationNames {
    param([System.Windows.Automation.AutomationElement]$Root)

    return @(Get-AllAutomationNames -Root $Root | Where-Object {
            $_ -eq "nav-screeners" -or $_ -like "screeners-*" -or $_ -like "screener-*"
        })
}

function Get-ScreenerPresets {
    $payload = Invoke-ApiJson -Method Get -Path "/screeners/presets"
    foreach ($item in @($payload)) {
        if ($item -is [System.Array]) {
            foreach ($nested in $item) {
                $nested
            }
        }
        else {
            $item
        }
    }
}

function Get-ScreenerVariants {
    param([string]$Preset)

    $payload = Invoke-ApiJson -Method Get -Path "/screeners/presets/$([uri]::EscapeDataString($Preset))/variants"
    foreach ($item in @($payload)) {
        if ($item -is [System.Array]) {
            foreach ($nested in $item) {
                $nested
            }
        }
        else {
            $item
        }
    }
}

function Get-ScreenerPreset {
    param([string]$Preset)

    foreach ($item in @(Get-ScreenerPresets)) {
        if ($item.key -eq $Preset) {
            return $item
        }
    }

    return $null
}

function Get-ScreenerVariant {
    param(
        [string]$Preset,
        [string]$VariantKey
    )

    foreach ($item in @(Get-ScreenerVariants -Preset $Preset)) {
        if ($item.variant_key -eq $VariantKey) {
            return $item
        }
    }

    return $null
}

function Reset-ScreenerPresetState {
    param([string]$Preset)

    $variants = Get-ScreenerVariants -Preset $Preset
    foreach ($variant in $variants) {
        if (-not [bool]$variant.is_system_default) {
            Invoke-ApiJson -Method Delete -Path "/screeners/presets/$([uri]::EscapeDataString($Preset))/variants/$([uri]::EscapeDataString($variant.variant_key))" | Out-Null
        }
    }

    $defaultVariant = Get-ScreenerVariant -Preset $Preset -VariantKey "default"
    if ($null -eq $defaultVariant) {
        throw "Failed to resolve the default screener variant for preset '$Preset'."
    }
    if (-not [bool]$defaultVariant.is_active) {
        Invoke-ApiJson -Method Post -Path "/screeners/presets/$([uri]::EscapeDataString($Preset))/variants/default/activate" | Out-Null
    }

    return Get-ScreenerVariant -Preset $Preset -VariantKey "default"
}

function New-TestVariant {
    param([string]$Preset)

    $nameSeed = "T25 Signoff $(Get-Date -Format 'yyyyMMdd-HHmmss')"
    $created = Invoke-ApiJson -Method Post -Path "/screeners/presets/$([uri]::EscapeDataString($Preset))/variants" -Body @{
        name = $nameSeed
        description = "T25 packaged signoff copy"
    }

    $updated = Invoke-ApiJson -Method Put -Path "/screeners/presets/$([uri]::EscapeDataString($Preset))/variants/$([uri]::EscapeDataString($created.variant_key))" -Body @{
        name = "$nameSeed tuned"
        description = "T25 packaged lifecycle validation variant"
        tuning = @{
            quality_floor = "low"
            trend_requirement = "low"
            size_bias = "high"
        }
    }

    Invoke-ApiJson -Method Post -Path "/screeners/presets/$([uri]::EscapeDataString($Preset))/variants/$([uri]::EscapeDataString($created.variant_key))/activate" | Out-Null

    return Get-ScreenerVariant -Preset $Preset -VariantKey $created.variant_key
}

function Invoke-ScreenerRun {
    param(
        [string]$Preset,
        [string]$VariantKey,
        [string]$Universe
    )

    return Invoke-ApiJson -Method Post -Path "/screeners/run" -Body @{
        preset = $Preset
        asset_type = "equity"
        universeSource = $Universe
        variantKey = $VariantKey
    } -TimeoutSeconds $RunTimeoutSeconds
}

function Open-ScreenersView {
    param(
        [System.Windows.Automation.AutomationElement]$Root,
        [int]$TimeoutSeconds
    )

    $screenersButton = Wait-ForElementByName -Root $Root -Name "nav-screeners" -TimeoutSeconds $TimeoutSeconds
    Invoke-Element -Element $screenersButton
}

function Capture-SignoffStage {
    param(
        [string]$PhaseName,
        [string]$Preset,
        [string]$ExpectedVariantKey,
        [bool]$ExpectedSystemDefault,
        [object]$ExpectedVariant,
        [string]$ExpectedVariantName,
        [bool]$RequireUiRunAttribution = $true
    )

    $windowState = Wait-ForMainWindow -ResolvedExePath $script:resolvedExePath -TimeoutSeconds $UiTimeoutSeconds
    $window = $windowState.window
    $result[$PhaseName].window_title = $window.Current.Name
    $result[$PhaseName].window_pid = $windowState.process.Id
    $result[$PhaseName].window_ready_seconds = $windowState.seconds

    Open-ScreenersView -Root $window -TimeoutSeconds $UiTimeoutSeconds

    $presetPattern = "screener-preset key=$Preset*"
    $presetButton = Wait-ForElementByNameLike -Root $window -Pattern $presetPattern -TimeoutSeconds $UiTimeoutSeconds
    Invoke-Element -Element $presetButton
    Wait-ForElementByNameLike -Root $window -Pattern "screener-preset key=$Preset selected=true active-variant=$ExpectedVariantKey" -TimeoutSeconds $UiTimeoutSeconds | Out-Null
    $variantButton = Wait-ForElementByNameLike -Root $window -Pattern "screener-variant key=$ExpectedVariantKey * active=true system=$($ExpectedSystemDefault.ToString().ToLowerInvariant())" -TimeoutSeconds $UiTimeoutSeconds
    Invoke-Element -Element $variantButton
    Wait-ForElementByNameLike -Root $window -Pattern "screener-variant key=$ExpectedVariantKey selected=true active=true system=$($ExpectedSystemDefault.ToString().ToLowerInvariant())" -TimeoutSeconds $UiTimeoutSeconds | Out-Null
    Wait-ForElementByName -Root $window -Name "screener-summary-list variant=$ExpectedVariantKey count=$(@($ExpectedVariant.filters).Count)" -TimeoutSeconds $UiTimeoutSeconds | Out-Null

    for ($index = 0; $index -lt @($ExpectedVariant.filters).Count; $index++) {
        Wait-ForElementByName -Root $window -Name "screener-summary variant=$ExpectedVariantKey index=$index" -TimeoutSeconds $UiTimeoutSeconds | Out-Null
    }

    if ($RequireUiRunAttribution) {
        $runButton = Wait-ForElementByName -Root $window -Name "screener-run variant=$ExpectedVariantKey universe=$UniverseSource" -TimeoutSeconds $UiTimeoutSeconds
        Invoke-Element -Element $runButton
        Wait-ForElementByName -Root $window -Name "screener-run-attribution preset=$Preset variant=$ExpectedVariantKey universe=$UniverseSource" -TimeoutSeconds $RunTimeoutSeconds | Out-Null
    }

    $presetSnapshot = Get-ScreenerPreset -Preset $Preset
    $runPayload = Invoke-ScreenerRun -Preset $Preset -VariantKey $ExpectedVariantKey -Universe $UniverseSource

    if ($presetSnapshot.active_variant_key -ne $ExpectedVariantKey) {
        throw "Phase '$PhaseName' expected preset '$Preset' to keep active variant '$ExpectedVariantKey', got '$($presetSnapshot.active_variant_key)'."
    }
    if ($runPayload.variant_key -ne $ExpectedVariantKey) {
        throw "Phase '$PhaseName' run attribution returned '$($runPayload.variant_key)' instead of '$ExpectedVariantKey'."
    }

    $result[$PhaseName].active_variant_key = $presetSnapshot.active_variant_key
    $result[$PhaseName].active_variant_name = $presetSnapshot.active_variant_name
    $result[$PhaseName].selected_variant_key = $ExpectedVariantKey
    $result[$PhaseName].selected_variant_name = $ExpectedVariantName
    $result[$PhaseName].summary_filters = @($ExpectedVariant.filters)
    $result[$PhaseName].run_variant_key = $runPayload.variant_key
    $result[$PhaseName].run_variant_name = $runPayload.variant_name
    $result[$PhaseName].evaluated_count = $runPayload.evaluated_count
    $result[$PhaseName].hit_count = $runPayload.hit_count
    $result[$PhaseName].automation_names = Get-RelevantAutomationNames -Root $window
}

try {
    $script:resolvedExePath = (Resolve-Path $ExePath).Path
    $script:resolvedSidecarPath = (Resolve-Path $sidecarPath).Path
    $script:resolvedOutputPath = [System.IO.Path]::GetFullPath($OutputPath)
    $result.exe_path = $script:resolvedExePath

    Stop-MatchingProcesses -ProcessName "pengbo-workbench" -ResolvedPath $script:resolvedExePath
    Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $script:resolvedSidecarPath

    $null = Start-DesktopPhase -ResolvedExePath $script:resolvedExePath -PhaseName ""
    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath

    Backup-DataDirectory -Path $script:dataDirPath

    $null = Start-DesktopPhase -ResolvedExePath $script:resolvedExePath -PhaseName ""
    $defaultVariant = Reset-ScreenerPresetState -Preset $PresetKey
    $createdVariant = New-TestVariant -Preset $PresetKey
    $result.created_variant_key = $createdVariant.variant_key
    $result.created_variant_name = $createdVariant.name
    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath

    $null = Start-DesktopPhase -ResolvedExePath $script:resolvedExePath -PhaseName "initial_run"
    $createdVariant = Get-ScreenerVariant -Preset $PresetKey -VariantKey $result.created_variant_key
    if ($null -eq $createdVariant) {
        throw "Created variant '$($result.created_variant_key)' was not found before the initial signoff run."
    }
    Capture-SignoffStage -PhaseName "initial_run" -Preset $PresetKey -ExpectedVariantKey $createdVariant.variant_key -ExpectedSystemDefault $false -ExpectedVariant $createdVariant -ExpectedVariantName $createdVariant.name
    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath

    $null = Start-DesktopPhase -ResolvedExePath $script:resolvedExePath -PhaseName "after_restart"
    $createdVariant = Get-ScreenerVariant -Preset $PresetKey -VariantKey $result.created_variant_key
    if ($null -eq $createdVariant) {
        throw "Created variant '$($result.created_variant_key)' was not found after restart."
    }
    Capture-SignoffStage -PhaseName "after_restart" -Preset $PresetKey -ExpectedVariantKey $createdVariant.variant_key -ExpectedSystemDefault $false -ExpectedVariant $createdVariant -ExpectedVariantName $createdVariant.name

    Invoke-ApiJson -Method Delete -Path "/screeners/presets/$([uri]::EscapeDataString($PresetKey))/variants/$([uri]::EscapeDataString($result.created_variant_key))" | Out-Null
    Stop-DesktopScenario -ResolvedExePath $script:resolvedExePath

    $null = Start-DesktopPhase -ResolvedExePath $script:resolvedExePath -PhaseName "after_delete"
    $defaultVariant = Get-ScreenerVariant -Preset $PresetKey -VariantKey "default"
    if ($null -eq $defaultVariant) {
        throw "Default screener variant was not found after deleting '$($result.created_variant_key)'."
    }
    Capture-SignoffStage -PhaseName "after_delete" -Preset $PresetKey -ExpectedVariantKey "default" -ExpectedSystemDefault $true -ExpectedVariant $defaultVariant -ExpectedVariantName $defaultVariant.name -RequireUiRunAttribution $false
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
