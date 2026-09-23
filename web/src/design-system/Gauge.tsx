import React from 'react';

export interface GaugeProps {
  percentage?: number;
  label?: string;
  sublabel?: string;
  className?: string;
}

export const Gauge: React.FC<GaugeProps> = ({ percentage = 99.8, label = '99.8%', sublabel = 'Tunnel Reliability', className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-end relative select-none ${className}`}>
      <div className="relative w-48 h-24 flex items-end justify-center">
        <svg className="w-48 h-24 absolute inset-0 overflow-visible" viewBox="0 0 200 105">
          <defs>
            <linearGradient id="ds-rainbow-wheel" x1="0%" x2="100%" y1="100%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="25%" stopColor="#f59e0b" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="75%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <path d="M 18 100 A 82 82 0 0 1 182 100" fill="none" stroke="#f1f0e9" strokeDasharray="1.5 3" strokeLinecap="butt" strokeWidth="12" />
          <path d="M 18 100 A 82 82 0 0 1 182 100" fill="none" pathLength="100" stroke="url(#ds-rainbow-wheel)" strokeDasharray="1.5 3" strokeDashoffset={Math.max(0, 100 - percentage)} strokeLinecap="butt" strokeWidth="12" />
        </svg>
        <div className="flex flex-col items-center justify-end text-center z-10 pb-1">
          <span className="text-3xl font-extrabold text-neutral-900 tracking-tight leading-none mb-1">{label}</span>
          <div className="flex items-center space-x-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{sublabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
