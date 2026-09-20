# Cortex Studio (or Cortex Workbench)
> **The Zero-Knowledge, Single-Binary Extensible Infrastructure Workbench**

---

## 1. Project Identity & Vision

**Cortex Studio** is a unified, local-first, zero-knowledge developer workbench deployed as a **single, standalone executable binary**.

It consolidates databases, SSH bastions, event streaming (Kafka), container orchestrators (Kubernetes), performance testing (k6), and AI coding tools (Model Context Protocol - MCP) into an **"Everything-As-An-Extension"** microkernel.

### Core Tenets
1. **Single Portable Binary**: Zero external runtime requirements (no Node.js, Python, or JVM required on host). Single static binary with embedded production web UI and background daemon.
2. **Zero-Knowledge Security Architecture**: The server application and hosting provider **never** have access to unencrypted credentials, SSH private keys, or query results.
3. **Microkernel Architecture ("Everything is an Extension")**: The core engine is purely a lifecycle manager, event bus, and multiplexer. Even the SSH client, Database Explorer, and MCP Server are independent plugins.
4. **Selectable Build-Time Composition**: Compile-time flags (`-tags ext_db,ext_ssh`) or runtime plugin loading to generate custom, tailored enterprise binaries.
5. **Universal AI Interoperability**: Built-in native **Model Context Protocol (MCP)** server allowing any local AI coding agent (Claude Code, Cursor, Zed, Antigravity) to access infrastructure resources with fine-grained approval gates.

---

## 2. Technical Stack for Single-Binary Distribution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CORTEX STUDIO BINARY (`cortex`)                    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Single Static Executable (Go 1.26+ or Rust Tokio)                     │  │
│  │                                                                       │  │
│  │  1. Embedded Static Web Assets:                                       │  │
│  │     - React 19 + TypeScript + Vite + TailwindCSS + Monaco Editor       │  │
│  │     - Embedded directly into binary via `//go:embed` or `rust-embed`  │  │
│  │                                                                       │  │
│  │  2. Core Microkernel:                                                 │  │
│  │     - Plugin Registry & Event Bus                                     │  │
│  │     - Multiplexed WebSocket Gateway (Binary Streams & PTY)            │  │
│  │     - Native SSH Agent & Bastion Multiplexer (`golang.org/x/crypto`)  │  │
│  │     - Model Context Protocol (MCP) HTTP/SSE Server Engine             │  │
│  │     - Embedded Zero-Knowledge Metadata Store (Pure Go SQLite / bbolt) │  │
│  │                                                                       │  │
│  │  3. Extensions Layer (Compiled or Sandboxed):                         │  │
│  │     - `ext-ssh`: Dynamic SSH Tunnels & Bastion Hub                    │  │
│  │     - `ext-db`: PostgreSQL, MySQL, SQLite, Redis, DuckDB Drivers      │  │
│  │     - `ext-mcp`: Agentic Tool Exposure & Read-Only Safety Gate        │  │
│  │     - `ext-kafka` / `ext-k8s` / `ext-k6`: (Future pluggable modules)  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────▲──────────────────────────────────────┘
                                       │ Single Port (e.g. :8080)
                                       │ HTTPS / WSS
                                       ▼
                        ┌─────────────────────────────┐
                        │ Modern Browser (Any Device) │
                        │  - Zero-Knowledge Crypto    │
                        │  - TanStack Virtual Table   │
                        │  - Monaco Editor            │
                        └─────────────────────────────┘
```

---

## 3. Zero-Knowledge Cryptographic Specification

To guarantee that the host server cannot inspect sensitive data:

1. **Client-Side Master Key Derivation**:
   - Master Key derived in browser via **Argon2id** (`Passphrase + User Salt`).
   - Derived Key is never transmitted over the network.
2. **Client-Side Envelope Encryption**:
   - Connection strings and SSH private keys are encrypted locally using **AES-256-GCM**.
   - The central SQLite database strictly stores ciphertext strings and initialization vectors (IV).
3. **In-Memory Ephemeral Execution**:
   - When initiating a query or tunnel, the browser provides the ephemeral decryption token over TLS.
   - The backend engine loads the credentials only in volatile RAM for the lifetime of that query/connection. No unencrypted secrets touch disks or logs.

---

## 4. Repository Structure & Naming Conventions

```
cortex/
├── cmd/
│   └── cortex/                 # Main executable entry point (`main.go`)
│
├── internal/
│   ├── kernel/                 # Microkernel bus, plugin lifecycle, security sandbox
│   ├── server/                 # HTTP/WebSocket server & embedded assets handler
│   ├── crypto/                 # Server-side verification & envelope utils
│   └── store/                  # Embedded metadata store (Pure SQLite/bbolt)
│
├── pkg/
│   └── plugin/                 # Go Plugin SDK & RPC interfaces
│
├── plugins/                    # Independent Extensions (Modular)
│   ├── ext_ssh/                # Universal SSH tunnel multiplexer
│   ├── ext_db/                 # Relational & NoSQL database engine
│   └── ext_mcp/                # Model Context Protocol (MCP) server
│
├── web/                        # Embedded Web Application
│   ├── src/
│   │   ├── core/               # Frontend microkernel & UI shell
│   │   ├── crypto/             # WebCrypto (SubtleCrypto) client encryption
│   │   ├── components/         # Shadcn/Radix UI, Monaco, TanStack virtual table
│   │   └── plugins/            # Frontend companion code for each extension
│   ├── package.json
│   └── vite.config.ts
│
├── Makefile                    # Single-command build: `make build` -> `bin/cortex`
├── README.md
└── AGENTS.md
```

---

## 5. Next Implementation Milestones

- [ ] **Milestone 1**: Initialize Go core engine (`cmd/cortex`) with embedded asset serving.
- [ ] **Milestone 2**: Setup web shell with React 19, TypeScript, and client-side WebCrypto vault.
- [ ] **Milestone 3**: Implement Extension SDK and plug in `ext_ssh` (universal tunnel manager).
- [ ] **Milestone 4**: Implement `ext_db` (Postgres/MySQL/SQLite connection & query grid).
- [ ] **Milestone 5**: Implement `ext_mcp` (Model Context Protocol server for AI coding agents).
