.PHONY: all build check test clean run

all: check build test

check:
	@echo "==> Typechecking frontend (TypeScript)..."
	cd web && bun run typecheck
	@echo "==> Running Go vet..."
	go vet ./...

build: check
	@echo "==> Building web frontend..."
	cd web && bun run build
	@echo "==> Compiling standalone binary..."
	go build -ldflags="-s -w" -o bin/cortex.exe ./cmd/cortex
	@echo "==> Build complete: bin/cortex.exe"

test: check
	@echo "==> Running Go unit & integration test suite..."
	go test -v ./...

clean:
	rm -rf bin/ cmd/cortex/dist/

run:
	./bin/cortex.exe
