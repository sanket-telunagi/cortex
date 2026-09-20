.PHONY: all build test clean run

all: build

build:
	@echo "==> Building web frontend..."
	cd web && bun run vite build
	@echo "==> Compiling static standalone binary..."
	go build -ldflags="-s -w" -o bin/cortex.exe ./cmd/cortex
	@echo "==> Build complete: bin/cortex.exe"

test:
	@echo "==> Running Go tests..."
	go test -v ./internal/...
	@echo "==> Typechecking frontend..."
	cd web && bun run tsc --noEmit

clean:
	rm -rf bin/ cmd/cortex/dist/

run:
	./bin/cortex.exe