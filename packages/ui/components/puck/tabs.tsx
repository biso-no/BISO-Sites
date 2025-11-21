import type React from "react";
import {
  TabsContent,
  TabsList,
  Tabs as TabsRoot,
  TabsTrigger,
} from "../ui/tabs";

export type TabsProps = {
  tabs: { label: string; value: string }[];
  children?: React.ReactNode;
  // Slots passed from Puck
  tab0?: React.ReactNode;
  tab1?: React.ReactNode;
  tab2?: React.ReactNode;
  tab3?: React.ReactNode;
  ref?: React.RefObject<HTMLDivElement>;
};

export function Tabs({ tabs = [], tab0, tab1, tab2, tab3, ref }: TabsProps) {
  const contentMap = [tab0, tab1, tab2, tab3];
  const validTabs = tabs.slice(0, 4); // Limit to 4 for now based on slots

  if (!validTabs.length) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
        Add tabs to configure content
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <TabsRoot className="w-full" defaultValue={validTabs[0]?.value} ref={ref}>
        <div className="mb-8 flex justify-center">
          <TabsList className="h-auto w-full rounded-full bg-muted/50 p-1 sm:w-auto">
            {validTabs.map((tab) => (
              <TabsTrigger
                className="rounded-full px-6 py-3 font-medium text-sm transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
                key={tab.value}
                value={tab.value}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {validTabs.map((tab, index) => (
          <TabsContent className="mt-0" key={tab.value} value={tab.value}>
            {contentMap[index]}
          </TabsContent>
        ))}
      </TabsRoot>
    </div>
  );
}
