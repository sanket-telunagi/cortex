import React from 'react';
import { BadgeVariant } from './types';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
  pulse?: boolean;
}

const badgeVariants: Record<BadgeVariant, string> = {
  admin: 'bg-purple-100 text-purple-700 border border-purple-200/80',
  engineer: 'bg-sky-100 text-sky-700 border border-sky-200/80',
  viewer: 'bg-amber-100 text-amber-700 border border-amber-200/80',
  mcp_agent: 'bg-emerald-100 text-emerald-700 border border-emerald-200/80',
  online: 'bg-emerald-100 text-emerald-800 border border-emerald-200/80',
  degraded: 'bg-amber-100 text-amber-800 border border-amber-200/80',
  offline: 'bg-rose-100 text-rose-800 border border-rose-200/80',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200/60',
  neutral: 'bg-neutral-100 text-neutral-600 border border-neutral-200/80',
  info: 'bg-sky-50 text-sky-700 border border-sky-200/60',
  purple: 'bg-purple-50 text-purple-700 border border-purple-200/60',
  sky: 'bg-sky-50 text-sky-700 border border-sky-200/60',
  emerald: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
  amber: 'bg-amber-50 text-amber-700 border border-amber-200/60',
  rose: 'bg-rose-50 text-rose-700 border border-rose-200/60',
};

const dotColors: Record<BadgeVariant, string> = {
  admin: 'bg-purple-500', engineer: 'bg-sky-500', viewer: 'bg-amber-500', mcp_agent: 'bg-emerald-500',
  online: 'bg-emerald-500', degraded: 'bg-amber-500', offline: 'bg-rose-500', success: 'bg-emerald-500',
  warning: 'bg-amber-500', neutral: 'bg-neutral-400', info: 'bg-sky-500', purple: 'bg-purple-500',
  sky: 'bg-sky-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500',
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', dot = false, pulse = false, className = '', children, ...props }) => (
  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight select-none ${badgeVariants[variant]} ${className}`} {...props}>
    {dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColors[variant]} ${pulse ? 'animate-pulse' : ''}`} />}
    <span>{children}</span>
  </span>
);
