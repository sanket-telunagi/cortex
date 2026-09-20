# Graph Report - .  (2026-09-20)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 201 nodes · 292 edges · 19 communities (17 shown, 2 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `533d0d6a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 14

## God Nodes (most connected - your core abstractions)
1. `NetworkExtension` - 21 edges
2. `TelemetryMonitor` - 19 edges
3. `DBExplorerExtension` - 17 edges
4. `PipelineEngine` - 16 edges
5. `compilerOptions` - 16 edges
6. `HopConfig` - 15 edges
7. `MCPExtension` - 13 edges
8. `EventBus` - 12 edges
9. `Registry` - 11 edges
10. `main()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `NewPipelineEngine()`  [INFERRED]
  cmd/cortex/main.go → internal/tunnel/engine.go
- `main()` --calls--> `NewTelemetryMonitor()`  [INFERRED]
  cmd/cortex/main.go → internal/tunnel/monitor.go
- `main()` --calls--> `NewDBExplorerExtension()`  [INFERRED]
  cmd/cortex/main.go → plugins/ext_db/plugin.go
- `main()` --calls--> `NewMCPExtension()`  [INFERRED]
  cmd/cortex/main.go → plugins/ext_mcp/plugin.go
- `main()` --calls--> `NewNetworkExtension()`  [INFERRED]
  cmd/cortex/main.go → plugins/ext_network/plugin.go

## Import Cycles
- None detected.

## Communities (19 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (12): DBConnectionConfig, DBExplorerExtension, DBType, QueryResult, Context, MCPToolDefinition, Context, Request (+4 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (21): DOM, DOM.Iterable, ES2022, src, compilerOptions, allowImportingTsExtensions, isolatedModules, jsx (+13 more)

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (11): CancelFunc, HopMetric, NewPipelineEngine(), TestPipelineEngine_DirectDial(), TestTelemetryMonitor(), Context, Duration, RWMutex (+3 more)

### Community 3 - "Community 3"
Cohesion: 0.27
Nodes (13): Client, Conn, Context, Duration, RWMutex, Time, ChainMetric, HopAuth (+5 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (8): ChainDefinition, NetworkExtension, Context, Request, ResponseWriter, RWMutex, ServeMux, NewNetworkExtension()

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (17): autoprefixer, postcss, tailwindcss, @types/react, @types/react-dom, typescript, vite, @vitejs/plugin-react (+9 more)

### Community 6 - "Community 6"
Cohesion: 0.16
Nodes (6): MCPExtension, Context, Request, ResponseWriter, ServeMux, NewMCPExtension()

### Community 7 - "Community 7"
Cohesion: 0.21
Nodes (8): main(), RWMutex, ServeMux, NewEventBus(), NewRegistry(), EventBus, Extension, Registry

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (15): lucide-react, react, react-dom, dependencies, lucide-react, react, react-dom, name (+7 more)

### Community 9 - "Community 9"
Cohesion: 0.33
Nodes (3): RWMutex, NewMemoryStore(), MemoryStore

### Community 11 - "Community 11"
Cohesion: 0.50
Nodes (3): Context, Extension, MCPTool

## Knowledge Gaps
- **41 isolated node(s):** `github.com/cortex-studio/cortex`, `Extension`, `QueryResult`, `name`, `private` (+36 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `NetworkExtension` connect `Community 4` to `Community 0`, `Community 2`, `Community 3`, `Community 7`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **Why does `EventBus` connect `Community 7` to `Community 0`, `Community 4`, `Community 6`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Why does `PipelineEngine` connect `Community 3` to `Community 0`, `Community 2`, `Community 4`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **What connects `github.com/cortex-studio/cortex`, `Extension`, `QueryResult` to the rest of the system?**
  _41 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.1380952380952381 - nodes in this community are weakly interconnected._