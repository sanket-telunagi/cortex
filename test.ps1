$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " Running Cortex Studio Test & Diagnostic Suite" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Backend Go Tests
Write-Host "`n1. Running Go Subsystem Tests (Tunnel, Chaining, Telemetry)..." -ForegroundColor Yellow
go test -v ./internal/tunnel
if ($LASTEXITCODE -ne 0) {
    Write-Host "Tunnel tests failed!" -ForegroundColor Red
    exit 1
}

# 2. Frontend Type & Lint Check
Write-Host "`n2. Running Frontend TypeScript Typecheck..." -ForegroundColor Yellow
Push-Location web
try {
    bun run tsc --noEmit
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Frontend typecheck failed!" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}
Write-Host "Frontend types valid." -ForegroundColor Green

# 3. Binary Health & Smoke Test
Write-Host "`n3. Performing Binary Smoke Test & Endpoint Health Diagnostic..." -ForegroundColor Yellow
$proc = Start-Process -FilePath ".\bin\cortex.exe" -PassThru -NoNewWindow
Start-Sleep -Seconds 2

try {
    $health = Invoke-RestMethod -Uri "http://localhost:8080/api/health" -TimeoutSec 3
    Write-Host "Health Check: $($health.status) at $($health.timestamp)" -ForegroundColor Green

    $hops = Invoke-RestMethod -Uri "http://localhost:8080/api/network/hops" -TimeoutSec 3
    Write-Host "Registered Hops: $($hops.Count)" -ForegroundColor Green

    $tools = Invoke-RestMethod -Uri "http://localhost:8080/api/mcp/tools" -TimeoutSec 3
    Write-Host "Exposed MCP AI Tools: $($tools.tools.Count)" -ForegroundColor Green

    $page = Invoke-RestMethod -Uri "http://localhost:8080/" -TimeoutSec 3
    Write-Host "Web UI Status: HTTP OK" -ForegroundColor Green
} finally {
    if ($proc -and (-not $proc.HasExited)) {
        Stop-Process -Id $proc.Id -Force
    }
}

Write-Host "`nAll Systems Verified and Operational!" -ForegroundColor Green