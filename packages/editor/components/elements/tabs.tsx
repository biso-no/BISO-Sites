import { Tabs, TabsList, TabsTrigger, TabsContent } from "@repo/ui/components/ui/tabs";
import type { TabsElementProps } from "../../types";

export function TabsElement({ id, tabs, defaultTab }: TabsElementProps) {
  if (tabs.length === 0) {
    return (
      <div id={id} className="text-center text-gray-500 p-6 border rounded-lg">
        Add tabs in the settings
      </div>
    );
  }

  return (
    <Tabs id={id} defaultValue={defaultTab || tabs[0]?.id}>
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id}>
          <div className="prose max-w-none">{tab.content}</div>
        </TabsContent>
      ))}
    </Tabs>
  );
}

