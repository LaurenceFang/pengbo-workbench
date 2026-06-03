param(
    [string]$SidecarPath = (Join-Path (Join-Path $PSScriptRoot "..") "src-tauri\binaries\pengbo-sidecar\pengbo-sidecar.exe"),
    [string]$OutputPath = (Join-Path (Join-Path $PSScriptRoot "..") "logs\security-signoff-packaged-smoke-latest.json"),
    [int]$Port = 8765,
    [int]$HealthTimeoutSeconds = 30,
    [string]$UnlockSecret = "security-signoff-smoke-passphrase",
    [string]$SecretMarker = "security-signoff-secret-marker-1234567890"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$baseUrl = "http://127.0.0.1:$Port/api/v1"
$runtimeRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("pengbo-security-signoff-" + [Guid]::NewGuid().ToString("N"))
$dataDir = Join-Path $runtimeRoot "data"
$logDir = Join-Path $runtimeRoot "logs"
$result = [ordered]@{
    sidecar_path = ""
    started_at = (Get-Date).ToString("o")
    finished_at = $null
    current_step = "starting"
    health_ready = $false
    runtime_root = $runtimeRoot
    brief_id = $null
    locked_routes = [ordered]@{}
    exports = [ordered]@{
        research_exists = $false
        research_redacted = $false
        research_path = $null
        data_sources_exists = $false
        data_sources_redacted = $false
        data_sources_path = $null
    }
    audit = [ordered]@{
        report_export_recorded = $false
        sensitive_surface_blocked_recorded = $false
        permission_events_recorded = $false
        audit_redacted = $false
    }
    route_classification = [ordered]@{
        research_export = $false
        settings_runtime = $false
        portfolio_transactions = $false
        observed = @()
    }
    gateway = [ordered]@{
        unsafe_origin_rejected = $false
        invalid_method_rejected = $false
    }
    sqlite_plaintext_secret_found = $false
    smoke_log_contains_secret_marker = $false
    no_public_or_hosted_scope_added = $false
    failures = New-Object System.Collections.Generic.List[string]
}

function Add-Failure {
    param([string]$Message)
    $result.failures.Add($Message)
    Write-Warning $Message
}

function Set-Step {
    param([string]$Name)
    $result.current_step = $Name
    Write-Host "[security-signoff] $Name"
}

function Assert-Condition {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) {
        throw $Message
    }
}

function Invoke-ApiJson {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [hashtable]$Headers = @{},
        [int]$TimeoutSeconds = 20
    )

    $uri = "$baseUrl$Path"
    if ($null -eq $Body) {
        return Invoke-RestMethod -Method $Method -Uri $uri -Headers $Headers -TimeoutSec $TimeoutSeconds
    }

    $json = $Body | ConvertTo-Json -Depth 12
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

function Test-ContainsSecretMarker {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $false
    }
    return $Value.Contains($SecretMarker) -or $Value.Contains($UnlockSecret)
}

