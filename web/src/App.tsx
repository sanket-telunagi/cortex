import React, { useState, useEffect } from 'react';
import { 
  Network, 
  Database, 
  Bot, 
  ShieldCheck, 
  Activity, 
  ArrowRight, 
  Search, 
  MoreVertical, 
  Menu, 
  X, 
  Play, 
  Server, 
  Zap, 
  KeyRound, 
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
  Globe
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

interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'ENGINEER' | 'VIEWER' | 'MCP_AGENT';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'network' | 'database' | 'vault' | 'mcp' | 'rbac'>('network');
  const [, setMetrics] = useState<Record<string, HopMetric[]>>({});
  const [, setCurrentMetrics] = useState<HopMetric[]>([]);
  const [chains] = useState<ChainConfig[]>([
    {
      id: 'chain-prod',
      name: 'Primary Production Pipeline',
      description: 'Zero-Knowledge multi-hop tunnel routing through edge proxy and SSH bastion.',
      hops: [
        { id: 'hop-1', name: 'Workstation Host', type: 'LOCAL_SOCKET', host: '127.0.0.1', port: 8080 },
        { id: 'hop-2', name: 'Frankfurt SSH Bastion', type: 'SSH_TUNNEL', host: 'bastion-eu-central.corp.internal', port: 22 },
        { id: 'hop-3', name: 'RDS Aurora PostgreSQL', type: 'DB_GATEWAY', host: 'pg-prod.c91f.rds.internal', port: 5432 }
      ],
      target_addr: 'pg-prod.c91f.rds.internal:5432'
    }
  ]);
  const [wsConnected, setWsConnected] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
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
  const [isQuerying, setIsQuerying] = useState(false);

  // Vault handles state
  const [vaultSecrets, setVaultSecrets] = useState([
    { id: 'sec-1', name: 'PROD_PG_PASSWORD', handle: '$CORTEX_HANDLE:prod_pg_password_9f2a$', real_value: 'pG_sEcReT_kEy_9941!', type: 'DB_CREDENTIAL', status: 'RAM_UNLOCKED' },
    { id: 'sec-2', name: 'AWS_PROD_ACCESS_KEY', handle: '$CORTEX_HANDLE:aws_prod_key_77b1$', real_value: 'AKIAIOSFODNN7EXAMPLE', type: 'API_KEY', status: 'ENCRYPTED_DISK' },
    { id: 'sec-3', name: 'BASTION_SSH_ED25519', handle: '$CORTEX_HANDLE:bastion_ssh_3c89$', real_value: 'ssh-ed25519 AAAAC3NzaC1yc2E...', type: 'SSH_PRIVATE_KEY', status: 'RAM_UNLOCKED' },
    { id: 'sec-4', name: 'KAFKA_SASL_TOKEN', handle: '$CORTEX_HANDLE:kafka_sasl_00d4$', real_value: 'eyJhGciOiJIUzI1NiIsInR5c...', type: 'SASL_TOKEN', status: 'RAM_UNLOCKED' },
  ]);
  const [revealSecrets, setRevealSecrets] = useState(false);

  // MCP Simulator State
  const [selectedMcpTool, setSelectedMcpTool] = useState('db_execute_query');
  const [mcpInputJson, setMcpInputJson] = useState(JSON.stringify({ sql: "SELECT * FROM tunnels WHERE status='ACTIVE';", connection_id: "conn-prod-pg" }, null, 2));
  const [mcpOutput, setMcpOutput] = useState<string | null>(null);
  const [mcpRunning, setMcpRunning] = useState(false);

  // Add Member Modal State
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'ADMIN' | 'ENGINEER' | 'VIEWER' | 'MCP_AGENT'>('ENGINEER');

  // Add Secret Modal State
  const [addSecretModalOpen, setAddSecretModalOpen] = useState(false);
  const [newSecretName, setNewSecretName] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
  const [newSecretType, setNewSecretType] = useState('DB_CREDENTIAL');

  // Validate session on start
  useEffect(() => {
    const token = localStorage.getItem('cortex_token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Invalid token');
      })
      .then(data => {
        setCurrentUser({
          id: data.user_id,
          email: data.email,
          full_name: data.full_name,
          role: data.role
        });
      })
      .catch(() => {
        localStorage.removeItem('cortex_token');
        setAuthToken(null);
        setCurrentUser({
          id: 'usr-admin-01',
          email: 'admin@cortex.internal',
          full_name: 'Admin User',
          role: 'ADMIN'
        });
      });
    } else {
      setCurrentUser({
        id: 'usr-admin-01',
        email: 'admin@cortex.internal',
        full_name: 'Admin User',
        role: 'ADMIN'
      });
    }
  }, []);

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

    ws.onerror = () => setWsConnected(false);
    ws.onclose = () => setWsConnected(false);

    return () => {
      ws.close();
    };
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

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
        throw new Error(data.error || 'Authentication failed');
      }

      localStorage.setItem('cortex_token', data.token);
      setAuthToken(data.token);
      setCurrentUser({
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.full_name,
        role: data.user.role
      });
      setAuthModalOpen(false);
      setAuthEmail('');
      setAuthPassword('');
      setAuthFullName('');
    } catch (err: any) {
      setAuthError(err.message || 'Authentication error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    if (authToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      }).catch(() => {});
    }
    localStorage.removeItem('cortex_token');
    setAuthToken(null);
    setCurrentUser(null);
    setAuthModalOpen(true);
  };

  const switchUserRole = (newRole: 'ADMIN' | 'ENGINEER' | 'VIEWER' | 'MCP_AGENT') => {
    if (currentUser) {
      setCurrentUser({ ...currentUser, role: newRole });
    }
  };

  const executeDbQuery = async () => {
    if (currentUser?.role === 'VIEWER') {
      alert('RBAC Notice: Viewers have read-only cached access. Admin/Engineer authorization required to execute ad-hoc SQL.');
      return;
    }
    setIsQuerying(true);
    try {
      const res = await fetch('/api/db/query', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ connection_id: 'conn-prod-pg', sql: sqlQuery })
      });
      if (res.ok) {
        const data = await res.json();
        setQueryResult(data);
      } else {
        // Fallback mock simulation for table viewing
        setQueryResult({
          columns: ['id', 'metric_name', 'node_ip', 'status', 'latency_ms', 'scanned_at'],
          rows: [
            { id: '1', metric_name: 'bastion_handshake', node_ip: '10.0.4.12', status: 'SUCCESS', latency_ms: '1.4ms', scanned_at: '2026-09-23 17:20:01' },
            { id: '2', metric_name: 'pg_tls_verify', node_ip: '10.0.8.99', status: 'VERIFIED', latency_ms: '0.9ms', scanned_at: '2026-09-23 17:20:02' },
            { id: '3', metric_name: 'zk_token_unwrap', node_ip: '127.0.0.1', status: 'IN_RAM', latency_ms: '0.1ms', scanned_at: '2026-09-23 17:20:03' }
          ]
        });
      }
    } catch {
      setQueryResult({
        columns: ['id', 'metric_name', 'node_ip', 'status', 'latency_ms', 'scanned_at'],
        rows: [
          { id: '1', metric_name: 'bastion_handshake', node_ip: '10.0.4.12', status: 'SUCCESS', latency_ms: '1.4ms', scanned_at: '2026-09-23 17:20:01' },
          { id: '2', metric_name: 'pg_tls_verify', node_ip: '10.0.8.99', status: 'VERIFIED', latency_ms: '0.9ms', scanned_at: '2026-09-23 17:20:02' }
        ]
      });
    } finally {
      setIsQuerying(false);
    }
  };

  const executeMcpSimulator = () => {
    setMcpRunning(true);
    setMcpOutput(null);
    setTimeout(() => {
      setMcpRunning(false);
      if (selectedMcpTool === 'db_execute_query') {
        setMcpOutput(JSON.stringify({
          jsonrpc: "2.0",
          result: {
            status: "success",
            connection: "conn-prod-pg",
            scubbed_columns: ["password", "salt"],
            rows_affected: 4,
            latency_ms: 1.2
          },
          id: "mcp-req-8831"
        }, null, 2));
      } else if (selectedMcpTool === 'vault_list_handles') {
        setMcpOutput(JSON.stringify({
          jsonrpc: "2.0",
          result: {
            handles: vaultSecrets.map(s => ({ name: s.name, handle: s.handle, type: s.type }))
          },
          id: "mcp-req-8832"
        }, null, 2));
      } else {
        setMcpOutput(JSON.stringify({
          jsonrpc: "2.0",
          result: {
            route: ["127.0.0.1", "bastion-eu-central.corp.internal:22", "pg-prod.c91f.rds.internal:5432"],
            total_rtt_ms: 13.8,
            hop_status: "HEALTHY"
          },
          id: "mcp-req-8833"
        }, null, 2));
      }
    }, 600);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHandle(text);
    setTimeout(() => setCopiedHandle(null), 2000);
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName || !newMemberEmail) return;
    const newMember: AuthUser = {
      id: `usr-${Date.now().toString().slice(-4)}`,
      full_name: newMemberName,
      email: newMemberEmail,
      role: newMemberRole
    };
    setTeamMembers([...teamMembers, newMember]);
    setNewMemberName('');
    setNewMemberEmail('');
    setAddMemberModalOpen(false);
  };

  const handleAddSecret = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecretName || !newSecretValue) return;
    const randomHex = Math.random().toString(16).substring(2, 6);
    const newSec = {
      id: `sec-${Date.now().toString().slice(-4)}`,
      name: newSecretName.toUpperCase().replace(/\s+/g, '_'),
      handle: `$CORTEX_HANDLE:${newSecretName.toLowerCase().replace(/\s+/g, '_')}_${randomHex}$`,
      real_value: newSecretValue,
      type: newSecretType,
      status: 'RAM_UNLOCKED'
    };
    setVaultSecrets([...vaultSecrets, newSec]);
    setNewSecretName('');
    setNewSecretValue('');
    setAddSecretModalOpen(false);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <span className="bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full text-[10px] font-bold">ADMIN</span>;
      case 'ENGINEER':
        return <span className="bg-sky-100 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full text-[10px] font-bold">ENGINEER</span>;
      case 'VIEWER':
        return <span className="bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">VIEWER</span>;
      case 'MCP_AGENT':
        return <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">MCP AGENT</span>;
      default:
        return <span className="bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-full text-[10px] font-bold">{role}</span>;
    }
  };

  return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden relative select-none">
      {/* Top Action Navigation Bar */}
      <header className="px-6 py-3.5 flex items-center justify-between gap-4 border-b border-neutral-100 bg-white z-20 flex-shrink-0">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2.5">
            <span className="text-xl font-extrabold tracking-tight text-neutral-900 flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-neutral-900 inline-block"></span>
              cortex
            </span>
            <span className="text-[10px] font-semibold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full border border-neutral-200 font-mono">
              v0.1.0 • 0.0.0.0
            </span>
          </div>
          
          {/* Search Bar */}
          <div className="relative w-64 md:w-80">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tunnels, hops, databases, tokens..." 
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 rounded-full border border-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-400 placeholder-neutral-400 text-neutral-700"
            />
          </div>
        </div>

        {/* Action Navigation Tabs */}
        <div className="flex items-center space-x-1.5 md:space-x-2">
          <button 
            type="button"
            onClick={() => setActiveTab('network')}
            className={`flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors ${activeTab === 'network' ? 'bg-neutral-100 text-neutral-900 font-semibold shadow-sm' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'}`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Tunnels</span>
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab('database')}
            className={`flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors ${activeTab === 'database' ? 'bg-neutral-100 text-neutral-900 font-semibold shadow-sm' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'}`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Databases</span>
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab('vault')}
            className={`flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors ${activeTab === 'vault' ? 'bg-neutral-100 text-neutral-900 font-semibold shadow-sm' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'}`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>ZK Vault</span>
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab('mcp')}
            className={`flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors ${activeTab === 'mcp' ? 'bg-neutral-100 text-neutral-900 font-semibold shadow-sm' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'}`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>MCP Server</span>
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab('rbac')}
            className={`flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors ${activeTab === 'rbac' ? 'bg-neutral-100 text-neutral-900 font-semibold shadow-sm' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'}`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>RBAC & Team</span>
          </button>

          {/* User Account / Auth Trigger */}
          {currentUser ? (
            <div className="flex items-center space-x-2 pl-2 border-l border-neutral-200">
              <div className="flex items-center space-x-1.5 bg-neutral-50 px-2.5 py-1 rounded-xl border border-neutral-200/80">
                <User className="w-3.5 h-3.5 text-neutral-600" />
                <span className="text-xs font-semibold text-neutral-800">{currentUser.full_name}</span>
                {getRoleBadge(currentUser.role)}
              </div>
              <button 
                type="button"
                onClick={handleLogout}
                title="Sign Out"
                className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-neutral-100 rounded-lg transition-colors"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button 
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="flex items-center space-x-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-sm transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}

          <button 
            type="button" 
            onClick={() => setDrawerOpen(true)}
            className="p-2 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors"
            aria-label="Open System Drawer"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Scrollable View Area */}
      <main className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-white">
        
        {/* Top Overview KPI Banner Strip */}
        <section className="rounded-2xl p-5 border shadow-sm bg-neutral-50/60 border-neutral-100">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
            
            {/* Column 1: Live Latency Spectrum Bar Chart */}
            <div className="flex flex-col justify-between h-28 pr-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-neutral-900">Per-Hop Latency Spectrum</span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  1.8ms avg
                </span>
              </div>
              <div className="flex items-end space-x-2 h-20 text-[9px] text-neutral-500 font-medium">
                <div className="flex flex-col justify-between h-14 pb-4 pr-1 text-right text-[8px] text-neutral-400 select-none">
                  <span>20ms</span>
                  <span>10ms</span>
                  <span>0ms</span>
                </div>
                {/* Direct */}
                <div className="flex flex-col items-center flex-1">
                  <div className="flex space-x-1 items-end h-14">
                    <div className="w-2.5 h-6 bg-[#c4b5fd] rounded-sm"></div>
                    <div className="w-2.5 h-10 bg-[#8b5cf6] rounded-sm shadow-sm"></div>
                  </div>
                  <span className="mt-1.5 text-[9px] font-semibold text-purple-700">Direct</span>
                </div>
                {/* Proxy */}
                <div className="flex flex-col items-center flex-1">
                  <div className="flex space-x-1 items-end h-14">
                    <div className="w-2.5 h-5 bg-[#7dd3fc] rounded-sm"></div>
                    <div className="w-2.5 h-12 bg-[#0284c7] rounded-sm shadow-sm"></div>
                  </div>
                  <span className="mt-1.5 text-[9px] font-semibold text-sky-700">Proxy</span>
                </div>
                {/* SSH */}
                <div className="flex flex-col items-center flex-1">
                  <div className="flex space-x-1 items-end h-14">
                    <div className="w-2.5 h-7 bg-[#6ee7b7] rounded-sm"></div>
                    <div className="w-2.5 h-11 bg-[#10b981] rounded-sm shadow-sm"></div>
                  </div>
                  <span className="mt-1.5 text-[9px] font-semibold text-emerald-700">SSH</span>
                </div>
                {/* DB */}
                <div className="flex flex-col items-center flex-1">
                  <div className="flex space-x-1 items-end h-14">
                    <div className="w-2.5 h-6 bg-[#fde68a] rounded-sm"></div>
                    <div className="w-2.5 h-8 bg-[#f59e0b] rounded-sm shadow-sm"></div>
                  </div>
                  <span className="mt-1.5 text-[9px] font-semibold text-amber-700">DB</span>
                </div>
                {/* MCP */}
                <div className="flex flex-col items-center flex-1">
                  <div className="flex space-x-1 items-end h-14">
                    <div className="w-2.5 h-9 bg-[#fca5a5] rounded-sm"></div>
                    <div className="w-2.5 h-12 bg-[#ef4444] rounded-sm shadow-sm"></div>
                  </div>
                  <span className="mt-1.5 text-[9px] font-semibold text-rose-700">MCP</span>
                </div>
              </div>
            </div>

            {/* Column 2: Rainbow Arc Gauge */}
            <div className="flex flex-col items-center justify-end relative h-28 select-none">
              <div className="relative w-48 h-24 flex items-end justify-center">
                <svg className="w-48 h-24 absolute inset-0 overflow-visible" viewBox="0 0 200 105">
                  <defs>
                    <linearGradient id="rainbow-wheel" x1="0%" x2="100%" y1="100%" y2="100%">
                      <stop offset="0%" stopColor="#ef4444"></stop>
                      <stop offset="25%" stopColor="#f59e0b"></stop>
                      <stop offset="50%" stopColor="#10b981"></stop>
                      <stop offset="75%" stopColor="#06b6d4"></stop>
                      <stop offset="100%" stopColor="#8b5cf6"></stop>
                    </linearGradient>
                  </defs>
                  <path d="M 18 100 A 82 82 0 0 1 182 100" fill="none" stroke="#f1f0e9" strokeDasharray="1.5 3" strokeLinecap="butt" strokeWidth="12"></path>
                  <path d="M 18 100 A 82 82 0 0 1 182 100" fill="none" pathLength="100" stroke="url(#rainbow-wheel)" strokeDasharray="1.5 3" strokeDashoffset="12" strokeLinecap="butt" strokeWidth="12"></path>
                </svg>
                <div className="flex flex-col items-center justify-end text-center z-10 pb-1">
                  <span className="text-3xl font-extrabold text-neutral-900 tracking-tight leading-none mb-1">99.8%</span>
                  <div className="flex items-center space-x-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Tunnel Reliability</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: Active Hops KPI */}
            <div className="flex flex-col justify-between h-28 p-3.5 rounded-xl bg-[#f0f9ff] border border-[#bae6fd]">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-extrabold text-sky-950">
                  {chains.reduce((acc, c) => acc + (c.hops?.length || 0), 3)}
                </span>
                <span className="text-[10px] font-bold bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">
                  {wsConnected ? 'WSS Streaming' : 'Polling'}
                </span>
              </div>
              <div className="flex items-center justify-between group cursor-pointer pt-2" onClick={() => setActiveTab('network')}>
                <span className="text-xs text-sky-900 font-semibold leading-tight">
                  Active Tunnels<br />in Pipeline
                </span>
                <div className="w-7 h-7 rounded-full bg-sky-600 flex items-center justify-center text-white group-hover:translate-x-1 shadow-sm transition-transform">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Column 4: RBAC Role KPI */}
            <div className="flex flex-col justify-between h-28 p-3.5 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0]">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-extrabold text-emerald-950">
                  {currentUser?.role || 'ADMIN'}
                </span>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                  RBAC Active
                </span>
              </div>
              <div className="flex items-center justify-between group cursor-pointer pt-2" onClick={() => setActiveTab('rbac')}>
                <span className="text-xs text-emerald-900 font-semibold leading-tight">
                  Manage Roles<br />& Access Control
                </span>
                <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white group-hover:translate-x-1 shadow-sm transition-transform">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* TAB 1: NETWORK TUNNELS PIPELINE */}
        {activeTab === 'network' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            
            {/* Column 1: Direct Edge Dials */}
            <div className="flex flex-col space-y-3">
              <div className="flex items-center justify-between px-1 py-1">
                <h4 className="font-bold text-neutral-900 text-sm">Direct Edge Dials</h4>
                <div className="flex items-center space-x-1 text-xs font-semibold text-neutral-600 bg-neutral-100 border border-neutral-200/70 rounded-lg px-2 py-0.5">
                  <span>4 Hops</span>
                </div>
              </div>

              {/* Card 1: Local Loopback */}
              <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-bold text-xs text-neutral-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Workstation Host
                  </h5>
                  <span className="text-[10px] font-mono text-neutral-400">127.0.0.1</span>
                </div>
                <p className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed mb-4">
                  Ultra-low latency kernel socket listener on 0.0.0.0:8080 with auto-port fallback.
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-[10px] text-neutral-500 font-mono">
                  <div className="flex items-center space-x-1.5 bg-neutral-50 px-2 py-1 rounded-md border border-neutral-200/60 font-medium">
                    <Zap className="w-3 h-3 text-emerald-600" />
                    <span>0.24ms</span>
                  </div>
                  <span className="text-neutral-400">RTT Avg</span>
                </div>
              </div>

              {/* Card 2: Microkernel RPC */}
              <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-bold text-xs text-neutral-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Internal Event Bus
                  </h5>
                  <span className="text-[10px] font-mono text-neutral-400">in-memory</span>
                </div>
                <p className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed mb-4">
                  Lock-free Go channels multiplexing real-time telemetry ticks to browser clients.
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-[10px] text-neutral-500 font-mono">
                  <div className="flex items-center space-x-1.5 bg-neutral-50 px-2 py-1 rounded-md border border-neutral-200/60 font-medium">
                    <Zap className="w-3 h-3 text-emerald-600" />
                    <span>0.01ms</span>
                  </div>
                  <span className="text-neutral-400">60 FPS</span>
                </div>
              </div>
            </div>

            {/* Column 2: SSH Bastions */}
            <div className="flex flex-col space-y-3">
              <div className="flex items-center justify-between px-1 py-1">
                <h4 className="font-bold text-neutral-900 text-sm">SSH Bastions</h4>
                <div className="flex items-center space-x-1 text-xs font-semibold text-neutral-600 bg-neutral-100 border border-neutral-200/70 rounded-lg px-2 py-0.5">
                  <span>2 Active</span>
                </div>
              </div>

              {/* Card 1: Frankfurt Bastion */}
              <div className="bg-[#1c1b1f] text-white p-4 rounded-2xl shadow-lg relative border border-neutral-800">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-bold text-xs text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Frankfurt SSH Bastion
                  </h5>
                  <span className="text-[10px] font-mono text-neutral-400">:22</span>
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed mb-3">
                  Multi-hop proxy gateway routing through internal VPC with surrogate token authentication.
                </p>
                
                <div className="space-y-1.5 mb-3 text-[10px] text-neutral-400 font-mono">
                  <div className="flex items-center space-x-1.5 truncate">
                    <Server className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                    <span className="truncate">bastion-eu-central.corp.internal</span>
                  </div>
                  <div className="flex items-center space-x-1.5 truncate">
                    <KeyRound className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    <span className="truncate text-emerald-300">$CORTEX_HANDLE:bastion_ssh_3c89$</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-[10px] text-neutral-400 font-mono">
                  <div className="flex items-center space-x-1.5 bg-neutral-800/80 px-2 py-0.5 rounded-md border border-neutral-700/60 font-medium text-neutral-300">
                    <Zap className="w-3 h-3 text-emerald-400" />
                    <span>12.4ms</span>
                  </div>
                  <span className="text-neutral-400">VPC-Hop 2</span>
                </div>
              </div>

              {/* Card 2: Virginia Proxy */}
              <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-bold text-xs text-neutral-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    US-East SOCKS5 Proxy
                  </h5>
                  <span className="text-[10px] font-mono text-neutral-400">:1080</span>
                </div>
                <p className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed mb-4">
                  Encrypted forward proxy routing outbound database connections across US regions.
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-[10px] text-neutral-500 font-mono">
                  <div className="flex items-center space-x-1.5 bg-neutral-50 px-2 py-1 rounded-md border border-neutral-200/60 font-medium">
                    <Zap className="w-3 h-3 text-sky-600" />
                    <span>24.8ms</span>
                  </div>
                  <span className="text-neutral-400">SOCKS5</span>
                </div>
              </div>
            </div>

            {/* Column 3: Database Endpoints */}
            <div className="flex flex-col space-y-3">
              <div className="flex items-center justify-between px-1 py-1">
                <h4 className="font-bold text-neutral-900 text-sm">Database Endpoints</h4>
                <div className="flex items-center space-x-1 text-xs font-semibold text-neutral-600 bg-neutral-100 border border-neutral-200/70 rounded-lg px-2 py-0.5">
                  <span>2 Connections</span>
                </div>
              </div>

              {/* Card 1: Postgres Aurora */}
              <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-bold text-xs text-neutral-900 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-indigo-600" />
                    RDS Aurora PostgreSQL
                  </h5>
                  <span className="text-[10px] font-mono text-neutral-400">:5432</span>
                </div>
                <p className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed mb-4">
                  Production relational cluster with live table inspection and egress query scrubbing.
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-[10px] text-neutral-500 font-mono">
                  <div className="flex items-center space-x-1.5 bg-neutral-50 px-2 py-1 rounded-md border border-neutral-200/60 font-medium">
                    <span className="text-emerald-700 font-bold">CONNECTED</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setActiveTab('database')}
                    className="text-neutral-600 hover:text-neutral-900 text-[10px] font-semibold underline"
                  >
                    Open SQL →
                  </button>
                </div>
              </div>

              {/* Card 2: ClickHouse */}
              <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-bold text-xs text-neutral-900 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-amber-600" />
                    ClickHouse Metrics DB
                  </h5>
                  <span className="text-[10px] font-mono text-neutral-400">:9000</span>
                </div>
                <p className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed mb-4">
                  High-throughput columnar store for telemetry ticks, request logs, and trace telemetry.
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-[10px] text-neutral-500 font-mono">
                  <div className="flex items-center space-x-1.5 bg-neutral-50 px-2 py-1 rounded-md border border-neutral-200/60 font-medium">
                    <span className="text-neutral-500">STANDBY</span>
                  </div>
                  <span className="text-neutral-400">1.1ms</span>
                </div>
              </div>
            </div>

            {/* Column 4: MCP AI Connectors */}
            <div className="flex flex-col space-y-3">
              <div className="flex items-center justify-between px-1 py-1">
                <h4 className="font-bold text-neutral-900 text-sm">MCP AI Connectors</h4>
                <div className="flex items-center space-x-1 text-xs font-semibold text-neutral-600 bg-neutral-100 border border-neutral-200/70 rounded-lg px-2 py-0.5">
                  <span>3 Tools</span>
                </div>
              </div>

              {/* Card 1: Tool db_query */}
              <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-bold text-xs text-neutral-900 flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-purple-600" />
                    db_execute_query
                  </h5>
                  <span className="text-[9px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-mono font-semibold">MCP</span>
                </div>
                <p className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed mb-4">
                  Allows Cursor/Zed/Claude agents to run read-only queries with automatic error scrubbing.
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-[10px] text-neutral-500 font-mono">
                  <span className="text-purple-600 font-semibold">Surrogate Safe</span>
                  <span className="text-neutral-400">JSON-RPC</span>
                </div>
              </div>

              {/* Card 2: Tool vault_metadata */}
              <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-bold text-xs text-neutral-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    vault_list_handles
                  </h5>
                  <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono font-semibold">MCP</span>
                </div>
                <p className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed mb-4">
                  Provides LLMs with handles only ($CORTEX_HANDLE:*) so passwords never leak to context.
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-[10px] text-neutral-500 font-mono">
                  <span className="text-emerald-600 font-semibold">Leak-Proof</span>
                  <span className="text-neutral-400">Zero-Knowl.</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: RBAC & TEAM MANAGEMENT */}
        {activeTab === 'rbac' && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900">Role-Based Access Control (RBAC) & Team</h4>
                  <p className="text-[11px] text-neutral-500">
                    Granular permissions across Multi-Hop Tunnels, Database Queries, Ephemeral Keys, and MCP Agents.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-neutral-500 font-medium">Active User Simulation:</span>
                <select 
                  value={currentUser?.role || 'ADMIN'} 
                  onChange={(e) => switchUserRole(e.target.value as any)}
                  className="text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-1.5 font-semibold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                >
                  <option value="ADMIN">Role: ADMIN (Full Control)</option>
                  <option value="ENGINEER">Role: ENGINEER (Tunnels + DB Read/Write)</option>
                  <option value="VIEWER">Role: VIEWER (Read-Only Telemetry)</option>
                  <option value="MCP_AGENT">Role: MCP_AGENT (Scoped Surrogate)</option>
                </select>
              </div>
            </div>

            {/* Team Members List */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800">Team Identities & Access Roles</span>
                <button 
                  type="button"
                  onClick={() => setAddMemberModalOpen(true)}
                  className="text-xs bg-neutral-900 hover:bg-neutral-800 text-white px-3 py-1.5 rounded-xl font-semibold transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Team Member</span>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-neutral-50 text-neutral-500 text-[11px] border-b border-neutral-100">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Member</th>
                      <th className="px-5 py-3 font-semibold">Assigned Role</th>
                      <th className="px-5 py-3 font-semibold">Tunnels & Bastions</th>
                      <th className="px-5 py-3 font-semibold">Database Queries</th>
                      <th className="px-5 py-3 font-semibold">Zero-Knowledge Vault</th>
                      <th className="px-5 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-700">
                    {teamMembers.map((member) => (
                      <tr key={member.id} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="px-5 py-3 font-sans">
                          <div className="font-bold text-neutral-900">{member.full_name}</div>
                          <div className="text-[11px] text-neutral-400 font-mono">{member.email}</div>
                        </td>
                        <td className="px-5 py-3">
                          {getRoleBadge(member.role)}
                        </td>
                        <td className="px-5 py-3">
                          <span className={member.role === 'VIEWER' ? 'text-neutral-400' : 'text-emerald-600 font-semibold'}>
                            {member.role === 'VIEWER' ? 'Read-Only' : 'Create & Dial'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={member.role === 'VIEWER' ? 'text-amber-600' : 'text-emerald-600 font-semibold'}>
                            {member.role === 'VIEWER' ? 'Restricted' : 'Read/Write SQL'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={member.role === 'ADMIN' ? 'text-purple-600 font-bold' : 'text-neutral-600'}>
                            {member.role === 'ADMIN' ? 'Full Decrypt' : 'Surrogate Handles'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button type="button" className="text-neutral-400 hover:text-neutral-700 p-1" aria-label="Member options">
                            <MoreVertical className="w-4 h-4 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DATABASE EXPLORER */}
        {activeTab === 'database' && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-neutral-800" />
                  <span className="text-sm font-bold text-neutral-900">Interactive SQL Explorer</span>
                  <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                    Connected: RDS Aurora (Over SSH Bastion)
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <select 
                    value={selectedDbTable}
                    onChange={(e) => {
                      setSelectedDbTable(e.target.value);
                      setSqlQuery(`SELECT * FROM ${e.target.value} LIMIT 10;`);
                    }}
                    className="text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-1.5 font-semibold text-neutral-700 focus:outline-none"
                  >
                    <option value="connections">Table: connections</option>
                    <option value="tunnels">Table: tunnels</option>
                    <option value="audit_logs">Table: audit_logs</option>
                    <option value="vault_keys">Table: vault_keys</option>
                  </select>
                  <button 
                    type="button"
                    onClick={executeDbQuery}
                    disabled={isQuerying}
                    className="flex items-center space-x-1.5 bg-[#1c1b1f] hover:bg-neutral-800 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm transition-colors disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{isQuerying ? 'Executing...' : 'Run Query'}</span>
                  </button>
                </div>
              </div>

              <div className="relative font-mono text-xs">
                <textarea 
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  rows={3}
                  className="w-full p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-400 font-mono text-xs resize-none"
                />
              </div>
            </div>

            {/* Query Results Grid */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800">Query Results ({queryResult.rows?.length || 0} rows)</span>
                <span className="text-[10px] font-mono text-neutral-400">Execution time: 1.4ms</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-neutral-50 text-neutral-500 text-[11px] border-b border-neutral-100">
                    <tr>
                      {queryResult.columns?.map((col: string, idx: number) => (
                        <th key={idx} className="px-5 py-3 font-semibold">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-700">
                    {queryResult.rows?.map((row: any, rIdx: number) => (
                      <tr key={rIdx} className="hover:bg-neutral-50/80 transition-colors">
                        {queryResult.columns?.map((col: string, cIdx: number) => (
                          <td key={cIdx} className="px-5 py-3">
                            {col === 'status' ? (
                              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                {row[col]}
                              </span>
                            ) : (
                              row[col]
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ZERO-KNOWLEDGE VAULT */}
        {activeTab === 'vault' && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h4 className="text-sm font-bold text-neutral-900">Zero-Knowledge Secrets & Environment Vault</h4>
                    <p className="text-[11px] text-neutral-500">
                      Real passwords and private keys are never exposed to AI models or persistent logs. Models receive surrogate handles only.
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {currentUser?.role === 'ADMIN' && (
                    <button 
                      type="button"
                      onClick={() => setRevealSecrets(!revealSecrets)}
                      className="text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-800 px-3 py-2 rounded-xl font-semibold transition-colors"
                    >
                      {revealSecrets ? 'Hide Real Values' : 'Admin Reveal Decrypted'}
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => setAddSecretModalOpen(true)}
                    className="flex items-center space-x-1 bg-[#1c1b1f] hover:bg-neutral-800 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Secret</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-neutral-50 text-neutral-500 text-[11px] border-b border-neutral-100">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Variable / Name</th>
                      <th className="px-5 py-3 font-semibold">Surrogate Handle (LLM Context)</th>
                      {revealSecrets && <th className="px-5 py-3 font-semibold text-purple-700">Decrypted Plaintext (Admin)</th>}
                      <th className="px-5 py-3 font-semibold">Type</th>
                      <th className="px-5 py-3 font-semibold">Memory State</th>
                      <th className="px-5 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-700">
                    {vaultSecrets.map((sec) => (
                      <tr key={sec.id} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="px-5 py-3 font-bold text-neutral-900">{sec.name}</td>
                        <td className="px-5 py-3 text-emerald-600 font-semibold">
                          <div className="flex items-center space-x-2">
                            <span>{sec.handle}</span>
                            <button 
                              type="button"
                              onClick={() => copyToClipboard(sec.handle)}
                              className="text-neutral-400 hover:text-neutral-700 p-0.5"
                              title="Copy Handle"
                            >
                              {copiedHandle === sec.handle ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                        {revealSecrets && (
                          <td className="px-5 py-3 font-mono text-purple-700 font-bold bg-purple-50/50">
                            {sec.real_value}
                          </td>
                        )}
                        <td className="px-5 py-3 text-neutral-500">{sec.type}</td>
                        <td className="px-5 py-3">
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            {sec.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button type="button" className="text-neutral-400 hover:text-neutral-700 p-1" aria-label="Secret options">
                            <MoreVertical className="w-4 h-4 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: MODEL CONTEXT PROTOCOL (MCP) */}
        {activeTab === 'mcp' && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900">Model Context Protocol (MCP) Server</h4>
                  <p className="text-[11px] text-neutral-500 font-mono">
                    Endpoint: ws://0.0.0.0:8080/mcp • Claude Desktop / Cursor / Zed Compatible
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-semibold">
                  JSON-RPC 2.0 Active
                </span>
              </div>
            </div>

            {/* MCP Interactive Tool Simulator */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-900">Tool Simulator & Call Tester</span>
                  <select 
                    value={selectedMcpTool} 
                    onChange={(e) => {
                      setSelectedMcpTool(e.target.value);
                      if (e.target.value === 'db_execute_query') {
                        setMcpInputJson(JSON.stringify({ sql: "SELECT * FROM tunnels WHERE status='ACTIVE';", connection_id: "conn-prod-pg" }, null, 2));
                      } else if (e.target.value === 'vault_list_handles') {
                        setMcpInputJson(JSON.stringify({ scope: "ALL_ACTIVE" }, null, 2));
                      } else {
                        setMcpInputJson(JSON.stringify({ chain_id: "chain-prod", timeout_ms: 5000 }, null, 2));
                      }
                    }}
                    className="text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-1 font-semibold text-neutral-700"
                  >
                    <option value="db_execute_query">Tool: db_execute_query</option>
                    <option value="vault_list_handles">Tool: vault_list_handles</option>
                    <option value="tunnel_route_hop">Tool: tunnel_route_hop</option>
                  </select>
                </div>

                <div className="font-mono text-xs">
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Tool Input Payload (JSON-RPC args):</label>
                  <textarea 
                    value={mcpInputJson}
                    onChange={(e) => setMcpInputJson(e.target.value)}
                    rows={6}
                    className="w-full p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-800 font-mono text-xs resize-none focus:outline-none focus:ring-1 focus:ring-neutral-400"
                  />
                </div>

                <button 
                  type="button"
                  onClick={executeMcpSimulator}
                  disabled={mcpRunning}
                  className="w-full bg-[#1c1b1f] hover:bg-neutral-800 text-white font-semibold text-xs py-2 rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{mcpRunning ? 'Simulating Agent Call...' : 'Execute Tool Call'}</span>
                </button>
              </div>

              {/* MCP Tool Output Stream */}
              <div className="bg-[#1c1b1f] p-5 rounded-2xl border border-neutral-800 shadow-sm text-neutral-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                    <div className="flex items-center space-x-2">
                      <Terminal className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white font-mono">Agent Response Payload</span>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400">Status: 200 OK</span>
                  </div>
                  <pre className="mt-3 p-3 bg-neutral-900/80 rounded-xl text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-56">
                    {mcpOutput || "// Click 'Execute Tool Call' to simulate an LLM agent RPC interaction."}
                  </pre>
                </div>
                <div className="pt-3 border-t border-neutral-800 flex items-center justify-between text-[10px] font-mono text-neutral-400">
                  <span>Transport: WebSocket Frame</span>
                  <span className="text-emerald-400">Zero-Knowledge Surrogate: Active</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* SYSTEM SLIDE-OUT DRAWER */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-neutral-900/40 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white h-full shadow-2xl p-6 flex flex-col justify-between border-l border-neutral-200 animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-neutral-100 mb-5">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-neutral-900" />
                  <span className="font-bold text-sm text-neutral-900">System Telemetry & Nodes</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="text-neutral-400 hover:text-neutral-700 p-1"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 font-mono text-xs text-neutral-700">
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80">
                  <div className="text-[10px] text-neutral-400 font-sans font-semibold">Microkernel Runtime</div>
                  <div className="font-bold text-neutral-900 mt-0.5">Go 1.24 Microkernel (Non-blocking I/O)</div>
                </div>

                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80">
                  <div className="text-[10px] text-neutral-400 font-sans font-semibold">Memory Allocation</div>
                  <div className="font-bold text-emerald-600 mt-0.5">14.2 MB / RAM Locked</div>
                </div>

                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80">
                  <div className="text-[10px] text-neutral-400 font-sans font-semibold">Surrogate Token Broker</div>
                  <div className="font-bold text-neutral-900 mt-0.5">Argon2id + AES-256-GCM Envelope</div>
                </div>

                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80">
                  <div className="text-[10px] text-neutral-400 font-sans font-semibold">Active Listening Sockets</div>
                  <div className="font-bold text-neutral-900 mt-0.5">0.0.0.0:8080 (HTTP / WS / MCP)</div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500 font-mono">
              <span>Cortex Studio Engine</span>
              <span className="text-emerald-600 font-bold">ONLINE</span>
            </div>
          </div>
        </div>
      )}

      {/* AUTHENTICATION MODAL */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl border border-neutral-200 shadow-2xl p-6 relative">
            <button 
              type="button"
              onClick={() => setAuthModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700"
              aria-label="Close authentication modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <div className="flex items-center space-x-2 mb-2">
                <span className="h-3 w-3 rounded-full bg-neutral-900"></span>
                <span className="text-lg font-extrabold text-neutral-900">cortex studio</span>
              </div>
              <h3 className="text-base font-bold text-neutral-900">
                {authMode === 'login' ? 'Sign in to your account' : 'Create new account'}
              </h3>
              <p className="text-xs text-neutral-500">
                {authMode === 'login' 
                  ? 'Enter your credentials to access tunnels, databases & vault' 
                  : 'Register a new identity and assign an RBAC access level'}
              </p>
            </div>

            {authError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center space-x-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      required
                      value={authFullName}
                      onChange={(e) => setAuthFullName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-50 rounded-xl border border-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-400 text-neutral-800"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="email" 
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="user@corp.internal"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-50 rounded-xl border border-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-400 text-neutral-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="password" 
                    required
                    minLength={8}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-50 rounded-xl border border-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-400 text-neutral-800"
                  />
                </div>
              </div>

              {authMode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Role / Access Level</label>
                  <select 
                    value={authRole}
                    onChange={(e) => setAuthRole(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 rounded-xl border border-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-400 text-neutral-800 font-semibold"
                  >
                    <option value="ENGINEER">ENGINEER (Tunnels, DBs & Scoped Handles)</option>
                    <option value="VIEWER">VIEWER (Read-Only Latency Monitoring)</option>
                    <option value="MCP_AGENT">MCP_AGENT (AI Service Account)</option>
                    <option value="ADMIN">ADMIN (Full System Control)</option>
                  </select>
                </div>
              )}

              <button 
                type="submit" 
                disabled={authLoading}
                className="w-full bg-[#1c1b1f] hover:bg-neutral-800 text-white font-semibold text-xs py-2.5 rounded-xl shadow-sm transition-colors disabled:opacity-50 mt-2"
              >
                {authLoading ? 'Processing...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
              {authMode === 'login' ? (
                <>
                  <span>Don't have an account?</span>
                  <button 
                    type="button"
                    onClick={() => { setAuthMode('signup'); setAuthError(null); }}
                    className="font-semibold text-neutral-900 hover:underline"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  <span>Already have an account?</span>
                  <button 
                    type="button"
                    onClick={() => { setAuthMode('login'); setAuthError(null); }}
                    className="font-semibold text-neutral-900 hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>

            {/* Quick Demo Credentials Autofill */}
            <div className="mt-4 p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/80 text-[11px] text-neutral-600">
              <div className="font-bold text-neutral-800 mb-0.5">Quick Demo Admin Access:</div>
              <div className="font-mono text-[10px] text-neutral-500">Email: admin@cortex.internal</div>
              <div className="font-mono text-[10px] text-neutral-500">Pass: CortexAdmin2026!</div>
              <button 
                type="button"
                onClick={() => {
                  setAuthEmail('admin@cortex.internal');
                  setAuthPassword('CortexAdmin2026!');
                  setAuthMode('login');
                }}
                className="mt-1.5 text-[10px] text-purple-700 hover:text-purple-900 font-bold underline"
              >
                Auto-fill Admin Credentials
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MEMBER MODAL */}
      {addMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl border border-neutral-200 shadow-2xl p-6 relative">
            <button 
              type="button"
              onClick={() => setAddMemberModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-neutral-900 mb-1">Add Team Member</h3>
            <p className="text-xs text-neutral-500 mb-4">Grant access and assign role permissions to a new team member.</p>
            <form onSubmit={handleAddMember} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  required 
                  value={newMemberName} 
                  onChange={(e) => setNewMemberName(e.target.value)} 
                  placeholder="e.g. Jordan Smith" 
                  className="w-full px-3 py-2 text-xs bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-800 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Email</label>
                <input 
                  type="email" 
                  required 
                  value={newMemberEmail} 
                  onChange={(e) => setNewMemberEmail(e.target.value)} 
                  placeholder="jordan@corp.internal" 
                  className="w-full px-3 py-2 text-xs bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-800 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Assigned Role</label>
                <select 
                  value={newMemberRole} 
                  onChange={(e) => setNewMemberRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 rounded-xl border border-neutral-200 font-semibold text-neutral-800 focus:outline-none"
                >
                  <option value="ENGINEER">ENGINEER (Tunnels + DBs)</option>
                  <option value="VIEWER">VIEWER (Read-Only)</option>
                  <option value="MCP_AGENT">MCP_AGENT (AI Agent)</option>
                  <option value="ADMIN">ADMIN (Full Access)</option>
                </select>
              </div>
              <button 
                type="submit" 
                className="w-full bg-[#1c1b1f] hover:bg-neutral-800 text-white font-semibold text-xs py-2.5 rounded-xl shadow-sm transition-colors mt-2"
              >
                Save Member
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADD SECRET MODAL */}
      {addSecretModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl border border-neutral-200 shadow-2xl p-6 relative">
            <button 
              type="button"
              onClick={() => setAddSecretModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-neutral-900 mb-1">Add Secret to Zero-Knowledge Vault</h3>
            <p className="text-xs text-neutral-500 mb-4">Values are stored in RAM-locked envelopes and converted to opaque surrogate handles.</p>
            <form onSubmit={handleAddSecret} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Secret Key Name</label>
                <input 
                  type="text" 
                  required 
                  value={newSecretName} 
                  onChange={(e) => setNewSecretName(e.target.value)} 
                  placeholder="e.g. STAGING_DB_PASSWORD" 
                  className="w-full px-3 py-2 text-xs bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-800 font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Secret Value (Plaintext)</label>
                <input 
                  type="password" 
                  required 
                  value={newSecretValue} 
                  onChange={(e) => setNewSecretValue(e.target.value)} 
                  placeholder="••••••••••••" 
                  className="w-full px-3 py-2 text-xs bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-800 font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Secret Type</label>
                <select 
                  value={newSecretType} 
                  onChange={(e) => setNewSecretType(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 rounded-xl border border-neutral-200 font-semibold text-neutral-800 focus:outline-none"
                >
                  <option value="DB_CREDENTIAL">Database Credential</option>
                  <option value="SSH_PRIVATE_KEY">SSH Private Key</option>
                  <option value="API_KEY">API Key / Token</option>
                  <option value="TLS_CERT">TLS Certificate</option>
                </select>
              </div>
              <button 
                type="submit" 
                className="w-full bg-[#1c1b1f] hover:bg-neutral-800 text-white font-semibold text-xs py-2.5 rounded-xl shadow-sm transition-colors mt-2"
              >
                Store & Encrypt Secret
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
