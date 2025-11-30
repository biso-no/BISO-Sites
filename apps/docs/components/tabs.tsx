"use client";

import { cn } from "@repo/ui/lib/utils";
import { type ReactNode, useState } from "react";

type Tab = {
  label: string;
  value: string;
  content: ReactNode;
};

type TabsProps = {
  tabs: Tab[];
  defaultValue?: string;
};

export function Tabs({ tabs, defaultValue }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue || tabs[0]?.value);

  const activeContent = tabs.find((tab) => tab.value === activeTab)?.content;

  return (
    <div className="my-6">
      <div className="flex border-gray-200 border-b dark:border-gray-800">
        {tabs.map((tab) => (
          <button
            className={cn(
              "px-4 py-2 font-medium text-sm transition-colors",
              "-mb-px border-b-2",
              activeTab === tab.value
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            )}
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-4">{activeContent}</div>
    </div>
  );
}

type CodeTabsProps = {
  children: ReactNode;
};

export function CodeTabs({ children }: CodeTabsProps) {
  return <div className="my-6">{children}</div>;
}
