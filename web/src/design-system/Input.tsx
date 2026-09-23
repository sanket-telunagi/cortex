import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, iconRight, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    return (
      <div className="w-full space-y-1">
        {label && <label htmlFor={inputId} className="block text-xs font-semibold text-neutral-700">{label}</label>}
        <div className="relative flex items-center">
          {icon && <span className="absolute left-3 text-neutral-400 pointer-events-none flex items-center justify-center">{icon}</span>}
          <input
            id={inputId}
            ref={ref}
            className={`w-full text-xs bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-800 placeholder-neutral-400 transition-colors focus:outline-hidden focus:ring-1 focus:ring-neutral-400 focus:bg-white disabled:opacity-50 disabled:bg-neutral-100 ${icon ? 'pl-9' : 'pl-3'} ${iconRight ? 'pr-9' : 'pr-3'} py-2 ${error ? 'border-rose-300 focus:ring-rose-500' : ''} ${className}`}
            {...props}
          />
          {iconRight && <span className="absolute right-3 text-neutral-400 pointer-events-none flex items-center justify-center">{iconRight}</span>}
        </div>
        {error && <p className="text-[11px] text-rose-600">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
