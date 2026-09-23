import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  dark?: boolean;
}

export const Card: React.FC<CardProps> = ({ hoverable = false, dark = false, className = '', children, ...props }) => (
  <div className={`rounded-2xl transition-all duration-150 overflow-hidden ${dark ? 'bg-[#1c1b1f] text-white border border-neutral-800 shadow-md' : 'bg-white text-neutral-900 border border-neutral-200/80 shadow-xs'} ${hoverable ? 'hover:shadow-md hover:border-neutral-300' : ''} ${className}`} {...props}>
    {children}
  </div>
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => (
  <div className={`px-5 py-4 border-b border-neutral-100 flex items-center justify-between ${className}`} {...props}>{children}</div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className = '', children, ...props }) => (
  <h3 className={`text-sm font-bold text-neutral-900 flex items-center gap-2 ${className}`} {...props}>{children}</h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className = '', children, ...props }) => (
  <p className={`text-xs text-neutral-500 ${className}`} {...props}>{children}</p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => (
  <div className={`p-5 ${className}`} {...props}>{children}</div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => (
  <div className={`px-5 py-3 border-t border-neutral-100 bg-neutral-50/50 flex items-center justify-between text-xs ${className}`} {...props}>{children}</div>
);
