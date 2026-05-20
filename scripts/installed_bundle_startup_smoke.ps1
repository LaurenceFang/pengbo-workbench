param(
    [ValidateSet("msi", "nsis")]
    [string]$InstallerType = "msi",
    [string]$MsiPath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\bundle\\msi\\Pengbo Workbench_0.1.0_x64_en-US.msi"),
    [string]$NsisPath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\bundle\\nsis\\Pengbo Workbench_0.1.0_x64-setup.exe"),
    [string]$InstalledExePath = "",
    [string]$InstalledSidecarPath = "",
    [string]$OutputPath = "",
    [int]$HealthTimeoutSeconds = 25
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$baseUrl = "http://127.0.0.1:8765/api/v1"
$productName = "Pengbo Workbench"
$expectedInstalledExeNames = @(
    "Pengbo Workbench.exe",
    "pengbo-workbench.exe"
)
$appLogDir = Join-Path $env:LOCALAPPDATA "com.pengbo.workbench\\logs"
$appBootstrapLogPath = Join-Path $appLogDir "sidecar-bootstrap.log"
$appDataDir = Join-Path $env:APPDATA "com.pengbo.workbench"
$defaultOutputPaths = @{
    msi = Join-Path (Join-Path $PSScriptRoot "..") "logs\\installed-bundle-startup-smoke-latest.json"
    nsis = Join-Path (Join-Path $PSScriptRoot "..") "logs\\installed-bundle-startup-smoke-nsis-latest.json"
}
$result = [ordered]@{
    installer_type = $InstallerType
    installer_path = ""
    install_log_path = ""
    installed_exe_path = ""
    installed_sidecar_path = $null
    root_sidecar_absent_ok = $false
    started_at = (Get-Date).ToString("o")
    finished_at = $null
    health_ready = $false
    health_ready_seconds = $null
    connections_status_ok = $false
    settings_runtime_ok = $false
    single_instance_ok = $false
    adopt_existing_ok = $false
    appdata_log_dir_ok = $false
    appdata_data_dir_ok = $false
    bootstrap_log_path = $null
    install_exit_code = $null
    failures = New-Object System.Collections.Generic.List[string]
    scenarios = [ordered]@{
        install = [ordered]@{}
        cold_launch = [ordered]@{}
        second_launch = [ordered]@{}
        adopt_existing = [ordered]@{}
    }
}

function Normalize-ComparablePath {
    param([string]$Path)

    if (-not $Path) {
        return $null
    }

    return [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
}

function Add-Failure {
    param([string]$Message)

    $result.failures.Add($Message)
    Write-Warning $Message
}

function Get-ShortcutTarget {
    param([string]$ShortcutPath)

    if (-not (Test-Path -LiteralPath $ShortcutPath)) {
        return $null
    }

    try {
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($ShortcutPath)
        if ($shortcut.TargetPath) {
            return [System.IO.Path]::GetFullPath($shortcut.TargetPath)
        }
    }
    catch {
    }

    return $null
}

function Get-RegistryInstallCandidates {
    $roots = @(
        "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
        "HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
        "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
    )

    $candidates = New-Object System.Collections.Generic.List[string]
    foreach ($root in $roots) {
        $items = @(Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue)
        foreach ($item in $items) {
            try {
                $props = Get-ItemProperty -LiteralPath $item.PSPath -ErrorAction Stop
                if ($props.DisplayName -ne $productName) {
                    continue
                }

                foreach ($propertyName in @("InstallLocation", "DisplayIcon")) {
                    $value = [string]$props.$propertyName
                    if (-not $value) {
                        continue
                    }

                    $candidate = $value.Trim('"')
                    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
                        if ($expectedInstalledExeNames -contains [System.IO.Path]::GetFileName($candidate)) {
                            $candidates.Add([System.IO.Path]::GetFullPath($candidate))
                        }
                    }
                    elseif (Test-Path -LiteralPath $candidate -PathType Container) {
                        foreach ($expectedName in $expectedInstalledExeNames) {
                            $exeCandidate = Join-Path $candidate $expectedName
                            if (Test-Path -LiteralPath $exeCandidate -PathType Leaf) {
                                $candidates.Add([System.IO.Path]::GetFullPath($exeCandidate))
                            }
                        }
                    }
                }
            }
            catch {
            }
        }
    }

    return @($candidates)
}

function Get-InstalledExeCandidates {
    $candidates = New-Object System.Collections.Generic.List[string]
    $defaultRoots = @(
        (Join-Path $env:ProgramFiles $productName),
        (Join-Path ${env:ProgramFiles(x86)} $productName)
    ) | Where-Object { $_ }

    foreach ($root in $defaultRoots) {
        foreach ($expectedName in $expectedInstalledExeNames) {
            $candidate = Join-Path $root $expectedName
            if (Test-Path -LiteralPath $candidate -PathType Leaf) {
                $candidates.Add([System.IO.Path]::GetFullPath($candidate))
            }
        }
    }

    $shortcutLocations = @(
        (Join-Path $env:ProgramData "Microsoft\\Windows\\Start Menu\\Programs\\$productName\\$productName.lnk"),
        (Join-Path $env:APPDATA "Microsoft\\Windows\\Start Menu\\Programs\\$productName\\$productName.lnk"),
        (Join-Path $env:ProgramData "Microsoft\\Windows\\Start Menu\\Programs\\$productName.lnk"),
        (Join-Path $env:APPDATA "Microsoft\\Windows\\Start Menu\\Programs\\$productName.lnk")
    )
    foreach ($shortcutLocation in $shortcutLocations) {
        $shortcutTarget = Get-ShortcutTarget -ShortcutPath $shortcutLocation
        if ($shortcutTarget -and (Test-Path -LiteralPath $shortcutTarget -PathType Leaf)) {
            $candidates.Add($shortcutTarget)
        }
    }

    foreach ($registryCandidate in @(Get-RegistryInstallCandidates)) {
        if ($registryCandidate -and (Test-Path -LiteralPath $registryCandidate -PathType Leaf)) {
            $candidates.Add($registryCandidate)
        }
    }

    return @($candidates | Select-Object -Unique)
}

function Resolve-InstalledExePath {
    param([string]$PreferredPath)

    if ($PreferredPath) {
        $preferredResolved = [System.IO.Path]::GetFullPath($PreferredPath)
        if (-not (Test-Path -LiteralPath $preferredResolved -PathType Leaf)) {
            throw "Installed exe override was provided but not found: $preferredResolved"
        }

        return $preferredResolved
    }

    $candidates = @(Get-InstalledExeCandidates)
    if ($candidates.Count -eq 0) {
        throw "Unable to locate installed workbench executable after $($InstallerType.ToUpperInvariant()) install."
    }

    return $candidates[0]
}

function Resolve-InstalledSidecarPath {
    param(
        [string]$PreferredPath,
        [string]$ResolvedExePath
    )

    if ($PreferredPath) {
        $preferredResolved = [System.IO.Path]::GetFullPath($PreferredPath)
        if (-not (Test-Path -LiteralPath $preferredResolved -PathType Leaf)) {
            throw "Installed sidecar override was provided but not found: $preferredResolved"
        }

        return $preferredResolved
    }

    $exeDir = Split-Path -Parent $ResolvedExePath
    $preferredCandidates = @(
        (Join-Path $exeDir "binaries\pengbo-sidecar\pengbo-sidecar.exe"),
        (Join-Path $exeDir "resources\binaries\pengbo-sidecar\pengbo-sidecar.exe"),
        (Join-Path $exeDir "resources\pengbo-sidecar\pengbo-sidecar.exe"),
        (Join-Path $exeDir "_up_\binaries\pengbo-sidecar\pengbo-sidecar.exe"),
        (Join-Path $exeDir "_up_\pengbo-sidecar\pengbo-sidecar.exe")
    )

    foreach ($candidate in $preferredCandidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            return [System.IO.Path]::GetFullPath($candidate)
        }
    }

    $searchRoots = @(
        $exeDir,
        (Join-Path $exeDir "resources"),
        (Join-Path $exeDir "_up_")
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Container) }

    foreach ($root in $searchRoots) {
        $matches = @(Get-ChildItem -LiteralPath $root -Filter "pengbo-sidecar*.exe" -Recurse -File -ErrorAction SilentlyContinue)
        if ($matches.Count -gt 0) {
            return [System.IO.Path]::GetFullPath($matches[0].FullName)
        }
    }

    return $null
}

