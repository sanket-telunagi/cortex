# Cortex Studio (Cortex Workbench)

> **The Zero-Knowledge, Single-Binary Extensible Infrastructure Workbench**  
> Consolidating Databases, Multi-Hop SSH Bastions, Proxy Chaining, Telemetry, and Model Context Protocol (MCP) into an ultra-low latency standalone executable.

---

## ⚡ Key Highlights

- **Single Portable Binary**: Zero host prerequisites. Embedded static React 19 UI inside a standalone native Go binary (`bin/cortex.exe`).
- **Zero-Knowledge Security**: Secrets, private keys, and passwords are encrypted client-side with AES-256-GCM. The central backend and hosting provider never see plaintext secrets.
- **Arbitrary Multi-Hop Chaining**: Connect to databases and servers across complex multi-hop bastions and proxies (`Client -> SOCKS5/HTTP Proxy -> SSH Bastion 1 -> SSH Bastion 2 -> Target DB`).
- **Real-Time Per-Hop Latency Telemetry**: 60 FPS WebSocket push updates showing instantaneous latency (RTT) for every discrete hop, pinpointing network bottlenecks immediately.
- **Built-In Model Context Protocol (MCP)**: Native MCP server exposing infrastructure discovery, connection testing, and read-only querying to AI agents (Claude, Cursor, Zed, Antigravity).

---

## 📁 Repository Structure

```
ZedWorkspace/
├── cmd/
│   └── cortex/                 # Main executable entry point & embedded web assets (`main.go`)
│
├── internal/
│   ├── kernel/                 # Microkernel event bus, extension registry & lifecycle
│   ├── tunnel/                 # Multi-hop dialer pipeline & real-time telemetry monitor
│   ├── crypto/                 # Server-side verification & envelope utils
│   ├── store/                  # Ephemeral in-memory session vault
│   └── server/                 # HTTP/WebSocket gateway
│
├── pkg/
│   └── plugin/                 # Public Cortex Plugin SDK & interfaces
│
├── plugins/                    # Independent Modular Extensions
│   ├── ext_network/            # Universal multi-hop SSH & proxy chaining hub
│   ├── ext_ssh/                # Dedicated SSH bastion & PTY session manager
│   ├── ext_db/                 # Database explorer (Postgres, MySQL, SQLite, Redis)
│   └── ext_mcp/                # Model Context Protocol (MCP) gateway for AI agents
│
├── web/                        # Modern Web Application (React 19, TypeScript, TailwindCSS)
│   ├── src/
│   │   ├── core/               # UI shell microkernel
│   │   ├── crypto/             # WebCrypto client-side AES-256-GCM vault
│   │   ├── components/         # Dashboard visualizers & virtual tables
│   │   └── plugins/            # Frontend companion extensions
│   ├── package.json
│   └── vite.config.ts
│
├── docs/                       # Project Specifications
│   ├── ARCHITECTURE.md         # System design and component map
│   ├── CORTEX_BLUEPRINT.md     # Architectural blueprint and milestones
│   ├── PLAN.md                 # Implementation roadmap
│   ├── SECURITY.md             # Cryptographic vault & zero-knowledge threat model
│   └── TASKS.md                # Task tracking
│
├── graphify-out/               # Graphify Codebase Knowledge Graph
│   ├── graph.json              # Extracted AST graph (201 nodes, 292 edges)
│   └── GRAPH_REPORT.md         # Architectural communities & graph analysis
│
├── build.ps1                   # One-step automated build script
├── test.ps1                    # One-step diagnostics & test runner
├── Makefile                    # Standard multi-platform Makefile
├── AGENTS.md                   # Operational guidelines for AI agents
└── README.md
```

---

## 🚀 Quickstart

### 1. Build the Standalone Binary

```powershell
.\build.ps1
```

Or using Make:
```bash
make build
```

This compiles the web frontend, embeds the assets into Go, and outputs the standalone executable `bin/cortex.exe` (~10.5 MB).

### 2. Run Cortex Studio

```powershell
.\bin\cortex.exe
```

Open your browser at **`http://localhost:8080`**.

### 3. Run Automated Tests

```powershell
.\test.ps1
```

---

## 🤖 Querying the Codebase Knowledge Graph (Graphify)

A complete knowledge graph of the codebase has been generated using `graphify`. You can query it anytime:

```powershell
# Plain-language explanation of any node
graphify explain "PipelineEngine"

# Shortest path between components
graphify path "PipelineEngine" "MCPExtension"

# List most connected architectural hubs
graphify god-nodes
```