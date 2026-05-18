param(
    [string]$SidecarPath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\target\release\binaries\pengbo-sidecar\pengbo-sidecar.exe"),
    [string]$OutputPath = (Join-Path (Join-Path $PSScriptRoot "..") "logs\gateway-hardening-packaged-smoke-latest.json"),
    [int]$Port = 8765,
    [int]$HealthTimeoutSeconds = 25
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$baseUrl = "http://127.0.0.1:$Port/api/v1"
$runtimeRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("pengbo-gateway-smoke-" + [Guid]::NewGuid().ToString("N"))
$dataDir = Join-Path $runtimeRoot "data"
$logDir = Join-Path $runtimeRoot "logs"
$result = [ordered]@{
    sidecar_path = ""
    started_at = (Get-Date).ToString("o")
    finished_at = $null
    health_ready = $false
    loopback_listener_only = $false
    unsafe_origin_rejected = $false
    invalid_method_rejected = $false
    sensitive_route_requires_session = $false
    allowed_origin_ok = $false
    redacted_gateway_audit_ok = $false
    gateway_events = @()
    log_dir = $logDir
    failures = New-Object System.Collections.Generic.List[string]
}

function Add-Failure {
    param([string]$Message)
    $result.failures.Add($Message)
    Write-Warning $Message
}

function Invoke-ApiJson {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [hashtable]$Headers = @{},
        [int]$TimeoutSeconds = 15
    )

    $uri = "$baseUrl$Path"
    if ($null -eq $Body) {
        return Invoke-RestMethod -Method $Method -Uri $uri -Headers $Headers -TimeoutSec $TimeoutSeconds
    }

    $json = $Body | ConvertTo-Json -Depth 8
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $Headers -Body $json -ContentType "application/json" -TimeoutSec $TimeoutSeconds
}

function Invoke-StatusCode {
    param(
        [string]$Method,
        [string]$Path,
        [hashtable]$Headers = @{},
        [object]$Body = $null
    )

    try {
        Invoke-ApiJson -Method $Method -Path $Path -Headers $Headers -Body $Body | Out-Null
        return 200
    }
    catch {
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            return [int]$_.Exception.Response.StatusCode
        }
        throw
    }
}

function Wait-ForHealth {
    $deadline = (Get-Date).AddSeconds($HealthTimeoutSeconds)
    do {
        try {
            $health = Invoke-ApiJson -Method Get -Path "/health" -TimeoutSeconds 3
            if ($health.status -eq "ok") {
                return $true
            }
        }
        catch {
        }
        Start-Sleep -Milliseconds 300
    } while ((Get-Date) -lt $deadline)

    return $false
}

function Stop-PortListeners {
    $listeners = @(netstat -ano | Select-String "127.0.0.1:$Port\s+0.0.0.0:0\s+LISTENING" | ForEach-Object {
            ($_ -split "\s+")[-1]
        } | Where-Object { $_ -match "^\d+$" } | Select-Object -Unique)
    foreach ($pidText in $listeners) {
        $pidValue = [int]$pidText
        $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
        if ($null -ne $process -and $process.ProcessName -in @("python", "pythonw", "pengbo-sidecar")) {
            Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Milliseconds 500
}

function Test-LoopbackListenerOnly {
    $rows = @(netstat -ano | Select-String ":$Port\s+.*LISTENING")
    if ($rows.Count -eq 0) {
        return $false
    }
    foreach ($row in $rows) {
        $parts = @($row.ToString() -split "\s+" | Where-Object { $_ })
        if ($parts.Count -lt 2) {
            return $false
        }
        $localAddress = $parts[1]
        if (-not ($localAddress -like "127.0.0.1:$Port" -or $localAddress -like "[::1]:$Port")) {
            return $false
        }
    }
    return $true
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$process = $null
try {
    $resolvedSidecar = (Resolve-Path $SidecarPath).Path
    $result.sidecar_path = $resolvedSidecar

    Stop-PortListeners
    $args = @(
        "--host", "127.0.0.1",
        "--port", [string]$Port,
        "--runtime-mode", "tauri",
        "--data-dir", $dataDir,
        "--log-dir", $logDir
    )
    $process = Start-Process -FilePath $resolvedSidecar -ArgumentList $args -WorkingDirectory (Split-Path -Parent $resolvedSidecar) -PassThru -WindowStyle Hidden
    if (-not (Wait-ForHealth)) {
        throw "Packaged sidecar health did not become ready."
    }
    $result.health_ready = $true
    $result.loopback_listener_only = Test-LoopbackListenerOnly

    $unsafeStatus = Invoke-StatusCode -Method Post -Path "/security/session" -Headers @{
        Origin = "https://evil.example"
        "X-Pengbo-Session" = "session-secret"
        Authorization = "Bearer raw-token"
    } -Body @{ accountLabel = "Gateway smoke account" }
    $result.unsafe_origin_rejected = $unsafeStatus -eq 403

    $invalidStatus = Invoke-StatusCode -Method TRACE -Path "/health"
    $result.invalid_method_rejected = $invalidStatus -eq 405

    $allowed = Invoke-ApiJson -Method Get -Path "/health" -Headers @{ Origin = "tauri://localhost" }
    $result.allowed_origin_ok = $allowed.status -eq "ok"

    Invoke-ApiJson -Method Post -Path "/security/local/initialize" -Body @{ unlock_secret = "gateway-smoke-secret" } | Out-Null
    $blockedAuditStatus = Invoke-StatusCode -Method Get -Path "/security/audit"
    $result.sensitive_route_requires_session = $blockedAuditStatus -eq 401

    $session = Invoke-ApiJson -Method Post -Path "/security/session" -Body @{}
    $audit = @(Invoke-ApiJson -Method Get -Path "/security/audit?category=gateway&limit=50" -Headers @{
            "X-Pengbo-Session" = $session.session_id
        })
    $renderedAudit = $audit | ConvertTo-Json -Depth 8
    $result.gateway_events = @($audit | ForEach-Object { $_.event_type } | Where-Object { $_ } | Select-Object -Unique)
    $result.redacted_gateway_audit_ok = (
        $renderedAudit.Contains("origin_not_allowed") -and
        $renderedAudit.Contains("method_not_allowed") -and
        -not $renderedAudit.Contains("session-secret") -and
        -not $renderedAudit.Contains("raw-token") -and
        -not $renderedAudit.Contains("Gateway smoke account")
    )

    if (-not $result.loopback_listener_only) { Add-Failure "Sidecar listener was not limited to loopback." }
    if (-not $result.unsafe_origin_rejected) { Add-Failure "Unsafe origin was not rejected." }
    if (-not $result.invalid_method_rejected) { Add-Failure "Invalid method was not rejected." }
    if (-not $result.sensitive_route_requires_session) { Add-Failure "Sensitive route did not require a session." }
    if (-not $result.allowed_origin_ok) { Add-Failure "Allowed Tauri origin did not pass health check." }
    if (-not $result.redacted_gateway_audit_ok) { Add-Failure "Gateway audit was missing expected redaction or rejection evidence." }
}
catch {
    Add-Failure $_.Exception.Message
}
finally {
    if ($null -ne $process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
    Stop-PortListeners
    $result.finished_at = (Get-Date).ToString("o")
    $result | ConvertTo-Json -Depth 8 | Set-Content -Path $OutputPath -Encoding UTF8
    if ($result.failures.Count -gt 0) {
        Write-Error "Packaged gateway hardening smoke failed. See $OutputPath"
    }
    else {
        Write-Output "Packaged gateway hardening smoke passed: $OutputPath"
    }
}
