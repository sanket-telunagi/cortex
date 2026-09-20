param(
    [switch]$Dev,
    [switch]$Test,
    [switch]$SkipFrontend
)

$ErrorActionPreference = "Stop"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " Cortex Studio Single-Binary Build & Automation Engine" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# 1. Run Unit and Subsystem Tests
if ($Test -or (-not $Dev)) {
    Write-Host "`n[1/3] Running Go backend and tunnel tests..." -ForegroundColor Yellow
    go test -v ./internal/...
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Tests failed! Aborting build." -ForegroundColor Red
        exit 1
    }
    Write-Host "All Go tests passed." -ForegroundColor Green
}

# 2. Build Frontend
if (-not $SkipFrontend) {
    Write-Host "`n[2/3] Compiling React 19 web frontend into cmd/cortex/dist..." -ForegroundColor Yellow
    Push-Location web
    try {
        bun run vite build
    } finally {
        Pop-Location
    }
    Write-Host "Frontend compiled and staged for embedding." -ForegroundColor Green
} else {
    Write-Host "`n[2/3] Skipping frontend compilation (-SkipFrontend flag set)." -ForegroundColor DarkGray
}

# 3. Compile Standalone Single Binary
Write-Host "`n[3/3] Compiling single static executable bin/cortex.exe..." -ForegroundColor Yellow
if (-not (Test-Path "bin")) {
    New-Item -ItemType Directory -Path "bin" | Out-Null
}

go build -ldflags="-s -w" -o bin/cortex.exe ./cmd/cortex
if ($LASTEXITCODE -ne 0) {
    Write-Host "Go build failed!" -ForegroundColor Red
    exit 1
}

$bin = Get-Item "bin/cortex.exe"
$sizeMb = [Math]::Round($bin.Length / 1MB, 2)

Write-Host "`nBuild Succeeded!" -ForegroundColor Green
Write-Host "Binary: $($bin.FullName) ($sizeMb MB)" -ForegroundColor White
Write-Host "To run Cortex Studio: .\bin\cortex.exe" -ForegroundColor Cyan