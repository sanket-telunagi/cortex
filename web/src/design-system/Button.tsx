import React, { forwardRef } from 'react';
import { ButtonVariant, ButtonSize } from './types';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-[#1c1b1f] hover:bg-neutral-800 active:bg-neutral-900 text-white shadow-xs focus-visible:ring-neutral-900',
  secondary: 'bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-800 focus-visible:ring-neutral-400',
  outline: 'bg-white hover:bg-neutral-50 active:bg-neutral-100 text-neutral-700 border border-neutral-200/80 shadow-2xs focus-visible:ring-neutral-400',
  ghost: 'bg-transparent hover:bg-neutral-100 active:bg-neutral-200 text-neutral-700 focus-visible:ring-neutral-400',
  danger: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs focus-visible:ring-rose-600',
  success: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs focus-visible:ring-emerald-600',
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-[11px] rounded-lg gap-1 font-medium',
  sm: 'px-3 py-1.5 text-xs rounded-xl gap-1.5 font-semibold',
  md: 'px-4 py-2 text-xs rounded-xl gap-2 font-semibold',
  lg: 'px-5 py-2.5 text-sm rounded-xl gap-2.5 font-semibold',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'sm', icon, iconRight, loading = false, fullWidth = false, className = '', disabled, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center select-none transition-all duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${variantStyles[variant]} ${sizeStyles[size]} ${fullWidth ? 'w-full ' : ''}${className}`}
      {...props}
    >
      {loading ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" /> : icon ? <span className="flex-shrink-0 flex items-center justify-center">{icon}</span> : null}
      {children && <span>{children}</span>}
      {!loading && iconRight && <span className="flex-shrink-0 flex items-center justify-center">{iconRight}</span>}
    </button>
  )
);
Button.displayName = 'Button';
