"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { Newspaper, ShoppingBag, Target, Users } from "lucide-react";
import { useState } from "react";
import type { DepartmentTranslation } from "@/lib/actions/departments";
import { NewsTab } from "./news-tab";
import { OverviewTab } from "./overview-tab";
import { ProductsTab } from "./products-tab";
import { TeamTab } from "./team-tab";

type DepartmentTabsClientProps = {
  department: DepartmentTranslation;
  isMember: boolean;
};

export function DepartmentTabsClient({
  department,
  isMember,
}: DepartmentTabsClientProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    { value: "overview", label: "Overview", icon: Target },
    { value: "team", label: "Our Team", icon: Users },
    { value: "news", label: "News & Updates", icon: Newspaper },
    { value: "products", label: "Products & Tickets", icon: ShoppingBag },
  ];

  return (
    <>
      {/* Sticky Tab Navigation */}
      <div className="sticky top-0 z-40 border-border border-b bg-background shadow-sm">
        <div className="mx-auto max-w-7xl px-4">
          <Tabs onValueChange={setActiveTab} value={activeTab}>
            <TabsList className="grid h-auto w-full grid-cols-4 justify-start rounded-none border-0 bg-transparent p-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    className="rounded-none px-6 py-5 font-medium text-base text-muted-foreground transition-colors hover:text-[#3DA9E0] data-[state=active]:border-[#3DA9E0] data-[state=active]:border-b-2 data-[state=active]:bg-transparent data-[state=active]:text-[#3DA9E0]"
                    key={tab.value}
                    value={tab.value}
                  >
                    <Icon className="mr-2 h-5 w-5" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mx-auto max-w-7xl px-4">
        <Tabs onValueChange={setActiveTab} value={activeTab}>
          <TabsContent className="py-12" value="overview">
            <OverviewTab department={department} />
          </TabsContent>

          <TabsContent className="py-12" value="team">
            <TeamTab department={department} />
          </TabsContent>

          <TabsContent className="py-12" value="news">
            <NewsTab news={department.news || []} />
          </TabsContent>

          <TabsContent className="py-12" value="products">
            <ProductsTab
              isMember={isMember}
              products={department.products || []}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
