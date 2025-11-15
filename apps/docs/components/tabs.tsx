'use client';

import { ReactNode, useState } from 'react';
import { cn } from '@repo/ui/lib/utils';

interface Tab {
  label: string;
  value: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultValue?: string;
}

export function Tabs({ tabs, defaultValue }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue || tabs[0]?.value);

  const activeContent = tabs.find(tab => tab.value === activeTab)?.content;

  return (
    <div className="my-6">
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              'border-b-2 -mb-px',
              activeTab === tab.value
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-4">
        {activeContent}
      </div>
    </div>
  );
}

interface CodeTabsProps {
  children: ReactNode;
}

export function CodeTabs({ children }: CodeTabsProps) {
  return (
    <div className="my-6">
      {children}
    </div>
  );
}

