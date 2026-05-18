param(
    [string]$ExePath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\target\release\pengbo-workbench.exe"),
    [string]$OutputPath = (Join-Path (Join-Path $PSScriptRoot "..") "logs\account-scoped-credentials-smoke-latest.json"),
    [string]$UnlockSecret = "account-scope-smoke-passphrase",
    [int]$HealthTimeoutSeconds = 25
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$baseUrl = "http://127.0.0.1:8765/api/v1"
$result = [ordered]@{
    exe_path = ""
    started_at = (Get-Date).ToString("o")
    finished_at = $null
    health_ready = $false
    initialized = $false
    default_profile_seen = $false
    profile_created = $false
    profile_switch_ok = $false
    readiness_profile_context_ok = $false
    redacted_audit_ok = $false
    sqlite_plaintext_secret_found = $false
    active_profile_id = $null
    audit_events = @()
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
        [int]$TimeoutSeconds = 15
    )

    $uri = "$baseUrl$Path"
    if ($null -eq $Body) {
        return Invoke-RestMethod -Method $Method -Uri $uri -TimeoutSec $TimeoutSeconds
    }

    $json = $Body | ConvertTo-Json -Depth 8
    return Invoke-RestMethod -Method $Method -Uri $uri -Body $json -ContentType "application/json" -TimeoutSec $TimeoutSeconds
}

function Wait-ForHealth {
    $deadline = (Get-Date).AddSeconds($HealthTimeoutSeconds)
    do {
        try {
            $health = Invoke-ApiJson -Method Get -Path "/health" -TimeoutSeconds 3
            if ($health.status -eq "ok") { return $true }
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
    Start-Process -FilePath $resolvedExe -PassThru -WindowStyle Hidden | Out-Null
    if (-not (Wait-ForHealth)) {
        throw "Packaged sidecar health did not become ready."
    }
    $result.health_ready = $true

    $status = Invoke-ApiJson -Method Get -Path "/security/local/status"
    if (-not $status.initialized) {
        $status = Invoke-ApiJson -Method Post -Path "/security/local/initialize" -Body @{ unlock_secret = $UnlockSecret }
    }
    elseif ($status.locked) {
        $status = Invoke-ApiJson -Method Post -Path "/security/local/unlock" -Body @{ unlock_secret = $UnlockSecret }
    }
    $result.initialized = [bool]$status.initialized

    $baseline = Invoke-ApiJson -Method Get -Path "/connections/status"
    $result.default_profile_seen = [bool]($baseline.active_profile.profile_id -and @($baseline.profiles).Count -ge 1)

    $label = "Smoke profile " + (Get-Date -Format "HHmmss")
    $profile = Invoke-ApiJson -Method Post -Path "/connections/profiles" -Body @{ label = $label }
    $result.profile_created = [bool]($profile.profile_id -and $profile.label -eq $label)
    $selected = Invoke-ApiJson -Method Put -Path "/connections/profiles/active" -Body @{ profile_id = $profile.profile_id }
    $result.active_profile_id = $selected.profile_id
    $result.profile_switch_ok = [bool]($selected.profile_id -eq $profile.profile_id -and $selected.is_active)

    $edgar = Invoke-ApiJson -Method Post -Path "/connections/test" -Body @{ provider = "edgar" }
    $result.readiness_profile_context_ok = [bool]($edgar.profile_id -eq $profile.profile_id -and $edgar.profile_label -eq $label)

    $audit = @(Invoke-ApiJson -Method Get -Path "/security/audit?category=credential&limit=80")
    $result.audit_events = @($audit | ForEach-Object { $_.event_type } | Where-Object { $_ } | Select-Object -Unique)
    $auditText = ($audit | ConvertTo-Json -Depth 12)
    $result.redacted_audit_ok = [bool]($auditText.Contains($profile.profile_id) -and -not $auditText.Contains($UnlockSecret))

    $runtime = Invoke-ApiJson -Method Get -Path "/settings/runtime"
    if ($runtime.sqlite_path -and (Test-Path -LiteralPath $runtime.sqlite_path)) {
        $sqliteCopy = Join-Path ([System.IO.Path]::GetTempPath()) ("pengbo-account-credential-smoke-" + [Guid]::NewGuid().ToString("N") + ".sqlite3")
        Copy-Item -LiteralPath $runtime.sqlite_path -Destination $sqliteCopy -Force
        $bytes = [System.IO.File]::ReadAllBytes($sqliteCopy)
        Remove-Item -LiteralPath $sqliteCopy -Force -ErrorAction SilentlyContinue
        $text = [System.Text.Encoding]::UTF8.GetString($bytes)
        $result.sqlite_plaintext_secret_found = $text.Contains($UnlockSecret)
    }

    Invoke-ApiJson -Method Put -Path "/connections/profiles/active" -Body @{ profile_id = "local_default" } | Out-Null
    Invoke-ApiJson -Method Post -Path "/security/local/lock" | Out-Null

    if (-not $result.default_profile_seen) { Add-Failure "Default local credential profile was not visible." }
    if (-not $result.profile_created) { Add-Failure "Credential profile create did not return the expected profile." }
    if (-not $result.profile_switch_ok) { Add-Failure "Credential profile switch did not persist active profile context." }
    if (-not $result.readiness_profile_context_ok) { Add-Failure "Provider readiness did not include selected profile context." }
    if (-not $result.redacted_audit_ok) { Add-Failure "Credential audit did not include redacted profile context." }
    if ($result.sqlite_plaintext_secret_found) { Add-Failure "Plaintext unlock secret was found in SQLite." }
}
catch {
    Add-Failure $_.Exception.Message
}
finally {
    $result.finished_at = (Get-Date).ToString("o")
    $result | ConvertTo-Json -Depth 8 | Set-Content -Path $OutputPath -Encoding UTF8
    Stop-Workbench
    if ($result.failures.Count -gt 0) {
        Write-Error "Packaged account-scoped credential smoke failed. See $OutputPath"
    }
    else {
        Write-Output "Packaged account-scoped credential smoke passed: $OutputPath"
    }
}
