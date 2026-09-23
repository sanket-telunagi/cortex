import React from 'react';
import { ChainConfig, HopMetric } from './types';
import { ArrowRight, Radio } from 'lucide-react';

export interface TunnelPipelineCanvasProps {
  chain: ChainConfig;
  metrics?: Record<string, HopMetric[]>;
  onDialChain?: (chainId: string) => void;
  isDialing?: boolean;
}

export const TunnelPipelineCanvas: React.FC<TunnelPipelineCanvasProps> = ({ chain, metrics = {}, onDialChain, isDialing = false }) => {
  return (
    <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h4 className="text-sm font-bold text-neutral-900">{chain.name}</h4>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-mono font-bold border border-emerald-200/60">
              ZERO-KNOWLEDGE PIPELINE
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">{chain.description}</p>
        </div>
        {onDialChain && (
          <button
            type="button"
            onClick={() => onDialChain(chain.id)}
            disabled={isDialing}
            className="flex items-center space-x-1.5 bg-[#1c1b1f] hover:bg-neutral-800 active:bg-neutral-900 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{isDialing ? 'Dialing Pipeline...' : 'Dial Full Pipeline'}</span>
          </button>
        )}
      </div>

      <div className="p-4 rounded-xl bg-neutral-50/80 border border-neutral-200/70 overflow-x-auto">
        <div className="flex items-center justify-between min-w-[720px] gap-3">
          <div className="flex-1 bg-white p-3 rounded-xl border border-neutral-200 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-neutral-500">ORIGIN</span>
              <span className="text-[9px] bg-neutral-100 text-neutral-600 px-1.5 py-0.2 rounded font-mono">0ms</span>
            </div>
            <div className="font-bold text-xs text-neutral-900 truncate">Workstation Client</div>
            <div className="text-[10px] font-mono text-neutral-400 truncate">127.0.0.1:8080</div>
          </div>
          <ArrowRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          {chain.hops.map((hop, idx) => {
            const hopMetricList = metrics[hop.id] || [];
            const latestMetric = hopMetricList[hopMetricList.length - 1];
            const lat = latestMetric ? `${latestMetric.latency_ms.toFixed(1)}ms` : (idx === 0 ? '0.2ms' : idx === 1 ? '12.4ms' : '1.8ms');
            const isSsh = hop.type === 'ssh_bastion';
            return (
              <React.Fragment key={hop.id}>
                <div className={`flex-1 p-3 rounded-xl border shadow-2xs transition-all ${isSsh ? 'bg-[#1c1b1f] text-white border-neutral-800' : 'bg-white text-neutral-900 border-neutral-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-bold ${isSsh ? 'text-emerald-400' : 'text-neutral-500'}`}>HOP {idx + 1} • {hop.type.toUpperCase()}</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${isSsh ? 'bg-neutral-800 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>{lat}</span>
                  </div>
                  <div className={`font-bold text-xs truncate ${isSsh ? 'text-white' : 'text-neutral-900'}`}>{hop.name}</div>
                  <div className={`text-[10px] font-mono truncate ${isSsh ? 'text-neutral-400' : 'text-neutral-400'}`}>{hop.host}:{hop.port}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
              </React.Fragment>
            );
          })}
          <div className="flex-1 bg-white p-3 rounded-xl border border-indigo-200 bg-indigo-50/30 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-indigo-700">DESTINATION</span>
              <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-mono font-bold">TUNNELED</span>
            </div>
            <div className="font-bold text-xs text-neutral-900 truncate">Target DB Gateway</div>
            <div className="text-[10px] font-mono text-indigo-600 truncate">{chain.target_addr}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
