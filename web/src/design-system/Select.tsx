import React, { forwardRef } from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className = '', id, children, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    return (
      <div className="w-full space-y-1">
        {label && <label htmlFor={selectId} className="block text-xs font-semibold text-neutral-700">{label}</label>}
        <select
          id={selectId}
          ref={ref}
          className={`w-full px-3 py-2 text-xs bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-800 font-semibold focus:outline-hidden focus:ring-1 focus:ring-neutral-400 focus:bg-white disabled:opacity-50 ${error ? 'border-rose-300 focus:ring-rose-500' : ''} ${className}`}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-[11px] text-rose-600">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';
