import React from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ tabs, activeTab, onChange, className = '' }: TabsProps<T>) {
  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-all duration-150 cursor-pointer select-none ${isActive ? 'bg-neutral-100 text-neutral-900 font-semibold shadow-2xs' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'}`}
          >
            {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${isActive ? 'bg-neutral-200 text-neutral-800' : 'bg-neutral-100 text-neutral-500'}`}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
