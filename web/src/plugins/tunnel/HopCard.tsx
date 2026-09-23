import React from 'react';
import { HopConfig, HopMetric } from './types';
import { Badge } from '../../design-system';
import { KeyRound, Zap, Radio, Terminal } from 'lucide-react';

export interface HopCardProps {
  hop: HopConfig;
  metric?: HopMetric;
  onProbe?: (hop: HopConfig) => void;
  onDial?: (hop: HopConfig) => void;
  onDelete?: (hopId: string) => void;
}

export const HopCard: React.FC<HopCardProps> = ({ hop, metric, onProbe, onDial }) => {
  const isOnline = metric ? metric.status === 'online' : true;
  const isDegraded = metric?.status === 'degraded';
  const latency = metric?.latency_ms !== undefined ? `${metric.latency_ms.toFixed(1)}ms` : '0.24ms';
  const isDark = hop.type === 'ssh_bastion';

  const getBadgeType = () => {
    switch (hop.type) {
      case 'ssh_bastion': return <Badge variant="purple">SSH Bastion</Badge>;
      case 'socks5_proxy': return <Badge variant="sky">SOCKS5</Badge>;
      case 'http_proxy': return <Badge variant="info">HTTP Connect</Badge>;
      default: return <Badge variant="emerald">Direct Edge</Badge>;
    }
  };

  return (
    <div className={`p-4 rounded-2xl transition-all duration-150 relative border flex flex-col justify-between ${isDark ? 'bg-[#1c1b1f] text-white border-neutral-800 shadow-md hover:shadow-lg' : 'bg-white text-neutral-900 border-neutral-200/80 shadow-xs hover:shadow-md'}`}>
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? (isDegraded ? 'bg-amber-400' : (isDark ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-500')) : 'bg-rose-500'}`} />
            <h5 className={`font-bold text-xs truncate ${isDark ? 'text-white' : 'text-neutral-900'}`}>{hop.name}</h5>
          </div>
          <span className={`text-[10px] font-mono ${isDark ? 'text-neutral-400' : 'text-neutral-400'}`}>:{hop.port}</span>
        </div>
        <div className="mb-3">
          <div className={`text-[11px] font-mono truncate ${isDark ? 'text-neutral-300' : 'text-neutral-500'}`}>{hop.host}</div>
          {hop.auth?.surrogate_handle && (
            <div className="flex items-center space-x-1.5 mt-1 text-[10px] font-mono text-emerald-400 truncate">
              <KeyRound className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{hop.auth.surrogate_handle}</span>
            </div>
          )}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between pt-2.5 border-t border-neutral-100 dark:border-neutral-800 text-[10px] font-mono">
          <div className="flex items-center space-x-1.5">
            <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-md border font-medium ${isDark ? 'bg-neutral-800/80 text-emerald-300 border-neutral-700/60' : 'bg-neutral-50 text-neutral-700 border-neutral-200/60'}`}>
              <Zap className={`w-3 h-3 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
              <span>{latency}</span>
            </div>
            {getBadgeType()}
          </div>
          <div className="flex items-center space-x-1">
            {onProbe && (
              <button type="button" onClick={() => onProbe(hop)} title="Ping Probe Hop" className={`p-1 rounded-md transition-colors cursor-pointer ${isDark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100'}`}>
                <Terminal className="w-3.5 h-3.5" />
              </button>
            )}
            {onDial && (
              <button type="button" onClick={() => onDial(hop)} title="Direct Dial" className={`p-1 rounded-md transition-colors cursor-pointer ${isDark ? 'text-emerald-400 hover:text-emerald-300 hover:bg-neutral-800' : 'text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100'}`}>
                <Radio className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
