import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  children: React.ReactNode;
}

const maxWidthStyles = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl' };

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, description, maxWidth = 'md', children }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className={`w-full ${maxWidthStyles[maxWidth]} bg-white rounded-2xl border border-neutral-200 shadow-2xl p-6 relative animate-in zoom-in-95 duration-150`}>
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer" aria-label="Close dialog">
          <X className="w-5 h-5" />
        </button>
        <div className="mb-5 pr-6">
          <h3 className="text-base font-bold text-neutral-900 leading-snug">{title}</h3>
          {description && <p className="text-xs text-neutral-500 mt-1">{description}</p>}
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};
