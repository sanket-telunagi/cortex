import React, { forwardRef } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  mono?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, mono = false, className = '', id, ...props }, ref) => {
    const areaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    return (
      <div className="w-full space-y-1">
        {label && <label htmlFor={areaId} className="block text-xs font-semibold text-neutral-700">{label}</label>}
        <textarea
          id={areaId}
          ref={ref}
          className={`w-full p-3 text-xs bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-800 placeholder-neutral-400 focus:outline-hidden focus:ring-1 focus:ring-neutral-400 focus:bg-white disabled:opacity-50 ${mono ? 'font-mono' : ''} ${error ? 'border-rose-300 focus:ring-rose-500' : ''} ${className}`}
          {...props}
        />
        {error && <p className="text-[11px] text-rose-600">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
