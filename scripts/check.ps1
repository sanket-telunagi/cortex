Write-Host "==> [1/4] Running TypeScript Typecheck (bun run typecheck)..." -ForegroundColor Cyan
Set-Location web
bun run typecheck
if ($LASTEXITCODE -ne 0) {
    Write-Error "TypeScript Typecheck failed"
    exit 1
}
Set-Location ..

Write-Host "==> [2/4] Running Go Vet (go vet ./...)..." -ForegroundColor Cyan
go vet ./...
if ($LASTEXITCODE -ne 0) {
    Write-Error "Go Vet failed"
    exit 1
}

Write-Host "==> [3/4] Running Go Unit & Integration Tests (go test ./...)..." -ForegroundColor Cyan
go test ./...
if ($LASTEXITCODE -ne 0) {
    Write-Error "Go Tests failed"
    exit 1
}

Write-Host "==> [4/4] Building Frontend and Standalone Binary..." -ForegroundColor Cyan
Set-Location web
bun run build
Set-Location ..
go build -ldflags="-s -w" -o bin/cortex.exe ./cmd/cortex
if ($LASTEXITCODE -ne 0) {
    Write-Error "Binary build failed"
    exit 1
}

Write-Host "==> All quality checks, static analysis, and builds passed successfully!" -ForegroundColor Green
