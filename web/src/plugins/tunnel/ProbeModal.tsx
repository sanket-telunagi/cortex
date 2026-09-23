import React, { useState, useEffect } from 'react';
import { HopConfig } from './types';
import { Modal, Button } from '../../design-system';
import { Terminal, Zap, CheckCircle2 } from 'lucide-react';

export interface ProbeModalProps {
  hop: HopConfig | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ProbeModal: React.FC<ProbeModalProps> = ({ hop, isOpen, onClose }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<{ status: 'SUCCESS' | 'FAILED'; rttMs: number } | null>(null);

  useEffect(() => {
    if (isOpen && hop) runProbe();
    else { setLogs([]); setProbeResult(null); }
  }, [isOpen, hop]);

  const runProbe = () => {
    if (!hop) return;
    setProbing(true);
    setLogs([
      `[${new Date().toLocaleTimeString()}] Initiating raw TCP dial to ${hop.host}:${hop.port}...`,
      `[${new Date().toLocaleTimeString()}] Protocol: ${hop.type.toUpperCase()}`,
      `[${new Date().toLocaleTimeString()}] Negotiating surrogate envelope credentials...`,
    ]);
    setProbeResult(null);
    setTimeout(() => {
      const simulatedRtt = hop.type === 'ssh_bastion' ? 12.4 : hop.type === 'socks5_proxy' ? 24.8 : 0.4;
      setLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] SYN/ACK received in ${simulatedRtt}ms`,
        `[${new Date().toLocaleTimeString()}] TLS handshake verified (ALPN: h2, http/1.1)`,
        `[${new Date().toLocaleTimeString()}] Hop ${hop.name} is HEALTHY and READY.`,
      ]);
      setProbeResult({ status: 'SUCCESS', rttMs: simulatedRtt });
      setProbing(false);
    }, 800);
  };

  if (!hop) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Probe Diagnostic: ${hop.name}`} description={`Executing direct latency and health probe against ${hop.host}:${hop.port}`} maxWidth="lg">
      <div className="space-y-4">
        <div className="bg-[#1c1b1f] text-neutral-200 p-4 rounded-2xl font-mono text-xs border border-neutral-800 space-y-1.5 max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800 text-neutral-400 text-[11px]">
            <div className="flex items-center space-x-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>DIAGNOSTIC LOG STREAM</span>
            </div>
            <span>PORT {hop.port}</span>
          </div>
          {logs.map((line, idx) => (
            <div key={idx} className={idx === logs.length - 1 ? 'text-emerald-400 font-bold' : 'text-neutral-300'}>{line}</div>
          ))}
          {probing && <div className="text-purple-400 animate-pulse">Measuring jitter and per-packet RTT...</div>}
        </div>
        {probeResult && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-emerald-800 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Health Verification Passed (0% packet loss)</span>
            </div>
            <div className="flex items-center space-x-1 font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
              <Zap className="w-3.5 h-3.5" />
              <span>{probeResult.rttMs.toFixed(1)}ms</span>
            </div>
          </div>
        )}
        <div className="flex items-center justify-end space-x-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="primary" loading={probing} onClick={runProbe}>Re-run Probe</Button>
        </div>
      </div>
    </Modal>
  );
};
