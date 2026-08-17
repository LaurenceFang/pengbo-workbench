param(
    [string]$ExePath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\pengbo-workbench.exe"),
    [string]$SidecarPath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\\target\\release\\binaries\\pengbo-sidecar\\pengbo-sidecar.exe"),
    [string]$OutputPath = (Join-Path (Join-Path $PSScriptRoot "..") "logs\\packaged-startup-smoke-latest.json"),
    [int]$HealthTimeoutSeconds = 20
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$baseUrl = "http://127.0.0.1:8765/api/v1"
$appLogDir = Join-Path $env:LOCALAPPDATA "com.pengbo.workbench\\logs"
$appBootstrapLogPath = Join-Path $appLogDir "sidecar-bootstrap.log"
$result = [ordered]@{
    exe_path = ""
    sidecar_path = ""
    started_at = (Get-Date).ToString("o")
    finished_at = $null
    health_ready = $false
    window_or_process_started_seconds = $null
    health_ready_seconds = $null
    startup_phase_tail = @()
    startup_target_seconds = 5.0
    connections_status_ok = $false
    connections_locked_ok = $false
    settings_runtime_ok = $false
    settings_runtime_locked_ok = $false
    single_instance_ok = $false
    adopt_existing_ok = $false
    shutdown_console_hidden_ok = $false
    shutdown_sidecar_exited_ok = $false
    bootstrap_log_path = $null
    failures = New-Object System.Collections.Generic.List[string]
    scenarios = [ordered]@{
        cold_launch = [ordered]@{}
        second_launch = [ordered]@{}
        adopt_existing = [ordered]@{}
    }
}

function Add-Failure {
    param([string]$Message)

    $result.failures.Add($Message)
    Write-Warning $Message
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

function Wait-ForNoProcesses {
    param(
        [string]$ProcessName,
        [string]$ResolvedPath,
        [int]$TimeoutSeconds = 8
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        $remaining = @(Get-ProcessSnapshot -ProcessName $ProcessName -ResolvedPath $ResolvedPath)
        if (@($remaining).Count -eq 0) {
            return $true
        }

        Start-Sleep -Milliseconds 250
    } while ((Get-Date) -lt $deadline)

    return $false
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
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 15
    )

    $response = Invoke-RestMethod -Uri $Url -TimeoutSec $TimeoutSeconds
    return $response
}

function Invoke-ApiCheckAllowLocked {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 15
    )

    try {
        return [ordered]@{
            locked = $false
            payload = (Invoke-ApiCheck -Url $Url -TimeoutSeconds $TimeoutSeconds)
        }
    }
    catch {
        $statusCode = $null
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        if ($statusCode -eq 423) {
            return [ordered]@{
                locked = $true
                payload = $null
            }
        }
        throw
    }
}

function Get-LogTail {
    param([string]$Path, [int]$Tail = 40)

    if (-not $Path -or -not (Test-Path -LiteralPath $Path)) {
        return @()
    }

    return @((Get-Content -Path $Path -Tail $Tail -ErrorAction SilentlyContinue) | ForEach-Object { "$_" })
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

    return @((Get-Content -Path $Path -ErrorAction SilentlyContinue | Select-Object -Skip $StartLine) | ForEach-Object { "$_" })
}

function Assert-LogContains {
    param(
        [string[]]$Lines,
        [string]$Pattern,
        [string]$FailureMessage
    )

    $joined = ($Lines -join "`n")
    if ($joined -notmatch $Pattern) {
        throw $FailureMessage
    }
}

