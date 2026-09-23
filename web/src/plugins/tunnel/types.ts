export type HopType = 'direct' | 'http_proxy' | 'socks5_proxy' | 'ssh_bastion';

export interface HopAuth {
  username?: string;
  password?: string;
  private_key_pem?: string;
  surrogate_handle?: string;
  passphrase?: string;
  skip_host_verify?: boolean;
}

export interface HopConfig {
  id: string;
  name: string;
  type: HopType;
  host: string;
  port: number;
  auth?: HopAuth;
  timeout_ms?: number;
}

export interface HopMetric {
  hop_id: string;
  hop_name: string;
  hop_type: HopType;
  target_addr: string;
  latency_ms: number;
  timestamp: string;
  status: 'online' | 'degraded' | 'offline';
  error?: string;
}

export interface ChainConfig {
  id: string;
  name: string;
  description: string;
  hops: HopConfig[];
  target_addr: string;
}

export interface ActiveTunnelSession {
  session_id: string;
  chain_id: string;
  target_addr: string;
  connected_at: string;
  bytes_tx: number;
  bytes_rx: number;
  latency_ms: number;
  status: 'ESTABLISHED' | 'DRAINING' | 'CLOSED';
}
