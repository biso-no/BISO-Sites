import React from "react";
import { Tabs as TabsRoot, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { cn } from "../../lib/utils";

export interface TabsProps {
  tabs: { label: string; value: string }[];
  children?: React.ReactNode;
  // Slots passed from Puck
  tab0?: React.ReactNode;
  tab1?: React.ReactNode;
  tab2?: React.ReactNode;
  tab3?: React.ReactNode;
  ref?: React.RefObject<HTMLDivElement>;
}

export function Tabs({ tabs = [], tab0, tab1, tab2, tab3, ref }: TabsProps) {
  const contentMap = [tab0, tab1, tab2, tab3];
  const validTabs = tabs.slice(0, 4); // Limit to 4 for now based on slots

  if (!validTabs.length) {
    return (
      <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground">
        Add tabs to configure content
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <TabsRoot ref={ref} defaultValue={validTabs[0]?.value} className="w-full">
        <div className="flex justify-center mb-8">
          <TabsList className="w-full sm:w-auto h-auto p-1 bg-muted/50 rounded-full">
            {validTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-full px-6 py-3 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        
        {validTabs.map((tab, index) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-0">
            {contentMap[index]}
          </TabsContent>
        ))}
      </TabsRoot>
    </div>
  );
}
