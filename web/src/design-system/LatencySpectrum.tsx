import React from 'react';

export interface LatencyBarItem {
  id: string;
  name: string;
  lightColor: string;
  darkColor: string;
  textColor: string;
  h1: string;
  h2: string;
  latencyMs?: number;
}

export interface LatencySpectrumProps {
  avgLatency?: string;
  items?: LatencyBarItem[];
  className?: string;
}

const defaultBars: LatencyBarItem[] = [
  { id: 'direct', name: 'Direct', lightColor: 'bg-[#c4b5fd]', darkColor: 'bg-[#8b5cf6]', textColor: 'text-purple-700', h1: 'h-6', h2: 'h-10' },
  { id: 'proxy', name: 'Proxy', lightColor: 'bg-[#7dd3fc]', darkColor: 'bg-[#0284c7]', textColor: 'text-sky-700', h1: 'h-5', h2: 'h-12' },
  { id: 'ssh', name: 'SSH', lightColor: 'bg-[#6ee7b7]', darkColor: 'bg-[#10b981]', textColor: 'text-emerald-700', h1: 'h-7', h2: 'h-11' },
  { id: 'db', name: 'DB', lightColor: 'bg-[#fde68a]', darkColor: 'bg-[#f59e0b]', textColor: 'text-amber-700', h1: 'h-6', h2: 'h-8' },
  { id: 'mcp', name: 'MCP', lightColor: 'bg-[#fca5a5]', darkColor: 'bg-[#ef4444]', textColor: 'text-rose-700', h1: 'h-9', h2: 'h-12' },
];

export const LatencySpectrum: React.FC<LatencySpectrumProps> = ({ avgLatency = '1.8ms avg', items = defaultBars, className = '' }) => (
  <div className={`flex flex-col justify-between h-28 pr-2 select-none ${className}`}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-bold text-neutral-900">Per-Hop Latency Spectrum</span>
      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        {avgLatency}
      </span>
    </div>
    <div className="flex items-end space-x-2 h-20 text-[9px] text-neutral-500 font-medium">
      <div className="flex flex-col justify-between h-14 pb-4 pr-1 text-right text-[8px] text-neutral-400 select-none font-mono">
        <span>20ms</span><span>10ms</span><span>0ms</span>
      </div>
      {items.map((bar) => (
        <div key={bar.id} className="flex flex-col items-center flex-1">
          <div className="flex space-x-1 items-end h-14">
            <div className={`w-2.5 ${bar.h1} ${bar.lightColor} rounded-xs`} />
            <div className={`w-2.5 ${bar.h2} ${bar.darkColor} rounded-xs shadow-2xs`} />
          </div>
          <span className={`mt-1.5 text-[9px] font-semibold ${bar.textColor}`}>{bar.name}</span>
        </div>
      ))}
    </div>
  </div>
);
