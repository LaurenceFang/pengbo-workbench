param(
    [string[]]$Checks = @(
        "check:svg-frame-registry",
        "smoke:all-subpages-runtime",
        "smoke:svg-visual-acceptance",
        "smoke:all-routes-render",
        "smoke:all-route-states"
    ),
    [string]$CleanupOnly = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$tempRoot = [IO.Path]::GetFullPath($env:TEMP)
$runtimeRoot = [IO.Path]::GetFullPath((Join-Path $tempRoot ("pengbo-m1-web-" + [Guid]::NewGuid().ToString("N"))))
$dataDir = Join-Path $runtimeRoot "data"
$logDir = Join-Path $runtimeRoot "logs"
$backend = $null
$vite = $null
$failedChecks = New-Object System.Collections.Generic.List[string]

function Stop-PortOwner {
    param([int]$Port)
    $connections = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    foreach ($connection in $connections) {
        Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

function Wait-ForJsonHealth {
    for ($attempt = 0; $attempt -lt 120; $attempt++) {
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:8765/api/v1/health" -TimeoutSec 2
            if ($health.status -eq "ok") { return }
        }
        catch {
        }
        Start-Sleep -Milliseconds 250
    }
    throw "Acceptance backend did not become healthy."
}

function Wait-ForWeb {
    for ($attempt = 0; $attempt -lt 120; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:4190/" -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { return }
        }
        catch {
        }
        Start-Sleep -Milliseconds 250
    }
    throw "Acceptance Vite server did not become healthy."
}

if (-not $runtimeRoot.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to use a runtime path outside the Windows temporary directory."
}

if ($CleanupOnly) {
    $cleanupTarget = [IO.Path]::GetFullPath($CleanupOnly)
    if (-not $cleanupTarget.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -or
        -not ([IO.Path]::GetFileName($cleanupTarget)).StartsWith("pengbo-m1-web-")) {
        throw "Refusing to clean a path outside the M1 temporary-runtime namespace."
    }
    if (Test-Path -LiteralPath $cleanupTarget) {
        Remove-Item -LiteralPath $cleanupTarget -Recurse -Force
    }
    Write-Output "CLEANUP_REMOVED=$(-not (Test-Path -LiteralPath $cleanupTarget))"
    exit 0
}

try {
    Stop-PortOwner -Port 4190
    Stop-PortOwner -Port 8765
    New-Item -ItemType Directory -Force -Path $dataDir, $logDir | Out-Null

    $env:PENGBO_MARKET_FIXTURES = "1"
    $env:PENGBO_CHINA_CONNECTOR_FIXTURES = "1"
    $env:PENGBO_API_PROXY_TARGET = "http://127.0.0.1:8765"
    $env:PENGBO_WEB_URL = "http://127.0.0.1:4190"
    $env:PENGBO_API_URL = "http://127.0.0.1:8765"
    $env:PENGBO_TEST_UNLOCK_SECRET = "m1-runtime-contract-passphrase"
    $env:VITE_VISUAL_TEST_MODE = "true"

    $backendArguments = @(
        "-m", "backend.app.cli",
        "--host", "127.0.0.1",
        "--port", "8765",
        "--runtime-mode", "m1-web-acceptance",
        "--data-dir", $dataDir,
        "--log-dir", $logDir
    )
    $backend = Start-Process -FilePath "py" -ArgumentList $backendArguments -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir "backend-out.log") -RedirectStandardError (Join-Path $logDir "backend-err.log")
    Wait-ForJsonHealth

    $initializeBody = @{ unlock_secret = $env:PENGBO_TEST_UNLOCK_SECRET } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8765/api/v1/security/local/initialize" -Body $initializeBody -ContentType "application/json" -TimeoutSec 10 | Out-Null

    $vite = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4190") -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir "vite-out.log") -RedirectStandardError (Join-Path $logDir "vite-err.log")
    Wait-ForWeb

    foreach ($check in $Checks) {
        Write-Output "RUN=$check"
        & npm.cmd run $check
        if ($LASTEXITCODE -ne 0) {
            $failedChecks.Add($check)
            Write-Output "FAIL=$check"
        }
        else {
            Write-Output "PASS=$check"
        }
    }
}
finally {
    Stop-PortOwner -Port 4190
    Stop-PortOwner -Port 8765
    if ($null -ne $vite -and -not $vite.HasExited) {
        Stop-Process -Id $vite.Id -Force -ErrorAction SilentlyContinue
    }
    if ($null -ne $backend -and -not $backend.HasExited) {
        Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $runtimeRoot) {
        Remove-Item -LiteralPath $runtimeRoot -Recurse -Force
    }
    Write-Output "RUNTIME_REMOVED=$(-not (Test-Path -LiteralPath $runtimeRoot))"
}

if ($failedChecks.Count -gt 0) {
    Write-Error ("M1 web acceptance failed: " + ($failedChecks -join ", "))
    exit 1
}
