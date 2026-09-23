import React, { useState } from 'react';
import { HopConfig, HopMetric, ChainConfig, ActiveTunnelSession } from './types';
import { HopCard } from './HopCard';
import { TunnelPipelineCanvas } from './TunnelPipelineCanvas';
import { AddHopModal } from './AddHopModal';
import { ProbeModal } from './ProbeModal';
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '../../design-system';
import { Plus, Radio, Layers, Activity } from 'lucide-react';

export interface TunnelManagerProps {
  chains: ChainConfig[];
  hops: HopConfig[];
  metrics?: Record<string, HopMetric[]>;
  onAddHop?: (hop: HopConfig) => void;
  onDialHop?: (hop: HopConfig) => void;
}

export const TunnelManager: React.FC<TunnelManagerProps> = ({
  chains,
  hops: initialHops,
  metrics = {},
  onAddHop,
  onDialHop,
}) => {
  const [hops, setHops] = useState<HopConfig[]>(initialHops);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedHopForProbe, setSelectedHopForProbe] = useState<HopConfig | null>(null);
  const [probeModalOpen, setProbeModalOpen] = useState(false);
  const [isDialingChain, setIsDialingChain] = useState(false);

  const [sessions, setSessions] = useState<ActiveTunnelSession[]>([
    {
      session_id: 'tun-sess-8812',
      chain_id: 'chain-prod',
      target_addr: 'pg-prod.c91f.rds.internal:5432',
      connected_at: '24 mins ago',
      bytes_tx: 4194304,
      bytes_rx: 16777216,
      latency_ms: 13.8,
      status: 'ESTABLISHED',
    }
  ]);

  const handleAddHop = (newHop: HopConfig) => {
    setHops([...hops, newHop]);
    if (onAddHop) onAddHop(newHop);
  };

  const handleProbe = (hop: HopConfig) => {
    setSelectedHopForProbe(hop);
    setProbeModalOpen(true);
  };

  const handleDialChain = (chainId: string) => {
    setIsDialingChain(true);
    setTimeout(() => {
      setIsDialingChain(false);
      const newSess: ActiveTunnelSession = {
        session_id: `tun-sess-${Date.now().toString().slice(-4)}`,
        chain_id: chainId,
        target_addr: 'pg-prod.c91f.rds.internal:5432',
        connected_at: 'Just now',
        bytes_tx: 1024,
        bytes_rx: 2048,
        latency_ms: 12.8,
        status: 'ESTABLISHED',
      };
      setSessions((prev) => [newSess, ...prev]);
    }, 700);
  };

  const handleTeardownSession = (sessionId: string) => {
    setSessions(sessions.filter((s) => s.session_id !== sessionId));
  };

  const directHops = hops.filter((h) => h.type === 'direct');
  const sshHops = hops.filter((h) => h.type === 'ssh_bastion');
  const proxyHops = hops.filter((h) => h.type === 'socks5_proxy' || h.type === 'http_proxy');

  return (
    <div className="space-y-5 select-none">
      {chains.length > 0 && (
        <TunnelPipelineCanvas
          chain={chains[0]}
          metrics={metrics}
          onDialChain={handleDialChain}
          isDialing={isDialingChain}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-neutral-800" />
          <span className="text-xs font-bold text-neutral-900">Hop Node Directory</span>
          <Badge variant="neutral">{hops.length} Total Nodes</Badge>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            icon={<Activity className="w-3.5 h-3.5 text-neutral-500" />}
            onClick={() => handleProbe(hops[0])}
          >
            Probe Test All
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setAddModalOpen(true)}
          >
            Add Hop Node
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className="font-bold text-neutral-900 text-xs uppercase tracking-wider">Direct Sockets</h4>
            <span className="text-[10px] text-neutral-400 font-mono font-bold">{directHops.length} Nodes</span>
          </div>
          <div className="space-y-3">
            {directHops.map((hop) => (
              <HopCard
                key={hop.id}
                hop={hop}
                metric={(metrics[hop.id] || [])[(metrics[hop.id] || []).length - 1]}
                onProbe={handleProbe}
                onDial={onDialHop}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className="font-bold text-neutral-900 text-xs uppercase tracking-wider">SSH Bastions</h4>
            <span className="text-[10px] text-neutral-400 font-mono font-bold">{sshHops.length} Nodes</span>
          </div>
          <div className="space-y-3">
            {sshHops.map((hop) => (
              <HopCard
                key={hop.id}
                hop={hop}
                metric={(metrics[hop.id] || [])[(metrics[hop.id] || []).length - 1]}
                onProbe={handleProbe}
                onDial={onDialHop}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className="font-bold text-neutral-900 text-xs uppercase tracking-wider">Forward Proxies</h4>
            <span className="text-[10px] text-neutral-400 font-mono font-bold">{proxyHops.length} Nodes</span>
          </div>
          <div className="space-y-3">
            {proxyHops.map((hop) => (
              <HopCard
                key={hop.id}
                hop={hop}
                metric={(metrics[hop.id] || [])[(metrics[hop.id] || []).length - 1]}
                onProbe={handleProbe}
                onDial={onDialHop}
              />
            ))}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-emerald-600" />
            <CardTitle>Active Tunnel Sessions ({sessions.length})</CardTitle>
          </div>
          <span className="text-[10px] font-mono text-neutral-400">Low-overhead zero-copy forwarding</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-neutral-50 text-neutral-500 text-[11px] border-b border-neutral-100">
                <tr>
                  <th className="px-5 py-3 font-semibold">Session ID</th>
                  <th className="px-5 py-3 font-semibold">Target Destination</th>
                  <th className="px-5 py-3 font-semibold">Uptime</th>
                  <th className="px-5 py-3 font-semibold">Throughput (TX / RX)</th>
                  <th className="px-5 py-3 font-semibold">RTT</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {sessions.map((s) => (
                  <tr key={s.session_id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="px-5 py-3 font-bold text-neutral-900">{s.session_id}</td>
                    <td className="px-5 py-3 text-indigo-600 font-semibold">{s.target_addr}</td>
                    <td className="px-5 py-3 text-neutral-500">{s.connected_at}</td>
                    <td className="px-5 py-3">{(s.bytes_tx / 1024).toFixed(1)} KB / {(s.bytes_rx / 1024).toFixed(1)} KB</td>
                    <td className="px-5 py-3 font-bold text-emerald-600">{s.latency_ms}ms</td>
                    <td className="px-5 py-3"><Badge variant="online" dot pulse>ESTABLISHED</Badge></td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="danger" size="xs" onClick={() => handleTeardownSession(s.session_id)}>
                        Teardown
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AddHopModal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} onAddHop={handleAddHop} />
      <ProbeModal hop={selectedHopForProbe} isOpen={probeModalOpen} onClose={() => setProbeModalOpen(false)} />
    </div>
  );
};