function Get-TextFileSafe {
    param([string]$Path)
    if (-not $Path -or -not (Test-Path -LiteralPath $Path)) {
        return ""
    }
    return Get-Content -LiteralPath $Path -Raw -Encoding UTF8
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
    Assert-Condition (Wait-ForHealth) "Packaged sidecar health did not become ready."
    $result.health_ready = $true

    Set-Step "initialize local unlock"
    Invoke-ApiJson -Method Post -Path "/security/local/initialize" -Body @{ unlock_secret = $UnlockSecret } -TimeoutSeconds 5 | Out-Null
    Set-Step "create security session"
    $session = Invoke-ApiJson -Method Post -Path "/security/session" -Body @{}
    $sessionHeaders = @{ "X-Pengbo-Session" = $session.session_id }

    Set-Step "create research brief"
    $created = Invoke-ApiJson -Method Post -Path "/research/briefs" -Headers $sessionHeaders -Body @{ symbol = "AAPL" } -TimeoutSeconds 120
    $result.brief_id = $created.brief_id
    $notePayload = @{
        markdown = "Security signoff note api_key=$SecretMarker Authorization: Bearer $SecretMarker"
    }
    Set-Step "update research notes"
    $updated = Invoke-ApiJson -Method Put -Path "/research/briefs/$($created.brief_id)/notes" -Headers $sessionHeaders -Body $notePayload -TimeoutSeconds 5
    Assert-Condition (-not (Test-ContainsSecretMarker -Value ($updated | ConvertTo-Json -Depth 12))) "Research notes API response leaked the secret marker."

    Set-Step "export research report"
    $researchExport = Invoke-ApiJson -Method Post -Path "/research/briefs/$($created.brief_id)/export" -Headers $sessionHeaders -TimeoutSeconds 5
    $result.exports.research_path = $researchExport.export_path
    $researchText = Get-TextFileSafe -Path $researchExport.export_path
    $result.exports.research_exists = Test-Path -LiteralPath $researchExport.export_path
    $result.exports.research_redacted = -not (Test-ContainsSecretMarker -Value $researchText)

    Set-Step "export data sources report"
    $dataExport = Invoke-ApiJson -Method Post -Path "/data-sources/reports/export" -Headers $sessionHeaders -TimeoutSeconds 8 -Body @{
        macroProvider = "worldbank"
        macroSeriesId = "NY.GDP.MKTP.CD"
        macroCountry = "CN"
        newsQuery = "api_key=$SecretMarker"
        cryptoIds = "bitcoin"
    }
    $result.exports.data_sources_path = $dataExport.export_path
    $dataText = Get-TextFileSafe -Path $dataExport.export_path
    $result.exports.data_sources_exists = Test-Path -LiteralPath $dataExport.export_path
    $result.exports.data_sources_redacted = -not (Test-ContainsSecretMarker -Value $dataText)

    Set-Step "lock local security"
    Invoke-ApiJson -Method Post -Path "/security/local/lock" -TimeoutSeconds 5 | Out-Null
    $result.locked_routes["research_brief"] = Invoke-StatusCode -Method Get -Path "/research/briefs/$($created.brief_id)" -Headers $sessionHeaders
    $result.locked_routes["portfolio_transactions"] = Invoke-StatusCode -Method Get -Path "/portfolio/transactions" -Headers $sessionHeaders
    $result.locked_routes["settings_runtime"] = Invoke-StatusCode -Method Get -Path "/settings/runtime" -Headers $sessionHeaders
    $result.locked_routes["research_assistant_context"] = Invoke-StatusCode -Method Get -Path "/research/assistant/briefs/$($created.brief_id)/context-preview" -Headers $sessionHeaders
    $result.locked_routes["data_source_export"] = Invoke-StatusCode -Method Post -Path "/data-sources/reports/export" -Headers $sessionHeaders -Body @{
        macroProvider = "worldbank"
        macroSeriesId = "NY.GDP.MKTP.CD"
        macroCountry = "CN"
        newsQuery = "locked"
        cryptoIds = "bitcoin"
    }

    foreach ($name in $result.locked_routes.Keys) {
        if ([int]$result.locked_routes[$name] -ne 423) {
            Add-Failure "Locked route $name returned $($result.locked_routes[$name]) instead of 423."
        }
    }

    Set-Step "unlock local security"
    Invoke-ApiJson -Method Post -Path "/security/local/unlock" -Body @{ unlock_secret = $UnlockSecret } -TimeoutSeconds 5 | Out-Null
    Set-Step "read security audit"
    $audit = @(Invoke-ApiJson -Method Get -Path "/security/audit?limit=200" -Headers $sessionHeaders)
    $auditText = $audit | ConvertTo-Json -Depth 12
    $auditEvents = @($audit | ForEach-Object { $_.event_type } | Where-Object { $_ })
    $result.audit.report_export_recorded = $auditEvents -contains "report_exported"
    $result.audit.sensitive_surface_blocked_recorded = $auditEvents -contains "sensitive_surface_blocked"
    $result.audit.permission_events_recorded = ($auditEvents | Where-Object { $_ -eq "permission_granted" }).Count -gt 0
    $result.audit.audit_redacted = -not (Test-ContainsSecretMarker -Value $auditText)

    Set-Step "read route classification"
    $routes = @(Invoke-ApiJson -Method Get -Path "/security/route-classification")
    $routeKeys = @()
    if ($routes.Count -eq 1 -and $routes[0].method -is [array]) {
        for ($index = 0; $index -lt $routes[0].method.Count; $index++) {
            $routeKeys += "$($routes[0].method[$index]) $($routes[0].path[$index])"
        }
    }
    else {
        foreach ($route in $routes) {
            $routeKeys += "$($route.method) $($route.path)"
        }
    }
    $result.route_classification.observed = $routeKeys
    $result.route_classification.research_export = $routeKeys -contains "POST /api/v1/research/briefs/{brief_id}/export"
    $result.route_classification.settings_runtime = $routeKeys -contains "GET /api/v1/settings/runtime"
    $result.route_classification.portfolio_transactions = $routeKeys -contains "GET /api/v1/portfolio/transactions"

    $result.gateway.unsafe_origin_rejected = (Invoke-StatusCode -Method Post -Path "/security/session" -Headers @{
        Origin = "https://evil.example"
        Authorization = "Bearer $SecretMarker"
    } -Body @{}) -eq 403
    $result.gateway.invalid_method_rejected = (Invoke-StatusCode -Method TRACE -Path "/health") -eq 405

    Set-Step "verify runtime storage"
    $runtime = Invoke-ApiJson -Method Get -Path "/settings/runtime" -Headers $sessionHeaders
    if ($runtime.sqlite_path -and (Test-Path -LiteralPath $runtime.sqlite_path)) {
        $sqliteCopy = Join-Path ([System.IO.Path]::GetTempPath()) ("pengbo-security-signoff-" + [Guid]::NewGuid().ToString("N") + ".sqlite3")
        Copy-Item -LiteralPath $runtime.sqlite_path -Destination $sqliteCopy -Force
        $sqliteText = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($sqliteCopy))
        Remove-Item -LiteralPath $sqliteCopy -Force -ErrorAction SilentlyContinue
        $result.sqlite_plaintext_secret_found = Test-ContainsSecretMarker -Value $sqliteText
    }

    $result.no_public_or_hosted_scope_added = -not (($routeKeys -join "`n") -match "hosted|remote sync|public account")

    if (-not $result.exports.research_exists) { Add-Failure "Research export was not created." }
    if (-not $result.exports.research_redacted) { Add-Failure "Research export leaked the secret marker." }
    if (-not $result.exports.data_sources_exists) { Add-Failure "Data Sources export was not created." }
    if (-not $result.exports.data_sources_redacted) { Add-Failure "Data Sources export leaked the secret marker." }
    if (-not $result.audit.report_export_recorded) { Add-Failure "Report export audit event was not recorded." }
    if (-not $result.audit.sensitive_surface_blocked_recorded) { Add-Failure "Locked sensitive surface audit event was not recorded." }
    if (-not $result.audit.permission_events_recorded) { Add-Failure "Session permission audit events were not recorded." }
    if (-not $result.audit.audit_redacted) { Add-Failure "Security audit leaked the secret marker." }
    if (-not $result.route_classification.research_export) { Add-Failure "Route classification is missing Research export." }
    if (-not $result.route_classification.settings_runtime) { Add-Failure "Route classification is missing Settings runtime." }
    if (-not $result.route_classification.portfolio_transactions) { Add-Failure "Route classification is missing Portfolio transactions." }
    if (-not $result.gateway.unsafe_origin_rejected) { Add-Failure "Gateway did not reject unsafe origin." }
    if (-not $result.gateway.invalid_method_rejected) { Add-Failure "Gateway did not reject invalid method." }
    if ($result.sqlite_plaintext_secret_found) { Add-Failure "SQLite contained the unlock secret or secret marker." }
    if (-not $result.no_public_or_hosted_scope_added) { Add-Failure "Route classification suggests a hosted/public scope was added." }
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
    $resultJson = $result | ConvertTo-Json -Depth 12
    $result.smoke_log_contains_secret_marker = Test-ContainsSecretMarker -Value $resultJson
    if ($result.smoke_log_contains_secret_marker) {
        $result.failures.Add("Smoke result JSON contained the secret marker.")
        $resultJson = $result | ConvertTo-Json -Depth 12
    }
    $resultJson | Set-Content -Path $OutputPath -Encoding UTF8
    if ($result.failures.Count -gt 0) {
        Write-Error "Packaged security signoff smoke failed. See $OutputPath"
    }
    else {
        Write-Output "Packaged security signoff smoke passed: $OutputPath"
    }
}
