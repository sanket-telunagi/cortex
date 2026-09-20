import React, { useState, useEffect, useRef } from 'react';
import { 
  Network, 
  Database, 
  Bot, 
  Cpu, 
  ShieldCheck, 
  Activity, 
  Plus, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Terminal, 
  Sliders, 
  Lock,
  Layers
} from 'lucide-react';

interface HopMetric {
  hop_id: string;
  hop_name: string;
  hop_type: string;
  target_addr: string;
  latency_ms: number;
  timestamp: string;
  status: 'online' | 'degraded' | 'offline';
  error?: string;
}

interface ChainConfig {
  id: string;
  name: string;
  description: string;
  hops: Array<{
    id: string;
    name: string;
    type: string;
    host: string;
    port: number;
  }>;
  target_addr: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'network' | 'database' | 'mcp'>('network');
  const [metrics, setMetrics] = useState<Record<string, HopMetric[]>>({});
  const [currentMetrics, setCurrentMetrics] = useState<HopMetric[]>([]);
  const [chains, setChains] = useState<ChainConfig[]>([]);
  const [selectedChain, setSelectedChain] = useState<string | null>('chain-prod-db');
  const [wsConnected, setWsConnected] = useState(false);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [sqlQuery, setSqlQuery] = useState("SELECT id, username, role, status, created_at FROM users LIMIT 10;");

