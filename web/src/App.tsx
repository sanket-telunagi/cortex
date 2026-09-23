import React, { useState, useEffect } from 'react';
import { 
  Network, 
  Database, 
  Bot, 
  ShieldCheck, 
  Activity, 
  Search, 
  LogOut,
  User,
  Users,
  Lock,
  Mail,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Copy,
  Check,
  Terminal,
  Cpu,
  Layers,
  KeyRound,
  Play
} from 'lucide-react';
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Input,
  Select,
  Textarea,
  Modal,
  Tabs,
  Gauge,
  LatencySpectrum
} from './design-system';
import { TunnelManager, HopConfig, ChainConfig, HopMetric } from './plugins/tunnel';

interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'ENGINEER' | 'VIEWER' | 'MCP_AGENT';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'network' | 'database' | 'vault' | 'mcp' | 'rbac'>('network');
  const [metrics, setMetrics] = useState<Record<string, HopMetric[]>>({});
  const [wsConnected, setWsConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Tunnel Chains and Hops
  const [chains] = useState<ChainConfig[]>([
    {
      id: 'chain-prod',
      name: 'Primary Production Pipeline',
      description: 'Zero-Knowledge multi-hop tunnel routing through edge proxy and SSH bastion.',
      hops: [
        { id: 'hop-1', name: 'Workstation Edge Dial', type: 'direct', host: '127.0.0.1', port: 8080 },
        { id: 'hop-2', name: 'Frankfurt SSH Bastion', type: 'ssh_bastion', host: 'bastion-eu-central.corp.internal', port: 22, auth: { surrogate_handle: '$CORTEX_HANDLE:frankfurt_ssh$' } },
        { id: 'hop-3', name: 'RDS Aurora PostgreSQL', type: 'direct', host: 'pg-prod.c91f.rds.internal', port: 5432, auth: { surrogate_handle: '$CORTEX_HANDLE:rds_prod_master$' } }
      ],
      target_addr: 'pg-prod.c91f.rds.internal:5432'
    }
  ]);

  const [hops, setHops] = useState<HopConfig[]>([
    { id: 'hop-1', name: 'Direct Edge Dial', type: 'direct', host: '127.0.0.1', port: 8080, timeout_ms: 1000 },
    { id: 'hop-2', name: 'Frankfurt Bastion', type: 'ssh_bastion', host: 'bastion-eu.corp.internal', port: 22, auth: { username: 'ubuntu', surrogate_handle: '$CORTEX_HANDLE:frankfurt_ssh$' } },
    { id: 'hop-3', name: 'Tokyo Forward Proxy', type: 'socks5_proxy', host: 'proxy-ap.internal', port: 1080 },
    { id: 'hop-4', name: 'US-East Bastion', type: 'ssh_bastion', host: 'bastion-us.corp.internal', port: 22, auth: { username: 'ec2-user', surrogate_handle: '$CORTEX_HANDLE:useast_ssh$' } },
    { id: 'hop-5', name: 'Aurora PG Gateway', type: 'direct', host: 'pg-prod.rds.internal', port: 5432, auth: { surrogate_handle: '$CORTEX_HANDLE:rds_prod_master$' } },
    { id: 'hop-6', name: 'Corporate HTTP Proxy', type: 'http_proxy', host: 'squid.corp.internal', port: 3128 },
  ]);

  // Authentication & RBAC State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('cortex_token'));
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authRole, setAuthRole] = useState<'ADMIN' | 'ENGINEER' | 'VIEWER' | 'MCP_AGENT'>('ENGINEER');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [copiedHandle, setCopiedHandle] = useState<string | null>(null);
  
  // Team Management State
  const [teamMembers, setTeamMembers] = useState<AuthUser[]>([
    { id: 'usr-admin-01', email: 'admin@cortex.internal', full_name: 'Admin User', role: 'ADMIN' },
    { id: 'usr-eng-02', email: 'alex.chen@corp', full_name: 'Alex Chen', role: 'ENGINEER' },
    { id: 'usr-sec-03', email: 'sarah.m@infra', full_name: 'Sarah Miller', role: 'VIEWER' },
    { id: 'usr-mcp-04', email: 'agent-claude@mcp.bot', full_name: 'Claude MCP Agent', role: 'MCP_AGENT' },
  ]);

  // Database Query State
  const [selectedDbTable, setSelectedDbTable] = useState('connections');
  const [sqlQuery, setSqlQuery] = useState("SELECT id, username, role, status, latency_ms, last_login FROM connections LIMIT 10;");
  const [queryResult, setQueryResult] = useState<any>({
    columns: ['id', 'username', 'role', 'status', 'latency_ms', 'last_login'],
    rows: [
      { id: 'usr-101', username: 'alex.chen@corp', role: 'DevOps Lead', status: 'ACTIVE', latency_ms: '1.2ms', last_login: '2 mins ago' },
      { id: 'usr-102', username: 'sarah.m@infra', role: 'Security SecOps', status: 'ACTIVE', latency_ms: '3.4ms', last_login: '12 mins ago' },
      { id: 'usr-103', username: 'cortex-agent-01', role: 'MCP Agent', status: 'STREAMING', latency_ms: '0.8ms', last_login: 'Just now' },
      { id: 'usr-104', username: 'db-replica-sync', role: 'DB Worker', status: 'STANDBY', latency_ms: '4.1ms', last_login: '1 hour ago' },
    ]
  });

  // Vault Secrets
  const [vaultSecrets, setVaultSecrets] = useState([
    { id: 'sec-1', name: 'PostgreSQL Prod Master', handle: '$CORTEX_HANDLE:rds_prod_master$', type: 'POSTGRES_PW', created_at: '2 hours ago', status: 'RAM_UNLOCKED' },
    { id: 'sec-2', name: 'Frankfurt Bastion SSH Key', handle: '$CORTEX_HANDLE:frankfurt_ssh$', type: 'SSH_PRIVATE_KEY', created_at: '1 day ago', status: 'RAM_UNLOCKED' },
    { id: 'sec-3', name: 'Tokyo Forward Proxy Auth', handle: '$CORTEX_HANDLE:tokyo_socks5$', type: 'SOCKS5_AUTH', created_at: '3 days ago', status: 'ENCRYPTED' },
  ]);

  // MCP JSON-RPC State
  const [mcpLog, setMcpLog] = useState<string[]>([
    '--> {"jsonrpc": "2.0", "method": "tools/list", "id": 1}',
    '<-- {"jsonrpc": "2.0", "result": {"tools": [{"name": "cortex_run_query", "description": "Execute zero-knowledge parameterized SQL over multi-hop pipeline"}, {"name": "cortex_check_health", "description": "Probe pipeline health and hop latencies"}, {"name": "cortex_dial_hop", "description": "Direct dial individual hop"}]}, "id": 1}',
  ]);
  const [mcpToolParams, setMcpToolParams] = useState('{\n  "chain_id": "chain-prod",\n  "query": "SELECT COUNT(*) FROM audit_logs;"\n}');
  const [mcpExecuting, setMcpExecuting] = useState(false);

  // User Authentication on mount
  useEffect(() => {
    const token = authToken || localStorage.getItem('cortex_token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : null)
      .then(user => {
        if (user) {
          setCurrentUser(user);
        } else {
          setCurrentUser({
            id: 'demo-admin-01',
            email: 'admin@cortex.internal',
            full_name: 'Lead Architect',
            role: 'ADMIN'
          });
        }
      })
      .catch(() => {
        setCurrentUser({
          id: 'demo-admin-01',
          email: 'admin@cortex.internal',
          full_name: 'Lead Architect',
          role: 'ADMIN'
        });
      });
    } else {
      setCurrentUser({
        id: 'demo-admin-01',
        email: 'admin@cortex.internal',
        full_name: 'Lead Architect',
        role: 'ADMIN'
      });
    }
  }, [authToken]);

  // WebSocket Live Latency Streaming
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWS = () => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/api/network/telemetry/ws`;
      
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          setWsConnected(true);
        };
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.hops && Array.isArray(data.hops)) {
              setMetrics((prev) => {
                const next = { ...prev };
                data.hops.forEach((h: HopMetric) => {
                  const arr = next[h.hop_id] || [];
                  next[h.hop_id] = [...arr.slice(-19), h];
                });
                return next;
              });
            }
          } catch (e) {
            // Ignore parse errors
          }
        };
        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimeout = setTimeout(connectWS, 3000);
        };
        ws.onerror = () => {
          setWsConnected(false);
        };
      } catch (e) {
        setWsConnected(false);
      }
    };

    connectWS();
    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
    const payload = authMode === 'login' 
      ? { email: authEmail, password: authPassword }
      : { email: authEmail, password: authPassword, full_name: authFullName, role: authRole };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication request failed');
      }

      setAuthToken(data.token);
      setCurrentUser(data.user);
      localStorage.setItem('cortex_token', data.token);
      setAuthModalOpen(false);
      setAuthPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Network error during authentication');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    localStorage.removeItem('cortex_token');
  };

  const handleCopyHandle = (handle: string) => {
    navigator.clipboard.writeText(handle);
    setCopiedHandle(handle);
    setTimeout(() => setCopiedHandle(null), 2000);
  };

  const handleRunSQL = () => {
    setQueryResult({
      columns: ['id', 'username', 'role', 'status', 'latency_ms', 'last_login'],
      rows: [
        { id: `usr-${Math.floor(Math.random()*900 + 100)}`, username: 'telemetry-streamer', role: 'Service Worker', status: 'ACTIVE', latency_ms: '0.4ms', last_login: 'Just now' },
        { id: 'usr-101', username: 'alex.chen@corp', role: 'DevOps Lead', status: 'ACTIVE', latency_ms: '1.2ms', last_login: '2 mins ago' },
        { id: 'usr-102', username: 'sarah.m@infra', role: 'Security SecOps', status: 'ACTIVE', latency_ms: '3.4ms', last_login: '12 mins ago' },
        { id: 'usr-103', username: 'cortex-agent-01', role: 'MCP Agent', status: 'STREAMING', latency_ms: '0.8ms', last_login: 'Just now' },
      ]
    });
  };

  const handleRunMCPTool = () => {
    setMcpExecuting(true);
    setMcpLog((prev) => [
      ...prev,
      `--> {"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "cortex_run_query", "arguments": ${mcpToolParams}}, "id": ${Date.now()}}`
    ]);

    setTimeout(() => {
      setMcpLog((prev) => [
        ...prev,
        `<-- {"jsonrpc": "2.0", "result": {"content": [{"type": "text", "text": "{\\"status\\": \\"SUCCESS\\", \\"rows_affected\\": 4, \\"pipeline_latency_ms\\": 1.4, \\"envelope_encrypted\\": true}"}]}, "id": ${Date.now()}}`
      ]);
      setMcpExecuting(false);
    }, 600);
  };

  const navTabs = [
    { id: 'network', label: 'Tunnels & Hops', icon: <Network className="w-4 h-4" />, badge: hops.length },
    { id: 'database', label: 'Databases', icon: <Database className="w-4 h-4" /> },
    { id: 'vault', label: 'ZK Vault', icon: <ShieldCheck className="w-4 h-4" />, badge: 'AES-GCM' },
    { id: 'mcp', label: 'MCP Server', icon: <Bot className="w-4 h-4" /> },
    { id: 'rbac', label: 'RBAC & Team', icon: <Users className="w-4 h-4" />, badge: currentUser?.role },
  ];

  return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden select-none font-sans">
      
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-neutral-200/80 px-6 flex items-center justify-between bg-white flex-shrink-0 z-30">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-xl bg-[#1c1b1f] flex items-center justify-center text-white shadow-xs">
              <Cpu className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-neutral-900 leading-none block">CORTEX</span>
              <span className="text-[9px] font-mono text-neutral-400 leading-none">ZERO-KNOWLEDGE SAAS</span>
            </div>
          </div>

          <Tabs
            tabs={navTabs}
            activeTab={activeTab}
            onChange={(tab) => setActiveTab(tab as any)}
          />
        </div>

        <div className="flex items-center space-x-3">
          {/* Live Telemetry Ping */}
          <div className="flex items-center space-x-2 bg-neutral-50 border border-neutral-200/70 px-3 py-1 rounded-xl text-xs">
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
            <span className="font-mono text-[11px] text-neutral-600">
              {wsConnected ? 'LIVE TELEMETRY' : 'STANDALONE MODE'}
            </span>
          </div>

          {/* User Account / Auth Modal Trigger */}
          {currentUser ? (
            <div className="flex items-center space-x-2 bg-neutral-50 border border-neutral-200/80 px-3 py-1 rounded-xl">
              <div className="flex flex-col text-right">
                <span className="text-xs font-bold text-neutral-900 leading-none">{currentUser.full_name}</span>
                <span className="text-[10px] font-mono text-neutral-500 leading-none mt-0.5">{currentUser.role}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Log Out"
                className="text-neutral-400 hover:text-rose-600 transition-colors p-1 rounded-lg cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              icon={<User className="w-3.5 h-3.5" />}
              onClick={() => { setAuthMode('login'); setAuthModalOpen(true); }}
            >
              Sign In
            </Button>
          )}
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
        
        {/* Metric Overview Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Tunnel Reliability Radial Gauge */}
          <Card hoverable className="flex flex-col justify-between p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-neutral-900">Zero-Knowledge Uptime</span>
              <Badge variant="online" dot pulse>99.98% SLA</Badge>
            </div>
            <Gauge percentage={99.8} label="99.8%" sublabel="Tunnel Reliability" />
          </Card>

          {/* Per-Hop Latency Spectrum */}
          <Card hoverable className="flex flex-col justify-between p-5">
            <LatencySpectrum avgLatency="1.8ms avg" />
          </Card>

          {/* Microkernel Architecture Card */}
          <Card dark hoverable className="flex flex-col justify-between p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>SURROGATE ENVELOPE</span>
              </div>
              <Badge variant="mcp_agent">ACTIVE</Badge>
            </div>
            <p className="text-xs text-neutral-300 font-mono my-2 leading-relaxed">
              Plaintext database passwords and private keys are never exposed. Replaced at runtime with surrogate handles.
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-[11px] font-mono text-neutral-400">
              <span>CIPHER: AES-256-GCM</span>
              <span className="text-emerald-400 font-bold">100% UNTOUCHED</span>
            </div>
          </Card>
        </div>

        {/* Tab 1: TUNNELS & HOPS EXTENSION */}
        {activeTab === 'network' && (
          <TunnelManager
            chains={chains}
            hops={hops}
            metrics={metrics}
            onAddHop={(newHop) => setHops([...hops, newHop])}
          />
        )}

        {/* Tab 2: DATABASES */}
        {activeTab === 'database' && (
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-neutral-900" />
                  <CardTitle>Zero-Knowledge SQL Explorer</CardTitle>
                </div>
                <Badge variant="purple">RDS Aurora PostgreSQL</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-neutral-500 font-medium">
                    <span>Target Connection: <code className="font-mono text-indigo-600 font-bold">pg-prod.c91f.rds.internal:5432</code></span>
                    <span>Surrogate Handle: <code className="font-mono text-emerald-600 font-bold">$CORTEX_HANDLE:rds_prod_master$</code></span>
                  </div>
                  <Textarea
                    mono
                    rows={3}
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />}
                    onClick={handleRunSQL}
                  >
                    Execute Query over Tunnel
                  </Button>
                </div>
              </CardContent>

              {/* Table Data View */}
              <div className="border-t border-neutral-100 overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-neutral-50 text-neutral-500 text-[11px] border-b border-neutral-100">
                    <tr>
                      {queryResult.columns.map((col: string) => (
                        <th key={col} className="px-5 py-3 font-semibold uppercase">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-700">
                    {queryResult.rows.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-5 py-3 font-bold text-neutral-900">{row.id}</td>
                        <td className="px-5 py-3 text-neutral-800">{row.username}</td>
                        <td className="px-5 py-3 text-neutral-600">{row.role}</td>
                        <td className="px-5 py-3">
                          <Badge variant={row.status === 'ACTIVE' ? 'online' : row.status === 'STREAMING' ? 'purple' : 'warning'}>
                            {row.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-emerald-600 font-bold">{row.latency_ms}</td>
                        <td className="px-5 py-3 text-neutral-400">{row.last_login}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Tab 3: ZK VAULT */}
        {activeTab === 'vault' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Zero-Knowledge Memory Vault</h3>
                <p className="text-xs text-neutral-500">Credentials stored exclusively in AES-256-GCM locked memory, accessed via opaque surrogate tokens.</p>
              </div>
              <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                Store Secret
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {vaultSecrets.map((sec) => (
                <Card key={sec.id} hoverable className="p-4 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h5 className="font-bold text-xs text-neutral-900">{sec.name}</h5>
                      <Badge variant="emerald">{sec.status}</Badge>
                    </div>
                    <div className="text-[11px] font-mono text-neutral-500">{sec.type}</div>
                  </div>

                  <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200/80 flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-emerald-700 truncate pr-2">
                      {sec.handle}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyHandle(sec.handle)}
                      title="Copy Surrogate Handle"
                      className="p-1 text-neutral-400 hover:text-neutral-800 transition-colors cursor-pointer"
                    >
                      {copiedHandle === sec.handle ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: MCP SERVER */}
        {activeTab === 'mcp' && (
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Bot className="w-4 h-4 text-neutral-900" />
                  <CardTitle>Model Context Protocol (MCP) Server</CardTitle>
                </div>
                <Badge variant="mcp_agent">JSON-RPC 2.0</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-[#1c1b1f] text-neutral-200 p-4 rounded-2xl font-mono text-xs border border-neutral-800 space-y-1.5 max-h-56 overflow-y-auto">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800 text-neutral-400 text-[11px]">
                    <span>MCP INTERFACE LOG</span>
                    <span>ENDPOINT: /api/mcp/sse</span>
                  </div>
                  {mcpLog.map((line, idx) => (
                    <div key={idx} className={line.startsWith('-->') ? 'text-sky-400' : 'text-emerald-400'}>
                      {line}
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-neutral-700">Tool Arguments (JSON):</label>
                  <Textarea
                    mono
                    rows={3}
                    value={mcpToolParams}
                    onChange={(e) => setMcpToolParams(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    loading={mcpExecuting}
                    icon={<Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />}
                    onClick={handleRunMCPTool}
                  >
                    Execute MCP Tool Call
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab 5: RBAC & TEAM */}
        {activeTab === 'rbac' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Role-Based Access Control (RBAC)</h3>
                <p className="text-xs text-neutral-500">Fine-grained permissions and cryptographic session verification for humans and AI agents.</p>
              </div>
              <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                Invite Member
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-neutral-50 text-neutral-500 text-[11px] border-b border-neutral-100">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Member</th>
                        <th className="px-5 py-3 font-semibold">Email</th>
                        <th className="px-5 py-3 font-semibold">Assigned Role</th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                        <th className="px-5 py-3 font-semibold text-right">Access Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-neutral-700">
                      {teamMembers.map((m) => (
                        <tr key={m.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-5 py-3 font-bold text-neutral-900">{m.full_name}</td>
                          <td className="px-5 py-3 text-neutral-500">{m.email}</td>
                          <td className="px-5 py-3">
                            <Badge variant={m.role.toLowerCase() as any}>
                              {m.role}
                            </Badge>
                          </td>
                          <td className="px-5 py-3">
                            <span className="flex items-center space-x-1 text-emerald-600 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>ACTIVE</span>
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right text-neutral-500">
                            {m.role === 'ADMIN' ? 'Full Cluster Admin' : m.role === 'ENGINEER' ? 'Tunnel & DB Exec' : m.role === 'MCP_AGENT' ? 'Automated Tool Calls' : 'Read-Only Audit'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      </main>

      {/* Auth Modal (Login & Signup) */}
      <Modal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        title={authMode === 'login' ? 'Sign in to Cortex' : 'Create Cortex Account'}
        description="Enter your credentials to access zero-knowledge tunnel orchestration."
      >
        <form onSubmit={handleAuthSubmit} className="space-y-3.5">
          {authError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {authMode === 'signup' && (
            <>
              <Input
                label="Full Name"
                required
                value={authFullName}
                onChange={(e) => setAuthFullName(e.target.value)}
                placeholder="Alex Chen"
              />
              <Select
                label="Initial Role"
                value={authRole}
                onChange={(e) => setAuthRole(e.target.value as any)}
              >
                <option value="ENGINEER">Engineer (Tunnels & DB Execution)</option>
                <option value="ADMIN">Admin (Full Control)</option>
                <option value="VIEWER">Viewer (Read-Only Metrics)</option>
                <option value="MCP_AGENT">MCP Agent (AI Tool Invocation)</option>
              </Select>
            </>
          )}

          <Input
            label="Email Address"
            type="email"
            required
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
            placeholder="name@company.com"
          />

          <Input
            label="Password"
            type="password"
            required
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            placeholder="••••••••••••"
          />

          <div className="pt-2">
            <Button
              type="submit"
              fullWidth
              size="md"
              loading={authLoading}
            >
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </div>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(null); }}
              className="text-xs text-neutral-600 hover:text-neutral-900 font-semibold cursor-pointer underline"
            >
              {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