function Remove-StaleRootSidecar {
    param([string]$ResolvedExePath)

    $exeDir = Split-Path -Parent $ResolvedExePath
    $rootSidecarPath = Join-Path $exeDir "pengbo-sidecar.exe"
    if (Test-Path -LiteralPath $rootSidecarPath -PathType Leaf) {
        Remove-Item -LiteralPath $rootSidecarPath -Force
    }
}

function Test-RootSidecarAbsent {
    param([string]$ResolvedExePath)

    $exeDir = Split-Path -Parent $ResolvedExePath
    $rootSidecarPath = Join-Path $exeDir "pengbo-sidecar.exe"
    return -not (Test-Path -LiteralPath $rootSidecarPath -PathType Leaf)
}

function Get-ProcessNameFromPath {
    param([string]$Path)

    return [System.IO.Path]::GetFileNameWithoutExtension($Path)
}

function Get-ProcessSnapshot {
    param(
        [string]$ProcessName,
        [string]$ResolvedPath
    )

    return @(Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | Where-Object {
            if (-not $ResolvedPath) {
                return $true
            }

            try {
                $_.Path -and ((Resolve-Path $_.Path).Path -eq $ResolvedPath)
            }
            catch {
                $false
            }
        })
}

function Stop-MatchingProcesses {
    param(
        [string]$ProcessName,
        [string]$ResolvedPath
    )

    $targets = @(Get-ProcessSnapshot -ProcessName $ProcessName -ResolvedPath $ResolvedPath)
    foreach ($target in $targets) {
        Stop-Process -Id $target.Id -Force -ErrorAction SilentlyContinue
    }

    if ($targets.Count -gt 0) {
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

function Invoke-ApiCheck {
    param([string]$Url)

    return Invoke-RestMethod -Uri $Url -TimeoutSec 5
}

function Get-LogLineCount {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return 0
    }

    return @((Get-Content -Path $Path -ErrorAction SilentlyContinue)).Count
}

function Get-LogDelta {
    param(
        [string]$Path,
        [int]$StartLine
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return @()
    }

    $lines = @((Get-Content -Path $Path -ErrorAction SilentlyContinue) | ForEach-Object { "$_" })
    if ($lines.Count -lt $StartLine) {
        return $lines
    }
    return @($lines | Select-Object -Skip $StartLine)
}

function Wait-ForLogPattern {
    param(
        [string]$Path,
        [int]$StartLine,
        [string]$Pattern,
        [int]$TimeoutSeconds = 10
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        $lines = Get-LogDelta -Path $Path -StartLine $StartLine
        if (($lines -join "`n") -match $Pattern) {
            return $lines
        }

        Start-Sleep -Milliseconds 300
    } while ((Get-Date) -lt $deadline)

    throw "Timed out waiting for log pattern '$Pattern' in $Path."
}

function Start-Desktop {
    param([string]$ResolvedExePath)

    return Start-Process -FilePath $ResolvedExePath -PassThru
}

function Start-StandaloneSidecar {
    param(
        [string]$ResolvedSidecarPath,
        [string]$DataDir,
        [string]$LogDir
    )

    if (-not $ResolvedSidecarPath) {
        throw "Installed sidecar path is required for the adopt-existing scenario."
    }

    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

    return Start-Process -FilePath $ResolvedSidecarPath -ArgumentList @(
        "--host", "127.0.0.1",
        "--port", "8765",
        "--runtime-mode", "tauri",
        "--data-dir", $DataDir,
        "--log-dir", $LogDir
    ) -PassThru -WindowStyle Hidden
}

function Install-Msi {
    param(
        [string]$ResolvedMsiPath,
        [string]$InstallLogPath
    )

    $arguments = @(
        "/i", $ResolvedMsiPath,
        "/qn",
        "/norestart",
        "/log", $InstallLogPath
    )
    $process = Start-Process -FilePath "msiexec.exe" -ArgumentList $arguments -PassThru -Wait
    return $process.ExitCode
}

function Install-Nsis {
    param([string]$ResolvedNsisPath)

    $process = Start-Process -FilePath $ResolvedNsisPath -ArgumentList @("/S") -PassThru -Wait
    return $process.ExitCode
}

function New-AsciiInstallerStage {
    param(
        [string]$ResolvedInstallerPath,
        [string]$InstallerType
    )

    $stageRoot = Join-Path $env:TEMP "pengbo-installed-startup-smoke"
    New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null

    $stagedInstallerPath = switch ($InstallerType) {
        "nsis" { Join-Path $stageRoot "PengboWorkbenchSetup.exe" }
        default { Join-Path $stageRoot "PengboWorkbench.msi" }
    }
    Copy-Item -LiteralPath $ResolvedInstallerPath -Destination $stagedInstallerPath -Force

    return $stagedInstallerPath
}

function Install-Installer {
    param(
        [string]$InstallerType,
        [string]$ResolvedInstallerPath,
        [string]$InstallLogPath
    )

    switch ($InstallerType) {
        "nsis" {
            return Install-Nsis -ResolvedNsisPath $ResolvedInstallerPath
        }
        default {
            return Install-Msi -ResolvedMsiPath $ResolvedInstallerPath -InstallLogPath $InstallLogPath
        }
    }
}

$resolvedOutputPath = [System.IO.Path]::GetFullPath($(if ($OutputPath) { $OutputPath } else { $defaultOutputPaths[$InstallerType] }))
try {
    $resolvedInstallerPath = switch ($InstallerType) {
        "nsis" { (Resolve-Path $NsisPath).Path }
        default { (Resolve-Path $MsiPath).Path }
    }
    $stagedInstallerPath = New-AsciiInstallerStage -ResolvedInstallerPath $resolvedInstallerPath -InstallerType $InstallerType
    $installLogPath = if ($InstallerType -eq "msi") {
        Join-Path $env:TEMP "pengbo-installed-startup-smoke\\installed-bundle-install-latest.log"
    }
    else {
        $null
    }
    $result.installer_path = $stagedInstallerPath
    $result.install_log_path = $installLogPath
    $result.scenarios.install = [ordered]@{
        installer_type = $InstallerType
        source_installer_path = $resolvedInstallerPath
        staged_installer_path = $stagedInstallerPath
        install_log_path = $installLogPath
    }
    if ($InstallerType -eq "msi") {
        $result.scenarios.install.source_msi_path = $resolvedInstallerPath
        $result.scenarios.install.staged_msi_path = $stagedInstallerPath
    }
    else {
        $result.scenarios.install.source_nsis_path = $resolvedInstallerPath
        $result.scenarios.install.staged_nsis_path = $stagedInstallerPath
    }

    Stop-MatchingProcesses -ProcessName "pengbo-workbench" -ResolvedPath $null
    Stop-MatchingProcesses -ProcessName "Pengbo Workbench" -ResolvedPath $null
    Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $null
    foreach ($existingExePath in @(Get-InstalledExeCandidates)) {
        Remove-StaleRootSidecar -ResolvedExePath $existingExePath
    }

    $installExitCode = Install-Installer -InstallerType $InstallerType -ResolvedInstallerPath $stagedInstallerPath -InstallLogPath $installLogPath
    $result.install_exit_code = $installExitCode
    $result.scenarios.install.exit_code = $installExitCode
    $allowedInstallExitCodes = if ($InstallerType -eq "msi") { @(0, 1641, 3010) } else { @(0) }
    if ($allowedInstallExitCodes -notcontains $installExitCode) {
        throw "$($InstallerType.ToUpperInvariant()) install failed with exit code $installExitCode."
    }

    $resolvedInstalledExePath = Resolve-InstalledExePath -PreferredPath $InstalledExePath
    $resolvedInstalledSidecarPath = Resolve-InstalledSidecarPath -PreferredPath $InstalledSidecarPath -ResolvedExePath $resolvedInstalledExePath
    $installedProcessName = Get-ProcessNameFromPath -Path $resolvedInstalledExePath

    $result.installed_exe_path = $resolvedInstalledExePath
    $result.installed_sidecar_path = $resolvedInstalledSidecarPath
    $result.scenarios.install.installed_exe_path = $resolvedInstalledExePath
    $result.scenarios.install.installed_sidecar_path = $resolvedInstalledSidecarPath
    $result.root_sidecar_absent_ok = Test-RootSidecarAbsent -ResolvedExePath $resolvedInstalledExePath
    $result.scenarios.install.root_sidecar_absent_ok = $result.root_sidecar_absent_ok
    if (-not $result.root_sidecar_absent_ok) {
        throw "Installed bundle unexpectedly contains a root pengbo-sidecar.exe; expected the onedir sidecar under binaries\pengbo-sidecar."
    }

    Stop-MatchingProcesses -ProcessName $installedProcessName -ResolvedPath $resolvedInstalledExePath
    if ($resolvedInstalledSidecarPath) {
        $installedSidecarProcessName = Get-ProcessNameFromPath -Path $resolvedInstalledSidecarPath
        Stop-MatchingProcesses -ProcessName $installedSidecarProcessName -ResolvedPath $resolvedInstalledSidecarPath
    }
    Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $null

    $coldLaunchLogStart = Get-LogLineCount -Path $appBootstrapLogPath
    $coldLaunchProcess = Start-Desktop -ResolvedExePath $resolvedInstalledExePath
    $healthResult = Wait-ForHealth -Url $baseUrl -TimeoutSeconds $HealthTimeoutSeconds
    $settingsRuntime = Invoke-ApiCheck -Url "$baseUrl/settings/runtime"
    $connectionsStatus = Invoke-ApiCheck -Url "$baseUrl/connections/status"
    $bootstrapTail = Wait-ForLogPattern -Path $appBootstrapLogPath -StartLine $coldLaunchLogStart -Pattern "runtime status -> online"

    $result.health_ready = $healthResult.ok
    $result.health_ready_seconds = $healthResult.seconds
    $result.settings_runtime_ok = $null -ne $settingsRuntime.base_url
    $result.connections_status_ok = $null -ne $connectionsStatus.providers
    $result.bootstrap_log_path = $appBootstrapLogPath
    $normalizedRuntimeLogDir = Normalize-ComparablePath -Path $settingsRuntime.log_dir
    $normalizedExpectedLogDir = Normalize-ComparablePath -Path $appLogDir
    $normalizedRuntimeDataDir = Normalize-ComparablePath -Path $settingsRuntime.data_dir
    $normalizedExpectedDataDir = Normalize-ComparablePath -Path $appDataDir
    $result.appdata_log_dir_ok = $normalizedRuntimeLogDir -eq $normalizedExpectedLogDir -and (Test-Path -LiteralPath $appLogDir -PathType Container)
    $result.appdata_data_dir_ok = $normalizedRuntimeDataDir -eq $normalizedExpectedDataDir -and (Test-Path -LiteralPath $appDataDir -PathType Container)
    $result.scenarios.cold_launch = [ordered]@{
        workbench_pid = $coldLaunchProcess.Id
        process_name = $installedProcessName
        health_message = $healthResult.payload.message
        runtime_mode = $settingsRuntime.runtime_mode
        base_url = $settingsRuntime.base_url
        log_dir = $settingsRuntime.log_dir
        data_dir = $settingsRuntime.data_dir
        providers_count = @($connectionsStatus.providers).Count
        bootstrap_tail = $bootstrapTail
    }
    if (-not $result.appdata_log_dir_ok) {
        throw "Installed app wrote logs to '$($settingsRuntime.log_dir)' instead of '$appLogDir'."
    }
    if (-not $result.appdata_data_dir_ok) {
        throw "Installed app wrote data to '$($settingsRuntime.data_dir)' instead of '$appDataDir'."
    }

    Start-Sleep -Milliseconds 800
    $secondLaunchProcess = Start-Desktop -ResolvedExePath $resolvedInstalledExePath
    Start-Sleep -Seconds 2
    $workbenchProcesses = @(Get-ProcessSnapshot -ProcessName $installedProcessName -ResolvedPath $resolvedInstalledExePath)
    $postSecondHealth = Wait-ForHealth -Url $baseUrl -TimeoutSeconds 10
    $result.single_instance_ok = ($workbenchProcesses.Count -eq 1)
    $result.scenarios.second_launch = [ordered]@{
        launcher_pid = $secondLaunchProcess.Id
        observed_process_count = $workbenchProcesses.Count
        health_after_second_launch_seconds = $postSecondHealth.seconds
        observed_process_ids = @($workbenchProcesses | ForEach-Object { $_.Id })
    }
    if (-not $result.single_instance_ok) {
        throw "Second launch left $($workbenchProcesses.Count) installed workbench processes instead of one."
    }

    Stop-MatchingProcesses -ProcessName $installedProcessName -ResolvedPath $resolvedInstalledExePath
    if ($resolvedInstalledSidecarPath) {
        Stop-MatchingProcesses -ProcessName (Get-ProcessNameFromPath -Path $resolvedInstalledSidecarPath) -ResolvedPath $resolvedInstalledSidecarPath
    }
    Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $null

    $adoptRoot = Join-Path $repoRoot ".pengbo-runtime\\t23-$InstallerType-installed-adopt-existing"
    $adoptDataDir = Join-Path $adoptRoot "data"
    $adoptLogDir = Join-Path $adoptRoot "logs"
    if (Test-Path -LiteralPath $adoptRoot) {
        Remove-Item -LiteralPath $adoptRoot -Recurse -Force
    }

    $standaloneSidecar = Start-StandaloneSidecar -ResolvedSidecarPath $resolvedInstalledSidecarPath -DataDir $adoptDataDir -LogDir $adoptLogDir
    $standaloneHealth = Wait-ForHealth -Url $baseUrl -TimeoutSeconds $HealthTimeoutSeconds
    $adoptLogStart = Get-LogLineCount -Path $appBootstrapLogPath
    $adoptDesktopProcess = Start-Desktop -ResolvedExePath $resolvedInstalledExePath
    $adoptedRuntime = Invoke-ApiCheck -Url "$baseUrl/settings/runtime"
    $adoptBootstrapTail = Wait-ForLogPattern -Path $appBootstrapLogPath -StartLine $adoptLogStart -Pattern "adopted_existing=true"
    $adoptConnections = Invoke-ApiCheck -Url "$baseUrl/connections/status"

    $result.adopt_existing_ok = $true
    $result.scenarios.adopt_existing = [ordered]@{
        standalone_sidecar_pid = $standaloneSidecar.Id
        workbench_pid = $adoptDesktopProcess.Id
        standalone_health_ready_seconds = $standaloneHealth.seconds
        base_url = $adoptedRuntime.base_url
        bootstrap_tail = $adoptBootstrapTail
        providers_count = @($adoptConnections.providers).Count
        standalone_log_dir = $adoptLogDir
        standalone_sidecar_path = $resolvedInstalledSidecarPath
    }
}
catch {
    Add-Failure $_.Exception.Message
}
finally {
    if ($result.installed_exe_path) {
        Stop-MatchingProcesses -ProcessName (Get-ProcessNameFromPath -Path $result.installed_exe_path) -ResolvedPath $result.installed_exe_path
    }
    Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $null
    $result.finished_at = (Get-Date).ToString("o")

    $outputDirectory = Split-Path -Parent $resolvedOutputPath
    if (-not (Test-Path -LiteralPath $outputDirectory)) {
        New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    }

    $result | ConvertTo-Json -Depth 8 | Set-Content -Path $resolvedOutputPath -Encoding UTF8
}

if ($result.failures.Count -gt 0) {
    exit 1
}
