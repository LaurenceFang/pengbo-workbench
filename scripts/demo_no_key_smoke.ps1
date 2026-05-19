$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("pengbo-demo-no-key-" + [Guid]::NewGuid().ToString("N"))
$dataDir = Join-Path $runtimeRoot "data"
$logDir = Join-Path $runtimeRoot "logs"
$resultPath = Join-Path $repoRoot "logs\demo-no-key-smoke-latest.json"
$stdoutPath = Join-Path $logDir "sidecar-stdout.log"
$stderrPath = Join-Path $logDir "sidecar-stderr.log"
$process = $null

function New-FreePort {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), 0)
    $listener.Start()
    $port = $listener.LocalEndpoint.Port
    $listener.Stop()
    return $port
}

function Invoke-ApiJson {
    param(
        [string]$BaseUrl,
        [string]$Path
    )
    return Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/v1$Path" -TimeoutSec 10
}

function Assert-Condition {
    param(
        [bool]$Condition,
        [string]$Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

function Wait-ForHealth {
    param(
        [string]$BaseUrl,
        [int]$Attempts = 60
    )
    for ($i = 0; $i -lt $Attempts; $i++) {
        try {
            $health = Invoke-ApiJson -BaseUrl $BaseUrl -Path "/health"
            if ($health.status -eq "ok") {
                return $health
            }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    throw "Timed out waiting for no-key sidecar health."
}

$result = [ordered]@{
    smoke = "demo-no-key"
    generated_at = [DateTimeOffset]::UtcNow.ToString("o")
    runtime_root = $runtimeRoot
    no_key_startup_ok = $false
    demo_mode_ok = $false
    dashboard_sample_ok = $false
    data_sources_missing_credentials_visible = $false
    portfolio_empty_sample_ok = $false
    private_account_blocked = $false
    failures = @()
}

try {
    New-Item -ItemType Directory -Force -Path $dataDir, $logDir, (Split-Path -Parent $resultPath) | Out-Null

    $port = New-FreePort
    $baseUrl = "http://127.0.0.1:$port"
    $env:EDGAR_IDENTITY = $null
    $env:PENGBO_EDGAR_IDENTITY = $null
    $env:PENGBO_BINANCE_API_KEY = $null
    $env:PENGBO_BINANCE_SECRET = $null
    $env:PENGBO_BINANCE_PASSWORD = $null
    $env:PENGBO_FRED_API_KEY = $null
    $env:FRED_API_KEY = $null
    $env:PENGBO_COINGECKO_DEMO_API_KEY = $null
    $env:PENGBO_COINGECKO_PRO_API_KEY = $null

    $args = @(
        "-m", "backend.app.cli",
        "--host", "127.0.0.1",
        "--port", [string]$port,
        "--runtime-mode", "demo-no-key-smoke",
        "--data-dir", $dataDir,
        "--log-dir", $logDir
    )
    $process = Start-Process -FilePath "py" -ArgumentList $args -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath

    $health = Wait-ForHealth -BaseUrl $baseUrl
    $result.no_key_startup_ok = $true

    $demo = Invoke-ApiJson -BaseUrl $baseUrl -Path "/settings/demo-mode"
    Assert-Condition ($demo.no_key_evaluation_ready -eq $true) "Demo mode did not report no-key readiness."
    Assert-Condition ($demo.missing_credentials -contains "EDGAR identity") "EDGAR no-key state was not visible."
    Assert-Condition ($demo.missing_credentials -contains "FRED API key") "FRED no-key state was not visible."
    Assert-Condition ($demo.missing_credentials -contains "CoinGecko key") "CoinGecko no-key state was not visible."
    Assert-Condition ($demo.missing_credentials -contains "Binance account credentials") "Binance no-key state was not visible."
    $result.demo_mode_ok = $true

    $dashboard = Invoke-ApiJson -BaseUrl $baseUrl -Path "/dashboard/overview"
    Assert-Condition ($dashboard.watchlist.Count -gt 0) "Dashboard did not expose seeded watchlist sample context."
    Assert-Condition ($dashboard.market_pulse.Count -gt 0) "Dashboard did not expose market pulse sample context."
    $result.dashboard_sample_ok = $true

    $sources = Invoke-ApiJson -BaseUrl $baseUrl -Path "/data-sources/status"
    $sourceMap = @{}
    foreach ($item in $sources.providers) {
        $sourceMap[$item.provider] = $item
    }
    Assert-Condition ($sourceMap["fred"].health -eq "missing_credentials") "FRED missing-credential state was not visible."
    Assert-Condition ($sourceMap["coingecko"].health -eq "missing_credentials") "CoinGecko missing-credential state was not visible."
    $result.data_sources_missing_credentials_visible = $true

    $transactions = Invoke-ApiJson -BaseUrl $baseUrl -Path "/portfolio/transactions"
    Assert-Condition ($transactions.Count -eq 0) "Fresh no-key runtime should not create real portfolio transactions."
    $result.portfolio_empty_sample_ok = $true

    try {
        Invoke-RestMethod -Method Get -Uri "$baseUrl/api/v1/connections/binance/account" -TimeoutSec 10 | Out-Null
        throw "Binance private account route unexpectedly succeeded without unlock/session/credentials."
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        Assert-Condition (($status -eq 423) -or ($status -eq 401) -or ($status -eq 403)) "Unexpected Binance private account response: $status"
    }
    $result.private_account_blocked = $true
} catch {
    $result.failures += $_.Exception.Message
    throw
} finally {
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
        $process.WaitForExit()
    }
    $result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $resultPath -Encoding UTF8
    Write-Host "Demo no-key smoke result: $resultPath"
}
