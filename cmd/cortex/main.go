package main

import (
	"embed"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/cortex-studio/cortex/internal/auth"
	"github.com/cortex-studio/cortex/internal/kernel"
	"github.com/cortex-studio/cortex/internal/tunnel"
	db "github.com/cortex-studio/cortex/plugins/ext_db"
	mcp "github.com/cortex-studio/cortex/plugins/ext_mcp"
	network "github.com/cortex-studio/cortex/plugins/ext_network"
)

//go:embed all:dist
var embeddedWeb embed.FS

// findAvailablePort searches starting from startPort up to maxAttempts to find a free port.
func findAvailablePort(startPort int, maxAttempts int) (net.Listener, int, error) {
	for p := startPort; p < startPort+maxAttempts; p++ {
		addr := fmt.Sprintf("0.0.0.0:%d", p)
		listener, err := net.Listen("tcp", addr)
		if err == nil {
			return listener, p, nil
		}
	}
	return nil, 0, fmt.Errorf("no free port found in range %d-%d", startPort, startPort+maxAttempts)
}

func main() {
	portFlag := flag.Int("port", 0, "Custom port to bind the server on (default: 8080 or next free port)")
	flag.IntVar(portFlag, "p", 0, "Custom port (shorthand)")
	autoPort := flag.Bool("auto-port", true, "Automatically fallback to next free port if preferred port is in use")
	flag.Parse()

	preferredPort := 8080
	if *portFlag > 0 {
		preferredPort = *portFlag
	} else if envPort := os.Getenv("PORT"); envPort != "" {
		if p, err := strconv.Atoi(envPort); err == nil {
			preferredPort = p
		}
	}

	fmt.Println("Cortex Studio - The Zero-Knowledge Infrastructure Workbench")

	var listener net.Listener
	var actualPort int
	var err error

	if *autoPort {
		listener, actualPort, err = findAvailablePort(preferredPort, 100)
		if err != nil {
			log.Fatalf("Failed to bind port: %v", err)
		}
	} else {
		addr := fmt.Sprintf("0.0.0.0:%d", preferredPort)
		listener, err = net.Listen("tcp", addr)
		if err != nil {
			log.Fatalf("Port %d is already in use: %v", preferredPort, err)
		}
		actualPort = preferredPort
	}

	fmt.Printf("Microkernel listening on 0.0.0.0:%d\n", actualPort)
	if actualPort != preferredPort {
		fmt.Printf("(Port %d was occupied; automatically assigned to %d)\n", preferredPort, actualPort)
	}

	bus := kernel.NewEventBus()
	registry := kernel.NewRegistry(bus)
	authService := auth.NewAuthService()

	pipelineEngine := tunnel.NewPipelineEngine()
	telemetryMonitor := tunnel.NewTelemetryMonitor(pipelineEngine, 2*time.Second)

	networkExt := network.NewNetworkExtension(pipelineEngine, telemetryMonitor)
	dbExt := db.NewDBExplorerExtension(pipelineEngine)
	mcpExt := mcp.NewMCPExtension(registry, authService)

	if err := registry.Register(networkExt); err != nil {
		log.Fatalf("failed registering ext_network: %v", err)
	}
	if err := registry.Register(dbExt); err != nil {
		log.Fatalf("failed registering ext_db: %v", err)
	}
	if err := registry.Register(mcpExt); err != nil {
		log.Fatalf("failed registering ext_mcp: %v", err)
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"online","port":%d,"timestamp":"%s"}`, actualPort, time.Now().Format(time.RFC3339))
	})

	// Mount RBAC & Authentication API endpoints
	auth.RegisterAuthRoutes(mux, authService)

	registry.RegisterAllRoutes(mux)

	distFS, err := fs.Sub(embeddedWeb, "dist")
	if err == nil {
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			// Security headers
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "SAMEORIGIN")
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

			cleanPath := strings.TrimPrefix(r.URL.Path, "/ui")
			cleanPath = strings.TrimPrefix(cleanPath, "/")

			// Serve static assets if exact file exists
			if cleanPath != "" {
				if f, err := distFS.Open(cleanPath); err == nil {
					defer f.Close()
					if strings.HasPrefix(cleanPath, "assets/") {
						w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
					}
					// Let http.ServeContent determine Content-Type by extension
					ext := filepath.Ext(cleanPath)
					switch ext {
					case ".js", ".mjs":
						w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
					case ".css":
						w.Header().Set("Content-Type", "text/css; charset=utf-8")
					case ".json":
						w.Header().Set("Content-Type", "application/json")
					case ".svg":
						w.Header().Set("Content-Type", "image/svg+xml")
					case ".txt":
						w.Header().Set("Content-Type", "text/plain; charset=utf-8")
					}
					if rs, ok := f.(io.ReadSeeker); ok {
						http.ServeContent(w, r, cleanPath, time.Now(), rs)
						return
					}
				}
			}

			// SPA Fallback: serve index.html
			indexFile, err := distFS.Open("index.html")
			if err == nil {
				defer indexFile.Close()
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
				if rs, ok := indexFile.(io.ReadSeeker); ok {
					http.ServeContent(w, r, "index.html", time.Now(), rs)
					return
				}
			}

			http.NotFound(w, r)
		})
	}

	server := &http.Server{
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	log.Printf("Cortex Workbench ready at http://localhost:%d\n", actualPort)
	if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server exited unexpectedly: %v", err)
	}
}
