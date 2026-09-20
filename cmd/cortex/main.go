package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/cortex-studio/cortex/internal/kernel"
	"github.com/cortex-studio/cortex/internal/tunnel"
	db "github.com/cortex-studio/cortex/plugins/ext_db"
	mcp "github.com/cortex-studio/cortex/plugins/ext_mcp"
	network "github.com/cortex-studio/cortex/plugins/ext_network"
)

//go:embed all:dist
var embeddedWeb embed.FS

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Println("Cortex Studio - The Zero-Knowledge Infrastructure Workbench")
	fmt.Printf("Initializing Microkernel on port :%s...\n", port)

	bus := kernel.NewEventBus()
	registry := kernel.NewRegistry(bus)

	pipelineEngine := tunnel.NewPipelineEngine()
	telemetryMonitor := tunnel.NewTelemetryMonitor(pipelineEngine, 2*time.Second)

	networkExt := network.NewNetworkExtension(pipelineEngine, telemetryMonitor)
	dbExt := db.NewDBExplorerExtension(pipelineEngine)
	mcpExt := mcp.NewMCPExtension(registry)

	if err := registry.Register(networkExt); err != nil {
		log.Fatalf("failed registering ext_network: %v", err)
	}
	if err := registry.Register(dbExt); err != nil {
		log.Fatalf("failed registering ext_db: %v", err)
	}
	if err := registry.Register(mcpExt); err != nil {
		log.Fatalf("failed registering ext_mcp: %v", err)
	}

	fmt.Printf("Loaded %d extensions:\n", len(registry.All()))
	for _, ext := range registry.All() {
		fmt.Printf("   - [%s] %s (v%s)\n", ext.ID(), ext.Name(), ext.Version())
	}

	mux := http.NewServeMux()
	registry.RegisterAllRoutes(mux)

	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"online","timestamp":"%s"}`, time.Now().UTC().Format(time.RFC3339))
	})

	distFS, err := fs.Sub(embeddedWeb, "dist")
	if err == nil {
		fileServer := http.FileServer(http.FS(distFS))
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			f, err := distFS.Open(r.URL.Path[1:])
			if err == nil {
				_ = f.Close()
				fileServer.ServeHTTP(w, r)
				return
			}
			indexFile, err := distFS.Open("index.html")
			if err == nil {
				_ = indexFile.Close()
				r.URL.Path = "/"
				fileServer.ServeHTTP(w, r)
				return
			}
			fileServer.ServeHTTP(w, r)
		})
	}

	addr := fmt.Sprintf("0.0.0.0:%s", port)
	fmt.Printf("Server listening at http://localhost:%s\n", port)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}