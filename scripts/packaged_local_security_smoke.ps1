param(
    [string]$ExePath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\target\release\pengbo-workbench.exe"),
    [string]$OutputPath = (Join-Path (Join-Path $PSScriptRoot "..") "logs\local-security-packaged-smoke-latest.json"),
    [string]$UnlockSecret = "local-security-smoke-passphrase",
    [int]$HealthTimeoutSeconds = 25
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$baseUrl = "http://127.0.0.1:8765/api/v1"
$result = [ordered]@{
    exe_path = ""
    started_at = (Get-Date).ToString("o")
    finished_at = $null
    health_ready = $false
    initialized = $false
    locked_blocked_audit = $false
    failed_unlock_recorded = $false
    idle_relock_ok = $false
    restart_restore_ok = $false
    audit_events = @()
    sqlite_plaintext_secret_found = $false
    sqlite_path = $null
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

function Stop-Workbench {
    Get-Process -Name "pengbo-workbench" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process -Name "pengbo-sidecar" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    $listeners = @(netstat -ano | Select-String "127.0.0.1:8765\s+0.0.0.0:0\s+LISTENING" | ForEach-Object {
            ($_ -split "\s+")[-1]
        } | Where-Object { $_ -match "^\d+$" } | Select-Object -Unique)
    foreach ($pidText in $listeners) {
        $pidValue = [int]$pidText
        $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
        if ($null -ne $process -and $process.ProcessName -in @("python", "pythonw", "pengbo-sidecar")) {
            Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Milliseconds 800
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null

try {
    $resolvedExe = (Resolve-Path $ExePath).Path
    $result.exe_path = $resolvedExe

    Stop-Workbench
    $process = Start-Process -FilePath $resolvedExe -PassThru -WindowStyle Hidden
    if (-not (Wait-ForHealth)) {
        throw "Packaged sidecar health did not become ready."
    }
    $result.health_ready = $true

    $status = Invoke-ApiJson -Method Get -Path "/security/local/status"
    if ($status.initialized) {
        Invoke-ApiJson -Method Post -Path "/security/local/reset" -Body @{ confirmation = "RESET LOCAL UNLOCK" } | Out-Null
    }
    $status = Invoke-ApiJson -Method Post -Path "/security/local/initialize" -Body @{ unlock_secret = $UnlockSecret }
    $result.initialized = [bool]$status.initialized

    Invoke-ApiJson -Method Post -Path "/security/local/lock" | Out-Null
    try {
        Invoke-ApiJson -Method Get -Path "/security/audit" | Out-Null
        Add-Failure "Security audit was readable while local security was locked."
    }
    catch {
        if ($_.Exception.Message -match "423|locked|unlock") {
            $result.locked_blocked_audit = $true
        }
        else {
            throw
        }
    }

    try {
        Invoke-ApiJson -Method Post -Path "/security/local/unlock" -Body @{ unlock_secret = "wrong-$UnlockSecret" } | Out-Null
        Add-Failure "Wrong unlock secret unexpectedly succeeded."
    }
    catch {
        $statusAfterFailure = Invoke-ApiJson -Method Get -Path "/security/local/status"
        $result.failed_unlock_recorded = [int]$statusAfterFailure.failed_attempts -ge 1
    }

    Invoke-ApiJson -Method Post -Path "/security/local/unlock" -Body @{ unlock_secret = $UnlockSecret } | Out-Null
    $session = Invoke-ApiJson -Method Post -Path "/security/session" -Body @{}
    $sessionHeaders = @{ "X-Pengbo-Session" = $session.session_id }
    Invoke-ApiJson -Method Post -Path "/security/local/idle-timeout" | Out-Null
    $idleStatus = Invoke-ApiJson -Method Get -Path "/security/local/status"
    $result.idle_relock_ok = [bool]$idleStatus.locked

    Stop-Workbench
    Start-Process -FilePath $resolvedExe -PassThru -WindowStyle Hidden | Out-Null
    if (-not (Wait-ForHealth)) {
        throw "Packaged sidecar health did not return after restart."
    }
    $restartStatus = Invoke-ApiJson -Method Get -Path "/security/local/status"
    $result.restart_restore_ok = [bool]($restartStatus.initialized -and $restartStatus.locked)

    Invoke-ApiJson -Method Post -Path "/security/local/unlock" -Body @{ unlock_secret = $UnlockSecret } | Out-Null
    $session = Invoke-ApiJson -Method Post -Path "/security/session" -Body @{}
    $sessionHeaders = @{ "X-Pengbo-Session" = $session.session_id }
    $rawAudit = Invoke-ApiJson -Method Get -Path "/security/audit?category=local_security&limit=80" -Headers $sessionHeaders
    if ($rawAudit.PSObject.Properties.Name -contains "value") {
        $audit = @($rawAudit.value)
    }
    else {
        $audit = @($rawAudit)
    }
    $result.audit_events = @($audit | ForEach-Object { $_.event_type } | Where-Object { $_ } | Select-Object -Unique)
    foreach ($required in @("local_unlock_initialized", "local_unlock_failed", "local_unlock_succeeded", "local_idle_timeout", "sensitive_surface_blocked")) {
        if ($result.audit_events -notcontains $required) {
            Add-Failure "Missing local security audit event: $required"
        }
    }

    $runtime = Invoke-ApiJson -Method Get -Path "/settings/runtime"
    $result.sqlite_path = $runtime.sqlite_path
    if ($runtime.sqlite_path -and (Test-Path -LiteralPath $runtime.sqlite_path)) {
        $sqliteCopy = Join-Path ([System.IO.Path]::GetTempPath()) ("pengbo-local-security-smoke-" + [Guid]::NewGuid().ToString("N") + ".sqlite3")
        Copy-Item -LiteralPath $runtime.sqlite_path -Destination $sqliteCopy -Force
        $bytes = [System.IO.File]::ReadAllBytes($sqliteCopy)
        Remove-Item -LiteralPath $sqliteCopy -Force -ErrorAction SilentlyContinue
        $text = [System.Text.Encoding]::UTF8.GetString($bytes)
        $result.sqlite_plaintext_secret_found = $text.Contains($UnlockSecret)
        if ($result.sqlite_plaintext_secret_found) {
            Add-Failure "Plaintext unlock secret was found in SQLite."
        }
    }

    Invoke-ApiJson -Method Post -Path "/security/local/lock" | Out-Null

    if (-not $result.locked_blocked_audit) { Add-Failure "Locked audit route was not blocked." }
    if (-not $result.failed_unlock_recorded) { Add-Failure "Failed unlock attempt was not recorded." }
    if (-not $result.idle_relock_ok) { Add-Failure "Idle relock did not leave local security locked." }
    if (-not $result.restart_restore_ok) { Add-Failure "Restart did not restore initialized locked state." }
}
catch {
    Add-Failure $_.Exception.Message
}
finally {
    $result.finished_at = (Get-Date).ToString("o")
    $result | ConvertTo-Json -Depth 8 | Set-Content -Path $OutputPath -Encoding UTF8
    if ($result.failures.Count -gt 0) {
        Write-Error "Packaged local security smoke failed. See $OutputPath"
    }
    else {
        Write-Output "Packaged local security smoke passed: $OutputPath"
    }
}
