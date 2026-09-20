# Cortex Studio: Implementation Plan & Architecture Specification
> **Low-Latency, Multi-Hop SSH/Proxy Chaining Engine with Real-Time Topology & Per-Hop Latency Telemetry**

---

## 1. High-Level Requirements & Invariants

1. **Ultra-Low Latency & High Performance**:
   - Backend built in Go using asynchronous non-blocking I/O (`net.Dialer`, `golang.org/x/crypto/ssh`, SOCKS5/HTTP CONNECT proxy multiplexing).
   - Zero unnecessary allocations; connection pooling and multiplexed keep-alives.
   - Frontend UI optimized with 60 FPS Canvas / SVG rendering for real-time telemetry graphs without DOM thrashing.
2. **Arbitrary Multi-Hop Connection Chaining**:
   - Chain arbitrary sequences: `Local Browser -> Cortex Server -> [Proxy 1 (SOCKS5/HTTP)] -> [SSH Bastion A] -> [Proxy 2] -> [SSH Bastion B] -> Target (PostgreSQL/MySQL/Redis)`.
   - Dynamic routing graph: Each node can serve as a bridge or gateway to subsequent nodes.
3. **Per-Hop Latency Measurement & Telemetry Engine**:
   - Continuous background TCP/SSH synthetic heartbeat pings measuring round-trip time (RTT) for every discrete hop:
     - Hop 1: Cortex -> Proxy 1 (e.g. `24ms`)
     - Hop 2: Proxy 1 -> SSH Bastion A (e.g. `45ms`)
     - Hop 3: Bastion A -> SSH Bastion B (e.g. `82ms`)
     - Hop 4: Bastion B -> Target Database (e.g. `12ms`)
     - Total Pipeline RTT: `163ms`
   - Real-time streaming via WebSocket to the dashboard with historical time-series sparklines/charts.
4. **"Everything-As-An-Extension" Microkernel**:
   - Core provides lifecycle, routing engine, telemetry bus, and WebSocket multiplexer.
   - All tools (`ext_network` / `ext_ssh_proxy`, `ext_db`, `ext_mcp`) are modular extensions implementing a clean Go interface and React frontend contract.
5. **Single Standalone Executable**:
   - Go backend embedding the compiled React 19 + TypeScript + TailwindCSS web frontend using `//go:embed`.
   - Single port (`:8080`), zero external dependencies.

---

## 2. Dynamic Multi-Hop Pipeline Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    CORTEX MULTI-HOP PIPELINE                                    │
│                                                                                                 │
│  [Client Web UI]                                                                                │
│        │  (WebSocket / HTTP)                                                                    │
│        ▼                                                                                        │
│  [Cortex Engine]                                                                                │
│        │                                                                                        │
│        ├───(Hop 1 RTT: 15ms)───► [Proxy 1 (SOCKS5 / HTTP)]                                      │
│        │                               │                                                        │
│        │                               └───(Hop 2 RTT: 35ms)───► [SSH Bastion 1]                │
│        │                                                               │                        │
│        │                                                               └───(Hop 3 RTT: 28ms)──► │
│        ▼                                                                                        │
│  [Telemetry Engine] ◄──(Periodic Per-Node Micro-Pings)──────────────────────────────────────────┘
│        │                                                                                        │
│        └───(Real-time Hop Latency Matrix)──► [Dashboard Topology & Canvas Latency Graph]       │
│                                              • Hop 1: 15ms | Hop 2: 35ms | Hop 3: 28ms          │
│                                              • Total Pipeline Latency: 78ms                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Phased Implementation Roadmap

### Phase 1: Microkernel & Multi-Hop Chaining Core (`internal/tunnel`)
- [ ] Initialize Go module (`go.mod`) with modern dependencies (`x/crypto/ssh`, `gorilla/websocket`, `proxy`, `sqlite`).
- [ ] Implement the **Tunnel Pipeline Graph Engine**:
  - Node types: `Direct`, `HTTP_Proxy`, `SOCKS5_Proxy`, `SSH_Bastion`.
  - Sequential dialer chaining: `DialChain(ctx, []HopConfig) (net.Conn, *HopTelemetry, error)`.
  - In-memory keep-alive and connection pooling to eliminate handshake overhead on consecutive queries.
- [ ] Implement the **Per-Hop Latency Telemetry Engine**:
  - Independent round-trip time (RTT) pingers for each individual segment.
  - Streaming telemetry broker broadcasting metrics at configurable intervals (e.g. every 2s) over WebSockets.

### Phase 2: Plugin SDK & Core Server (`internal/kernel` & `internal/server`)
- [ ] Implement the **Extension Microkernel Interface**:
  - `Extension` lifecycle (`Init`, `Start`, `Stop`, `Routes`, `MCPTools`).
  - Registry for dynamic plugin activation.
- [ ] Implement the **`ext_network` extension**:
  - Connection manager for SSH keys, passwords, proxy configs, and multi-hop chain templates.
  - CRUD API for connection profiles and chain topologies.
- [ ] Implement the **`ext_db` extension skeleton**:
  - Target database probe over the established tunnel chain (Postgres / MySQL / SQLite).
- [ ] Implement the **`ext_mcp` extension skeleton**:
  - Exposing tunnel status and database query tools to AI agents.

### Phase 3: High-Performance Web Dashboard (`web/`)
- [ ] Initialize modern frontend: Vite + React 19 + TypeScript + TailwindCSS + Lucide icons.
- [ ] Build **Real-Time Latency Dashboard & Connection Topology**:
  - Interactive multi-hop chain visualizer showing node-by-node status (Active, Connecting, Error).
  - High-performance sparklines / canvas-based latency graph per hop and cumulative pipeline latency.
- [ ] Build **Connection Chaining Builder**:
  - Drag-and-drop or visual flow builder to construct chains (e.g., `SOCKS5 Proxy -> Bastion US-East -> Bastion Private -> RDS Postgres`).
  - Immediate "Test Hop-by-Hop Connection" diagnostic tool.

### Phase 4: Single-Binary Packaging & End-to-End Verification
- [ ] Configure `//go:embed` asset serving with automatic fallback to Vite dev server in development mode.
- [ ] Build single static executable (`bin/cortex.exe`).
- [ ] Run full automated verification suite: unit tests, mock SSH bastion chaining tests, and latency streaming verification.