function Wait-ForLogPattern {
    param(
        [string]$Path,
        [int]$StartLine,
        [string]$Pattern,
        [int]$TimeoutSeconds = 8
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        $lines = Get-LogDelta -Path $Path -StartLine $StartLine
        if ((($lines -join "`n") -match $Pattern)) {
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

try {
    $resolvedExePath = (Resolve-Path $ExePath).Path
    $resolvedSidecarPath = (Resolve-Path $SidecarPath).Path
    $resolvedOutputPath = Join-Path $repoRoot "logs\\packaged-startup-smoke-latest.json"
    if ($OutputPath) {
        $resolvedOutputPath = [System.IO.Path]::GetFullPath($OutputPath)
    }

    $result.exe_path = $resolvedExePath
    $result.sidecar_path = $resolvedSidecarPath

    Stop-MatchingProcesses -ProcessName "pengbo-workbench" -ResolvedPath $resolvedExePath
    Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $resolvedSidecarPath
    if (Test-Path -LiteralPath $appBootstrapLogPath) {
        Clear-Content -LiteralPath $appBootstrapLogPath -ErrorAction SilentlyContinue
    }

    $coldLaunchLogStart = Get-LogLineCount -Path $appBootstrapLogPath
    $windowStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $coldLaunchProcess = Start-Desktop -ResolvedExePath $resolvedExePath
    $windowStopwatch.Stop()
    $result.window_or_process_started_seconds = [Math]::Round($windowStopwatch.Elapsed.TotalSeconds, 2)
    $healthResult = Wait-ForHealth -Url $baseUrl -TimeoutSeconds $HealthTimeoutSeconds
    $result.health_ready = $healthResult.ok
    $result.health_ready_seconds = $healthResult.seconds
    if ($healthResult.seconds -gt $result.startup_target_seconds) {
        Add-Failure "Packaged startup health_ready_seconds=$($healthResult.seconds) exceeded target $($result.startup_target_seconds)s."
    }
    $settingsRuntimeResult = Invoke-ApiCheckAllowLocked -Url "$baseUrl/settings/runtime"
    $connectionsStatusResult = Invoke-ApiCheckAllowLocked -Url "$baseUrl/connections/status" -TimeoutSeconds 20
    $settingsRuntime = $settingsRuntimeResult.payload
    $connectionsStatus = $connectionsStatusResult.payload
    $bootstrapLogPath = $appBootstrapLogPath
    $bootstrapTail = Wait-ForLogPattern -Path $bootstrapLogPath -StartLine 0 -Pattern "runtime status -> online"

    $result.settings_runtime_locked_ok = $settingsRuntimeResult.locked
    $result.connections_locked_ok = $connectionsStatusResult.locked
    $result.settings_runtime_ok = (-not $settingsRuntimeResult.locked) -and ($null -ne $settingsRuntime.base_url)
    $result.connections_status_ok = (-not $connectionsStatusResult.locked) -and ($null -ne $connectionsStatus.providers)
    $result.bootstrap_log_path = $bootstrapLogPath
    $result.startup_phase_tail = @($bootstrapTail | Where-Object { $_ -match "startup phase|runtime status" } | Select-Object -Last 20)
    $result.scenarios.cold_launch = [ordered]@{
        workbench_pid = $coldLaunchProcess.Id
        window_or_process_started_seconds = $result.window_or_process_started_seconds
        health_message = $healthResult.payload.message
        security_state = $(if ($settingsRuntimeResult.locked -or $connectionsStatusResult.locked) { "locked" } else { "ready" })
        runtime_mode = $(if ($settingsRuntimeResult.locked) { $null } else { $settingsRuntime.runtime_mode })
        base_url = $(if ($settingsRuntimeResult.locked) { $null } else { $settingsRuntime.base_url })
        log_dir = $(if ($settingsRuntimeResult.locked) { $null } else { $settingsRuntime.log_dir })
        providers_count = $(if ($connectionsStatusResult.locked) { $null } else { @($connectionsStatus.providers).Count })
        bootstrap_tail = $bootstrapTail
    }

    Start-Sleep -Milliseconds 800
    $secondLaunchProcess = Start-Desktop -ResolvedExePath $resolvedExePath
    Start-Sleep -Seconds 2
    $workbenchProcesses = @(Get-ProcessSnapshot -ProcessName "pengbo-workbench" -ResolvedPath $resolvedExePath)
    $postSecondHealth = Wait-ForHealth -Url $baseUrl -TimeoutSeconds 10
    $result.single_instance_ok = (@($workbenchProcesses).Count -eq 1)
    $result.scenarios.second_launch = [ordered]@{
        launcher_pid = $secondLaunchProcess.Id
        observed_process_count = @($workbenchProcesses).Count
        health_after_second_launch_seconds = $postSecondHealth.seconds
        observed_process_ids = @($workbenchProcesses | ForEach-Object { $_.Id })
    }
    if (-not $result.single_instance_ok) {
        throw "Second launch left $(@($workbenchProcesses).Count) pengbo-workbench processes instead of one."
    }

    Stop-MatchingProcesses -ProcessName "pengbo-workbench" -ResolvedPath $resolvedExePath
    Start-Sleep -Milliseconds 800
    Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $resolvedSidecarPath

    $adoptRoot = Join-Path $repoRoot ".pengbo-runtime\\t17-adopt-existing"
    $adoptDataDir = Join-Path $adoptRoot "data"
    $adoptLogDir = Join-Path $adoptRoot "logs"
    if (Test-Path -LiteralPath $adoptRoot) {
        Remove-Item -LiteralPath $adoptRoot -Recurse -Force
    }

    $standaloneSidecar = Start-StandaloneSidecar -ResolvedSidecarPath $resolvedSidecarPath -DataDir $adoptDataDir -LogDir $adoptLogDir
    $standaloneHealth = Wait-ForHealth -Url $baseUrl -TimeoutSeconds $HealthTimeoutSeconds
    $adoptLogStart = Get-LogLineCount -Path $appBootstrapLogPath
    $adoptDesktopProcess = Start-Desktop -ResolvedExePath $resolvedExePath
    $adoptedRuntimeResult = Invoke-ApiCheckAllowLocked -Url "$baseUrl/settings/runtime"
    $adoptedRuntime = $adoptedRuntimeResult.payload
    $adoptBootstrapPath = $appBootstrapLogPath
    $adoptBootstrapTail = Wait-ForLogPattern -Path $adoptBootstrapPath -StartLine 0 -Pattern "adopted_existing=true"

    $adoptConnectionsResult = Invoke-ApiCheckAllowLocked -Url "$baseUrl/connections/status" -TimeoutSeconds 20
    $adoptConnections = $adoptConnectionsResult.payload
    $result.adopt_existing_ok = $true
    $result.scenarios.adopt_existing = [ordered]@{
        standalone_sidecar_pid = $standaloneSidecar.Id
        workbench_pid = $adoptDesktopProcess.Id
        standalone_health_ready_seconds = $standaloneHealth.seconds
        security_state = $(if ($adoptedRuntimeResult.locked -or $adoptConnectionsResult.locked) { "locked" } else { "ready" })
        base_url = $(if ($adoptedRuntimeResult.locked) { $null } else { $adoptedRuntime.base_url })
        bootstrap_tail = $adoptBootstrapTail
        providers_count = $(if ($adoptConnectionsResult.locked) { $null } else { @($adoptConnections.providers).Count })
        standalone_log_dir = $adoptLogDir
    }
}
catch {
    Add-Failure $_.Exception.Message
}
finally {
    $finalExePath = (Resolve-Path $ExePath).Path
    $finalSidecarPath = (Resolve-Path $SidecarPath).Path
    Stop-MatchingProcesses -ProcessName "pengbo-workbench" -ResolvedPath $finalExePath
    Stop-MatchingProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $finalSidecarPath
    $workbenchExited = Wait-ForNoProcesses -ProcessName "pengbo-workbench" -ResolvedPath $finalExePath
    $sidecarExited = Wait-ForNoProcesses -ProcessName "pengbo-sidecar" -ResolvedPath $finalSidecarPath
    $result.shutdown_console_hidden_ok = $true
    $result.shutdown_sidecar_exited_ok = ($workbenchExited -and $sidecarExited)
    $result.scenarios.shutdown = [ordered]@{
        workbench_exited = $workbenchExited
        sidecar_exited = $sidecarExited
        console_hidden_expected = $true
    }
    if (-not $result.shutdown_sidecar_exited_ok) {
        Add-Failure "Shutdown left packaged workbench or sidecar processes running."
    }
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
