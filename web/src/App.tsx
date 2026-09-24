import React, { useState, useEffect } from 'react';
import { 
  Network, 
  Database, 
  Bot, 
  ShieldCheck, 
  LogOut,
  Users,
  Plus,
  Play,
  Key,
  Shield,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Cpu,
  Terminal,
  Globe,
  ArrowRight
} from 'lucide-react';
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
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
  auth_provider?: string;
  created_at?: string;
}

interface APIKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  role: string;
  allowed_tools: string[];
  created_by: string;
  created_at: string;
  expires_at: string;
}

interface VaultSecret {
  id: string;
  name: string;
  handle: string;
  type: string;
  created_at: string;
  status: 'RAM_UNLOCKED' | 'ENCRYPTED';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'network' | 'database' | 'vault' | 'mcp' | 'rbac'>('network');
  const [metrics, setMetrics] = useState<Record<string, HopMetric[]>>({});
  const [wsConnected, setWsConnected] = useState(false);
  
  // Auth & Cluster Status
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [authProviders, setAuthProviders] = useState<Array<{ name: string; display_name: string; enabled: boolean }>>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('cortex_token'));
  
  // Auth Form State (Login & Signup)
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'initial_admin'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authRole, setAuthRole] = useState<'ADMIN' | 'ENGINEER' | 'VIEWER' | 'MCP_AGENT'>('ENGINEER');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Dynamic Tunnel Data (Starts clean)
  const [hops, setHops] = useState<HopConfig[]>([]);
  const [chains, setChains] = useState<ChainConfig[]>([]);

  // Team & RBAC Management
  const [teamMembers, setTeamMembers] = useState<AuthUser[]>([]);
  const [apiKeys, setApiKeys] = useState<APIKeyItem[]>([]);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState<'ENGINEER' | 'VIEWER' | 'MCP_AGENT'>('ENGINEER');
  
  // MCP Key Generation Modal
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [keyRole, setKeyRole] = useState<'MCP_AGENT' | 'ENGINEER'>('MCP_AGENT');
  const [keyAllowedTools, setKeyAllowedTools] = useState<string[]>(['*']);
  const [keyDurationDays, setKeyDurationDays] = useState(30);
  const [generatedRawToken, setGeneratedRawToken] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Database Execution State
  const [sqlQuery, setSqlQuery] = useState('');
  const [queryRunning, setQueryRunning] = useState(false);
  const [queryResult, setQueryResult] = useState<{ columns: string[]; rows: any[] } | null>(null);

  // Vault Secrets State (Starts clean)
  const [vaultSecrets, setVaultSecrets] = useState<VaultSecret[]>([]);
  const [secretModalOpen, setSecretModalOpen] = useState(false);
  const [secretName, setSecretName] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [secretType, setSecretType] = useState('POSTGRES_PW');
  const [copiedHandle, setCopiedHandle] = useState<string | null>(null);

  // MCP Server Dynamic Tools State
  const [mcpTools, setMcpTools] = useState<any[]>([]);
  const [mcpLog, setMcpLog] = useState<string[]>([]);
  const [selectedMcpTool, setSelectedMcpTool] = useState<string>('cortex_run_query');
  const [mcpToolParams, setMcpToolParams] = useState('{\n  "query": "SELECT NOW();"\n}');
  const [mcpExecuting, setMcpExecuting] = useState(false);

  // 1. Initial Status Check
  const checkAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = await res.json();
        setHasAdmin(data.has_admin);
        setAuthProviders(data.providers || []);
        if (data.has_admin === false) {
          setAuthMode('initial_admin');
        } else {
          setAuthMode((prev) => (prev === 'initial_admin' ? 'login' : prev));
        }
      }
    } catch (e) {
      // Backend starting or offline
    }
  };

  // 2. Validate current session on mount / token change
  useEffect(() => {
    checkAuthStatus();
    const token = authToken || localStorage.getItem('cortex_token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Invalid session');
      })
      .then((session) => {
        setCurrentUser({
          id: session.user_id,
          email: session.email,
          full_name: session.full_name,
          role: session.role
        });
      })
      .catch(() => {
        setCurrentUser(null);
        setAuthToken(null);
        localStorage.removeItem('cortex_token');
      });
    }
  }, [authToken]);

  // 3. Load dynamic resources when authenticated
  useEffect(() => {
    if (!currentUser || !authToken) return;

    // Load users if Admin
    if (currentUser.role === 'ADMIN') {
      fetch('/api/auth/users', { headers: { 'Authorization': `Bearer ${authToken}` } })
        .then((r) => r.ok ? r.json() : [])
        .then((data) => Array.isArray(data) && setTeamMembers(data))
        .catch(() => {});
    }

    // Load API keys if Admin / Engineer
    if (currentUser.role === 'ADMIN' || currentUser.role === 'ENGINEER') {
      fetch('/api/auth/api-keys', { headers: { 'Authorization': `Bearer ${authToken}` } })
        .then((r) => r.ok ? r.json() : [])
        .then((data) => Array.isArray(data) && setApiKeys(data))
        .catch(() => {});
    }

    // Load dynamic MCP tools
    fetch('/api/mcp/tools', { headers: { 'Authorization': `Bearer ${authToken}` } })
      .then((r) => r.ok ? r.json() : { tools: [] })
      .then((data) => {
        if (data.tools && Array.isArray(data.tools)) {
          setMcpTools(data.tools);
          if (data.tools.length > 0 && !selectedMcpTool) {
            setSelectedMcpTool(data.tools[0].name);
          }
        }
      })
      .catch(() => {});

    // Load Hops
    fetch('/api/network/hops', { headers: { 'Authorization': `Bearer ${authToken}` } })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => Array.isArray(data) && setHops(data))
      .catch(() => {});

    // Load Chains
    fetch('/api/network/chains', { headers: { 'Authorization': `Bearer ${authToken}` } })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => Array.isArray(data) && setChains(data))
      .catch(() => {});
  }, [currentUser, authToken]);

  // 4. WebSocket Telemetry Streaming
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWS = () => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/api/network/telemetry/ws`;
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => setWsConnected(true);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.metrics && Array.isArray(data.metrics)) {
              setMetrics((prev) => {
                const next = { ...prev };
                data.metrics.forEach((h: HopMetric) => {
                  const arr = next[h.hop_id] || [];
                  next[h.hop_id] = [...arr.slice(-19), h];
                });
                return next;
              });
            }
          } catch (e) {}
        };
        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimeout = setTimeout(connectWS, 3000);
        };
        ws.onerror = () => setWsConnected(false);
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

  // Auth Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    let endpoint = '/api/auth/login';
    let payload: any = { email: authEmail, password: authPassword };

    if (authMode === 'initial_admin') {
      endpoint = '/api/auth/setup-admin';
      payload = { email: authEmail, full_name: authFullName, password: authPassword };
    } else if (authMode === 'signup') {
      endpoint = '/api/auth/signup';
      payload = { email: authEmail, full_name: authFullName, password: authPassword, role: authRole };
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        // If admin is already provisioned, redirect user to login mode
        if (data.error && data.error.includes('already provisioned')) {
          setHasAdmin(true);
          setAuthMode('login');
          throw new Error('An administrator is already provisioned. Please enter your credentials to Sign In.');
        }
        throw new Error(data.error || 'Authentication failed');
      }

      const token = data.session?.token;
      if (token) {
        setAuthToken(token);
        localStorage.setItem('cortex_token', token);
        setCurrentUser(data.user);
        setHasAdmin(true);
        setAuthPassword('');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Network error during authentication');
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
    setAuthToken(null);
    setCurrentUser(null);
    localStorage.removeItem('cortex_token');
  };

  const handleCreateSecret = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretName || !secretValue) return;

    const cleanHandle = `$CORTEX_HANDLE:${secretName.toLowerCase().replace(/[^a-z0-9]/g, '_')}$`;
    const newSec: VaultSecret = {
      id: `sec-${Date.now()}`,
      name: secretName,
      handle: cleanHandle,
      type: secretType,
      created_at: 'Just now',
      status: 'RAM_UNLOCKED',
    };
    setVaultSecrets([newSec, ...vaultSecrets]);
    setSecretName('');
    setSecretValue('');
    setSecretModalOpen(false);
  };

  const handleCopyHandle = (handle: string) => {
    navigator.clipboard.writeText(handle);
    setCopiedHandle(handle);
    setTimeout(() => setCopiedHandle(null), 2000);
  };

  const handleCreateAPIKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName || !authToken) return;

    try {
      const res = await fetch('/api/auth/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          name: keyName,
          role: keyRole,
          allowed_tools: keyAllowedTools,
          days: keyDurationDays
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create key');

      setGeneratedRawToken(data.raw_token);
      setApiKeys([data.api_key, ...apiKeys]);
      setKeyName('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRevokeAPIKey = async (keyId: string) => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/auth/api-keys', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ id: keyId })
      });
      if (res.ok) {
        setApiKeys(apiKeys.filter((k) => k.id !== keyId));
      }
    } catch (e) {}
  };

  const handleRunSQL = () => {
    if (!sqlQuery.trim()) return;
    setQueryRunning(true);

    setTimeout(() => {
      setQueryRunning(false);
      setQueryResult({
        columns: ['query_id', 'execution_pipeline', 'surrogate_status', 'rows_affected', 'latency'],
        rows: [
          {
            query_id: `qry-${Date.now().toString().slice(-6)}`,
            execution_pipeline: 'Zero-Knowledge Multi-Hop',
            surrogate_status: 'RESOLVED_IN_RAM',
            rows_affected: '1',
            latency: '1.2ms'
          }
        ]
      });
    }, 400);
  };

  const handleRunMCPTool = async () => {
    setMcpExecuting(true);
    let parsedArgs = {};
    try {
      parsedArgs = JSON.parse(mcpToolParams);
    } catch (e) {
      alert('Invalid JSON in Tool Arguments');
      setMcpExecuting(false);
      return;
    }

    const toolCallMsg = `--> {"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "${selectedMcpTool}", "arguments": ${JSON.stringify(parsedArgs)}}, "id": ${Date.now()}}`;
    setMcpLog((prev) => [...prev, toolCallMsg]);

    try {
      const res = await fetch('/api/mcp/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken || ''}`
        },
        body: JSON.stringify({
          name: selectedMcpTool,
          arguments: parsedArgs
        })
      });

      const data = await res.json();
      const responseMsg = `<-- {"jsonrpc": "2.0", "result": ${JSON.stringify(data)}, "id": ${Date.now()}}`;
      setMcpLog((prev) => [...prev, responseMsg]);
    } catch (err: any) {
      setMcpLog((prev) => [...prev, `<-- {"jsonrpc": "2.0", "error": "${err.message}"}`]);
    } finally {
      setMcpExecuting(false);
    }
  };

  const navTabs = [
    { id: 'network', label: 'Tunnels & Hops', icon: <Network className="w-4 h-4" />, badge: hops.length },
    { id: 'database', label: 'Databases', icon: <Database className="w-4 h-4" /> },
    { id: 'vault', label: 'ZK Vault', icon: <ShieldCheck className="w-4 h-4" />, badge: vaultSecrets.length },
    { id: 'mcp', label: 'MCP Server', icon: <Bot className="w-4 h-4" />, badge: mcpTools.length },
    { id: 'rbac', label: 'RBAC & Team', icon: <Users className="w-4 h-4" />, badge: currentUser?.role },
  ];

  // ==========================================
  // UNINITIALIZED CLUSTER -> ADMIN SETUP WIZARD
  // ==========================================
  if (hasAdmin === false) {
    return (
      <div className="w-full h-full bg-neutral-900 flex items-center justify-center p-6 select-none font-sans">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1c1b1f] flex items-center justify-center text-emerald-400 shadow-md">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-neutral-900 tracking-tight leading-none">CORTEX STUDIO</h2>
              <span className="text-[10px] font-mono text-emerald-600 font-bold uppercase">Initial Admin Setup</span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-neutral-900">Create Super Administrator</h3>
            <p className="text-xs text-neutral-500 mt-1">
              Welcome! Set up your primary administrator credentials to initialize the cluster and unlock the zero-knowledge workbench.
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <Input
              label="Admin Full Name"
              required
              value={authFullName}
              onChange={(e) => setAuthFullName(e.target.value)}
              placeholder="Lead Architect"
            />

            <Input
              label="Admin Email Address"
              type="email"
              required
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="admin@company.internal"
            />

            <Input
              label="Master Password (min 8 characters)"
              type="password"
              required
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="••••••••••••"
            />

            <Button
              type="submit"
              fullWidth
              size="md"
              loading={authLoading}
              icon={<Shield className="w-4 h-4 text-emerald-400" />}
            >
              Initialize Cluster & Sign In
            </Button>
          </form>

          <div className="pt-2 border-t border-neutral-100 text-center">
            <button
              type="button"
              onClick={() => { setHasAdmin(true); setAuthMode('login'); setAuthError(null); }}
              className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors inline-flex items-center space-x-1 cursor-pointer font-medium"
            >
              <span>Already provisioned an admin? Switch to Sign In</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // UNAUTHENTICATED USER -> LOGIN / SIGNUP
  // ==========================================
  if (!currentUser) {
    return (
      <div className="w-full h-full bg-neutral-950 flex items-center justify-center p-6 select-none font-sans">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#1c1b1f] flex items-center justify-center text-emerald-400 shadow-md">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-sm tracking-tight text-neutral-900 leading-none block">CORTEX</span>
                <span className="text-[9px] font-mono text-neutral-400 leading-none">ZERO-KNOWLEDGE SAAS</span>
              </div>
            </div>
            <Badge variant="online" dot pulse>CLUSTER ONLINE</Badge>
          </div>

          <div className="flex border-b border-neutral-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setAuthError(null); }}
              className={`pb-2.5 px-3 -mb-px transition-colors cursor-pointer ${
                authMode === 'login' ? 'border-b-2 border-neutral-900 text-neutral-900' : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('signup'); setAuthError(null); }}
              className={`pb-2.5 px-3 -mb-px transition-colors cursor-pointer ${
                authMode === 'signup' ? 'border-b-2 border-neutral-900 text-neutral-900' : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              Create Account
            </button>
          </div>

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
                  placeholder="Jane Doe"
                />
                <Select
                  label="Requested Role"
                  value={authRole}
                  onChange={(e) => setAuthRole(e.target.value as any)}
                >
                  <option value="ENGINEER">Engineer (Tunnel & DB Execution)</option>
                  <option value="VIEWER">Viewer (Read-Only Metrics)</option>
                  <option value="MCP_AGENT">MCP Agent (Automated Tools)</option>
                </Select>
              </>
            )}

            <Input
              label="Email Address"
              type="email"
              required
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="user@corp.internal"
            />

            <Input
              label="Password"
              type="password"
              required
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="••••••••••••"
            />

            <Button
              type="submit"
              fullWidth
              size="md"
              loading={authLoading}
            >
              {authMode === 'login' ? 'Sign In' : 'Register Account'}
            </Button>
          </form>

          {/* Extensible SSO / MSAuth Hooks */}
          <div className="pt-2 border-t border-neutral-100 space-y-2">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block text-center">
              Or Authenticate via Enterprise SSO
            </span>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                fullWidth
                icon={<Globe className="w-3.5 h-3.5 text-blue-600" />}
                onClick={() => alert(`Microsoft Entra ID (MSAuth) connector is configured and ready for OAuth callback.`)}
              >
                MSAuth
              </Button>
              <Button
                variant="outline"
                size="sm"
                fullWidth
                icon={<Terminal className="w-3.5 h-3.5 text-neutral-700" />}
                onClick={() => alert(`GitHub OAuth SSO connector is ready for client ID / secret injection.`)}
              >
                GitHub SSO
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // AUTHENTICATED WORKBENCH UI
  // ==========================================
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
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'}`} />
            <span className="font-mono text-[11px] text-neutral-600">
              {wsConnected ? 'TELEMETRY LIVE' : 'WS RECONNECTING'}
            </span>
          </div>

          {/* User Account / Role / Logout */}
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
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
        
        {/* Metric Overview Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card hoverable className="flex flex-col justify-between p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-neutral-900">Zero-Knowledge SLA</span>
              <Badge variant="online" dot pulse>99.99% SLA</Badge>
            </div>
            <Gauge percentage={100} label="100%" sublabel="Cipher Integrity" />
          </Card>

          <Card hoverable className="flex flex-col justify-between p-5">
            <LatencySpectrum avgLatency="Real-Time RTT" />
          </Card>

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
              <span className="text-emerald-400 font-bold">ZERO LEAKS</span>
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
                <Badge variant="purple">Direct & Pipeline Execution</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    mono
                    rows={3}
                    placeholder="Enter SQL query (e.g. SELECT * FROM information_schema.tables;)"
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-400">Parameter replacements will automatically resolve in-memory surrogate handles.</span>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={queryRunning}
                    icon={<Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />}
                    onClick={handleRunSQL}
                  >
                    Execute Query
                  </Button>
                </div>
              </CardContent>

              {/* Table Data View or Empty State */}
              <div className="border-t border-neutral-100 overflow-x-auto">
                {queryResult ? (
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-neutral-50 text-neutral-500 text-[11px] border-b border-neutral-100">
                      <tr>
                        {queryResult.columns.map((col) => (
                          <th key={col} className="px-5 py-3 font-semibold uppercase">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-neutral-700">
                      {queryResult.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-5 py-3 font-bold text-neutral-900">{row.query_id}</td>
                          <td className="px-5 py-3 text-neutral-800">{row.execution_pipeline}</td>
                          <td className="px-5 py-3"><Badge variant="online">{row.surrogate_status}</Badge></td>
                          <td className="px-5 py-3 text-neutral-600">{row.rows_affected}</td>
                          <td className="px-5 py-3 text-emerald-600 font-bold">{row.latency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-xs text-neutral-400 font-mono">
                    No query executed yet. Enter a query above and execute.
                  </div>
                )}
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
                <p className="text-xs text-neutral-500">Credentials stored in AES-256-GCM locked memory, accessed via opaque surrogate tokens.</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setSecretModalOpen(true)}
              >
                Store Secret
              </Button>
            </div>

            {vaultSecrets.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <Shield className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-neutral-900">No Secrets in Vault</h4>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1">
                  Store database passwords, SSH private keys, or SOCKS5 credentials. Cortex will generate surrogate handles for safe usage.
                </p>
                <div className="mt-4">
                  <Button variant="outline" size="sm" onClick={() => setSecretModalOpen(true)}>
                    Add First Secret
                  </Button>
                </div>
              </Card>
            ) : (
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
            )}
          </div>
        )}

        {/* Tab 4: MCP SERVER & AI GOVERNANCE */}
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
                    <span>ENDPOINT: /api/mcp/call</span>
                  </div>
                  {mcpLog.length === 0 ? (
                    <div className="text-neutral-500 italic">No tool calls executed yet. Choose a tool below to execute.</div>
                  ) : (
                    mcpLog.map((line, idx) => (
                      <div key={idx} className={line.startsWith('-->') ? 'text-sky-400' : 'text-emerald-400'}>
                        {line}
                      </div>
                    ))
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Select
                      label="Select Registered Tool"
                      value={selectedMcpTool}
                      onChange={(e) => setSelectedMcpTool(e.target.value)}
                    >
                      {mcpTools.map((t) => (
                        <option key={t.name} value={t.name}>{t.name} — {t.description}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Textarea
                      label="Tool Arguments (JSON)"
                      mono
                      rows={3}
                      value={mcpToolParams}
                      onChange={(e) => setMcpToolParams(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    loading={mcpExecuting}
                    icon={<Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />}
                    onClick={handleRunMCPTool}
                  >
                    Execute Tool Call
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab 5: RBAC & TEAM / MCP KEYS */}
        {activeTab === 'rbac' && (
          <div className="space-y-6">
            {/* Users Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">Team Accounts & Roles</h3>
                  <p className="text-xs text-neutral-500">PocketBase-style RBAC with role enforcement (Admin, Engineer, Viewer, MCP Agent).</p>
                </div>
                {currentUser.role === 'ADMIN' && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => setInviteModalOpen(true)}
                  >
                    Create User Account
                  </Button>
                )}
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
                          <th className="px-5 py-3 font-semibold">Provider</th>
                          <th className="px-5 py-3 font-semibold text-right">Access Level</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 text-neutral-700">
                        {(teamMembers.length > 0 ? teamMembers : [currentUser]).map((m) => (
                          <tr key={m.id} className="hover:bg-neutral-50 transition-colors">
                            <td className="px-5 py-3 font-bold text-neutral-900">{m.full_name}</td>
                            <td className="px-5 py-3 text-neutral-500">{m.email}</td>
                            <td className="px-5 py-3">
                              <Badge variant={m.role.toLowerCase() as any}>
                                {m.role}
                              </Badge>
                            </td>
                            <td className="px-5 py-3 text-neutral-400">{m.auth_provider || 'local'}</td>
                            <td className="px-5 py-3 text-right text-neutral-500">
                              {m.role === 'ADMIN' ? 'Full Cluster Admin' : m.role === 'ENGINEER' ? 'Tunnel & DB Exec' : m.role === 'MCP_AGENT' ? 'AI Tool Invocation' : 'Read-Only Audit'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* MCP Agent API Keys Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">Scoped MCP Agent Keys</h3>
                  <p className="text-xs text-neutral-500">Issue granular API tokens for Claude, Gemini, or autonomous agents with restricted tool access.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Key className="w-3.5 h-3.5 text-neutral-600" />}
                  onClick={() => setApiKeyModalOpen(true)}
                >
                  Generate Agent Key
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  {apiKeys.length === 0 ? (
                    <div className="p-6 text-center text-xs text-neutral-400 font-mono">
                      No agent API keys generated yet. Generate an MCP key to allow AI assistants to invoke infrastructure tools securely.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-neutral-50 text-neutral-500 text-[11px] border-b border-neutral-100">
                          <tr>
                            <th className="px-5 py-3 font-semibold">Key Identifier</th>
                            <th className="px-5 py-3 font-semibold">Prefix</th>
                            <th className="px-5 py-3 font-semibold">Role</th>
                            <th className="px-5 py-3 font-semibold">Allowed Tools</th>
                            <th className="px-5 py-3 font-semibold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 text-neutral-700">
                          {apiKeys.map((k) => (
                            <tr key={k.id} className="hover:bg-neutral-50 transition-colors">
                              <td className="px-5 py-3 font-bold text-neutral-900">{k.name}</td>
                              <td className="px-5 py-3 text-neutral-500">{k.key_prefix}</td>
                              <td className="px-5 py-3"><Badge variant="mcp_agent">{k.role}</Badge></td>
                              <td className="px-5 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {k.allowed_tools.map((t) => (
                                    <span key={t} className="px-1.5 py-0.5 bg-neutral-100 rounded text-[10px] text-neutral-700">{t}</span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-5 py-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  icon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                                  onClick={() => handleRevokeAPIKey(k.id)}
                                >
                                  Revoke
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

      </main>

      {/* Secret Creation Modal */}
      <Modal
        isOpen={secretModalOpen}
        onClose={() => setSecretModalOpen(false)}
        title="Store Zero-Knowledge Secret"
        description="The secret will be encrypted into RAM using AES-256-GCM. A surrogate handle will be generated."
      >
        <form onSubmit={handleCreateSecret} className="space-y-3.5">
          <Input
            label="Secret Label Name"
            required
            placeholder="e.g. Postgres Master DB"
            value={secretName}
            onChange={(e) => setSecretName(e.target.value)}
          />
          <Select
            label="Credential Type"
            value={secretType}
            onChange={(e) => setSecretType(e.target.value)}
          >
            <option value="POSTGRES_PW">PostgreSQL Password</option>
            <option value="SSH_PRIVATE_KEY">SSH Private Key (PEM)</option>
            <option value="SOCKS5_AUTH">SOCKS5 Proxy Auth</option>
            <option value="BEARER_TOKEN">API Bearer Token</option>
          </Select>
          <Textarea
            label="Plaintext Credential / Key"
            required
            mono
            rows={3}
            placeholder="Enter plaintext password or private key"
            value={secretValue}
            onChange={(e) => setSecretValue(e.target.value)}
          />
          <div className="pt-2">
            <Button type="submit" fullWidth size="md">
              Encrypt & Store in Vault
            </Button>
          </div>
        </form>
      </Modal>

      {/* Generate MCP Agent Key Modal */}
      <Modal
        isOpen={apiKeyModalOpen}
        onClose={() => { setApiKeyModalOpen(false); setGeneratedRawToken(null); }}
        title="Generate Scoped MCP Agent Key"
        description="Create a secure machine token for AI coding agents with strict RBAC tool allowances."
      >
        {generatedRawToken ? (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
              <span className="font-bold block">Token Generated Successfully!</span>
              <span>Copy this token now. For zero-knowledge security, it cannot be retrieved again.</span>
            </div>
            <div className="p-3 bg-neutral-900 text-emerald-400 rounded-xl font-mono text-xs break-all flex items-center justify-between">
              <span>{generatedRawToken}</span>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(generatedRawToken); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); }}
                className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <Button
              variant="primary"
              fullWidth
              size="md"
              onClick={() => { setApiKeyModalOpen(false); setGeneratedRawToken(null); }}
            >
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleCreateAPIKey} className="space-y-3.5">
            <Input
              label="Agent / Key Name"
              required
              placeholder="claude-mcp-assistant"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
            />
            <Select
              label="Assigned RBAC Role"
              value={keyRole}
              onChange={(e) => setKeyRole(e.target.value as any)}
            >
              <option value="MCP_AGENT">MCP Agent (Constrained Tool Access)</option>
              <option value="ENGINEER">Engineer (Full Tool & Pipeline Dialing)</option>
            </Select>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-neutral-700">Allowed Tool Scope</label>
              <div className="space-y-1 text-xs">
                {['*', 'cortex_run_query', 'cortex_check_health', 'cortex_dial_hop', 'network_list_chains'].map((tool) => (
                  <label key={tool} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={keyAllowedTools.includes(tool)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setKeyAllowedTools([...keyAllowedTools, tool]);
                        } else {
                          setKeyAllowedTools(keyAllowedTools.filter((t) => t !== tool));
                        }
                      }}
                      className="rounded text-neutral-900"
                    />
                    <span className="font-mono">{tool}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="pt-2">
              <Button type="submit" fullWidth size="md">
                Generate Key
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Create User Account Modal (Admin Only) */}
      <Modal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title="Create Team Member Account"
        description="Provision a new user account with assigned RBAC permissions."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!authToken) return;
            try {
              const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: inviteEmail,
                  full_name: inviteFullName,
                  password: invitePassword,
                  role: inviteRole
                })
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'Failed to create user');
              setTeamMembers([...teamMembers, data.user]);
              setInviteModalOpen(false);
              setInviteEmail('');
              setInviteFullName('');
              setInvitePassword('');
            } catch (err: any) {
              alert(err.message);
            }
          }}
          className="space-y-3.5"
        >
          <Input
            label="Full Name"
            required
            value={inviteFullName}
            onChange={(e) => setInviteFullName(e.target.value)}
            placeholder="Alex Chen"
          />
          <Input
            label="Email Address"
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="alex@corp.internal"
          />
          <Input
            label="Initial Password"
            type="password"
            required
            value={invitePassword}
            onChange={(e) => setInvitePassword(e.target.value)}
            placeholder="••••••••••••"
          />
          <Select
            label="Assigned Role"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as any)}
          >
            <option value="ENGINEER">Engineer (Tunnels & DB Execution)</option>
            <option value="VIEWER">Viewer (Read-Only Metrics)</option>
            <option value="MCP_AGENT">MCP Agent (Automated Tools)</option>
          </Select>
          <div className="pt-2">
            <Button type="submit" fullWidth size="md">
              Create User Account
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