  // WebSocket Live Telemetry Connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/network/telemetry/ws`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'snapshot' && data.history) {
          setMetrics(data.history);
        } else if (data.type === 'telemetry_tick' && data.metrics) {
          setCurrentMetrics(data.metrics);
          setMetrics((prev) => {
            const updated = { ...prev };
            for (const m of data.metrics as HopMetric[]) {
              const list = updated[m.hop_id] || [];
              const slice = list.length >= 25 ? list.slice(1) : list;
              updated[m.hop_id] = [...slice, m];
            }
            return updated;
          });
        }
      } catch (e) {
        console.error('Failed to parse telemetry', e);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    // Fetch chains
    fetch('/api/network/chains')
      .then((r) => r.json())
      .then((d) => setChains(d))
      .catch(() => {});

    return () => ws.close();
  }, []);

  const executeDbQuery = async () => {
    setIsQuerying(true);
    try {
      const res = await fetch('/api/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: 'conn-prod-pg', sql: sqlQuery })
      });
      const data = await res.json();
      setQueryResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsQuerying(false);
    }
  };

  const activeChainData = chains.find(c => c.id === selectedChain);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0d14] text-gray-200">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-gray-800/80 bg-[#0f1422] flex flex-col justify-between p-4">
        <div>
          {/* Brand Header */}
          <div className="flex items-center space-x-3 px-2 py-3 mb-6">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Cpu className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm tracking-wide text-white uppercase font-mono">Cortex Studio</h1>
              <p className="text-[10px] text-gray-400">Zero-Knowledge Workbench</p>
            </div>
          </div>

          {/* Extension Navigation */}
          <div className="space-y-1">
            <button 
              onClick={() => setActiveTab('network')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'network' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'}`}
            >
              <div className="flex items-center space-x-2.5">
                <Network className="h-4 w-4" />
                <span>Multi-Hop Tunnels</span>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </button>

            <button 
              onClick={() => setActiveTab('database')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'database' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'}`}
            >
              <div className="flex items-center space-x-2.5">
                <Database className="h-4 w-4" />
                <span>Database Explorer</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono">1 DB</span>
            </button>

            <button 
              onClick={() => setActiveTab('mcp')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'mcp' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'}`}
            >
              <div className="flex items-center space-x-2.5">
                <Bot className="h-4 w-4" />
                <span>Model Context Protocol</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 font-mono">3 Tools</span>
            </button>
          </div>
        </div>

        {/* Zero-Knowledge Vault Card */}
        <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800/80 space-y-2">
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-medium">
            <ShieldCheck className="h-4 w-4" />
            <span>Zero-Knowledge Mode</span>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            All private keys, passwords & tokens are encrypted client-side with AES-256-GCM.
          </p>
          <div className="flex items-center justify-between pt-1 border-t border-gray-800 text-[10px] text-gray-400 font-mono">
            <span>RAM Ephemeral: Active</span>
            <span className={wsConnected ? "text-emerald-400" : "text-amber-400"}>
              {wsConnected ? "â— 60 FPS WSS" : "â—‹ Reconnecting"}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#0c101d]">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-gray-800/80 px-6 flex items-center justify-between bg-[#0f1422]/60 backdrop-blur">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-mono text-gray-400">PIPELINE:</span>
            <span className="text-xs font-bold text-white uppercase tracking-wider bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-1 rounded-md">
              {activeChainData ? activeChainData.name : 'Custom Direct Pipeline'}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm">
              <Plus className="h-3.5 w-3.5" />
              <span>Add Hop or Proxy</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'network' && (
            <>
              {/* Chain Topology Diagram */}
              <div className="p-6 rounded-2xl bg-[#11172a] border border-gray-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-cyan-400" />
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Multi-Hop Chain Topology</h2>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">Real-time hop latency propagation</span>
                </div>

                <div className="flex items-center space-x-3 overflow-x-auto py-4">
                  {/* Origin Client */}
                  <div className="flex-shrink-0 p-3.5 rounded-xl bg-gray-900 border border-gray-700/80 w-44 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono text-gray-400">
                      <span>ORIGIN</span>
                      <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                    </div>
                    <div className="text-xs font-bold text-white">Browser Client</div>
                    <div className="text-[10px] text-gray-400 font-mono">Local Machine</div>
                  </div>

                  <ArrowRight className="h-4 w-4 text-indigo-400 flex-shrink-0" />

                  {/* Hop 1: Edge Proxy */}
                  <div className="flex-shrink-0 p-3.5 rounded-xl bg-gray-900 border border-indigo-500/40 w-48 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono text-indigo-400">
                      <span>HOP 1 (SOCKS5)</span>
                      <span className="text-[10px] text-emerald-400 font-bold">~14ms</span>
                    </div>
                    <div className="text-xs font-bold text-white">Cloudflare Edge Proxy</div>
                    <div className="text-[10px] text-gray-400 font-mono">1.1.1.1:1080</div>
                  </div>

                  <ArrowRight className="h-4 w-4 text-indigo-400 flex-shrink-0" />

                  {/* Hop 2: AWS Bastion */}
                  <div className="flex-shrink-0 p-3.5 rounded-xl bg-gray-900 border border-purple-500/40 w-48 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono text-purple-400">
                      <span>HOP 2 (SSH BASTION)</span>
                      <span className="text-[10px] text-emerald-400 font-bold">~32ms</span>
                    </div>
                    <div className="text-xs font-bold text-white">AWS VPC Bastion</div>
                    <div className="text-[10px] text-gray-400 font-mono">10.0.1.50:22 (ec2-user)</div>
                  </div>

                  <ArrowRight className="h-4 w-4 text-indigo-400 flex-shrink-0" />

                  {/* Target Endpoint */}
                  <div className="flex-shrink-0 p-3.5 rounded-xl bg-gray-900 border border-emerald-500/40 w-48 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400">
                      <span>DESTINATION</span>
                      <span className="text-[10px] text-emerald-400 font-bold">ACTIVE</span>
                    </div>
                    <div className="text-xs font-bold text-white">Production PostgreSQL</div>
                    <div className="text-[10px] text-gray-400 font-mono">10.0.12.99:5432</div>
                  </div>
                </div>
              </div>

              {/* Real-time Per-Hop Latency Telemetry Grid */}
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-400 font-mono">Live Per-Node Latency Telemetry</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(metrics).map(([hopId, history]) => {
                    const latest = history[history.length - 1] || { latency_ms: 0, status: 'online', hop_name: hopId };
                    const isOnline = latest.status === 'online';

                    return (
                      <div key={hopId} className="p-4 rounded-xl bg-[#11172a] border border-gray-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white truncate">{latest.hop_name}</span>
                          <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                        </div>

                        <div className="flex items-baseline space-x-2">
                          <span className="text-2xl font-black font-mono text-white">
                            {latest.latency_ms ? latest.latency_ms.toFixed(1) : '--'}
                          </span>
                          <span className="text-xs font-mono text-gray-400">ms RTT</span>
                        </div>

                        {/* Sparkline Canvas / SVG */}
                        <div className="h-10 w-full flex items-end space-x-1 pt-2">
                          {history.slice(-20).map((h, idx) => {
                            const heightPercent = Math.min(100, Math.max(15, (h.latency_ms / 150) * 100));
                            return (
                              <div
                                key={idx}
                                style={{ height: `${heightPercent}%` }}
                                className="flex-1 bg-gradient-to-t from-indigo-600 to-cyan-400 rounded-t-sm opacity-80 hover:opacity-100 transition-all"
                                title={`${h.latency_ms.toFixed(1)}ms at ${new Date(h.timestamp).toLocaleTimeString()}`}
                              ></div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {activeTab === 'database' && (
            <div className="space-y-6">
              {/* Database Explorer Interface */}
              <div className="p-6 rounded-2xl bg-[#11172a] border border-gray-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Internal Analytics Postgres</h3>
                    <p className="text-xs text-gray-400 font-mono">Connected via [chain-prod-db] Multi-Hop SSH Tunnel</p>
                  </div>
                  <button
                    onClick={executeDbQuery}
                    disabled={isQuerying}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center space-x-2"
                  >
                    <span>{isQuerying ? "Executing..." : "Run Query (Ctrl+Enter)"}</span>
                  </button>
                </div>

                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  className="w-full h-28 bg-[#090d16] border border-gray-700/80 rounded-xl p-3 text-xs font-mono text-emerald-300 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Virtualized Result Table */}
              {queryResult && (
                <div className="p-4 rounded-2xl bg-[#11172a] border border-gray-800 space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-400 font-mono">
                    <span>{queryResult.row_count} rows returned</span>
                    <span>Query execution: {queryResult.elapsed_ms.toFixed(2)}ms</span>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-gray-800">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-gray-900/90 text-gray-300 border-b border-gray-800">
                        <tr>
                          {queryResult.columns.map((c: string) => (
                            <th key={c} className="px-4 py-2 font-semibold uppercase">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60 bg-[#0b0f19]">
                        {queryResult.rows.map((row: any[], i: number) => (
                          <tr key={i} className="hover:bg-gray-800/40">
                            {row.map((val, j) => (
                              <td key={j} className="px-4 py-2 text-gray-200">{String(val)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'mcp' && (
            <div className="p-6 rounded-2xl bg-[#11172a] border border-gray-800 space-y-4">
              <div className="flex items-center space-x-3">
                <Bot className="h-5 w-5 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Model Context Protocol (MCP) Server Endpoint</h3>
              </div>
              <p className="text-xs text-gray-400">
                Any local AI agent (Claude Code, Cursor, Zed, Antigravity) can connect to this endpoint to interact with your tunneled databases and proxies.
              </p>
              <div className="p-3 bg-[#090d16] border border-gray-800 rounded-lg text-xs font-mono text-purple-300">
                http://localhost:8080/api/mcp/tools
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}